import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Playwright config — Agent 30 headed (manual) Google onboarding verification.
 *
 * Drives `tests/e2e/googleOnboarding.headed.spec.ts` against a local
 * `vite dev` server on `http://localhost:3000` with `headless: false` so a
 * human can complete the Google consent screen interactively. The test never
 * automates, enters, captures, or stores the Google password, cookies,
 * tokens, codes, or any private profile data.
 *
 * Run:
 *   npx playwright test --config=playwright.google-onboarding.headed.config.ts
 *
 * Target URL: http://localhost:3000 (the default Vite dev server port
 * declared in `vite.config.ts`). The webServer block starts `vite` on
 * exactly that port and Playwright auto-tears it down when the suite ends.
 */

const BASE_URL = 'http://localhost:3000';
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '.');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /googleOnboarding\.headed\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 240_000, // 4 minutes — enough time for manual Google consent
  expect: { timeout: 30_000 },
  webServer: {
    // vite dev (HMR) on the configured localhost:3000 port. We rely on Vite
    // honoring `server.port = 3000` from vite.config.ts. --strictPort makes
    // the run fail loudly if 3000 is already in use rather than silently
    // rolling to a different port.
    command: 'npx vite --port 3000 --strictPort --host localhost',
    url: BASE_URL,
    cwd: REPO_ROOT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // Default dev BE proxy target is localhost:5000, but the headed run
      // doesn't require a real BE — the spec mocks /api/Auth/google-login.
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:5000',
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    viewport: { width: 1366, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Headed mode — a real browser window opens so the user can complete
        // the Google consent screen interactively. The test never enters
        // the Google password programmatically.
        headless: false,
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
