import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Playwright config — Agent 30 first-time Google onboarding E2E.
 *
 * Drives `tests/e2e/googleOnboarding.spec.ts` against a local `vite preview`
 * server (no real Google account, no real BE). Mocked BE responses are
 * injected through `page.route()` so the suite runs offline.
 *
 * Run:
 *   npx playwright test --config=playwright.google-onboarding.config.ts
 *
 * Requires a fresh production build: `npm run build`.
 */

const BASE_URL = process.env.VITE_E2E_APP_URL || 'http://127.0.0.1:4173';
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '.');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /googleOnboarding\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  webServer: {
    // vite preview serves the production build we created above.
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: BASE_URL,
    cwd: REPO_ROOT,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || BASE_URL,
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    viewport: { width: 1366, height: 900 },
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