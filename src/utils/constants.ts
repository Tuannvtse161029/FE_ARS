export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
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
} as const;

export const STORAGE_KEYS = {
  TOKEN: 'ars_token',
  USER: 'ars_user',
  REMEMBER_ME: 'ars_remember',
} as const;

export const ROLES = {
  ADMIN: 'Admin',
  RESEARCHER: 'Researcher',
  REVIEWER: 'Reviewer',
} as const;

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORUM: '/forum',
  DASHBOARD: '/dashboard',
  USERS: '/users',
  PAPERS: '/papers',
  PROFILE: '/profile',
} as const;

export const PAPER_STATUS = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
} as const;
