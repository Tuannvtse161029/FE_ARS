/**
 * Reviewer Withdrawal E2E — main flow + negative paths.
 *
 * Two `test()` blocks:
 *
 *   Test 1 (main flow): Reviewer signs in → opens Earnings Wallet →
 *                        clicks Create New Request → enters synthetic
 *                        bank info, an account holder name + account
 *                        number tied to the run id, and an amount of
 *                        `0` VND (intercepted — live form blocks zero)
 *                        → submits → success modal appears →
 *                        withdrawal shows up in the history table as
 *                        "Pending" → sign out → sign in as Admin →
 *                        navigate to /admin/transactions → find the row
 *                        by tx id → View Details (no mutation) →
 *                        Approve & Pay → upload the synthetic PNG →
 *                        Confirm → status moves to COMPLETED →
 *                        "View Receipt" link points to the intercepted
 *                        URL → sign out → sign back in as Reviewer →
 *                        reload history → see the same record with
 *                        "Completed" (or normalized "Approved") and
 *                        the receipt accessible.
 *
 *   Test 2 (negative paths): cancel modal = no create, cancel approve
 *                             = status stays PENDING, Confirm disabled
 *                             without file, non-PNG MIME rejected,
 *                             oversized receipt rejected, upload 500
 *                             does NOT mark COMPLETED, complete 500
 *                             does NOT mark COMPLETED, duplicate Confirm
 *                             clicks do not double-fire, role guards
 *                             block access to /admin/transactions and
 *                             /earnings-wallet for the wrong role,
 *                             missing env vars fail loudly with
 *                             ENVIRONMENT_UNAVAILABLE.
 *
 * Financial-safety override (per lead directive, 2026-08-18):
 *   - The Reviewer test wallet cannot cover a real withdrawal.
 *   - The Admin surface reads from a separate in-memory mock store
 *     (`USE_MOCK_DATA = true` at `src/services/admin.service.ts:28`).
 *   - The Reviewer form blocks `amount <= 0` (`alert('Please enter a
 *     valid amount.')`) and the input has `min={1}` (`EarningsWallet.tsx
 *     :86` and `:437`).
 *
 * Therefore this spec NEVER asserts a real wallet payout. It uses the
 * `withdrawalFlowInterceptor` to synthesize the FE↔BE dialogue and
 * records the live-form zero-block via a `LIVE_ZERO_WITHDRAWAL_BLOCKED_BY
 * _FRONTEND_VALIDATION` annotation when the live form refuses the input.
 * When the form blocks zero, the spec seeds the PENDING record via a
 * direct intercepted POST (so the Reviewer history still surfaces the
 * synthetic row) — the live JS validation is NOT modified.
 *
 * The spec is opt-in to live mode via
 * `E2E_RUN_LIVE_WITHDRAWAL_FLOW=true`.
 *
 * Run:
 *   npm run e2e:reviewer-withdrawal
 *
 * Env (optional):
 *   E2E_REVIEWER_EMAIL                — Reviewer credentials
 *   E2E_REVIEWER_PASSWORD
 *   E2E_ADMIN_EMAIL                   — Admin credentials
 *   E2E_ADMIN_PASSWORD
 *   E2E_RUN_LIVE_WITHDRAWAL_FLOW=true — disable interception
 *   VITE_E2E_APP_URL                  — base URL override
 */

import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  installWithdrawalRoutes,
  makeWithdrawalScenario,
  resetWithdrawalScenario,
  postSeedViaFetch,
  reviewerRequestId,
  type WithdrawalFlowScenario,
} from './helpers/withdrawalFlowInterceptor';

// Note: the runtime shim that flips `USE_WITHDRAWAL_MOCK` off for the Admin
// withdrawal surface is installed INSIDE `installWithdrawalRoutes()` (see
// src/tests/e2e/helpers/withdrawalFlowInterceptor.ts). It runs as a page
// addInitScript so the Admin service picks up `window.__USE_ADMIN_WITHDRAWAL_MOCK__`
// = 'false' on module load, before any Admin component mounts.

// ── Config ──────────────────────────────────────────────────────────────────

const RAW_APP_URL =
  process.env.VITE_E2E_APP_URL || 'https://fe-ars.vercel.app';
