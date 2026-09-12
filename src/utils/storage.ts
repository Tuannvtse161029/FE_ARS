import { STORAGE_KEYS } from './constants';
import type { User } from '../types/auth';

// Pick localStorage for "Remember Me", sessionStorage otherwise.
// Session storage is cleared automatically when the tab/window closes.
const rememberBucket = (): Storage => (storage.getRememberMe() ? localStorage : sessionStorage);

// We force-define `storage` object first, then call it from helpers.
export const storage = {
  getToken: (): string | null => {
    // Read deterministically from the bucket matching the active Remember Me
    // flag. Cross-bucket fallback chains (localStorage || sessionStorage)
    // previously let a missing primary bucket silently borrow from the wrong
    // session -- logout wipes both buckets via clearAll() so this is safe.
    return rememberBucket().getItem(STORAGE_KEYS.TOKEN);
  },

  setToken: (token: string): void => {
    rememberBucket().setItem(STORAGE_KEYS.TOKEN, token);
  },

  removeToken: (): void => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
  },

  getUser: (): User | null => {
    // Mirror getToken(): deterministic bucket selection -- see comment there.
    const raw = rememberBucket().getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  setUser: (user: User): void => {
    rememberBucket().setItem(STORAGE_KEYS.USER, JSON.stringify(user));
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

  // Clear auth data from BOTH storages to guarantee complete logout.
  clearAuth: (): void => {
    storage.removeToken();
    storage.removeUser();
    storage.removeRememberMe();
  },

  removeRememberMe: (): void => {
    localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
  },

  clearAll: (): void => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.USER);
  },
};

export default storage;
