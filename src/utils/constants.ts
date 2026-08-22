// Fallback to the live Swagger BE when no VITE_API_BASE_URL is provided.
// Without this, a production build (e.g. on Vercel) would default to
// http://localhost:5000 — which is unreachable from end-user browsers and
// produces a Network Timeout on login. Local dev can override this in
// .env.local with VITE_API_BASE_URL=http://localhost:5000.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://arsplatform.onrender.com';

// Frontend origin URL — used for OAuth callbacks, redirect URLs, and absolute links.
// Override in .env.production with VITE_APP_URL=https://your-app.vercel.app
export const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    GOOGLE_LOGIN: '/api/auth/google-login',
    // Agent 54 — backend-driven Google OAuth (Authorization Code flow).
    // GET /api/Auth/google-oauth-login begins the BE handshake; GET
    // /api/Auth/google-callback?code=&error= completes it on our /auth/google/callback
    // route. The old `POST /api/auth/google-login` (GIS credential swap) is
    // retained for backward compatibility but is no longer the primary path.
    GOOGLE_OAUTH_LOGIN: '/api/auth/google-oauth-login',
    GOOGLE_CALLBACK: '/api/auth/google-callback',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    VERIFY_OTP: '/api/auth/verify-otp',
    RESET_PASSWORD: '/api/auth/reset-password',
    VERIFY_EMAIL: '/api/auth/verify-email',
    SEND_APPROVAL_EMAIL: '/api/auth/send-approval-email',
  },
  ROLE: {
    GET_ALL: '/api/Role',
  },
  USER: {
    BASE: '/api/user',
    GET_ALL: '/api/user',
    GET_BY_ID: (id: number) => `/api/user/${id}`,
    UPDATE: (id: number) => `/api/user/${id}`,
    DELETE: (id: number) => `/api/user/${id}`,
  },
  PAPER: {
    BASE: '/api/paper',
    GET_ALL: '/api/paper',
    GET_BY_ID: (id: number) => `/api/paper/${id}`,
    CREATE: '/api/paper',
    UPDATE: (id: number) => `/api/paper/${id}`,
    DELETE: (id: number) => `/api/paper/${id}`,
  },
  PROFESSIONAL_PROFILE: {
    GET_ALL: '/api/ProfessionalProfile',
    GET_BY_ID: (id: number) => `/api/ProfessionalProfile/${id}`,
    UPDATE: (id: number) => `/api/ProfessionalProfile/${id}`,
    UPDATE_AVAILABILITY: (id: number) => `/api/ProfessionalProfile/${id}/availability`,
  },
  PROFILE: {
    GET_CURRENT: '/api/Profile',
    GET_BY_ID: (id: number) => `/api/Profile/${id}`,
    UPDATE: (id: number) => `/api/Profile/${id}`,
    PATCH: (id: number) => `/api/Profile/${id}`,
    DELETE: (id: number) => `/api/Profile/${id}`,
  },
  REVIEW_REQUEST: {
    BASE: '/api/ReviewRequest',
    GET_ALL: '/api/ReviewRequest',
    CREATE: '/api/ReviewRequest',
    GET_BY_ID: (id: number) => `/api/ReviewRequest/${id}`,
    UPDATE: (id: number) => `/api/ReviewRequest/${id}`,
    DELETE: (id: number) => `/api/ReviewRequest/${id}`,
  },
  DETAILED_EVALUATION: {
    GET_ALL: '/api/DetailedEvaluation',
    GET_BY_ID: (id: number) => `/api/DetailedEvaluation/${id}`,
    UPDATE: (id: number) => `/api/DetailedEvaluation/${id}`,
  },
  WITHDRAWAL_REQUEST: {
    BASE: '/api/WithdrawalRequest',
    GET_ALL: '/api/WithdrawalRequest',
    CREATE: '/api/WithdrawalRequest',
    GET_BY_ID: (id: number) => `/api/WithdrawalRequest/${id}`,
    UPDATE: (id: number) => `/api/WithdrawalRequest/${id}`,
  },
  SEMINAR: {
    BASE: '/api/Seminar',
    GET_ALL: '/api/Seminar',
    CREATE: '/api/Seminar',
    GET_BY_ID: (id: number) => `/api/Seminar/${id}`,
    UPDATE: (id: number) => `/api/Seminar/${id}`,
    DELETE: (id: number) => `/api/Seminar/${id}`,
    SUMMARIZE_AUDIO: (id: number) => `/api/Seminar/${id}/summarize-audio`,
  },
  SEMINAR_PARTICIPANT: {
    BASE: '/api/SeminarParticipant',
    GET_ALL: '/api/SeminarParticipant',
    CREATE: '/api/SeminarParticipant',
    GET_BY_ID: (id: number) => `/api/SeminarParticipant/${id}`,
    UPDATE: (id: number) => `/api/SeminarParticipant/${id}`,
    DELETE: (id: number) => `/api/SeminarParticipant/${id}`,
  },
  PAYMENT: {
    CREATE_LINK: '/api/Payment/create-link',
    SUCCESS: '/api/Payment/success',
    CANCEL: '/api/Payment/cancel',
    CANCEL_ORDER: (orderCode: number | string) => `/api/Payment/cancel/${orderCode}`,
    WEBHOOK: '/api/Payment/webhook',
  },
  FOLLOWER: {
    BASE: '/api/Follower',
    GET_ALL: '/api/Follower',
    CREATE: '/api/Follower',
    DELETE: (id: number) => `/api/Follower/${id}`,
  },
  NOTIFICATION: {
    BASE: '/api/Notification',
    GET_ALL: '/api/Notification',
    CREATE: '/api/Notification',
    GET_BY_ID: (id: number) => `/api/Notification/${id}`,
    UPDATE: (id: number) => `/api/Notification/${id}`,
    DELETE: (id: number) => `/api/Notification/${id}`,
  },
  USER_ROLE: {
    BASE: '/api/UserRole',
    GET_ALL: '/api/UserRole',
    CREATE: '/api/UserRole',
    GET_BY_ID: (id: number) => `/api/UserRole/${id}`,
    UPDATE: (id: number) => `/api/UserRole/${id}`,
    DELETE: (id: number) => `/api/UserRole/${id}`,
  },
  MAJOR_FIELD: {
    BASE: '/api/MajorField',
    GET_ALL: '/api/MajorField',
    CREATE: '/api/MajorField',
    GET_BY_ID: (id: number) => `/api/MajorField/${id}`,
    UPDATE: (id: number) => `/api/MajorField/${id}`,
    DELETE: (id: number) => `/api/MajorField/${id}`,
  },
  SUB_FIELD: {
    BASE: '/api/SubField',
    GET_ALL: '/api/SubField',
    CREATE: '/api/SubField',
    GET_BY_ID: (id: number) => `/api/SubField/${id}`,
    UPDATE: (id: number) => `/api/SubField/${id}`,
    DELETE: (id: number) => `/api/SubField/${id}`,
  },
  COMMENT_VOTE: {
    BASE: '/api/CommentVote',
    GET_ALL: '/api/CommentVote',
    CREATE: '/api/CommentVote',
  },
  FORUM_POST: {
    BASE: '/api/ForumPost',
    GET_ALL: '/api/ForumPost',
    GET_BY_ID: (id: number) => `/api/ForumPost/${id}`,
    CREATE: '/api/ForumPost',
  },
  FORUM_COMMENT: {
    BASE: '/api/ForumComment',
    GET_ALL: '/api/ForumComment',
    GET_BY_ID: (id: number) => `/api/ForumComment/${id}`,
    CREATE: '/api/ForumComment',
    UPDATE: (id: number) => `/api/ForumComment/${id}`,
    DELETE: (id: number) => `/api/ForumComment/${id}`,
  },
  WALLET: {
    BASE: '/api/Wallet',
    GET_ALL: '/api/Wallet',
    GET_BY_ID: (id: number) => `/api/Wallet/${id}`,
    // DEV-only shortcut: POST `/api/Wallet` with `{ userId, balance }` to
    // fund a wallet instantly without going through the PayOS redirect flow.
    // Hidden in production builds (see WalletTopUpModal). Documented in
    // docs/local-only/admin-suite-be-gap-report.md (WALLET auto-fund).
    AUTO_FUND: '/api/Wallet',
  },
  // Admin surface — see docs/local-only/admin-suite-be-gap-report.md.
  // All paths here are written against the upcoming Swagger contract; until BE
  // ships them, `adminService` short-circuits to mock data via USE_MOCK_DATA.
  ADMIN: {
    ROLE_REQUESTS: {
      GET_ALL: '/api/RoleRequest',
      GET_BY_ID: (id: number) => `/api/RoleRequest/${id}`,
      APPROVE: (id: number) => `/api/RoleRequest/${id}/approve`,
      DENY: (id: number) => `/api/RoleRequest/${id}/deny`,
    },
    ACCOUNTS: {
      GET_ALL: '/api/Account',
      GET_BY_ID: (id: number) => `/api/Account/${id}`,
      SUSPEND: (id: number) => `/api/Account/${id}/suspend`,
      UNSUSPEND: (id: number) => `/api/Account/${id}/unsuspend`,
    },
    WITHDRAWALS: {
      GET_ALL: '/api/WithdrawalRequest',
      ACCEPT: (id: number) => `/api/WithdrawalRequest/${id}/accept`,
      COMPLETE: (id: number) => `/api/WithdrawalRequest/${id}/complete`,
      DENY: (id: number) => `/api/WithdrawalRequest/${id}/deny`,
    },
    REPORTS: {
      GET_ALL: '/api/ViolationReport',
      GET_BY_ID: (id: number) => `/api/ViolationReport/${id}`,
      RESOLVE: (id: number) => `/api/ViolationReport/${id}/resolve`,
    },
    PACKAGES: {
      GET_ALL: '/api/PremiumPackage',
      CREATE: '/api/PremiumPackage',
      UPDATE: (id: number) => `/api/PremiumPackage/${id}`,
      DELETE: (id: number) => `/api/PremiumPackage/${id}`,
      TOGGLE: (id: number) => `/api/PremiumPackage/${id}/toggle`,
    },
    AUDIT_LOGS: {
      GET_ALL: '/api/AuditLog',
      EXPORT: '/api/AuditLog/export',
    },
  },
  ANALYTICS: {
    SUMMARY: '/api/Analytics/summary',
    TIMESERIES: '/api/Analytics/timeseries',
  },
  // Lecturer ↔ Graduate Student workflow surface — see
  // docs/local-only/research-workflow-contract.md §1. Agent 1 and Agent 2
  // both write to these paths; the contract is the single source of truth.
  RESEARCH_WORKFLOW: {
    GUIDANCE_PROJECT: {
      GET_ALL: '/api/GuidanceProject',
      GET_BY_ID: (id: number) => `/api/GuidanceProject/${id}`,
      CREATE: '/api/GuidanceProject',
      UPDATE: (id: number) => `/api/GuidanceProject/${id}`,
    },
    RESEARCH_TOPIC: {
      GET_ALL: '/api/ResearchTopic',
      GET_BY_ID: (id: number) => `/api/ResearchTopic/${id}`,
      CREATE: '/api/ResearchTopic',
      UPDATE: (id: number) => `/api/ResearchTopic/${id}`,
    },
    RESEARCH_GROUP: {
      GET_ALL: '/api/ResearchGroup',
      GET_BY_ID: (id: number) => `/api/ResearchGroup/${id}`,
      CREATE: '/api/ResearchGroup',
      UPDATE: (id: number) => `/api/ResearchGroup/${id}`,
    },
    GROUP_MEMBER: {
      GET_ALL: '/api/GroupMember',
      GET_BY_ID: (id: number) => `/api/GroupMember/${id}`,
      CREATE: '/api/GroupMember',
      UPDATE: (id: number) => `/api/GroupMember/${id}`,
    },
    PHASED_REPORT: {
      GET_ALL: '/api/PhasedReport',
      GET_BY_ID: (id: number) => `/api/PhasedReport/${id}`,
      CREATE: '/api/PhasedReport',
      UPDATE: (id: number) => `/api/PhasedReport/${id}`,
    },
    LEARNING_MATERIAL: {
      GET_ALL: '/api/LearningMaterial',
      GET_BY_ID: (id: number) => `/api/LearningMaterial/${id}`,
      CREATE: '/api/LearningMaterial',
      UPDATE: (id: number) => `/api/LearningMaterial/${id}`,
    },
  },
} as const;

export const STORAGE_KEYS = {
  TOKEN: 'ars_token',
  USER: 'ars_user',
  REMEMBER_ME: 'ars_remember',
} as const;

export const ROLES = {
  RESEARCHER: 'Researcher',
  REVIEWER: 'Reviewer',
  LECTURER: 'Lecturer',
  GRADUATE_STUDENT: 'Graduate Student',
} as const;

export const REPORT = {
  BASE: '/api/Report',
  CREATE: '/api/Report',
  GET_ALL: '/api/Report',
  GET_BY_ID: (id: number) => `/api/Report/${id}`,
  UPDATE: (id: number) => `/api/Report/${id}`,
} as const;

export type RoleName = typeof ROLES[keyof typeof ROLES];

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  FORUM: '/forum',
  USERS: '/users',
  PAPERS: '/papers',
  PROFILE: '/profile',
  ACCOUNT_SETTINGS: '/account-settings',
  ADMIN: '/admin',
} as const;

export const PAPER_STATUS = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
} as const;