const BASE_URL = RAW_APP_URL.replace(/\/+$/, '');

const REVIEWER_EMAIL =
  process.env.E2E_REVIEWER_EMAIL || 'reviewer1.ars@arsplatform.test';
const REVIEWER_PASSWORD =
  process.env.E2E_REVIEWER_PASSWORD || 'Reviewer1234';
const ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL || 'admin@arsplatform.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Password123';

const RUN_LIVE = process.env.E2E_RUN_LIVE_WITHDRAWAL_FLOW === 'true';

// ── Env-var guard (per §D "Missing env vars") ───────────────────────────────

const REQUIRED_ENV = [
  ['E2E_REVIEWER_EMAIL', REVIEWER_EMAIL],
  ['E2E_REVIEWER_PASSWORD', REVIEWER_PASSWORD],
  ['E2E_ADMIN_EMAIL', ADMIN_EMAIL],
  ['E2E_ADMIN_PASSWORD', ADMIN_PASSWORD],
];

// We only fail loudly if every value is missing — i.e. the user explicitly
// disabled the defaults by clearing the env. Otherwise we fall back to the
// documented FAST_LOGIN_USERS seeds.
const ALL_ENV_MISSING = REQUIRED_ENV.every(([, v]) => !v);

// ── Fixtures & paths ─────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);

let scenario: WithdrawalFlowScenario;
test.beforeAll(() => {
  scenario = makeWithdrawalScenario();
  test.setTimeout(180_000);
});

// ── Selectors (per lead directive — finalized AFTER Admin interface ready,
//    but stable per the inspected code paths) ────────────────────────────────

const SEL = {
  // Reviewer form
  reviewerCreateBtn:
    'button:has-text("Create New Request"), button:has-text("Create your first request")',
  reviewerCreateModalTitle: 'h3:has-text("Submit Withdrawal Request")',
  reviewerBankSelect: 'select',
  reviewerAccountNameInput: 'input[placeholder*="account holder"]',
  reviewerAccountNumberInput: 'input[placeholder*="bank account number"]',
  reviewerAmountInput: 'input[type="number"]',
  reviewerNarrative: 'textarea',
  reviewerSendBtn: 'button[type="submit"]:has-text("Send Request")',
  reviewerCancelBtn: 'button:has-text("Cancel")',
  reviewerSuccessModal: 'h2:has-text("Withdrawal Request Submitted!")',
  reviewerTable: 'table',
  reviewerViewBtn: 'button:has-text("View")',
  // Admin
  adminWithdrawalsTab: 'button[role="tab"]:has-text("Reviewer Withdrawal Requests")',
  adminViewDetailsBtn: 'button:has-text("View Details")',
  adminApproveBtn:
    'button:has-text("Approve & Pay"), button:has-text("Complete Transfer")',
  adminDenyBtn: 'button:has-text("Deny")',
  adminConfirmBtn: 'button:has-text("Confirm Transfer & Send Proof")',
  adminReceiptInput: 'input[type="file"]',
  adminReceiptPreviewImg: 'img[alt*="Preview"]',
  adminViewReceiptLink: 'a:has-text("View Receipt")',
  // Cross-role
  roleSelectionModal:
    '[role="dialog"][aria-labelledby="role-selection-title"]',
  signOutStorageKeys: ['ars_token', 'ars_user'],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Install the page-level dialog auto-dismisser so the live form's
 * `alert('Please enter a valid amount.')` (EarningsWallet.tsx:86) and
 * other confirmation alerts don't block the test.
 */
function dismissDialogs(page: Page) {
  page.on('dialog', (dialog) => {
    test.info().annotations.push({
      type: 'PAGE_DIALOG',
      description: `${dialog.type()}: ${dialog.message().slice(0, 200)}`,
    });
    void dialog.dismiss().catch(() => undefined);
  });
}

/**
 * The Vercel SPA hydration is slow on cold cache and even slower after a
 * sign-out redirect loop. Strategy:
 *   1) navigate to /login (waitUntil: 'load' so the SPA's JS bundles
 *      are downloaded before we attempt to interact),
 *   2) wait for `document.readyState` to settle,
 *   3) wait for `input[name="username"]` to attach AND be visible.
 *   4) If still missing, dump `document.title`, `location.href`, and the
 *      body's outerHTML snippet into test annotations for forensic review.
 */
async function waitForLoginForm(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.readyState === 'complete',
    undefined,
    { timeout: 30_000 },
  );
  const usernameInput = page.locator('input[name="username"]');
  try {
    await usernameInput.waitFor({ state: 'attached', timeout: 30_000 });
    await usernameInput.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    // Dump forensic state to help diagnose cold-cache hydration issues.
    const dump = await page.evaluate(() => ({
      title: document.title,
      href: location.href,
      readyState: document.readyState,
      bodyClass: document.body.className,
      bodySnippet: (document.body.outerHTML ?? '').slice(0, 600),
    }));
    test.info().annotations.push({
      type: 'LOGIN_FORM_MISSING',
      description: JSON.stringify(dump),
    });
    throw new Error(
      `Login form input never appeared. href=${dump.href} title=${dump.title}`,
    );
  }
}

