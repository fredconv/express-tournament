import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so unit tests do not start the Cloudflare plugin.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      // ROADMAP E1 DoD: domain line coverage >= 90 %.
      thresholds: { lines: 90 },
    },
  },
});
