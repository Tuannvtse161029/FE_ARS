export const ROUTES = {
  LANDING: '/',
  HOME: '/home',
  LOGIN: '/login',
  REGISTER: '/register',
  PRIVACY_POLICY: '/privacy-policy',
  TERMS_OF_SERVICE: '/terms-of-service',
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
  LECTURER_PHASE_REPORTS: '/lecturer/phase-reports',
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
  LECTURER_SHARED_MATERIALS: '/lecturer/shared-materials',
  ADMIN: '/admin',
  ADMIN_ROLE_REQUESTS: '/admin/role-requests',
  ADMIN_ACCOUNTS: '/admin/accounts',
  ADMIN_TRANSACTIONS: '/admin/transactions',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_PACKAGES: '/admin/packages',
  // Agent admin-annual-fees — Admin Annual Fees tab. Mounted at
  // /admin/annual-fees and exposed only when the Admin user is signed
  // in; other roles cannot reach this route. Backend request:
  // tickets/backend/BE_ANNUAL_FEE_API_TICKET.md.
  ADMIN_ANNUAL_FEES: '/admin/annual-fees',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
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
  // FE_ORCID_CONNECT_CALLBACK_FIX_TICKET — public deep-link landing for
  // the BE-owned ORCID OAuth handoff. The BE redirects the browser here
  // with a URL fragment (`#success=true&context=...&registrationTicket=...`
  // for registration, or `#success=true&context=ACCOUNT_LINK` for
  // authenticated account linking). The page parses the fragment once,
  // branches by `context`, and replaces itself with the right destination
  // (Profile for account link, Register for registration). The page must
  // stay outside authenticated-only route guards because the registration
  // callback happens before the user has an ARS JWT.
  ORCID_OAUTH_CALLBACK: '/auth/orcid/callback',
  // Agent researcher-lecturer-subscription — Researcher / Lecturer paid
  // access via PayOS. The page lists 6- and 12-month plans sourced from
  // the BE, exposes a `Proceed to Pay` button that calls
  // `POST /api/Subscription/order`, and shows the documented
  // awaiting-API banner when the BE contract is not yet live. The route
  // itself is always allowed for Researcher / Lecturer (the lock applies
  // to other workspace routes, not to the subscription page).
  SUBSCRIPTION: '/subscription',
  // PayOS return landing. The BE redirects here after the user scans the
  // PayOS QR code. The page shows "Payment received. We are verifying
  // your subscription." and refetches subscription state — it never
  // activates access from the browser query string.
  SUBSCRIPTION_RETURN: '/subscription/return',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

export default ROUTES;
