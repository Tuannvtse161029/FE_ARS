import { resolve } from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vite.config';

/**
 * `npm run test:integration` — integration-only Vitest run.
 *
 * Scoped to `tests/integration/**` to keep `test:unit` and `test:integration`
 * cleanly separated in CI. Excludes Playwright specs and the ad-hoc probe so a
 * future drift in `tests/integration/**` cannot pull in unit or e2e tests
 * accidentally.
 *
 * NOTE: this file was originally created by agent-7 (reviewer-withdrawal)
 * and has been deliberately preserved. Only include/exclude patterns were
 * tightened for clean separation.
 */
export default mergeConfig(baseConfig, defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: resolve(__dirname, 'tests/setup.ts'),
    include: ['tests/integration/**'],
    exclude: [
      '**/node_modules/**',
      'dist/**',
      '.git/**',
      'tests/e2e/**',
      'tests/unit/**',
      'tests/probe.test.ts',
      'tests/mocks/**',
      'tests/fixtures/**',
    ],
    /**
     * `passWithNoTests: true` — the `tests/integration/` directory is empty
     * at the time of writing. CI jobs that invoke this script (nightly /
     * release) should NOT fail loudly the very first time they run with an
     * empty integration layer; the failure mode intended for affected
     * selection (see `scripts/run-affected-tests.mjs`) is a different exit
     * code entirely. Once a real integration test is added, this stays
     * `true` because there is no harm in a no-op for an empty directory —
     * the failure that matters is the one that fires when an integration
     * test exists but its assertions fail.
     */
    passWithNoTests: true,
  },
}));