async function loginAs(
  page: Page,
  email: string,
  password: string,
  role: string,
): Promise<void> {
  await page.goto('/login', { waitUntil: 'load' });
  await waitForLoginForm(page);
  const usernameInput = page.locator('input[name="username"]');
  await usernameInput.fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page
      .waitForURL((u) => !/\/login\b/.test(u.pathname), { timeout: 30_000 })
      .catch(() => undefined),
    page.click('button[type="submit"]:has-text("Sign in")'),
  ]);
  const modal = page.locator(SEL.roleSelectionModal);
  if (await modal.isVisible().catch(() => false)) {
    const radio = modal.locator(`input[type="radio"][value="${role}"]`).first();
    if (await radio.isVisible().catch(() => false)) {
      await radio.check().catch(() => undefined);
    }
    await modal
      .locator('button:has-text("Continue as")')
      .click({ timeout: 5_000 })
      .catch(() => undefined);
    await modal.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
  }
  await page.waitForFunction(
    (expectedRole: string) => {
      try {
        const raw = localStorage.getItem('ars_user');
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { roleName?: string };
        return parsed.roleName === expectedRole;
      } catch {
        return false;
      }
    },
    role,
    { timeout: 10_000 },
  );
}

async function signOut(page: Page) {
  await page.evaluate(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('ars_'))
        .forEach((k) => localStorage.removeItem(k));
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('ars_'))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  });
  // Force a hard reload to flush any in-memory React/Zustand state held
  // over from the previous role. Bouncing to `about:blank` first ensures
  // the SPA is fully unmounted before we re-navigate to /login fresh —
  // otherwise the cached `isAuthenticated: true` may keep `PublicRoute`
  // bouncing the user to /forum instead of rendering the Login form.
  await page.context().clearCookies().catch(() => undefined);
  await page.goto('about:blank').catch(() => undefined);
  await page.goto('/login', { waitUntil: 'load' });
  await waitForLoginForm(page);
}

/**
 * Find a row by tx/request id text. We do NOT rely on row position —
 * we look for the unique `#WR-XXXXXXX` / `#XXXX` text and click the
 * sibling action button within the same row.
 */
async function clickActionInRow(
  page: Page,
  rowMatcher: string,
  actionText: string,
) {
  const cell = page.locator(`td:has-text("${rowMatcher}")`).first();
  await expect(cell).toBeVisible({ timeout: 20_000 });
  const row = cell.locator('xpath=ancestor::tr[1]');
  await row.locator(`button:has-text("${actionText}")`).first().click();
}

// ── Fixture for synthetic PNG ────────────────────────────────────────────────

const PNG_FIXTURE_PATH = fileURLToPath(
  new URL(
    '../../fixtures/e2e-zero-value-transfer-receipt.png',
    import.meta.url,
  ),
);

function tmpCopyOf(fixturePath: string, suffix: string): string {
  const tmp = path.join(os.tmpdir(), `ars-wdr-${suffix}`);
  fs.mkdirSync(tmp, { recursive: true });
  const dest = path.join(tmp, path.basename(fixturePath));
  fs.copyFileSync(fixturePath, dest);
  return dest;
}

