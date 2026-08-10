import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../../utils/storage';
import { STORAGE_KEYS } from '../../utils/constants';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('storage utils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TOKEN
  // ─────────────────────────────────────────────────────────────────────────────

  describe('token operations', () => {
    it('should get null when no token exists', () => {
      expect(storage.getToken()).toBeNull();
    });

    it('should set and get token', () => {
      storage.setToken('test-token-123');
      expect(storage.getToken()).toBe('test-token-123');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.TOKEN,
        'test-token-123'
      );
    });

    it('should remove token', () => {
      storage.setToken('test-token');
      storage.removeToken();
      expect(storage.getToken()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.TOKEN);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // USER
  // ─────────────────────────────────────────────────────────────────────────────

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
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.USER,
        JSON.stringify(mockUser)
      );
    });

    it('should return null for invalid JSON user data', () => {
      localStorage.setItem(STORAGE_KEYS.USER, 'invalid-json{');
      expect(storage.getUser()).toBeNull();
    });

    it('should remove user', () => {
      storage.setUser(mockUser);
      storage.removeUser();
      expect(storage.getUser()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.USER);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // REMEMBER ME
  // ─────────────────────────────────────────────────────────────────────────────

  describe('remember me operations', () => {
    it('should get false when remember me is not set', () => {
      expect(storage.getRememberMe()).toBe(false);
    });

    it('should set and get remember me as true', () => {
      storage.setRememberMe(true);
      expect(storage.getRememberMe()).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.REMEMBER_ME,
        'true'
      );
    });

    it('should set and get remember me as false', () => {
      storage.setRememberMe(false);
      expect(storage.getRememberMe()).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.REMEMBER_ME,
        'false'
      );
    });

    it('should remove remember me', () => {
      storage.setRememberMe(true);
      storage.removeRememberMe();
      expect(storage.getRememberMe()).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        STORAGE_KEYS.REMEMBER_ME
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEAR AUTH
  // ─────────────────────────────────────────────────────────────────────────────

  describe('clearAuth', () => {
    it('should clear token and user but keep remember me when rememberMe is true', () => {
      storage.setToken('token');
      storage.setUser({ id: 1, username: 'test', email: 'test@test.com', fullName: 'Test', roleId: 1, roleName: 'Researcher' });
      storage.setRememberMe(true);

      storage.clearAuth();

      expect(storage.getToken()).toBeNull();
      expect(storage.getUser()).toBeNull();
      expect(storage.getRememberMe()).toBe(true); // Should be kept
    });

    it('should clear everything including remember me when rememberMe is false', () => {
      storage.setToken('token');
      storage.setUser({ id: 1, username: 'test', email: 'test@test.com', fullName: 'Test', roleId: 1, roleName: 'Researcher' });
      storage.setRememberMe(false);

      storage.clearAuth();

      expect(storage.getToken()).toBeNull();
      expect(storage.getUser()).toBeNull();
      expect(storage.getRememberMe()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEAR ALL
  // ─────────────────────────────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('should clear all auth data', () => {
      storage.setToken('token');
      storage.setUser({ id: 1, username: 'test', email: 'test@test.com', fullName: 'Test', roleId: 1, roleName: 'Researcher' });
      storage.setRememberMe(true);

      storage.clearAll();

      expect(storage.getToken()).toBeNull();
      expect(storage.getUser()).toBeNull();
      expect(storage.getRememberMe()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPLETE FLOW
  // ─────────────────────────────────────────────────────────────────────────────

  describe('complete auth flow', () => {
    it('should handle full login/logout cycle', () => {
      // Simulate login
      storage.setToken('jwt-token-xyz');
      storage.setUser({
        id: 1,
        username: 'johndoe',
        email: 'john@university.edu',
        fullName: 'John Doe',
        roleId: 2,
        roleName: 'Researcher',
      });
      storage.setRememberMe(true);

      // Verify stored data
      expect(storage.getToken()).toBe('jwt-token-xyz');
      expect(storage.getUser()?.username).toBe('johndoe');
      expect(storage.getRememberMe()).toBe(true);

      // Simulate logout
      storage.clearAuth();

      // Verify data after logout (with remember me)
      expect(storage.getToken()).toBeNull();
      expect(storage.getUser()).toBeNull();
      expect(storage.getRememberMe()).toBe(true); // Remember me preserved
    });
  });
});
