// Fallback to the live Swagger BE when no VITE_API_BASE_URL is provided.
// Without this, a production build (e.g. on Vercel) would default to
// http://localhost:5000 — which is unreachable from end-user browsers and
// produces a Network Timeout on login. Local dev can override this in
// .env.local with VITE_API_BASE_URL=http://localhost:5000.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://arsplatform.onrender.com';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    VERIFY_OTP: '/api/auth/verify-otp',
    RESET_PASSWORD: '/api/auth/reset-password',
    VERIFY_EMAIL: '/api/auth/verify-email',
    SEND_APPROVAL_EMAIL: '/api/auth/send-approval-email',
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

export type RoleName = typeof ROLES[keyof typeof ROLES];

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  FORUM: '/forum',
  DASHBOARD: '/dashboard',
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
