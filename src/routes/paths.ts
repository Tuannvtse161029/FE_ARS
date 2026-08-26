export const ROUTES = {
  HOME: '/home',
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
  RESEARCHER_SUBMISSIONS: '/researcher/submissions',
  RESEARCHER_SUBMISSION_NEW: '/researcher/submissions/new',
  RESEARCHER_SUBMISSION_DETAIL: '/researcher/submissions/:id',
  REVIEWER_ASSIGNMENTS: '/reviewer/assignments',
  REVIEWER_ASSIGNMENT_DETAIL: '/reviewer/assignments/:id',
  ADMIN_PAPER_SUBMISSIONS: '/admin/paper-submissions',
  ADMIN_PAPER_SUBMISSION_DETAIL: '/admin/paper-submissions/:id',
  ADMIN_REVIEWER_ASSIGNMENTS: '/admin/reviewer-assignments',
  ADMIN_PUBLISHED_PAPERS: '/admin/published-papers',
  PROFILE: '/profile',
  PROFESSIONAL_PROFILE: '/reviewer/professional-profile',
  ACCOUNT_SETTINGS: '/account-settings',
  STUDENT_RESEARCH_GROUPS: '/student/research-groups',
  GRADUATE_STUDENT_DASHBOARD: '/student/dashboard',
  LECTURER_EVALUATE_REPORTS: '/lecturer/evaluate-reports',
  LECTURER_GROUP_DETAIL: '/lecturer/groups/:groupId',
  LECTURER_GUIDANCE_PROJECTS: '/lecturer/guidance-projects',
  // Agent lecturer-navigation — top-level Lecturer surface for the Research
  // Topics CRUD (previously a nested section inside Research Groups).
  // Shared edit: only an additive constant was appended. See
  // docs/BACKEND_REQUESTS.md under "Coordination — Agent Lecturer Navigation".
  LECTURER_RESEARCH_TOPICS: '/lecturer/research-topics',
  // Agent lecturer-navigation — top-level Lecturer surface for Learning
  // Materials. Previously the CRUD lived only inside the per-topic modal.
  // Shared, additive registration: see BACKEND_REQUESTS.md "Coordination".
  LECTURER_LEARNING_MATERIALS: '/lecturer/learning-materials',
  ADMIN: '/admin',
  ADMIN_ROLE_REQUESTS: '/admin/role-requests',
  ADMIN_ACCOUNTS: '/admin/accounts',
  ADMIN_TRANSACTIONS: '/admin/transactions',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_PACKAGES: '/admin/packages',
  // Agent admin-annual-fees — Admin Annual Fees tab. Mounted at
  // /admin/annual-fees and exposed only when the Admin user is signed
  // in; other roles cannot reach this route. Backend request:
  // docs/BACKEND_REQUESTS.md → BTR-AF-01 (BE has not shipped the
  // annual-fee CRUD endpoint yet — the page renders against
  // src/data/annualFees.demo.ts).
  ADMIN_ANNUAL_FEES: '/admin/annual-fees',
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
  // Agent email-verification — public deep-link landing for the
  // registration email. The BE redirects the user here with `?token=...`
  // after they click the verification link. The page forwards the token
  // exactly once to `POST /api/Auth/verify-email?token=...` and renders
  // one of three outcomes (verified / expired / malformed).
  VERIFY_EMAIL: '/verify-email',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

export default ROUTES;
