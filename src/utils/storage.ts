import { STORAGE_KEYS } from './constants';
import { secureToken } from './secureToken';
import type { SessionUser } from './projectedUser';
import { projectUser, serializeSessionUser } from './projectedUser';
import type { User } from '../types/auth';

// The session token is no longer round-tripped through plain storage. The
// `ars_token` key is delegated to `secureToken.ts` which encrypts the
// JWT before it ever hits `localStorage` / `sessionStorage`. This module
// only owns the *user* blob and the remember-me flag; the token side is
// exclusively `secureToken.getAccessToken()`.
const rememberBucket = (): Storage => (storage.getRememberMe() ? localStorage : sessionStorage);

export const storage = {
  /**
   * Returns the raw access token from in-memory storage. Falls back to
   * the legacy `ars_token` key when the secureToken module has not been
   * initialized yet (degraded Web Crypto environment only).
   */
  getToken: (): string | null => {
    const live = secureToken.getAccessToken();
    if (live) return live;
    // Defensive fallback for the degraded-environment branch in
    // secureToken.writeAfterLogin. The legacy key is still used so
    // older builds remain functional in the rare case where Web Crypto
    // is unavailable (http://, very old browsers).
    try {
      return localStorage.getItem('ars_token') || sessionStorage.getItem('ars_token');
    } catch {
      return null;
    }
  },

  /**
   * Plain-text token writes are not allowed. This shim forwards through
   * the secure path so legacy test fixtures that pre-date the migration
   * keep working. New callers should use `secureToken.writeAfterLogin`
   * directly.
   */
  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    const rememberMe = storage.getRememberMe();
    void secureToken.writeAfterLogin(token, null, rememberMe);
  },

  removeToken: (): void => {
    secureToken.clear();
  },

  getUser: (): SessionUser | null => {
    if (typeof window === 'undefined') return null;
    const raw =
      rememberBucket().getItem(STORAGE_KEYS.USER) ||
      localStorage.getItem(STORAGE_KEYS.USER) ||
      sessionStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return projectUser(parsed as unknown as User);
    } catch {
      return null;
    }
  },

  setUser: (user: User | SessionUser): void => {
    if (typeof window === 'undefined') return;
    const payload = serializeSessionUser(user);
    if (!payload) return;
    try {
      rememberBucket().setItem(STORAGE_KEYS.USER, payload);
      if (storage.getRememberMe()) {
        localStorage.setItem(STORAGE_KEYS.USER, payload);
      } else {
        sessionStorage.setItem(STORAGE_KEYS.USER, payload);
      }
    } catch {
      /* ignore */
    }
  },

  removeUser: (): void => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    sessionStorage.removeItem(STORAGE_KEYS.USER);
  },

  getRememberMe: (): boolean => {
    return localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
  },

  setRememberMe: (remember: boolean): void => {
    if (remember) {
      localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    }
  },

  getSavedEmail: (): string => {
    return localStorage.getItem(STORAGE_KEYS.SAVED_EMAIL) || '';
  },

  setSavedEmail: (email: string): void => {
    if (email && email.trim()) {
      localStorage.setItem(STORAGE_KEYS.SAVED_EMAIL, email.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.SAVED_EMAIL);
    }
  },

  removeSavedEmail: (): void => {
    localStorage.removeItem(STORAGE_KEYS.SAVED_EMAIL);
  },

  /**
   * Clear auth data from BOTH storages. The token side is delegated to
   * `secureToken.clear()` which wipes the envelope, the in-memory key,
   * and the legacy fallback key.
   */
  clearAuth: (): void => {
    storage.removeToken();
    storage.removeUser();
    storage.removeRememberMe();
  },

  removeRememberMe: (): void => {
    localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
  },

  clearAll: (): void => {
    storage.removeToken();
    storage.removeUser();
    storage.removeRememberMe();
  },
};

export default storage;
