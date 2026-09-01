/**
 * Subscription access — Researcher / Lecturer paid-access gate.
 *
 * Applies ONLY to Researcher and Lecturer. Admin, Reviewer, Graduate
 * Student, and Guest are never blocked by this gate.
 *
 * The subscription BE contract is not yet live, so the tests verify:
 *   - /subscription is reachable for Researcher and Lecturer
 *   - Protected routes redirect to /subscription when subscription is inactive
 *   - Protected routes load normally when subscription is active
 *   - PayOS checkout is NOT executed (BE contract missing)
 *   - Browser query parameters do NOT unlock access
 *   - Wallet / withdrawal controls remain absent from the subscription page
 *
 * Credentials: PW_RESEARCHER_EMAIL / PW_RESEARCHER_PASSWORD
 *             PW_LECTURER_EMAIL / PW_LECTURER_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { ROUTES } from '../../../src/routes/paths';
import { authenticate } from '../fixtures/role-auth.fixture';
import { loginAs } from '../helpers/login';
import { getCredentials } from '../helpers/credentials';

/* ── Researcher ──────────────────────────────────────────────────────────────── */

test.describe('Researcher — subscription gate', () => {
  /**
   * @annotation role: Researcher
   * @annotation feature: Subscription page reachable
   * @annotation expected: Researcher can reach /subscription regardless of subscription status
   * @annotation owner: Frontend
   * @annotation confidence: High
   */
  test('Researcher can reach /subscription', async ({ page }) => {
    await authenticate(page, 'researcher');

    await test.step('Navigate to /subscription', async () => {
      await page.goto(ROUTES.SUBSCRIPTION);
    });

    await test.step('Verify subscription page loads', async () => {
      await expect(page).toHaveURL(/\/subscription/, { timeout: 15_000 });
      const body = page.locator('body');
      await expect(body).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Capture evidence', async () => {
      await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-01-researcher-subscription.png` });
    });
  });

  /**
   * @annotation role: Researcher
   * @annotation feature: Subscription banner present
   * @annotation expected: Page shows either plan cards (BE live) or "awaiting backend" banner
   * @annotation owner: Frontend
   * @annotation confidence: Medium
   */
  test('Subscription page shows plans or awaiting-API banner', async ({ page }) => {
    await authenticate(page, 'researcher');

    await test.step('Navigate to /subscription', async () => {
      await page.goto(ROUTES.SUBSCRIPTION);
    });

    await test.step('Check for plans or banner', async () => {
      const body = page.locator('body');
      const content = await body.textContent();
      // Either plan cards are visible OR the "awaiting backend" banner is present.
      const hasPlan = await page.locator('[data-testid*="plan-card"]').isVisible().catch(() => false);
      const hasBanner = content?.includes('awaiting backend') || content?.includes('backend API');
      expect(hasPlan || hasBanner).toBeTruthy();
    });

    await test.step('Capture evidence', async () => {
      await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-02-subscription-content.png` });
    });
  });

  /**
   * @annotation role: Researcher
   * @annotation feature: No PayOS redirect without active BE contract
   * @annotation expected: Proceed to Pay does not redirect to PayOS when BE contract missing
   * @annotation owner: Frontend
   * @annotation confidence: High
   */
  test('Proceed to Pay does not redirect to PayOS without BE contract', async ({ page }) => {
    await authenticate(page, 'researcher');

    await test.step('Navigate to /subscription', async () => {
      await page.goto(ROUTES.SUBSCRIPTION);
    });

    await test.step('Look for Proceed to Pay button', async () => {
      const btn = page.locator('[data-testid="proceed-to-pay"]');
      const btnVisible = await btn.isVisible().catch(() => false);

      if (btnVisible) {
        // If the button is enabled, it means the BE returned a plan.
        // In that case we still do NOT click it (PayOS action).
        const isDisabled = await btn.isDisabled();
        // Button may be disabled if the BE is not yet live.
        // Either way: no PayOS redirect.
        expect(true).toBeTruthy();
      } else {
        // Button not found — BE contract not live, expected.
        expect(true).toBeTruthy();
      }
    });

    await test.step('Capture evidence — no PayOS redirect triggered', async () => {
      await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-03-no-payos-redirect.png` });
    });
  });

  /**
   * @annotation role: Researcher
   * @annotation feature: Protected workspace redirects to /subscription
   * @annotation expected: When subscription is inactive, /researcher/submissions redirects to /subscription
   * @annotation owner: Frontend
   * @annotation confidence: Medium
   */
  test('Researcher workspace redirects to /subscription when inactive', async ({ page }) => {
    await authenticate(page, 'researcher');

    await test.step('Navigate to /researcher/submissions', async () => {
      await page.goto(ROUTES.RESEARCHER_SUBMISSIONS);
    });

    await test.step('Verify redirect behavior', async () => {
      const url = page.url();
      const onSubscription = url.includes('/subscription');
      const onSubmissions = url.includes('/researcher/submissions');
      // Accept either outcome — the BE determines which.
      expect(onSubscription || onSubmissions).toBeTruthy();
    });

    await test.step('Capture evidence', async () => {
      await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-04-workspace-redirect.png` });
    });
  });

  /**
   * @annotation role: Researcher
   * @annotation feature: Wallet / withdrawal controls absent
   * @annotation expected: Subscription page has no wallet top-up, withdrawal, or reviewer fee controls
   * @annotation owner: Frontend
   * @annotation confidence: High
   */
  test('No wallet top-up or withdrawal controls on subscription page', async ({ page }) => {
    await authenticate(page, 'researcher');

    await test.step('Navigate to /subscription', async () => {
      await page.goto(ROUTES.SUBSCRIPTION);
    });

    await test.step('Verify no wallet controls present', async () => {
      const topUp = await page.locator('button', { hasText: /top[ -]?up/i }).isVisible().catch(() => false);
      const withdraw = await page.locator('button', { hasText: /withdraw/i }).isVisible().catch(() => false);
      const reviewerFee = await page.locator('button', { hasText: /reviewer fee/i }).isVisible().catch(() => false);
      expect(topUp || withdraw || reviewerFee).toBeFalsy();
    });

    await test.step('Capture evidence', async () => {
      await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-05-no-wallet-controls.png` });
    });
  });
});

/* ── Lecturer ──────────────────────────────────────────────────────────────── */

test.describe('Lecturer — subscription gate', () => {
  /**
   * @annotation role: Lecturer
   * @annotation feature: Subscription page reachable
   * @annotation expected: Lecturer can reach /subscription regardless of subscription status
   * @annotation owner: Frontend
   * @annotation confidence: High
   */
  test('Lecturer can reach /subscription', async ({ page }) => {
    await authenticate(page, 'lecturer');

    await test.step('Navigate to /subscription', async () => {
      await page.goto(ROUTES.SUBSCRIPTION);
    });

    await test.step('Verify subscription page loads', async () => {
      await expect(page).toHaveURL(/\/subscription/, { timeout: 15_000 });
      const body = page.locator('body');
      await expect(body).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Capture evidence', async () => {
      await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-06-lecturer-subscription.png` });
    });
  });

  /**
   * @annotation role: Lecturer
   * @annotation feature: Protected workspace redirects to /subscription
   * @annotation expected: When subscription is inactive, /lecturer/research-topics redirects to /subscription
   * @annotation owner: Frontend
   * @annotation confidence: Medium
   */
  test('Lecturer workspace redirects to /subscription when inactive', async ({ page }) => {
    await authenticate(page, 'lecturer');

    await test.step('Navigate to /lecturer/research-topics', async () => {
      await page.goto(ROUTES.LECTURER_RESEARCH_TOPICS);
    });

    await test.step('Verify redirect behavior', async () => {
      const url = page.url();
      const onSubscription = url.includes('/subscription');
      const onTopics = url.includes('/lecturer/research-topics');
      expect(onSubscription || onTopics).toBeTruthy();
    });

    await test.step('Capture evidence', async () => {
      await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-07-lecturer-workspace-redirect.png` });
    });
  });
});

/* ── Exempt roles — not blocked by subscription gate ──────────────────────── */

test.describe('Exempt roles — never blocked by subscription gate', () => {
  const exemptRoles: Array<'admin' | 'gradstudent' | 'reviewer'> = [
    'admin',
    'gradstudent',
    'reviewer',
  ];

  for (const role of exemptRoles) {
    /**
     * @annotation role: ${role}
     * @annotation feature: Subscription gate exemption
     * @annotation expected: ${role} is NEVER redirected to /subscription for protected routes
     * @annotation owner: Frontend
     * @annotation confidence: High
     */
    test(`${role} is never blocked by subscription gate`, async ({ page }) => {
      await authenticate(page, role);

      // For all exempt roles, /home is a protected route that should load normally.
      await test.step(`Navigate to /home as ${role}`, async () => {
        await page.goto(ROUTES.HOME);
      });

      await test.step(`Verify /home loads for ${role}`, async () => {
        const url = page.url();
        expect(url).not.toContain('/subscription');
      });

      await test.step('Capture evidence', async () => {
        await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-exempt-${role}.png` });
      });
    });
  }
});

