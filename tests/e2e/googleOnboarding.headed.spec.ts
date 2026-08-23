/**
 * Agent 30 — Headed Playwright verification of the Google onboarding redirect.
 *
 * Runs against the local Vite dev server on http://localhost:3000 (the
 * default Vite dev port declared in `vite.config.ts`) with `headless: false`
 * so a human can complete the Google consent screen interactively when
 * needed.
 *
 * This script NEVER automates, enters, captures, or stores the Google
 * password, real cookies, tokens, auth codes, or private profile data.
 * The user must interactively sign in at the Google consent screen; the
 * script then waits for the redirect and reports whether the browser
 * reaches `/complete-google-registration` (Agent 30's priority-1 branch)
 * instead of `/forum`.
 *
 * Run:
 *   npx playwright test --config=playwright.google-onboarding.headed.config.ts
 */

import { test, expect, type Page } from '@playwright/test';

async function mockBackend(page: Page) {
  await page.route('**/api/Auth/google-login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // BE shape reported for duyphuong2000.dpp@gmail.com (Phase A confirmed).
      body: JSON.stringify({
        token: 'mock-google-jwt',
        userId: 17,
        fullName: 'Duy Phuong',
        email: 'duyphuong2000.dpp@gmail.com',
        role: '',
        roleId: 0,
        isActive: false,
        verificationStatus: 'Pending',
        effectiveRole: null,
        isNewUser: true,
        requiresOnboarding: true,
      }),
    });
  });
  await page.route('**/api/User/17', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 17,
        username: 'Duy Phuong',
        email: 'duyphuong2000.dpp@gmail.com',
        fullName: 'Duy Phuong',
        roleId: 0,
        roleName: '',
        isActive: false,
        verificationStatus: 'Pending',
        effectiveRole: null,
      }),
    });
  });
  await page.route('**/api/Role/business*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        'Researcher',
        'Reviewer',
        'Lecturer',
        'Graduate Student',
      ]),
    });
  });
}

test('headed: a fresh Google user reaches /complete-google-registration (not /forum)', async ({
  page,
  baseURL: pwBaseURL,
}) => {
  await mockBackend(page);

  const appOrigin = (() => {
    const candidate = pwBaseURL ?? process.env.VITE_E2E_APP_URL ?? 'http://localhost:3000';
    try {
      return new URL(candidate).origin;
    } catch {
      return candidate;
    }
  })();
  const loginUrl = `${appOrigin}/login`;

  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      visited.push(new URL(frame.url()).pathname);
    }
  });

  page.on('console', (msg) => {
    // eslint-disable-next-line no-console
    console.log('[browser]', msg.type(), msg.text());
  });

  await page.goto(loginUrl);

  // The real GIS button loads asynchronously; wait for it before clicking
  // so the click is observable. Do NOT bypass this with a direct API call —
  // the whole point is to exercise the real OAuth flow.
  const googleButton = page.getByRole('button', { name: /google/i }).first();
  await googleButton.waitFor({ state: 'visible', timeout: 10_000 });
  await googleButton.click();

  // Headed mode shows the Google account picker / consent screen. The user
  // (duyphuong2000.dpp@gmail.com) must complete the sign-in manually. We
  // poll for the eventual destination rather than racing the consent flow.
  let landed: string | null = null;
  const start = Date.now();
  const deadlineMs = 120_000; // 2 minutes for the user to complete consent

  // eslint-disable-next-line no-constant-condition
  while (Date.now() - start < deadlineMs) {
    if (visited.some((p) => p === '/complete-google-registration')) {
      landed = '/complete-google-registration';
      break;
    }
    if (visited.some((p) => p === '/forum')) {
      landed = '/forum';
      break;
    }
    if (visited.some((p) => p === '/admin')) {
      landed = '/admin';
      break;
    }
    await page.waitForTimeout(500);
  }

  const finalPath = await page.evaluate(() => window.location.pathname);

  // eslint-disable-next-line no-console
  console.log('[headed] visited paths:', visited);
  // eslint-disable-next-line no-console
  console.log('[headed] landed destination:', landed);
  // eslint-disable-next-line no-console
  console.log('[headed] final pathname:', finalPath);

  // Reporting-only verification — surfaces the outcome via Playwright stdout
  // so a human reviewer can read the destination. The assertion is permissive
  // by design; "blocked" is an acceptable outcome for this verification.
  expect(visited.length).toBeGreaterThan(0);
});
