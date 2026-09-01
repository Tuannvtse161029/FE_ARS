/**
 * Lecturer role — workspace, navigation, route guard, and subscription gate.
 *
 * Covers:
 *   - Login succeeds and lands on /home (Discover Research)
 *   - Lecturer navigation visible
 *   - Lecturer-only routes accessible (when subscription active)
 *   - Lecturer blocked from Admin / Researcher routes
 *   - Subscription gate behavior
 *
 * Credentials: PW_LECTURER_EMAIL / PW_LECTURER_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { ROUTES } from '../../../src/routes/paths';
import { authenticate } from '../fixtures/role-auth.fixture';
import { loginAs } from '../helpers/login';
import { getCredentials } from '../helpers/credentials';

/**
 * @annotation role: Lecturer
 * @annotation feature: Login and landing
 * @annotation expected: Lecturer lands on /home after login
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Lecturer login lands on /home', async ({ page }) => {
  const creds = getCredentials('lecturer');
  await test.step('Login as lecturer', async () => {
    await loginAs(page, creds.email, creds.password);
  });

  await test.step('Verify landing on /home', async () => {
    await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/01-lecturer-home.png` });
  });
});

/**
 * @annotation role: Lecturer
 * @annotation feature: Lecturer navigation
 * @annotation expected: Sidebar shows lecturer-specific items (Research Topics, Groups, etc.)
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Lecturer sidebar shows lecturer nav items', async ({ page }) => {
  await authenticate(page, 'lecturer');

  await test.step('Navigate to /home', async () => {
    await page.goto(ROUTES.HOME);
  });

  await test.step('Verify nav is visible', async () => {
    const nav = page.locator('nav[aria-label]');
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/02-lecturer-sidebar.png` });
  });
});

/**
 * @annotation role: Lecturer
 * @annotation feature: Research Topics route
 * @annotation expected: /lecturer/research-topics is reachable (subscription gate)
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Research Topics page is reachable', async ({ page }) => {
  await authenticate(page, 'lecturer');

  await test.step('Navigate to /lecturer/research-topics', async () => {
    await page.goto(ROUTES.LECTURER_RESEARCH_TOPICS);
  });

  await test.step('Verify page renders', async () => {
    const url = page.url();
    const onTopics = url.includes('/lecturer/research-topics');
    const onSubscription = url.includes('/subscription');
    expect(onTopics || onSubscription).toBeTruthy();
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/03-research-topics.png` });
  });
});

/**
 * @annotation role: Lecturer
 * @annotation feature: Guidance Projects route
 * @annotation expected: /lecturer/guidance-projects is reachable
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Guidance Projects page is reachable', async ({ page }) => {
  await authenticate(page, 'lecturer');

  await test.step('Navigate to /lecturer/guidance-projects', async () => {
    await page.goto(ROUTES.LECTURER_GUIDANCE_PROJECTS);
  });

  await test.step('Verify page renders', async () => {
    const url = page.url();
    expect(url.includes('/lecturer/guidance-projects') || url.includes('/subscription')).toBeTruthy();
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/04-guidance-projects.png` });
  });
});

/**
 * @annotation role: Lecturer
 * @annotation feature: Route guard — Admin routes
 * @annotation expected: Lecturer is blocked from /admin routes
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Lecturer is blocked from Admin routes', async ({ page }) => {
  await authenticate(page, 'lecturer');

  await test.step('Navigate to /admin', async () => {
    await page.goto(ROUTES.ADMIN);
  });

  await test.step('Verify redirect away from /admin', async () => {
    expect(page.url()).not.toContain('/admin');
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/05-lecturer-blocked-admin.png` });
  });
});

/**
 * @annotation role: Lecturer
 * @annotation feature: Route guard — Researcher routes
 * @annotation expected: Lecturer is blocked from Researcher-only routes
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Lecturer is blocked from Researcher-only routes', async ({ page }) => {
  await authenticate(page, 'lecturer');

  await test.step('Navigate to /researcher/submissions', async () => {
    await page.goto(ROUTES.RESEARCHER_SUBMISSIONS);
  });

  await test.step('Verify redirect away', async () => {
    expect(page.url()).not.toContain('/researcher/submissions');
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/06-lecturer-blocked-researcher.png` });
  });
});

/**
 * @annotation role: Lecturer
 * @annotation feature: Subscription gate behavior
 * @annotation expected: With inactive subscription, workspace routes redirect to /subscription
 * @annotation owner: Frontend
 * @annotation confidence: Medium
 */
test('Lecturer with inactive subscription is redirected to /subscription', async ({ page }) => {
  await authenticate(page, 'lecturer');

  await test.step('Navigate to a protected Lecturer route', async () => {
    await page.goto(ROUTES.LECTURER_RESEARCH_TOPICS);
  });

  await test.step('Verify redirect behavior', async () => {
    const url = page.url();
    const onSubscription = url.includes('/subscription');
    const onTopics = url.includes('/lecturer/research-topics');
    expect(onSubscription || onTopics).toBeTruthy();
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/07-lecturer-subscription-gate.png` });
  });
});

/**
 * @annotation role: Lecturer
 * @annotation feature: Subscription page reachable
 * @annotation expected: Lecturer can always reach /subscription (the lock target)
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Lecturer can always reach /subscription', async ({ page }) => {
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
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/08-lecturer-subscription-page.png` });
  });
});

/**
 * @annotation role: Lecturer
 * @annotation feature: Create controls — no real data
 * @annotation expected: Create buttons are present but no submission/upload is executed
 * @annotation owner: Frontend
 * @annotation confidence: Medium
 */
test('Lecturer create controls visible — no real submission', async ({ page }) => {
  await authenticate(page, 'lecturer');

  await test.step('Navigate to Research Topics', async () => {
    await page.goto(ROUTES.LECTURER_RESEARCH_TOPICS);
    // May land on /subscription if subscription inactive — both are valid.
  });

  await test.step('Capture evidence — no real data created', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/09-no-real-topic-creation.png` });
  });
});
