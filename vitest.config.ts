import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { mergeConfig } from 'vite';
import baseConfig from './vite.config';

/**
 * Default Vitest config — invoked by `npm test` and `npm run test:watch`.
 *
 * Purpose: combined unit + integration run so single-shell dev loops still see
 * both layers. The dedicated `vitest.unit.config.ts` and
 * `vitest.integration.config.ts` files tighten the include globs for CI
 * (`test:unit`, `test:integration`, `test:smoke`).
 *
 *   `npm test`           → unit + integration (this file)
 *   `npm run test:unit`  → unit-only (see vitest.unit.config.ts)
 *   `npm run test:integration` → integration-only (preserved file)
 *   `npm run test:smoke` → curated subset (see scripts/run-smoke.mjs)
 *   `npm run test:e2e`   → Playwright only (separate runner)
 */
export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.{ts,tsx}',
    ],
    // E2E specs live under `tests/e2e/**` and run via Playwright, not Vitest.
    // Keep them explicitly excluded so they never enter a Vitest run, even if
    // a developer (or another agent) accidentally imports a `*.spec.ts` file.
    exclude: [
      '**/node_modules/**',
      'dist/**',
      '.git/**',
      'tests/e2e/**',
      'tests/fixtures/**',
      'tests/mocks/**',
    ],
  },
}));
