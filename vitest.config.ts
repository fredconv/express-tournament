import { defineConfig } from 'vitest/config';

// Coverage instrumentation slows code down several times: timing assertions are only
// meaningful in plain runs (`npm test`), so they are skipped under `--coverage`.
const coverageRun = process.argv.includes('--coverage');

// Kept separate from vite.config.ts so unit tests do not start the Cloudflare plugin.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    env: { PERF_TESTS: coverageRun ? 'off' : 'on' },
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      // ROADMAP E1 DoD: domain line coverage >= 90 %.
      thresholds: { lines: 90 },
    },
  },
});
