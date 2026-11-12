import { Hono } from 'hono';
import { securityHeaders } from './securityHeaders';

export const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.use('*', securityHeaders);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled API error', err.message);
  return c.json({ error: 'internal_error' }, 500);
});

export default app;
