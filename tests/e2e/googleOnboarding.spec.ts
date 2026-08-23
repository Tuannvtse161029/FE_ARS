/**
 * Agent 30 — Headless Playwright mock for the first-time Google onboarding flow.
 *
 * Boots `vite preview` against the production build, mocks the OAuth and
 * ARS backend endpoints with deterministic responses, and drives the
 * dialog end-to-end. Does NOT use a real Google account.
 *
 * Run:
 *   npx playwright test tests/e2e/googleOnboarding.spec.ts --reporter=list
 *
 * Setup requirement:
 *   `npm run build` must have produced `dist/`. We invoke `vite preview`
 *   inside the spec so the test is self-contained.
 */

import { test, expect, type Page } from '@playwright/test';

// `baseURL` and the `vite preview` server are configured via
// `playwright.google-onboarding.config.ts` (`webServer`). No manual
// process spawn is needed here.

let baseURL = process.env.VITE_E2E_APP_URL || 'http://127.0.0.1:4173';

async function mockBackend(page: Page, opts: {
  isNewUser?: boolean;
  requiresOnboarding?: boolean;
  isActive?: boolean;
  verificationStatus?: 'Pending' | 'Accepted' | 'Rejected';
  role?: string;
  roleId?: number | null;
  effectiveRole?: string | null;
} = {}) {
  const {
    isNewUser = false,
    requiresOnboarding = false,
    isActive = true,
    verificationStatus = 'Accepted',
    role = 'Researcher',
    roleId = 1,
    effectiveRole = 'Researcher',
  } = opts;

  await page.route('**/api/Auth/google-login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'mock-google-jwt',
        userId: 17,
        fullName: 'Playwright Google',
        email: 'playwright@example.com',
        role,
        roleId,
        isActive,
        verificationStatus,
        effectiveRole,
        isNewUser,
        requiresOnboarding,
      }),
    });
  });

  await page.route('**/api/User/17', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 17,
        username: 'Playwright Google',
        email: 'playwright@example.com',
        fullName: 'Playwright Google',
        roleId,
        roleName: isActive ? role : '',
        isActive,
        verificationStatus,
        effectiveRole,
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

  await page.route('**/api/Auth/complete-google-registration', async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as Record<string, unknown>;
    // Track the payload for assertions.
    (globalThis as Record<string, unknown>).__lastCompletionPayload = body;
    (globalThis as Record<string, unknown>).__completionCallCount =
      ((globalThis as Record<string, unknown>).__completionCallCount as
        | number
        | undefined) ?? 0;
    (globalThis as Record<string, unknown>).__completionCallCount =
      ((globalThis as Record<string, unknown>).__completionCallCount as
        | number) + 1;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 17,
        email: 'playwright@example.com',
        fullName: 'Playwright Google',
        role: body.role,
        roleId,
        token: null,
        isActive: false,
        verificationStatus: 'Pending',
        effectiveRole: 'Guest',
        requestStatus: 'Pending',
        onboardingStatus: 'Completed',
      }),
    });
  });
}

async function seedOnboardingSession(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      'ars_token',
      'mock-google-jwt',
    );
    window.sessionStorage.setItem(
      'ars_user',
      JSON.stringify({
        id: 17,
        username: 'Playwright Google',
        email: 'playwright@example.com',
        fullName: 'Playwright Google',
        roleId: 0,
        roleName: '',
        isActive: false,
        verificationStatus: 'Pending',
        effectiveRole: 'Guest',
      }),
    );
  });
}

async function uploadPdf(page: Page) {
  // The PdfDropzone renders a hidden <input type="file">. We attach a tiny
  // 1-page PDF byte stream and emit the change event programmatically.
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /upload/i }).first().click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles({
    name: 'proof.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%mock pdf body\n%%EOF'),
  });
}

test('approved Google user never sees the onboarding dialog', async ({ page }) => {
  await mockBackend(page, {
    isNewUser: false,
    requiresOnboarding: false,
    isActive: true,
    verificationStatus: 'Accepted',
    role: 'Researcher',
    roleId: 1,
    effectiveRole: 'Researcher',
  });

  await page.goto(`${baseURL}/login`);
  await page.getByRole('button', { name: /google/i }).first().click();

  // Lands on the researcher workspace (no dialog).
  await expect(page).toHaveURL(/\/researcher|\/forum|\/$/);
  await expect(page.getByTestId('complete-google-registration')).toHaveCount(0);
});

