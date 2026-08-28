import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { storage } from '../utils/storage';
import type { AxiosErrorResponse } from '../types/api';
import { clearAuthSession } from './auth.service';

let sessionFailureHandled = false;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = storage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Agent 53 — failed-session recovery is delegated to the centralized
// ARS session cleanup so the 401 path stays in lock-step with the
// normal logout path. The interceptor still owns the navigation
// (window.location.href) so a hard redirect survives even when the
// React tree has unmounted; `clearAuthSession` runs synchronously and
// the navigation happens immediately after.
api.interceptors.response.use(
  (response) => {
    const url = (response.config.url ?? '').toLowerCase();
    if (url.includes('/api/auth/')) {
      sessionFailureHandled = false;
    }
    return response;
  },
  (error: AxiosError<AxiosErrorResponse>) => {
    const requestUrl = (error.config?.url ?? '').toLowerCase();
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    // Auth endpoints (login, register, verify-otp, send-approval-email, etc.) and
    // unauthenticated auth pages (/verify-email, /register, /login) must NOT trigger hard redirect to /login on 401.
    const isAuthEndpoint = requestUrl.includes('/api/auth/') || requestUrl.includes('/api/email/');
    const isAuthPage =
      currentPath === '/login' ||
      currentPath === '/register' ||
      currentPath === '/verify-email' ||
      currentPath.startsWith('/forgot-password') ||
      currentPath === '/reset-password';

    if (error.response?.status === 401 && !isAuthEndpoint && !isAuthPage && !sessionFailureHandled) {
      sessionFailureHandled = true;
      clearAuthSession();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    if (error.response?.data?.message) {
      error.message = error.response.data.message;
    } else if (error.code === 'ECONNABORTED') {
      error.message = 'Request timed out. Please try again.';
    } else if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }

    return Promise.reject(error);
  }
);

export default api;
