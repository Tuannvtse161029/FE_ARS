import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright config — ALL e2e specs.
 *
 * Scoped to the headless, mocked e2e specs under `tests/e2e/`. The other
 * specialized configs (`playwright.config.ts`, `playwright.reviewer-flow.config.ts`,
 * `playwright.withdrawal-flow.config.ts`, `playwright.google-onboarding.config.ts`,
 * `playwright.google-onboarding.headed.config.ts`) are preserved as-is and are
 * invoked through their dedicated scripts (`e2e:production`, etc.).
 *
 * The headless `googleOnboarding.headed.spec.ts` is excluded here because it
 * requires a real, headed Google OAuth consent screen and should never run
 * in CI — it is interactive manual verification only.
 *
 * Used by:
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /googleOnboarding\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    cwd: __dirname,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      VITE_API_BASE_URL:
        process.env.VITE_API_BASE_URL || 'http://127.0.0.1:4173',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    viewport: { width: 1280, height: 900 },
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
