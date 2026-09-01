/**
 * Route guard checks — shared assertions for role-based access control.
 *
 * These helpers mirror the frontend guard logic (RoleRouteGuard,
 * SubscriptionRouteGuard, useVerifiedGuard) so the Playwright suite can
 * verify that the UI enforces the same rules end-to-end.
 *
 * Each function returns `true` when the route IS accessible and throws
 * a descriptive assertion error when it is NOT (so Playwright's `expect()`
 * can consume the return value naturally).
 */
import type { Page } from '@playwright/test';
import { ROUTES } from '../../../src/routes/paths';

/** Expected landing page for each role after login. */
export const LANDING_BY_ROLE: Record<string, string> = {
  Admin: ROUTES.ADMIN,
  Researcher: ROUTES.HOME,
  Lecturer: ROUTES.HOME,
  'Graduate Student': ROUTES.GRADUATE_STUDENT_DASHBOARD,
  Reviewer: ROUTES.HOME,
  Guest: ROUTES.FORUM,
};

/** Routes only accessible to Admin. */
export const ADMIN_ONLY_ROUTES = [
  ROUTES.ADMIN,
  ROUTES.ADMIN_ROLE_REQUESTS,
  ROUTES.ADMIN_ACCOUNTS,
  ROUTES.ADMIN_TRANSACTIONS,
  ROUTES.ADMIN_REPORTS,
  ROUTES.ADMIN_PACKAGES,
  ROUTES.ADMIN_ANNUAL_FEES,
  ROUTES.ADMIN_AUDIT_LOGS,
  ROUTES.ADMIN_PAPER_SUBMISSIONS,
  ROUTES.ADMIN_PAPER_SUBMISSION_DETAIL,
  ROUTES.ADMIN_REVIEWER_ASSIGNMENTS,
  ROUTES.ADMIN_PUBLISHED_PAPERS,
];

/** Routes only accessible to Reviewer. */
export const REVIEWER_ONLY_ROUTES = [
  ROUTES.REVIEWER_ASSIGNMENTS,
  ROUTES.REVIEWER_ASSIGNMENT_DETAIL,
  ROUTES.PROFESSIONAL_PROFILE,
  ROUTES.EVALUATION,
  ROUTES.REVIEW_TASKS,
];

/** Routes only accessible to Researcher. */
export const RESEARCHER_ONLY_ROUTES = [
  ROUTES.RESEARCHER_SUBMISSIONS,
  ROUTES.RESEARCHER_SUBMISSION_NEW,
  ROUTES.RESEARCHER_SUBMISSION_DETAIL,
];

/** Routes only accessible to Lecturer. */
export const LECTURER_ONLY_ROUTES = [
  ROUTES.RESEARCH_GROUP,
  ROUTES.CONFIGURE_MILESTONES,
  ROUTES.LECTURER_EVALUATE_REPORTS,
  ROUTES.LECTURER_PHASE_REPORTS,
  ROUTES.LECTURER_GUIDANCE_PROJECTS,
  ROUTES.LECTURER_RESEARCH_TOPICS,
  ROUTES.LECTURER_MATERIALS,
  // DEPRECATED: legacy routes redirect to LECTURER_MATERIALS.
  ROUTES.LECTURER_LEARNING_MATERIALS,
  ROUTES.LECTURER_SHARED_MATERIALS,
];

/** Routes only accessible to Graduate Student. */
export const GRADSTUDENT_ONLY_ROUTES = [
  ROUTES.STUDENT_RESEARCH_GROUPS,
  ROUTES.SUBMIT_REPORT,
  ROUTES.GRADUATE_STUDENT_DASHBOARD,
];

/**
 * Verify a route is accessible (returns true) or is blocked (throws).
 * We check the URL after navigation: if the page landed on the target path,
 * the guard passed. If it landed on a different path (e.g. /login,
 * /subscription, /forum), the guard blocked it.
 */
export async function expectRouteAccessible(
  page: Page,
  route: string,
  role: string,
): Promise<void> {
  await page.goto(route);
  const finalUrl = page.url();
  const finalPath = new URL(finalUrl).pathname;

  if (finalPath === route) return; // Guard passed.

  // Guard blocked — classify the landing page for the failure message.
  if (finalPath.startsWith('/login')) {
    throw new Error(
      `[guard] ${role} navigated to ${route} but was redirected to /login — authentication guard may have failed.`,
    );
  }
  if (finalPath.startsWith('/subscription')) {
    throw new Error(
      `[guard] ${role} navigated to ${route} but was redirected to /subscription — subscription gate is blocking this route.`,
    );
  }
  throw new Error(
    `[guard] ${role} navigated to ${route} but landed on ${finalPath}.`,
  );
}

/**
 * Verify a route is blocked for the given role (redirected away from
 * the target path).
 */
export async function expectRouteBlocked(
  page: Page,
  route: string,
  role: string,
): Promise<void> {
  await page.goto(route);
  const finalUrl = page.url();
  const finalPath = new URL(finalUrl).pathname;

  if (finalPath !== route) return; // Guard blocked — good.

  // Guard did not block — the route should have been restricted.
  throw new Error(
    `[guard] ${role} should be blocked from ${route} but accessed it successfully. Route guard may be missing.`,
  );
}

/**
 * Verify a subscription-gated route for Researcher/Lecturer.
 * If `subscriptionActive` is false, the route must redirect to /subscription.
 * If true, the route must load normally.
 */
export async function expectSubscriptionRouteAccess(
  page: Page,
  route: string,
  role: 'Researcher' | 'Lecturer',
  subscriptionActive: boolean,
): Promise<void> {
  await page.goto(route);
  const finalPath = new URL(page.url()).pathname;

  if (subscriptionActive) {
    if (finalPath === route) return;
    throw new Error(
      `[guard] ${role} with ACTIVE subscription navigated to ${route} but landed on ${finalPath}.`,
    );
  } else {
    // Subscription is inactive — must be redirected to /subscription.
    if (finalPath.startsWith('/subscription')) return;
    if (finalPath === route) {
      throw new Error(
        `[guard] ${role} with INACTIVE subscription should be blocked from ${route} but accessed it.`,
      );
    }
    throw new Error(
      `[guard] ${role} navigated to ${route} but landed on ${finalPath} — unexpected redirect.`,
    );
  }
}
