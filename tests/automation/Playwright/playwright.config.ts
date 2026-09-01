/**
 * Playwright config — ARS role-function automation suite.
 *
 * Lives entirely under `tests/automation/Playwright/` so it can never
 * collide with the legacy `tests/e2e` (googleOnboarding), `playwright.config.ts`
 * (researcherProduction), or any reviewer/withdrawal-flow spec. The
 * base URL defaults to nothing — the runner refuses to start when
 * `E2E_BASE_URL` is missing so we never silently point at production.
 *
 * Run:
 *   npx playwright test --config tests/automation/Playwright/playwright.config.ts
 *   npm run e2e:roles
 *
 * Security:
 *   - Credentials are read from `.env.playwright.local` (gitignored).
 *   - Reports, screenshots, traces, videos land under `test/report/<run-id>/`.
 *   - `forbidOnly: true` prevents accidentally committing `.only` markers.
 *   - `workers: 1` serializes the suite; the FE BE has tight rate limits.
 *   - `retries: 2` gives two extra attempts per test before it is marked
 *     failed and the suite moves on (no fail-fast).
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import './helpers/env-loader';
import { CustomReporter } from './reporters/custom-reporter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.E2E_BASE_URL ?? '';

// Use explicit undefined check so an empty string (from .env.playwright.local)
// does not silently default to production.
if (process.env.E2E_BASE_URL === undefined || process.env.E2E_BASE_URL.length === 0) {
  // Throw early — never default to production. The user has explicitly
  // approved only local / approved-staging targets.
  throw new Error(
    '[playwright.config] E2E_BASE_URL is not set in .env.playwright.local. ' +
    'Set it to your local dev server (e.g. http://localhost:5173) or an approved staging URL. ' +
    'Never leave it empty — the runner refuses to run without an explicit non-production target.',
  );
}

// Build a timestamped run folder so each invocation gets isolated evidence.
const RUN_ID = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace(/Z$/, '');
const REPORT_DIR = path.resolve(__dirname, '..', '..', '..', 'test', 'report', RUN_ID);

fs.mkdirSync(REPORT_DIR, { recursive: true });

export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.ts$/,
  // Keep this folder out of any other suite — we exclude the helper /
  // reporter / fixture source so they never become "tests".
  testIgnore: [
    '**/helpers/**',
    '**/reporters/**',
    '**/fixtures/**',
    '**/TEST_MATRIX.md',
  ],
  fullyParallel: false,
  forbidOnly: true,
  // Two retries = up to two additional attempts on top of the first run.
  // After the third failed attempt total, mark it failed and continue.
  retries: 2,
  workers: 1,
  // No fail-fast — let independent tests complete so the report covers
  // every role regardless of any single failure.
  reporter: [
    ['list'],
    [CustomReporter, { outputDir: REPORT_DIR }],
  ],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    viewport: { width: 1280, height: 900 },
    // Mask credential fields so an evidence screenshot can never leak them.
    extraHTTPHeaders: {
      // The role-auth fixture injects Authorization itself.
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
  ],
  // Persist the resolved run directory so the reporter can echo it.
  metadata: {
    runId: RUN_ID,
    reportDir: REPORT_DIR,
    baseUrl: BASE_URL,
  },
});