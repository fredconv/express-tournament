import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so unit tests do not start the Cloudflare plugin.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