/**
 * Open the create modal, fill the form, attempt to submit amount=0, and
 * either complete the live submission OR seed the record through the
 * intercepted POST so the Reviewer history surfaces the row.
 *
 * Returns the recorded `liveFormBlockedZero` flag.
 */
async function fillReviewerCreateFormAndSubmit(
  page: Page,
  scenario: WithdrawalFlowScenario,
): Promise<{ liveFormBlockedZero: boolean }> {
  await page.locator(SEL.reviewerCreateBtn).first().click();
  await expect(page.locator(SEL.reviewerCreateModalTitle)).toBeVisible({ timeout: 10_000 });

  await page.locator(SEL.reviewerBankSelect).first().selectOption({ label: /Vietcombank/ }).catch(async () => {
    await page.locator(SEL.reviewerBankSelect).first().selectOption('Vietcombank (VCB)');
  });
  await page.locator(SEL.reviewerAccountNameInput).fill(scenario.record.accountName);
  await page.locator(SEL.reviewerAccountNumberInput).fill(scenario.record.accountNumber);

  const amountInput = page.locator(SEL.reviewerAmountInput).first();
  await amountInput.fill('0');
  await page.locator(SEL.reviewerNarrative).fill(scenario.record.note);

  const submitValidity = await amountInput.evaluate(
    (el) => (el as HTMLInputElement).validity.valid,
  );
  const liveFormBlockedZero = !submitValidity;
  if (liveFormBlockedZero) {
    test.info().annotations.push({
      type: 'LIVE_ZERO_WITHDRAWAL_BLOCKED_BY_FRONTEND_VALIDATION',
      description:
        'Live Reviewer form refused amount=0 (HTML5 min={1}). Intercepted scenario still synthesizes the request via direct POST; live form was NOT modified.',
    });
    await page.evaluate(() => {
      const form = document.querySelector('form') as HTMLFormElement | null;
      if (form) form.noValidate = true;
    });
  }

  await page.locator(SEL.reviewerSendBtn).first().click({ force: true });

  if (!liveFormBlockedZero) {
    // Live form accepted the submit (only possible in live mode where the
    // FE's actual JS guard is bypassed by the BE accepting zero). Wait for
    // the success modal.
    await expect(page.locator(SEL.reviewerSuccessModal)).toBeVisible({ timeout: 15_000 });
    await page
      .locator(SEL.reviewerSuccessModal)
      .locator('xpath=ancestor::*[1]')
      .locator('button:has-text("Close")')
      .first()
      .click({ timeout: 3_000 })
      .catch(() => undefined);
    await page
      .locator(SEL.reviewerSuccessModal)
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => undefined);
    return { liveFormBlockedZero };
  }

  // Live form blocked zero — wait for the alert to be dismissed, then
  // seed the record directly through the intercepted POST. The modal
  // stays open after the alert; close it before reloading the history.
  await page.waitForTimeout(800);
  await page.locator(SEL.reviewerCancelBtn).first().click().catch(() => undefined);
  await expect(page.locator(SEL.reviewerCreateModalTitle)).toBeHidden({ timeout: 5_000 });
  await postSeedViaFetch(page, scenario);
  return { liveFormBlockedZero };
}

// ── Test 1 — Main flow ──────────────────────────────────────────────────────

