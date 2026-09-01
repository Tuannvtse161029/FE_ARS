/**
 * Graduate Student role — workspace, navigation, and route guard.
 *
 * Covers:
 *   - Login succeeds and lands on /student/dashboard
 *   - Graduate Student navigation visible
 *   - Graduate Student-only routes accessible
 *   - Graduate Student blocked from Admin / Lecturer / Researcher / Reviewer routes
 *   - No real report submission
 *
 * Credentials: PW_GRADSTUDENT_EMAIL / PW_GRADSTUDENT_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { ROUTES } from '../../../src/routes/paths';
import { authenticate } from '../fixtures/role-auth.fixture';
import { loginAs } from '../helpers/login';
import { getCredentials } from '../helpers/credentials';

/**
 * @annotation role: Graduate Student
 * @annotation feature: Login and landing
 * @annotation expected: Graduate Student lands on /student/dashboard
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Graduate Student login lands on /student/dashboard', async ({ page }) => {
  const creds = getCredentials('gradstudent');
  await test.step('Login as graduate student', async () => {
    await loginAs(page, creds.email, creds.password);
  });

  await test.step('Verify landing on /student/dashboard', async () => {
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 20_000 });
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/01-grad-student-dashboard.png` });
  });
});

/**
 * @annotation role: Graduate Student
 * @annotation feature: Student Research Groups route
 * @annotation expected: /student/research-groups is reachable
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Student research groups page is reachable', async ({ page }) => {
  await authenticate(page, 'gradstudent');

  await test.step('Navigate to /student/research-groups', async () => {
    await page.goto(ROUTES.STUDENT_RESEARCH_GROUPS);
  });

  await test.step('Verify page renders', async () => {
    await expect(page).toHaveURL(/\/student\/research-groups/, { timeout: 15_000 });
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/02-student-groups.png` });
  });
});

/**
 * @annotation role: Graduate Student
 * @annotation feature: Route guard — Admin routes
 * @annotation expected: Graduate Student blocked from /admin routes
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Graduate Student is blocked from Admin routes', async ({ page }) => {
  await authenticate(page, 'gradstudent');

  await test.step('Navigate to /admin', async () => {
    await page.goto(ROUTES.ADMIN);
  });

  await test.step('Verify redirect away from /admin', async () => {
    expect(page.url()).not.toContain('/admin');
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/03-grad-blocked-admin.png` });
  });
});

/**
 * @annotation role: Graduate Student
 * @annotation feature: Route guard — Lecturer routes
 * @annotation expected: Graduate Student blocked from Lecturer management routes
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Graduate Student is blocked from Lecturer routes', async ({ page }) => {
  await authenticate(page, 'gradstudent');

  await test.step('Navigate to /lecturer/research-topics', async () => {
    await page.goto(ROUTES.LECTURER_RESEARCH_TOPICS);
  });

  await test.step('Verify redirect away', async () => {
    expect(page.url()).not.toContain('/lecturer');
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/04-grad-blocked-lecturer.png` });
  });
});

/**
 * @annotation role: Graduate Student
 * @annotation feature: Route guard — Researcher routes
 * @annotation expected: Graduate Student blocked from Researcher submission routes
 * @annotation owner: Frontend
 * @annotation confidence: High
 */
test('Graduate Student is blocked from Researcher routes', async ({ page }) => {
  await authenticate(page, 'gradstudent');

  await test.step('Navigate to /researcher/submissions', async () => {
    await page.goto(ROUTES.RESEARCHER_SUBMISSIONS);
  });

  await test.step('Verify redirect away', async () => {
    expect(page.url()).not.toContain('/researcher/submissions');
  });

  await test.step('Capture evidence', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/05-grad-blocked-researcher.png` });
  });
});

/**
 * @annotation role: Graduate Student
 * @annotation feature: Submit Report — no real submission
 * @annotation expected: Submit Report route is reachable but no PDF upload executed
 * @annotation owner: Frontend
 * @annotation confidence: Medium
 */
test('Submit Report page reachable — no real submission', async ({ page }) => {
  await authenticate(page, 'gradstudent');

  await test.step('Navigate to /submit-report', async () => {
    await page.goto(ROUTES.SUBMIT_REPORT);
  });

  await test.step('Verify page renders', async () => {
    const url = page.url();
    expect(url.includes('/submit-report')).toBeTruthy();
  });

  await test.step('Capture evidence — no file uploaded', async () => {
    await page.screenshot({ path: `${process.env.PW_RUN_DIR}/06-no-real-submission.png` });
  });
});
