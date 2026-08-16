export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  VERIFY_OTP: '/forgot-password/verify',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/dashboard',
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
  ACCOUNT_SETTINGS: '/account-settings',
  STUDENT_RESEARCH_GROUPS: '/student/research-groups',
  ADMIN: '/admin',
  ADMIN_ROLE_REQUESTS: '/admin/role-requests',
  ADMIN_ACCOUNTS: '/admin/accounts',
  ADMIN_TRANSACTIONS: '/admin/transactions',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_PACKAGES: '/admin/packages',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  PAYMENT_RETURN: '/payment/return',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

export default ROUTES;
