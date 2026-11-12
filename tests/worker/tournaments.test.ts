import { beforeEach, describe, expect, it } from 'vitest';
import { addTeams, createDraft, generate, setResult } from '../../src/app/draft/model';
import { toDoc } from '../../src/app/draft/publish';
import type { TournamentDoc } from '../../src/domain/schemas';
import { app } from '../../worker/index';
import { sqliteD1 } from './sqliteD1';

function sampleDoc(): TournamentDoc {
  let n = 0;
  const ids = (prefix: string) => `${prefix}${++n}`;
  const base = { ...createDraft('2026-06-20', ids, 'now'), name: 'Beach' };
  const names = Array.from({ length: 13 }, (_, i) => `Équipe ${i + 1}`).join('\n');
  const draft = generate(addTeams(base, names, ids).draft, 5);
  const first = draft.schedule?.matches[0]?.id as string;
  return toDoc(
    setResult(draft, first, [
      { a: 21, b: 15 },
      { a: 21, b: 18 },
    ]),
  );
}

let env: { DB: D1Database };
beforeEach(() => {
  env = { DB: sqliteD1() };
});

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const put = (body: unknown, headers: Record<string, string>) => ({
  ...json(body, headers),
  method: 'PUT',
});

async function create(doc = sampleDoc()) {
  const res = await app.request('/api/tournaments', json(doc), env);
  return { res, body: (await res.json()) as { id: string; ownerToken: string; version: number } };
}

describe('POST /api/tournaments', () => {
  it('creates a tournament and returns the management code once', async () => {
    const { res, body } = await create();
    expect(res.status).toBe(201);
    expect(body.id).toMatch(/^[a-z2-9]{10}$/);
    expect(body.ownerToken.length).toBeGreaterThanOrEqual(26);
    expect(body.version).toBe(1);
  });

  it('CA9.2: stores only the hash of the management code', async () => {
    const { body } = await create();
    const row = (await env.DB.prepare('SELECT * FROM tournaments').bind().first()) as Record<
      string,
      string
    >;
    expect(JSON.stringify(row)).not.toContain(body.ownerToken);
    expect(row.owner_token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('CA3.3: rejects invalid documents with 422', async () => {
    const doc = sampleDoc();
    const forged = structuredClone(doc);
    (forged.morning.matches[0] as { teamAId: string }).teamAId = 'ghost';
    const badScore = { ...doc, results: { m1: [{ a: 21, b: 21 }] } };
    const crossPool = structuredClone(doc);
    const [p1, p2] = crossPool.morning.pools;
    if (p1 && p2)
      [p1.teamIds[0], p2.teamIds[0]] = [p2.teamIds[0] as string, p1.teamIds[0] as string];
    for (const invalid of [null, {}, { ...doc, name: '' }, forged, badScore, crossPool]) {
      const res = await app.request('/api/tournaments', json(invalid), env);
      expect(res.status).toBe(422);
    }
  });

  it('rejects bodies over 100 KB with 413', async () => {
    const res = await app.request('/api/tournaments', json({ x: 'a'.repeat(110_000) }), env);
    expect(res.status).toBe(413);
  });
});

describe('GET /api/tournaments/:id', () => {
  it('returns the public document without any secret', async () => {
    const doc = sampleDoc();
    const { body } = await create(doc);
    const res = await app.request(`/api/tournaments/${body.id}`, {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(body.ownerToken);
    expect(JSON.parse(text)).toMatchObject({ doc, version: 1 });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('CA9.4: unknown tournament → 404', async () => {
    for (const id of ['abcdefghjk', 'not-an-id']) {
      expect((await app.request(`/api/tournaments/${id}`, {}, env)).status).toBe(404);
    }
  });
});

describe('PUT /api/tournaments/:id', () => {
  it('updates with the management code and the current version', async () => {
    const { body } = await create();
    const doc = { ...sampleDoc(), name: 'Beach renommé' };
    const auth = { Authorization: `Bearer ${body.ownerToken}`, 'If-Match': '1' };
    const res = await app.request(`/api/tournaments/${body.id}`, put(doc, auth), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 2 });
    const read = await app.request(`/api/tournaments/${body.id}`, {}, env);
    expect(await read.json()).toMatchObject({ doc: { name: 'Beach renommé' }, version: 2 });
  });

  it('CA9.1: no code, a wrong code or the code of another tournament → 401', async () => {
    const { body } = await create();
    const other = await create();
    const doc = sampleDoc();
    for (const headers of [
      { 'If-Match': '1' },
      { Authorization: 'Bearer wrong-code-0123456789', 'If-Match': '1' },
      { Authorization: `Bearer ${other.body.ownerToken}`, 'If-Match': '1' },
    ]) {
      const res = await app.request(`/api/tournaments/${body.id}`, put(doc, headers), env);
      expect(res.status).toBe(401);
    }
  });

  it('CA9.3: a write based on an outdated version → 409', async () => {
    const { body } = await create();
    const auth = (v: string) => ({ Authorization: `Bearer ${body.ownerToken}`, 'If-Match': v });
    const url = `/api/tournaments/${body.id}`;
    expect((await app.request(url, put(sampleDoc(), auth('1')), env)).status).toBe(200);
    const stale = await app.request(url, put(sampleDoc(), auth('1')), env);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'conflict', version: 2 });
  });

  it('requires a version, a valid document and an existing tournament', async () => {
    const { body } = await create();
    const auth = { Authorization: `Bearer ${body.ownerToken}` };
    const url = `/api/tournaments/${body.id}`;
    expect((await app.request(url, put(sampleDoc(), auth), env)).status).toBe(428);
    const invalid = put({ ...sampleDoc(), teams: [] }, { ...auth, 'If-Match': '1' });
    expect((await app.request(url, invalid, env)).status).toBe(422);
    const missing = put(sampleDoc(), { ...auth, 'If-Match': '1' });
    expect((await app.request('/api/tournaments/abcdefghjk', missing, env)).status).toBe(404);
  });
});
