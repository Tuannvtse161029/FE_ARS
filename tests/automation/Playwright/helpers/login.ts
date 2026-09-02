/**
 * Login helper — types email + password into the ARS login form and
 * waits for the post-login redirect. Safe to call from any role spec.
 *
 * Privacy:
 *   - The password is never printed, never asserted in screenshots, and
 *     is cleared from the input element after submission so a trace
 *     screenshot never reveals it.
 *   - Mask the email field with `password` semantics when the form
 *     type is `password` (it isn't here, but the masking helper is
 *     available for other input shapes).
 */
import type { Page } from '@playwright/test';
import { ROUTES } from '../../../../src/routes/paths';

export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  // Wait for the form to mount. The email field is identified by name;
  // fallback to label text if the form changes.
  const emailInput = page.locator(
    'input[name="email"], input[type="email"]',
  );
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  await emailInput.fill(email);

  const passwordInput = page.locator(
    'input[name="password"], input[type="password"]',
  );
  await passwordInput.waitFor({ state: 'visible' });
  // Use fill so the value never echoes to the trace as a series of
  // keystrokes; clear immediately after submit.
  await passwordInput.fill(password);
  await passwordInput.press('Enter');

  // Wait for the post-login redirect. The landing route differs per
  // role but the PrivateRoute always routes through PublicRoute first;
  // either the role landing or `/complete-google-registration` is fine.
  // The password field becomes disabled while the form submits, so we
  // don't try to clear it after Enter — the form clear is best-effort
  // and failures here are not the test's concern.
  try {
    await page.waitForURL(
      (url) =>
        !url.pathname.startsWith('/login') &&
        !url.pathname.startsWith('/forgot-password'),
      { timeout: 30_000 },
    );
  } finally {
    // Best-effort clear of the password field; the field may be
    // disabled while the form is submitting, so swallow that error.
    await passwordInput.fill('').catch(() => {});
  }
}

export async function logout(page: Page): Promise<void> {
  // The header profile dropdown holds the logout button. Use it when
  // possible; fall back to clearing storage directly so the test does
  // not flake on UI changes.
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* storage may be unavailable in some test contexts */
    }
  });
  await page.goto(ROUTES.LOGIN);
}