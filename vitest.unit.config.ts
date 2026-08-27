import { defineConfig, mergeConfig } from 'vitest/config';
import { resolve } from 'path';
import baseConfig from './vite.config';

/**
 * `npm run test:unit` — unit-only Vitest run.
 *
 * Globs `tests/unit/**` (Vitest test files) and explicitly excludes
 * `tests/integration/**`, `tests/e2e/**`, `tests/probe.test.ts`, mocks,
 * and fixtures. The probe test is intentionally de-scoped because it
 * imports deep BE-coupled services and was designed for ad-hoc
 * debugging, not the CI gate.
 *
 * Anything added to `tests/unit/**` is automatically picked up here —
 * no include-pattern edits required when new unit tests land.
 */
export default mergeConfig(baseConfig, defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: resolve(__dirname, 'tests/setup.ts'),
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      'dist/**',
      '.git/**',
      'tests/integration/**',
      'tests/e2e/**',
      'tests/probe.test.ts',
      'tests/mocks/**',
      'tests/fixtures/**',
    ],
  },
}));
