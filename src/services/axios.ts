import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { storage } from '../utils/storage';
import type { AxiosErrorResponse } from '../types/api';

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
    const url = response.config.url ?? '';
    if (url.includes('/api/auth/login') || url.includes('/api/auth/google-login') || url.includes('/api/auth/register')) {
      sessionFailureHandled = false;
    }
    return response;
  },
  (error: AxiosError<AxiosErrorResponse>) => {
    if (error.response?.status === 401 && !sessionFailureHandled) {
      sessionFailureHandled = true;
      // Fire-and-forget — local cleanup removes the token and the redirect
      // happens immediately. Repeated 401s from in-flight requests are
      // rejected without starting another cleanup/redirect cycle.
      void import('./auth.service').then(({ clearAuthSession }) => clearAuthSession());
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