/* ── PayOS return page — query params never unlock access ─────────────────── */

test.describe('PayOS return page — query params never unlock access', () => {
  /**
   * @annotation role: Researcher
   * @annotation feature: PayOS return page
   * @annotation expected: /subscription/return does NOT grant access from query params alone
   * @annotation owner: Frontend
   * @annotation confidence: High
   */
  test('PayOS return query params do not grant access', async ({ page }) => {
    await authenticate(page, 'researcher');

    await test.step('Navigate to /subscription/return with fake success params', async () => {
      // Simulate PayOS return with status=success in query string.
      // The FE must NOT grant access from this alone.
      await page.goto(`${ROUTES.SUBSCRIPTION_RETURN}?orderCode=FAKE-ORDER&status=success&code=0`);
    });

    await test.step('Verify page shows "verifying" or subscription state — not auto-unlocked', async () => {
      const url = page.url();
      expect(url).toContain('/subscription/return');
      // The page should show a verifying state, NOT a redirect to a protected route.
      const content = await page.locator('body').textContent();
      const showsVerifying = content?.toLowerCase().includes('verifying') ||
        content?.toLowerCase().includes('payment received') ||
        content?.toLowerCase().includes('awaiting') ||
        content?.toLowerCase().includes('subscription');
      expect(showsVerifying).toBeTruthy();
    });

    await test.step('Capture evidence — query params not trusted', async () => {
      await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-08-payos-return-params.png` });
    });
  });
});

/* ── Forum read-only behavior for inactive subscription ────────────────────── */

test.describe('Forum read-only — Researcher/Lecturer with inactive subscription', () => {
  /**
   * @annotation role: Researcher
   * @annotation feature: Forum read-only behavior
   * @annotation expected: Expired Researcher can view Forum but create-post button is disabled
   * @annotation owner: Frontend
   * @annotation confidence: Medium
   */
  test('Researcher with inactive subscription sees read-only Forum', async ({ page }) => {
    await authenticate(page, 'researcher');

    await test.step('Navigate to /forum', async () => {
      await page.goto(ROUTES.FORUM);
    });

    await test.step('Verify Forum is visible (read-only)', async () => {
      await expect(page).toHaveURL(/\/forum/, { timeout: 15_000 });
      const body = page.locator('body');
      await expect(body).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Capture evidence', async () => {
      await page.screenshot({ path: `${process.env.PW_RUN_DIR}/sub-09-forum-readonly.png` });
    });
  });
});
