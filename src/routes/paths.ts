export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  VERIFY_OTP: '/forgot-password/verify',
  RESET_PASSWORD: '/reset-password',
  FORUM: '/forum',
  REVIEWERS: '/reviewers',
  EVALUATION: '/evaluation',
  SEMINAR_WORKSPACE: '/seminar-workspace',
  RESEARCH_GROUP: '/research-group',
  CONFIGURE_MILESTONES: '/configure-milestones',
  SUBMIT_REPORT: '/submit-report',
  EARNINGS_WALLET: '/earnings-wallet',
  REVIEW_TASKS: '/review-tasks',
  USERS: '/users',
  PAPERS: '/papers',
  PROFILE: '/profile',
  PROFESSIONAL_PROFILE: '/reviewer/professional-profile',
  ACCOUNT_SETTINGS: '/account-settings',
  STUDENT_RESEARCH_GROUPS: '/student/research-groups',
  GRADUATE_STUDENT_DASHBOARD: '/student/dashboard',
  LECTURER_EVALUATE_REPORTS: '/lecturer/evaluate-reports',
  LECTURER_GROUP_DETAIL: '/lecturer/groups/:groupId',
  LECTURER_GUIDANCE_PROJECTS: '/lecturer/guidance-projects',
  ADMIN: '/admin',
  ADMIN_ROLE_REQUESTS: '/admin/role-requests',
  ADMIN_ACCOUNTS: '/admin/accounts',
  ADMIN_TRANSACTIONS: '/admin/transactions',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_PACKAGES: '/admin/packages',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  PAYMENT_RETURN: '/payment/return',
  PREMIUM_PACKAGES: '/premium-packages',
  // Agent 52 — first-time Google-user onboarding. Created by the GIS button
  // when the BE's google-login response carries `isNewUser === true` or
  // `requiresOnboarding === true` (see src/services/googleAuth.service.ts).
  // Public route — the page is responsible for re-validating the session
  // before letting the user submit a proof.
  COMPLETE_GOOGLE_REGISTRATION: '/complete-google-registration',
  // Agent 54 — backend OAuth callback landing page. The BE redirects here
  // after `/api/Auth/google-callback` finishes the handshake (with
  // `?code=...` on success or `?error=...access_denied` on cancel/error).
  // The page consumes the query string once, persists the session through
  // the existing ARS auth-storage path, and replaces itself with the
  // workspace / onboarding / rejection route — it does NOT keep the
  // `code` in the address bar or in sessionStorage after rendering.
  GOOGLE_OAUTH_CALLBACK: '/auth/google/callback',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

export default ROUTES;