test('first-time Google user opens the dialog before reaching /forum', async ({ page }) => {
  await mockBackend(page, {
    isNewUser: true,
    requiresOnboarding: true,
    isActive: false,
    verificationStatus: 'Pending',
    role: '',
    roleId: 0,
    effectiveRole: 'Guest',
  });

  await page.goto(`${baseURL}/login`);
  await page.getByRole('button', { name: /google/i }).first().click();

  await expect(page.getByTestId('complete-google-registration')).toBeVisible();
  await expect(page).toHaveURL(/\/complete-google-registration/);
  await expect(page.getByRole('heading', { name: /complete your ars registration/i })).toBeVisible();
});

test('Reviewer onboarding requires an ORCID iD and submits it in the payload', async ({ page }) => {
  await mockBackend(page, {
    isNewUser: true,
    requiresOnboarding: true,
    isActive: false,
    verificationStatus: 'Pending',
    effectiveRole: 'Guest',
  });
  await seedOnboardingSession(page);
  await page.goto(`${baseURL}/complete-google-registration`);

  // Select Reviewer, ORCID field appears.
  await page.locator('select#role').selectOption('Reviewer');
  await page.getByTestId('input-orcidId').fill('0000-0002-1825-0097');

  // PDF upload.
  await uploadPdf(page);
  await expect(page.getByText(/Uploaded\. The PDF URL is sent/i)).toBeVisible();

  // Submit.
  const submit = page.getByTestId('submit-button');
  await expect(submit).toBeEnabled();
  await submit.click();

  // The page navigates to /forum (pending Guest) or to the local success
  // screen with the "Go to the Forum" button.
  await expect(async () => {
    const payload = (globalThis as Record<string, unknown>)
      .__lastCompletionPayload as Record<string, unknown> | undefined;
    expect(payload).toBeTruthy();
    expect(payload?.pdfUrl).toMatch(/^https:\/\//);
    expect(payload?.role).toBe('Reviewer');
    expect(payload?.orcidId).toBe('0000-0002-1825-0097');
  }).toPass({ timeout: 5000 });

  await expect(
    page.getByRole('button', { name: /Go to the Forum/i }).or(page.getByTestId('forum-marker')),
  ).toBeVisible({ timeout: 10_000 });
});

test('submit double-click produces exactly one POST', async ({ page }) => {
  await mockBackend(page, {
    isNewUser: true,
    requiresOnboarding: true,
    isActive: false,
    verificationStatus: 'Pending',
    effectiveRole: 'Guest',
  });
  await seedOnboardingSession(page);

  // Slow the BE response so the double-click is observable.
  await page.route('**/api/Auth/complete-google-registration', async (route) => {
    await new Promise((r) => setTimeout(r, 200));
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 17,
        role: body.role,
        effectiveRole: 'Guest',
        verificationStatus: 'Pending',
        requestStatus: 'Pending',
        onboardingStatus: 'Completed',
      }),
    });
  });

  await page.goto(`${baseURL}/complete-google-registration`);

  await page.locator('select#role').selectOption('Researcher');
  await uploadPdf(page);

  const submit = page.getByTestId('submit-button');
  await Promise.all([submit.click(), submit.click(), submit.click()]);
  await page.waitForTimeout(500);

  expect(((globalThis as Record<string, unknown>).__completionCallCount as number) ?? 0)
    .toBe(1);
});

test('refresh after a successful submit renders the success state and does not re-submit', async ({ page }) => {
  await mockBackend(page, {
    isNewUser: true,
    requiresOnboarding: true,
    isActive: false,
    verificationStatus: 'Pending',
    effectiveRole: 'Guest',
  });
  await seedOnboardingSession(page);

  await page.goto(`${baseURL}/complete-google-registration`);
  await page.locator('select#role').selectOption('Researcher');
  await uploadPdf(page);
  await page.getByTestId('submit-button').click();

  await page.waitForFunction(
    () => Boolean(window.sessionStorage.getItem('ars_google_onboarding_submitted')),
    null,
    { timeout: 10_000 },
  );

  const before = ((globalThis as Record<string, unknown>).__completionCallCount as number) ?? 0;

  await page.reload();
  await expect(page.getByTestId('onboarding-submitted')).toBeVisible();
  await page.waitForTimeout(300);

  const after = ((globalThis as Record<string, unknown>).__completionCallCount as number) ?? 0;
  expect(after).toBe(before);
});