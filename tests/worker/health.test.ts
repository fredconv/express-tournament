import { describe, expect, it } from 'vitest';
import { app } from '../../worker/index';

describe('GET /api/health', () => {
  it('returns ok with security headers', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await app.request('/api/unknown');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
