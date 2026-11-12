import { Hono } from 'hono';
import { securityHeaders } from './securityHeaders';

export const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.use('*', securityHeaders);

app.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return row?.ok === 1
    ? c.json({ status: 'ok', db: 'ok' })
    : c.json({ status: 'degraded', db: 'unavailable' }, 503);
});

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled API error', err.message);
  return c.json({ error: 'internal_error' }, 500);
});

export default app;
