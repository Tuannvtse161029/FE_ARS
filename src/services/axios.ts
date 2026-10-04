import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { storage } from '../utils/storage';
import { secureToken } from '../utils/secureToken';
import type { AxiosErrorResponse } from '../types/api';
import { clearAuthSession } from './auth.service';
import { loadingTracker } from './loadingTracker';

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
    loadingTracker.begin();
    const token = storage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    // The request can fail before Axios creates a response, so close the
    // tracker here as well as in the response interceptor.
    loadingTracker.end(false);
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
    loadingTracker.end(true);
    const url = (response.config.url ?? '').toLowerCase();
    if (url.includes('/api/auth/')) {
      sessionFailureHandled = false;
    }
    return response;
  },
  (error: AxiosError<AxiosErrorResponse>) => {
    loadingTracker.end(false);

    // An AbortController cancellation is an expected lifecycle event (for
    // example, React Strict Mode remounts and analytics range changes). Keep
    // the original cancellation error intact rather than presenting it as a
    // network failure to callers.
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

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
    // Popup guard — the PayOS checkout popup is opened with `noopener`
    // so it shares `localStorage` (and the on-disk secureToken envelope)
    // with the parent tab, but it has its own JS context with a null
    // `liveAccessToken`. Any 401 in the popup would (a) try to clear the
    // shared envelope, nuking the parent tab's session, and (b) hard
    // redirect the popup window to /login — which is the "redirect into
    // login page" symptom the user reported. Suppress both: the popup
    // is a transient window and the parent owns auth.
    const isPayosReturnPopup =
      currentPath === '/subscription/return' &&
      typeof window !== 'undefined' &&
      window.name === 'payos_checkout';

    // Session-2 hardening: a "live session" is the in-memory access
    // token (or a refresh token on disk, once the BE ships the refresh
    // endpoint). The plain-text `ars_token` storage key is no longer
    // authoritative — `secureToken.hasLiveSession` is.
    const hasToken = secureToken.hasLiveSession();

    if (error.response?.status === 401 && !isAuthEndpoint && !isAuthPage && !isPayosReturnPopup && !sessionFailureHandled && hasToken) {
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
