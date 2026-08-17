import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — Reviewer Withdrawal E2E flow (Agent 7).
 *
 * Scope: drives `src/tests/e2e/reviewerWithdrawalMainFlow.spec.ts` —
 *       Reviewer creates a zero-VND withdrawal → Admin sees it →
 *       Admin approves & uploads a receipt → Admin completes →
 *       Reviewer sees the completed status.
 *
 * IMPORTANT — financial-safety override (2026-08-18, lead directive):
 *   The Reviewer test wallet cannot cover a real withdrawal, and the
 *   Admin surface reads from a separate in-memory mock store (see
 *   `src/services/admin.service.ts:28`, `USE_MOCK_DATA = true`) that does
 *   NOT share state with the Reviewer endpoint. The spec therefore runs
 *   in INTERCEPTED mode (Mode A) by default. Only when
 *   `E2E_RUN_LIVE_WITHDRAWAL_FLOW=true` does the spec attempt to hit the
 *   real BE.
 *
 *   The existing `playwright.config.ts` (which scopes to
 *   `researcherProduction.spec.ts` only) and
 *   `playwright.reviewer-flow.config.ts` (which scopes to Agent 6's
 *   `researcherReviewerMainFlow.spec.ts`) are both untouched. This config
 *   does NOT match either of their patterns.
 *
 * Run:
 *   npm run e2e:reviewer-withdrawal
 *   npm run e2e:reviewer-withdrawal:list
 *   npm run e2e:reviewer-withdrawal:ui
 *
 * Env (all optional unless live mode is on):
 *   E2E_REVIEWER_EMAIL         — Reviewer login email
 *   E2E_REVIEWER_PASSWORD      — Reviewer login password
 *   E2E_ADMIN_EMAIL            — Admin login email
 *   E2E_ADMIN_PASSWORD         — Admin login password
 *   E2E_RUN_LIVE_WITHDRAWAL_FLOW — "true" to disable network interception
 *   VITE_E2E_APP_URL           — base URL override (defaults to prod)
 */

const BASE_URL = process.env.VITE_E2E_APP_URL || 'https://fe-ars.vercel.app';

export default defineConfig({
  testDir: './src/tests/e2e',
  testMatch: /reviewerWithdrawalMainFlow\.spec\.ts$/,
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
      'Mozilla/5.0 (Playwright E2E ReviewerWithdrawal) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
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