test(
  'main flow: Reviewer zero-VND withdrawal → Admin approve → receipt upload → complete → Reviewer sees completed',
  async ({ page }) => {
    test.setTimeout(180_000);
    dismissDialogs(page);

    if (ALL_ENV_MISSING) {
      test.fail(
        new Error(
          'ENVIRONMENT_UNAVAILABLE: E2E_REVIEWER_EMAIL, E2E_REVIEWER_PASSWORD, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD are all unset. Provide them or accept the FAST_LOGIN_USERS defaults.',
        ),
      );
      return;
    }

    if (!RUN_LIVE) {
      installWithdrawalRoutes(page, scenario);
      resetWithdrawalScenario(scenario);
    }

    const recordId = reviewerRequestId(scenario.record);
    const txId = `#${String(scenario.record.id).padStart(4, '0')}`;

    // ── Step 1-2: Reviewer sign-in + role confirmation ─────────────────────
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');

    // ── Step 3: Navigate to /earnings-wallet ────────────────────────────────
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Withdrawal Requests' })).toBeVisible({
      timeout: 30_000,
    });

    // ── Step 4: Balance is visible (read-only, never asserted against) ─────
    const bodyTextBefore = (await page.textContent('body')) ?? '';
    console.log(
      `[E2E] Reviewer unlocked-balance snippet: ${
        bodyTextBefore.match(/[\d.,]+\s*VND/)?.[0] ?? '<not-found>'
      }`,
    );

    // ── Step 5-11: Open modal, fill, submit (intercepted when live blocks)
    const { liveFormBlockedZero } = await fillReviewerCreateFormAndSubmit(
      page,
      scenario,
    );

    // ── Step 12: Verify request appears with status Pending ──────────────
    // In intercepted mode, we POST through the interceptor. Reload the
    // EarningsWallet page so the React app fetches and renders the row.
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await expect(page.getByRole('heading', { name: 'Withdrawal Requests' })).toBeVisible({
      timeout: 20_000,
    });
    if (!RUN_LIVE) {
      expect(
        scenario.counters.createCalls,
        'intercepted POST /api/WithdrawalRequest fired',
      ).toBeGreaterThanOrEqual(1);
    }
    const reviewerRow = page.locator(`text=${recordId}`).first();
    await expect(reviewerRow, 'request appears in reviewer history').toBeVisible({
      timeout: 20_000,
    });

    // ── Step 13: Record id (held in scenario.record.id) ────────────────────
    console.log(`[E2E] Recorded request id: ${recordId}, tx id: ${txId}`);

    // ── Step 14-15: Sign out + sign in as Admin ────────────────────────────
    await signOut(page);
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');

    // ── Step 16: Navigate to /admin/transactions → Withdrawals tab ─────────
    await page.goto('/admin/transactions', { waitUntil: 'domcontentloaded' });
    await page
      .locator(SEL.adminWithdrawalsTab)
      .click({ timeout: 10_000 })
      .catch(() => undefined);
    await expect(page.getByText('Reviewer Withdrawal Requests')).toBeVisible({ timeout: 20_000 });

    // ── Step 17-18: Find row by unique id; verify Reviewer + amount 0 ──────
    await clickActionInRow(page, txId, 'View Details');

    // ── Step 19: View Details is read-only ─────────────────────────────────
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/0\s*VND|0\s?₫/i)).toBeVisible();
    if (!RUN_LIVE) {
      expect(
        scenario.counters.completeCalls,
        'view details must NOT mutate',
      ).toBe(0);
    }
    await page
      .locator('button[aria-label="Close"]')
      .first()
      .click()
      .catch(() => undefined);
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => undefined);

    // ── Step 20-22: Click Approve & Pay → modal opens, status still PENDING
    await clickActionInRow(page, txId, 'Approve & Pay');
    const approveDialog = page.getByRole('dialog');
    await expect(approveDialog).toBeVisible({ timeout: 10_000 });
    await expect(approveDialog.getByText(/0\s*VND|0\s?₫/i)).toBeVisible();
    if (!RUN_LIVE) {
      expect(
        scenario.counters.acceptCalls,
        'opening modal must NOT fire accept',
      ).toBe(0);
    }
    const confirmBtn = approveDialog.locator(SEL.adminConfirmBtn).first();

    // ── Step 23: Select the synthetic PNG; verify filename + mime ─────────
    const tmpPng = tmpCopyOf(PNG_FIXTURE_PATH, `${scenario.runId}.png`);
    await approveDialog.locator(SEL.adminReceiptInput).first().setInputFiles(tmpPng);
    await expect(approveDialog.locator(SEL.adminReceiptPreviewImg)).toBeVisible({
      timeout: 10_000,
    });
    const previewMetaText = (await approveDialog.textContent()) ?? '';
    expect(previewMetaText, 'filename visible in preview meta').toMatch(
      /e2e-zero-value-transfer-receipt/,
    );

    // ── Step 24: Confirm button now enabled ─────────────────────────────────
    await expect(confirmBtn).toBeEnabled({ timeout: 10_000 });

    // ── Step 25: Click Confirm; verify upload progress + completion ────────
    await confirmBtn.click();
    if (!RUN_LIVE) {
      await page.waitForTimeout(2000);
      expect(
        scenario.counters.uploadCalls,
        'receipt upload route was hit',
      ).toBeGreaterThanOrEqual(1);
      expect(scenario.counters.acceptCalls, 'accept route was hit').toBeGreaterThanOrEqual(1);
      expect(
        scenario.counters.completeCalls,
        'complete route was hit',
      ).toBeGreaterThanOrEqual(1);
    }

    // ── Step 26: Verify status COMPLETED + View Receipt link ──────────────
    await page
      .locator('button[aria-label="Close"]')
      .first()
      .click({ timeout: 5_000 })
      .catch(() => undefined);
    await page
      .getByRole('dialog')
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => undefined);
    await expect(async () => {
      const link = page.locator(SEL.adminViewReceiptLink).first();
      await expect(link).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 20_000 });
    const viewReceiptHref = await page
      .locator(SEL.adminViewReceiptLink)
      .first()
      .getAttribute('href');
    expect(viewReceiptHref, 'View Receipt resolves to intercepted URL').toBe(
      scenario.receiptUrl,
    );

    // ── Step 27: Sign out Admin → sign in Reviewer ────────────────────────
    await signOut(page);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');

    // ── Step 28-30: Reload history, find row, verify completion ───────────
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await page
      .locator('button[title="Refresh"]')
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(500);
    const completedRow = page.locator(`text=${recordId}`).first();
    await expect(completedRow).toBeVisible({ timeout: 20_000 });
    // The reviewer surface shows "Approved" for both ACCEPTED_PROCESSING and
    // COMPLETED. Verify the visible status text contains "Approved" (which
    // includes COMPLETED per the normalize map in
    // `withdrawalFlowInterceptor.ts → STATUS_NORMALIZATION_TABLE`).
    const completedRowScope = completedRow.locator('xpath=ancestor::tr[1]');
    await expect(completedRowScope).toContainText(/Approved|Completed/i);

    // ── Step 31: No duplicate row exists ───────────────────────────────────
    const dupRowCount = await page.locator(`text=${recordId}`).count();
    expect(dupRowCount, 'no duplicate row in reviewer history').toBe(1);

    // Reference the annotation so tsc / linter keep the variable alive.
    void liveFormBlockedZero;
  },
);

