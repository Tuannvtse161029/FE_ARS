import { STORAGE_KEYS } from './constants';
import type { User } from '../types/auth';

// Pick localStorage for "Remember Me", sessionStorage otherwise.
// Session storage is cleared automatically when the tab/window closes.
const rememberBucket = (): Storage => (storage.getRememberMe() ? localStorage : sessionStorage);

// We force-define `storage` object first, then call it from helpers.
export const storage = {
  getToken: (): string | null => {
    return storage.getRememberMe()
      ? localStorage.getItem(STORAGE_KEYS.TOKEN)
      : sessionStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  setToken: (token: string): void => {
    rememberBucket().setItem(STORAGE_KEYS.TOKEN, token);
  },

  removeToken: (): void => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
  },

  getUser: (): User | null => {
    const raw = storage.getRememberMe()
      ? localStorage.getItem(STORAGE_KEYS.USER)
      : sessionStorage.getItem(STORAGE_KEYS.USER);
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
