import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — Researcher → Reviewer E2E flow.
 *
 * Scope: drives the new `researcherReviewerMainFlow.spec.ts` end-to-end journey
 *       (Researcher uploads PDF → requests Review → Reviewer evaluates → back to
 *       Researcher for verification).
 *
 * IMPORTANT — financial safety override (2026-08-18):
 *   The Researcher test wallet cannot cover the 25,000 VND system processing fee,
 *   and wallet/database insertion is locked by the backend. This config therefore
 *   runs the spec in INTERCEPTED mode (Mode A) by default. Only when
 *   `E2E_RUN_LIVE_REVIEW_FLOW=true` does the spec attempt to hit the real BE.
 *
 *   The existing `playwright.config.ts` (which scopes to `researcherProduction
 *   .spec.ts` only) is untouched. This config does NOT match the production
 *   spec pattern.
 *
 * Run:
 *   npm run e2e:researcher-reviewer
 *   npm run e2e:researcher-reviewer:list
 *   npm run e2e:researcher-reviewer:ui
 */

const BASE_URL = process.env.VITE_E2E_APP_URL || 'https://fe-ars.vercel.app';

export default defineConfig({
  testDir: './src/tests/e2e',
  // Preflight must run before the main flow (per addendum §G).
  testMatch:
    /researcherReviewerPreflight\.spec\.ts$|researcherReviewerMainFlow\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (Playwright E2E ResearcherReviewer) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
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
});