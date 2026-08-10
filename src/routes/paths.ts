export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
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
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

export default ROUTES;
