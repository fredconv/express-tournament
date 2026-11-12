import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { tournamentDocSchema } from '../src/domain/schemas';
import { bearerCode, hashCode, newOwnerCode, newPublicId, sameHash } from './auth';
import { findTournament, insertTournament, updateTournament } from './repository';

// Tournament API (ARCHITECTURE.md §7). Every write: Zod schema + schedule/score checks
// (inside the schema) → management code → version lock.

const MAX_BODY_BYTES = 100 * 1024;
const RETENTION_DAYS = 90;
const ID_PATTERN = /^[a-z2-9]{10}$/;

export const tournaments = new Hono<{ Bindings: Env }>();

const limit = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: (c) => c.json({ error: 'too_large' }, 413),
});

tournaments.post('/', limit, async (c) => {
  const parsed = tournamentDocSchema.safeParse(await readJson(c.req.raw));
  if (!parsed.success) return c.json({ error: 'invalid_document' }, 422);

  const id = newPublicId();
  const ownerToken = newOwnerCode();
  const now = new Date().toISOString();
  await insertTournament(c.env.DB, {
    id,
    ownerTokenHash: await hashCode(ownerToken),
    doc: JSON.stringify(parsed.data),
    now,
    expiresAt: expiresAt(parsed.data.date),
  });
  // The only response that ever contains the management code.
  return c.json({ id, ownerToken, version: 1 }, 201);
});

tournaments.get('/:id', async (c) => {
  const id = c.req.param('id');
  const stored = ID_PATTERN.test(id) ? await findTournament(c.env.DB, id) : null;
  if (!stored) return c.json({ error: 'not_found' }, 404);
  return c.json({
    doc: JSON.parse(stored.doc) as unknown,
    version: stored.version,
    updatedAt: stored.updatedAt,
  });
});

tournaments.put('/:id', limit, async (c) => {
  const code = bearerCode(c.req.header('Authorization'));
  if (!code) return c.json({ error: 'unauthorized' }, 401);
  const hash = await hashCode(code);

  const id = c.req.param('id');
  const stored = ID_PATTERN.test(id) ? await findTournament(c.env.DB, id) : null;
  if (!stored) return c.json({ error: 'not_found' }, 404);
  if (!sameHash(hash, stored.ownerTokenHash)) return c.json({ error: 'unauthorized' }, 401);

  const version = Number(c.req.header('If-Match'));
  if (!Number.isInteger(version) || version < 1) {
    return c.json({ error: 'version_required' }, 428);
  }
  const parsed = tournamentDocSchema.safeParse(await readJson(c.req.raw));
  if (!parsed.success) return c.json({ error: 'invalid_document' }, 422);

  const updated = await updateTournament(c.env.DB, {
    id,
    version,
    doc: JSON.stringify(parsed.data),
    now: new Date().toISOString(),
    expiresAt: expiresAt(parsed.data.date),
  });
  if (!updated) return c.json({ error: 'conflict', version: stored.version }, 409);
  return c.json({ version: version + 1 });
});

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Decision D6: kept 90 days after the tournament date. */
function expiresAt(date: string): string {
  const expiry = new Date(`${date}T00:00:00Z`);
  expiry.setUTCDate(expiry.getUTCDate() + RETENTION_DAYS);
  return expiry.toISOString();
}