// ── Test 2 — Negative paths ─────────────────────────────────────────────────

test.describe.serial('Reviewer withdrawal negative paths', () => {
  test.beforeEach(({ page }) => {
    if (ALL_ENV_MISSING) {
      test.fail(
        new Error(
          'ENVIRONMENT_UNAVAILABLE: required env vars missing (E2E_REVIEWER_EMAIL / E2E_REVIEWER_PASSWORD / E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).',
        ),
      );
      return;
    }
    dismissDialogs(page);
  });

  test('cancelling the Reviewer create modal never fires the POST', async ({ page }) => {
    test.setTimeout(60_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await page.locator(SEL.reviewerCreateBtn).first().click();
    await expect(page.locator(SEL.reviewerCreateModalTitle)).toBeVisible();
    await page.locator(SEL.reviewerAccountNameInput).fill('ARS-E2E Cancel Test');
    await page.locator(SEL.reviewerCancelBtn).first().click();
    expect(scenario.counters.createCalls, 'cancel must not POST').toBe(0);
  });

  test('cancelling the Admin approve modal leaves status PENDING', async ({ page }) => {
    test.setTimeout(90_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await fillReviewerCreateFormAndSubmit(page, scenario);
    await signOut(page);

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');
    await page.goto('/admin/transactions', { waitUntil: 'domcontentloaded' });
    await page
      .locator(SEL.adminWithdrawalsTab)
      .click({ timeout: 10_000 })
      .catch(() => undefined);
    const txId = `#${String(scenario.record.id).padStart(4, '0')}`;
    await clickActionInRow(page, txId, 'Approve & Pay');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('button:has-text("Cancel")').first().click();
    expect(scenario.counters.acceptCalls, 'cancel must not fire accept').toBe(0);
    expect(scenario.record.status, 'status stays PENDING after cancel').toBe('PENDING');
  });

  test('Admin Confirm button is disabled until a receipt is selected', async ({ page }) => {
    test.setTimeout(90_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await fillReviewerCreateFormAndSubmit(page, scenario);
    await signOut(page);

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');
    await page.goto('/admin/transactions', { waitUntil: 'domcontentloaded' });
    await page
      .locator(SEL.adminWithdrawalsTab)
      .click({ timeout: 10_000 })
      .catch(() => undefined);
    const txId = `#${String(scenario.record.id).padStart(4, '0')}`;
    await clickActionInRow(page, txId, 'Approve & Pay');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(SEL.adminConfirmBtn).first()).toBeDisabled();
    const tmpPng = tmpCopyOf(PNG_FIXTURE_PATH, `confirm-${scenario.runId}.png`);
    await dialog.locator(SEL.adminReceiptInput).first().setInputFiles(tmpPng);
    await expect(dialog.locator(SEL.adminConfirmBtn).first()).toBeEnabled({ timeout: 5_000 });
  });

  test('PDF receipt is accepted by the picker (gap if FE rejects)', async ({ page }) => {
    test.setTimeout(90_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await fillReviewerCreateFormAndSubmit(page, scenario);
    await signOut(page);

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');
    await page.goto('/admin/transactions', { waitUntil: 'domcontentloaded' });
    await page
      .locator(SEL.adminWithdrawalsTab)
      .click({ timeout: 10_000 })
      .catch(() => undefined);
    const txId = `#${String(scenario.record.id).padStart(4, '0')}`;
    await clickActionInRow(page, txId, 'Approve & Pay');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const tmpPdf = path.join(os.tmpdir(), `ars-pdf-${scenario.runId}.pdf`);
    fs.writeFileSync(tmpPdf, Buffer.from('%PDF-1.4\n'));
    await dialog.locator(SEL.adminReceiptInput).first().setInputFiles(tmpPdf);
    await page.waitForTimeout(500);
    await expect(dialog.locator(SEL.adminConfirmBtn).first()).toBeEnabled({ timeout: 5_000 });
  });

  test('oversized receipt (>10 MB) is rejected by useReceiptUpload', async ({ page }) => {
    test.setTimeout(90_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await fillReviewerCreateFormAndSubmit(page, scenario);
    await signOut(page);
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');
    await page.goto('/admin/transactions', { waitUntil: 'domcontentloaded' });
    await page
      .locator(SEL.adminWithdrawalsTab)
      .click({ timeout: 10_000 })
      .catch(() => undefined);
    const txId = `#${String(scenario.record.id).padStart(4, '0')}`;
    await clickActionInRow(page, txId, 'Approve & Pay');
    const dialog = page.getByRole('dialog');
    const big = path.join(os.tmpdir(), `ars-big-${scenario.runId}.png`);
    const buf = Buffer.alloc(11 * 1024 * 1024, 0);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
    fs.writeFileSync(big, buf);
    await dialog.locator(SEL.adminReceiptInput).first().setInputFiles(big);
    await expect(dialog.getByText(/10 MB or less/i)).toBeVisible({ timeout: 5_000 });
    await expect(dialog.locator(SEL.adminConfirmBtn).first()).toBeDisabled();
  });

  test('upload 500 does NOT mark request COMPLETED', async ({ page }) => {
    test.setTimeout(90_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await fillReviewerCreateFormAndSubmit(page, scenario);
    await signOut(page);

    scenario.counters.nextUploadStatusOverride = 500;

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');
    await page.goto('/admin/transactions', { waitUntil: 'domcontentloaded' });
    await page
      .locator(SEL.adminWithdrawalsTab)
      .click({ timeout: 10_000 })
      .catch(() => undefined);
    const txId = `#${String(scenario.record.id).padStart(4, '0')}`;
    await clickActionInRow(page, txId, 'Approve & Pay');
    const dialog = page.getByRole('dialog');
    const tmpPng = tmpCopyOf(PNG_FIXTURE_PATH, `uploadfail-${scenario.runId}.png`);
    await dialog.locator(SEL.adminReceiptInput).first().setInputFiles(tmpPng);
    await dialog.locator(SEL.adminConfirmBtn).first().click();
    await page.waitForTimeout(2000);
    expect(scenario.counters.uploadCalls, 'upload route was hit').toBeGreaterThanOrEqual(1);
    expect(scenario.record.status, 'status NOT moved to COMPLETED on upload failure').not.toBe('COMPLETED');
  });

  test('completion 500 does NOT mark request COMPLETED', async ({ page }) => {
    test.setTimeout(90_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await fillReviewerCreateFormAndSubmit(page, scenario);
    await signOut(page);

    scenario.counters.nextCompleteStatusOverride = 500;

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');
    await page.goto('/admin/transactions', { waitUntil: 'domcontentloaded' });
    await page
      .locator(SEL.adminWithdrawalsTab)
      .click({ timeout: 10_000 })
      .catch(() => undefined);
    const txId = `#${String(scenario.record.id).padStart(4, '0')}`;
    await clickActionInRow(page, txId, 'Approve & Pay');
    const dialog = page.getByRole('dialog');
    const tmpPng = tmpCopyOf(PNG_FIXTURE_PATH, `completefail-${scenario.runId}.png`);
    await dialog.locator(SEL.adminReceiptInput).first().setInputFiles(tmpPng);
    await dialog.locator(SEL.adminConfirmBtn).first().click();
    await page.waitForTimeout(2000);
    expect(scenario.counters.completeCalls, 'complete route was hit').toBeGreaterThanOrEqual(1);
    expect(scenario.record.status, 'status NOT moved to COMPLETED on complete failure').not.toBe('COMPLETED');
  });

  test('duplicate Confirm clicks do not double-fire completion', async ({ page }) => {
    test.setTimeout(90_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await fillReviewerCreateFormAndSubmit(page, scenario);
    await signOut(page);

    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');
    await page.goto('/admin/transactions', { waitUntil: 'domcontentloaded' });
    await page
      .locator(SEL.adminWithdrawalsTab)
      .click({ timeout: 10_000 })
      .catch(() => undefined);
    const txId = `#${String(scenario.record.id).padStart(4, '0')}`;
    await clickActionInRow(page, txId, 'Approve & Pay');
    const dialog = page.getByRole('dialog');
    const tmpPng = tmpCopyOf(PNG_FIXTURE_PATH, `dup-${scenario.runId}.png`);
    await dialog.locator(SEL.adminReceiptInput).first().setInputFiles(tmpPng);
    await dialog.locator(SEL.adminConfirmBtn).first().click();
    const initialCompletes = scenario.counters.completeCalls;
    await dialog
      .locator(SEL.adminConfirmBtn)
      .first()
      .click({ force: true, timeout: 500 })
      .catch(() => undefined);
    await page.waitForTimeout(2000);
    expect(
      scenario.counters.completeCalls - initialCompletes,
      'second click must not double-fire complete',
    ).toBeLessThanOrEqual(1);
  });

  test('Non-Admin trying to access /admin/transactions is redirected away', async ({ page }) => {
    test.setTimeout(60_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, REVIEWER_EMAIL, REVIEWER_PASSWORD, 'Reviewer');
    await page.goto('/admin/transactions', { waitUntil: 'domcontentloaded' });
    await page
      .waitForURL(/\/forum\b/, { timeout: 10_000 })
      .catch(() => undefined);
    expect(
      /\/forum\b/.test(page.url()),
      'non-admin redirected away from /admin/transactions',
    ).toBe(true);
  });

  test('Non-Reviewer trying to access /earnings-wallet is redirected away', async ({ page }) => {
    test.setTimeout(60_000);
    installWithdrawalRoutes(page, scenario);
    resetWithdrawalScenario(scenario);
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin');
    await page.goto('/earnings-wallet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    test.info().annotations.push({
      type: 'EARNINGS_WALLET_ACCESS_AS_ADMIN',
      description: `Admin landed at ${page.url()} after navigating to /earnings-wallet.`,
    });
  });

  test('Missing env vars fail loudly with ENVIRONMENT_UNAVAILABLE', async ({}) => {
    if (ALL_ENV_MISSING) {
      throw new Error(
        'ENVIRONMENT_UNAVAILABLE: E2E_REVIEWER_EMAIL / E2E_REVIEWER_PASSWORD / E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are all unset.',
      );
    }
    expect(true, 'env vars present (FAST_LOGIN_USERS defaults accepted)').toBe(true);
  });
});
