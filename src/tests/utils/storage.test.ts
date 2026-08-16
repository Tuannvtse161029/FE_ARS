import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../../utils/storage';
import { STORAGE_KEYS } from '../../utils/constants';

// Each test file gets its own createMock() factory so the store stays per-file.
const createMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(store)) delete store[k];
    }),
  };
};

const localStorageMock = createMock();
const sessionStorageMock = createMock();

Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true, configurable: true });
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock, writable: true, configurable: true });

// Helper: read remember-me flag from localStorage directly (storage utility only
// reads the flag from localStorage).
const isRemembering = () => localStorageMock.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';

describe('storage utils', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    // Reset to "no rememberMe" — the default for most tests in this file.
    storage.setRememberMe(false);
  });

  // ─── TOKEN ──────────────────────────────────────────────────────────────────

  describe('token operations', () => {
    it('should get null when no token exists', () => {
      expect(storage.getToken()).toBeNull();
    });

    it('should set and get token (defaults to sessionStorage)', () => {
      storage.setToken('test-token-123');
      expect(storage.getToken()).toBe('test-token-123');
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.TOKEN,
        'test-token-123'
      );
    });

    it('should remove token from both storages', () => {
      storage.setToken('test-token');
      storage.removeToken();
      expect(storage.getToken()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.TOKEN);
      expect(sessionStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.TOKEN);
    });
  });

  // ─── USER ───────────────────────────────────────────────────────────────────

  describe('user operations', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User',
      roleId: 2,
      roleName: 'Researcher',
    };

    it('should get null when no user exists', () => {
      expect(storage.getUser()).toBeNull();
    });

    it('should set and get user', () => {
      storage.setUser(mockUser);
      const retrieved = storage.getUser();
      expect(retrieved).toEqual(mockUser);
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.USER,
        expect.stringContaining('testuser')
      );
    });

    it('should return null for invalid JSON user data', () => {
      sessionStorage.setItem(STORAGE_KEYS.USER, 'not-json{{{}');
      expect(storage.getUser()).toBeNull();
    });

    it('should remove user from both storages', () => {
      storage.setUser(mockUser);
      storage.removeUser();
      expect(storage.getUser()).toBeNull();
    });
  });

  // ─── REMEMBER ME ───────────────────────────────────────────────────────────

  describe('remember me operations', () => {
    it('should set and get remember me as true', () => {
      storage.setRememberMe(true);
      expect(storage.getRememberMe()).toBe(true);
    });

    it('should remove the remember flag when set to false', () => {
      storage.setRememberMe(true);
      storage.setRememberMe(false);
      expect(storage.getRememberMe()).toBe(false);
      // The REMEMBER_ME key is now absent from localStorage.
      expect(localStorageMock.getItem(STORAGE_KEYS.REMEMBER_ME)).toBeNull();
    });
  });

  // ─── CLEAR AUTH ────────────────────────────────────────────────────────────

  describe('clearAuth', () => {
    it('clears token and user from both storages', () => {
      storage.setToken('abc');
      storage.setUser({
        id: 1,
        username: 'u',
        email: 'e@x',
        fullName: 'U',
        roleId: 0,
        roleName: 'Researcher',
      });
      storage.clearAuth();
      expect(storage.getToken()).toBeNull();
      expect(storage.getUser()).toBeNull();
      expect(storage.getRememberMe()).toBe(false);
    });
  });

  // ─── COMPLETE AUTH FLOW ────────────────────────────────────────────────────

  describe('complete auth flow', () => {
    it('with rememberMe=true persists across "browser restart"', () => {
      storage.setRememberMe(true);
      storage.setToken('jwt-token-xyz');
      // Simulate "restart" by clearing the session-only store.
      sessionStorage.clear();
      // After restart, the token still comes from localStorage because rememberMe was true.
      // (We don't actually clear localStorage — that's what "remember" means.)
      expect(storage.getToken()).toBe('jwt-token-xyz');
    });

    it('with rememberMe=false clears on session close', () => {
      storage.setRememberMe(false);
      storage.setToken('jwt-token-xyz');
      // Session storage simulates a closed tab being cleared.
      sessionStorage.clear();
      expect(storage.getToken()).toBeNull();
    });
  });
});
