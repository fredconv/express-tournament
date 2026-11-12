import { describe, expect, it } from 'vitest';
import { app } from '../../worker/index';

// Minimal stand-in for D1: health only needs prepare().first().
// Real D1 integration tests arrive with the API in E3.
function fakeDb(result: { ok: number } | null): D1Database {
  return {
    prepare: () => ({ first: async () => result }),
  } as unknown as D1Database;
}

function failingDb(): D1Database {
  return {
    prepare: () => ({
      first: async () => {
        throw new Error('D1 unreachable');
      },
    }),
  } as unknown as D1Database;
}

describe('GET /api/health', () => {
  it('returns ok with security headers when D1 answers', async () => {
    const res = await app.request('/api/health', {}, { DB: fakeDb({ ok: 1 }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok' });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('returns 503 when D1 returns no row', async () => {
    const res = await app.request('/api/health', {}, { DB: fakeDb(null) });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'degraded', db: 'unavailable' });
  });

  it('returns a generic 500 without leaking the error when D1 throws', async () => {
    const res = await app.request('/api/health', {}, { DB: failingDb() });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error' });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await app.request('/api/unknown', {}, { DB: fakeDb({ ok: 1 }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
