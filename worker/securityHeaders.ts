import type { MiddlewareHandler } from 'hono';

// API responses only; static assets get their headers from public/_headers.
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Robots-Tag', 'noindex');
  c.header('Cache-Control', 'no-store');
};
