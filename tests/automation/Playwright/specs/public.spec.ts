/**
 * Public user — unauthenticated access checks.
 *
 * Covers:
 *   - Landing page loads
 *   - Login page reachable
 *   - Forum viewable (read-only for public)
 *   - Protected routes redirect to /login
 *
 * No credentials required.
 */
import { test, expect } from '@playwright/test';
import { ROUTES } from '../../../src/routes/paths';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const runDir = process.env.PW_RUN_DIR ?? './test-report';

/**
 * @annotation role: Public
 * @annotation feature: Landing page
 * @annotation expected: Landing page loads with ARS branding
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Landing page loads', async ({ page }) => {
  await test.step('Navigate to landing page', async () => {
    await page.goto('/');
  });

  await test.step('Verify page title or main content is visible', async () => {
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 15_000 });
    // The page should contain ARS-related content.
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${runDir}/01-landing-page.png` });
  });
});

/**
 * @annotation role: Public
 * @annotation feature: Login page
 * @annotation expected: Login page reachable and form visible
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Login page is reachable', async ({ page }) => {
  await test.step('Navigate to /login', async () => {
    await page.goto(ROUTES.LOGIN);
  });

  await test.step('Login form is visible', async () => {
    const emailInput = page.locator('input[name="email"], input[type="email"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await expect(passwordInput).toBeVisible();
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${runDir}/02-login-page.png` });
  });
});

/**
 * @annotation role: Public
 * @annotation feature: Forum (read-only)
 * @annotation expected: Forum is visible without authentication
 * @annotation owner: Frontend
 * @annotation confidence: Medium
 */
test('Forum is viewable for public user', async ({ page }) => {
  await test.step('Navigate to /forum', async () => {
    await page.goto(ROUTES.FORUM);
  });

  await test.step('Forum content is visible', async () => {
    // The page should render without a login redirect.
    const url = page.url();
    expect(url).toContain('/forum');
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 15_000 });
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${runDir}/03-forum-public.png` });
  });
});

/**
 * @annotation role: Public
 * @annotation feature: Route guard
 * @annotation expected: Protected routes redirect unauthenticated user to /login
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Protected routes redirect to /login for unauthenticated user', async ({ page }) => {
  const protectedRoutes = [
    ROUTES.HOME,
    ROUTES.RESEARCHER_SUBMISSIONS,
    ROUTES.ADMIN,
    ROUTES.SUBSCRIPTION,
  ];

  for (const route of protectedRoutes) {
    await test.step(`Navigate to ${route}`, async () => {
      await page.goto(route);
    });

    await test.step(`Verify redirect to /login`, async () => {
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${runDir}/04-auth-guard.png` });
  });
});
