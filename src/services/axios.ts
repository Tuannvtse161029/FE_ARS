import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { storage } from '../utils/storage';
import { secureToken } from '../utils/secureToken';
import type { AxiosErrorResponse } from '../types/api';
import { clearAuthSession } from './auth.service';
import { loadingTracker } from './loadingTracker';

let sessionFailureHandled = false;
// Agent 55 — request-level flag that records whether the 401 retry
// path already attempted a single recovery on this specific request.
// Without this, an axios-retry-style chain could loop indefinitely.
// The flag is keyed by the request object identity (the BE URL +
// method) so unrelated requests are unaffected.
const retriedRequests = new WeakSet<object>();

/**
 * Agent 55 — synchronous recovery + single-retry helper.
 *
 * Triggered when a protected call receives a 401 in a context where
 * the persistent session key + on-disk envelope exist (sibling tab /
 * post-reload). The hypothesis: the in-memory token was wiped by the
 * new tab's fresh JS context, but the persisted copy can be decrypted
 * synchronously now to recover the JWT. We retry the EXACT same
 * request once with the recovered `Authorization` header and return
 * the result so the caller sees a successful response instead of an
 * unauthenticated error.
 *
 * Returns `null` when recovery is not possible (no envelope, no key,
 * or the retry itself fails) so the caller can fall through to the
 * original "session lost" path.
 */
async function retryWithRecoveredToken(
  config: InternalAxiosRequestConfig | undefined,
): Promise<unknown | null> {
  if (!config) return null;
  if (retriedRequests.has(config)) return null;
  retriedRequests.add(config);
  try {
    // Drive the same rehydrate path `secureToken.getAccessToken` uses,
    // but awaited so we know the result before we re-issue the request.
    const recovered = await secureToken.rehydrate();
    if (!recovered) return null;
    const token = secureToken.getAccessToken();
    if (!token) return null;
    // Build a fresh AxiosHeaders so the resulting type stays compatible
    // with `InternalAxiosRequestConfig.headers` (axios's strict overload
    // rejects plain-object spreads of the union'd `RawAxiosRequestHeaders`
    // / `AxiosHeaders` shape).
    const retryHeaders = new AxiosHeaders();
    if (config.headers) {
      const source = config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);
      source.forEach((value: unknown, key: string) => {
        retryHeaders.set(key, value as string | number | boolean);
      });
    }
    retryHeaders.set('Authorization', `Bearer ${token}`);
    const retryConfig: InternalAxiosRequestConfig = {
      ...config,
      headers: retryHeaders,
    };
    return await api.request(retryConfig);
  } catch {
    return null;
  }
}

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
  async (error: AxiosError<AxiosErrorResponse>) => {
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
    //
    // Agent 55 — `hasLiveSession` also returns `true` when an
    // encrypted envelope AND a persistent session key are both on
    // disk (sibling tab / post-reload). This lets the first request
    // from a freshly-opened tab finish its background decrypt
    // WITHOUT the interceptor treating a transient unauthenticated
    // response as a session-lost event. The next request will ship
    // the recovered JWT header.
    const hasToken = secureToken.hasLiveSession();

    if (error.response?.status === 401 && !isAuthEndpoint && !isAuthPage && !isPayosReturnPopup && !sessionFailureHandled && hasToken) {
      // Agent 55 — attempt a synchronous rehydrate of the encrypted
      // envelope before treating the 401 as a session-lost event.
      // When the user just opened the app in a new tab, the first
      // protected call may race the async key recovery in
      // `getAccessToken()` and arrive at the BE without an
      // `Authorization` header; the BE replies 401. If the envelope
      // is still on disk and decryptable, retry the same request
      // once with the recovered token. This single retry covers the
      // vast majority of new-tab open cases without bouncing the
      // user to /login.
      const retried = await retryWithRecoveredToken(error.config);
      if (retried) {
        return retried;
      }

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
