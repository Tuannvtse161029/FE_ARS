import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — Vercel Live Site E2E
 *
 * Drives the production Researcher workflow smoke suite
 * (`src/tests/e2e/researcherProduction.spec.ts`) against the deployed SPA.
 *
 * Run:
 *   npm run e2e:production
 *   VITE_E2E_APP_URL=https://staging.example.com npm run e2e:production
 *
 * Notes:
 * - `workers: 1` because the prod BE has a small rate-limit budget.
 * - `testDir` + `testMatch` scope to the new spec only — the older vitest e2e
 *   files (`researcherUpload.e2e.test.ts`, `pdfRender.e2e.test.ts`) use raw
 *   `playwright` and continue to be run via `npm run test:e2e*`.
 */

const PROD_URL = process.env.VITE_E2E_APP_URL || 'https://fe-ars.vercel.app';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /researcherProduction\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: PROD_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Playwright E2E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Force headless. The chromium-headless-shell binary is installed by
        // `npx playwright install chromium` (lighter than full Chrome).
        // To run with a visible browser, override via CLI:
        //   npx playwright test --headed
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
});