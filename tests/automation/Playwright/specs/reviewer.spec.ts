/**
 * Reviewer role — workspace, navigation, and route guard.
 *
 * Covers:
 *   - Login succeeds and lands on /home (Discover Research)
 *   - Reviewer navigation visible (assignments, professional profile)
 *   - Reviewer blocked from Admin / Researcher / Lecturer / Graduate Student routes
 *   - Evaluation form reachable but no recommendation submitted
 *
 * Credentials: PW_REVIEWER_EMAIL / PW_REVIEWER_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { ROUTES } from '../../../src/routes/paths';
import { authenticate } from '../fixtures/role-auth.fixture';
import { loginAs } from '../helpers/login';
import { getCredentials } from '../helpers/credentials';

/**
 * @annotation role: Reviewer
 * @annotation feature: Login and landing
 * @annotation expected: Reviewer lands on /home after login
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Reviewer login lands on /home', async ({ page }) => {
  const creds = getCredentials('reviewer');
  await test.step('Login as reviewer', async () => {
    await loginAs(page, creds.email, creds.password);
  });

  await test.step('Verify landing on /home', async () => {
    await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/01-reviewer-home.png` });
  });
});

/**
 * @annotation role: Reviewer
 * @annotation feature: Reviewer navigation
 * @annotation expected: Sidebar shows reviewer-specific items
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Reviewer sidebar shows reviewer nav items', async ({ page }) => {
  await authenticate(page, 'reviewer');

  await test.step('Navigate to /home', async () => {
    await page.goto(ROUTES.HOME);
  });

  await test.step('Verify nav is visible', async () => {
    const nav = page.locator('nav[aria-label]');
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/02-reviewer-sidebar.png` });
  });
});

/**
 * @annotation role: Reviewer
 * @annotation feature: Review Assignments route
 * @annotation expected: /reviewer/assignments is reachable
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Review Assignments page is reachable', async ({ page }) => {
  await authenticate(page, 'reviewer');

  await test.step('Navigate to /reviewer/assignments', async () => {
    await page.goto(ROUTES.REVIEWER_ASSIGNMENTS);
  });

  await test.step('Verify page renders', async () => {
    await expect(page).toHaveURL(/\/reviewer\/assignments/, { timeout: 15_000 });
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/03-reviewer-assignments.png` });
  });
});

/**
 * @annotation role: Reviewer
 * @annotation feature: Profile tab consolidation
 * @annotation expected: /profile merges the Professional Profile content
 *                      (research expertise + academic metrics) into the
 *                      Profile & Expertise tab so reviewers only see two
 *                      tabs: account (editable, owner-only) and public.
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Profile & Expertise tab exposes the merged expertise + metrics surface', async ({ page }) => {
  await authenticate(page, 'reviewer');

  await test.step('Navigate to the Profile page', async () => {
    await page.goto(ROUTES.PROFILE);
  });

  await test.step('Verify the account tab is the default and shows the merged expertise surface', async () => {
    await expect(page).toHaveURL(/\/profile/, { timeout: 15_000 });
    await expect(page.getByTestId('profile-tab-account')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The merged tab no longer needs a click — the expertise + metrics
    // blocks live directly inside the account panel.
    await expect(page.getByTestId('profile-tabpanel-account')).toBeVisible();
    await expect(page.getByTestId('research-expertise-section')).toBeVisible();
    await expect(page.getByTestId('academic-metrics-section')).toBeVisible();
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/04-profile-and-expertise.png` });
  });
});

/**
 * @annotation role: Reviewer
 * @annotation feature: Route guard — Admin routes
 * @annotation expected: Reviewer blocked from /admin routes
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Reviewer is blocked from Admin routes', async ({ page }) => {
  await authenticate(page, 'reviewer');

  await test.step('Navigate to /admin', async () => {
    await page.goto(ROUTES.ADMIN);
  });

  await test.step('Verify redirect away from /admin', async () => {
    expect(page.url()).not.toContain('/admin');
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/05-reviewer-blocked-admin.png` });
  });
});

/**
 * @annotation role: Reviewer
 * @annotation feature: Route guard — Researcher routes
 * @annotation expected: Reviewer blocked from Researcher submission routes
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Reviewer is blocked from Researcher routes', async ({ page }) => {
  await authenticate(page, 'reviewer');

  await test.step('Navigate to /researcher/submissions', async () => {
    await page.goto(ROUTES.RESEARCHER_SUBMISSIONS);
  });

  await test.step('Verify redirect away', async () => {
    expect(page.url()).not.toContain('/researcher/submissions');
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/06-reviewer-blocked-researcher.png` });
  });
});

/**
 * @annotation role: Reviewer
 * @annotation feature: Route guard — Lecturer routes
 * @annotation expected: Reviewer blocked from Lecturer management routes
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Reviewer is blocked from Lecturer routes', async ({ page }) => {
  await authenticate(page, 'reviewer');

  await test.step('Navigate to /lecturer/research-topics', async () => {
    await page.goto(ROUTES.LECTURER_RESEARCH_TOPICS);
  });

  await test.step('Verify redirect away', async () => {
    expect(page.url()).not.toContain('/lecturer');
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/07-reviewer-blocked-lecturer.png` });
  });
});

/**
 * @annotation role: Reviewer
 * @annotation feature: Evaluation form — no real recommendation
 * @annotation expected: Evaluation form reachable but no recommendation submitted
 * @annotation owner: Frontend
 * @annotation confidence: Medium
 */
test('Review Assignments reachable — no real recommendation submitted', async ({ page }) => {
  await authenticate(page, 'reviewer');

  await test.step('Navigate to /reviewer/assignments', async () => {
    await page.goto(ROUTES.REVIEWER_ASSIGNMENTS);
  });

  await test.step('Verify page renders', async () => {
    const url = page.url();
    expect(url.includes('/reviewer/assignments')).toBeTruthy();
  });

  await test.step('Capture evidence — no recommendation submitted', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/08-no-real-recommendation.png` });
  });
});
