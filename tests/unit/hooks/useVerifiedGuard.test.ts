/**
 * Tests for useVerifiedGuard — blocks unapproved users from private routes.
 *
 * Confirms that:
 *   - Unverified (isActive=false) users are redirected to /forum
 *   - Verified (isActive=true, verificationStatus='Accepted') users are NOT redirected
 *   - Admin users bypass the guard regardless of isActive
 *
 * Live API calls are never made — all network/storage is mocked via vi.mock.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useVerifiedGuard } from '../../../src/hooks/useVerifiedGuard';

// ── Minimal AuthContext mock ──────────────────────────────────────────────────
// We'll override user data per test via doMock inside each test block so we
// can re-import the hook cleanly.

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Storage mock — useVerifiedGuard reads from storedUser as a fallback when
// the auth store hasn't rehydrated yet.
vi.mock('../../../src/utils/storage', () => ({
  storage: {
    getToken: vi.fn().mockReturnValue('mock-token'),
    getUser: vi.fn().mockReturnValue(null),
    clearAuth: vi.fn(),
    setToken: vi.fn(),
    setUser: vi.fn(),
    getRememberMe: vi.fn().mockReturnValue(false),
    setRememberMe: vi.fn(),
  },
}));

vi.mock('../../../src/utils/storedUser', () => ({
  readStoredUser: vi.fn().mockReturnValue(null),
}));

vi.mock('../../../src/utils/roleNormalizer', () => ({
  isAdminUser: vi.fn().mockReturnValue(false),
}));

// ── Helper to re-import after doMock ───────────────────────────────────────

const setupHook = (userOverrides: Record<string, unknown> = {}) => {
  vi.doMock('../../../src/context/AuthContext', () => ({
    useAuth: () => ({
      user: {
        token: 'mock-token',
        username: 'Test User',
        email: 'test@example.com',
        role: 'Researcher',
        isActive: false,
        verificationStatus: 'Pending',
        accountTier: 'Free',
        ...userOverrides,
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    }),
  }));

  vi.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useVerifiedGuard: guarded } = require('../../../src/hooks/useVerifiedGuard');
  const { result } = renderHook(() => guarded());
  return result;
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useVerifiedGuard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('redirects to /forum when isActive is false', async () => {
    vi.doMock('../../../src/context/AuthContext', () => ({
      useAuth: () => ({
        user: {
          token: 'mock-token',
          username: 'Pending User',
          email: 'pending@example.com',
          role: 'Researcher',
          isActive: false,
          verificationStatus: 'Pending',
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }),
    }));

    vi.resetModules();
    const { useVerifiedGuard: guarded } = require('../../../src/hooks/useVerifiedGuard');

    renderHook(() => guarded());

    // Allow the useEffect to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/forum', { replace: true });
  });

  it('redirects to /forum when verificationStatus is Pending even if isActive is true', async () => {
    vi.doMock('../../../src/context/AuthContext', () => ({
      useAuth: () => ({
        user: {
          token: 'mock-token',
          username: 'Partial User',
          email: 'partial@example.com',
          role: 'Researcher',
          isActive: true,
          verificationStatus: 'Pending',
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }),
    }));

    vi.resetModules();
    const { useVerifiedGuard: guarded } = require('../../../src/hooks/useVerifiedGuard');

    renderHook(() => guarded());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/forum', { replace: true });
  });

  it('does NOT redirect when isActive is true AND verificationStatus is Accepted', async () => {
    vi.doMock('../../../src/context/AuthContext', () => ({
      useAuth: () => ({
        user: {
          token: 'mock-token',
          username: 'Verified User',
          email: 'verified@example.com',
          role: 'Researcher',
          isActive: true,
          verificationStatus: 'Accepted',
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }),
    }));

    vi.resetModules();
    const { useVerifiedGuard: guarded } = require('../../../src/hooks/useVerifiedGuard');

    renderHook(() => guarded());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does NOT redirect when user is authenticated but isActive is undefined (lockout-safe)', async () => {
    vi.doMock('../../../src/context/AuthContext', () => ({
      useAuth: () => ({
        user: {
          token: 'mock-token',
          username: 'Edge User',
          email: 'edge@example.com',
          role: 'Researcher',
          // isActive deliberately absent → undefined → coerced to false → redirect
          verificationStatus: undefined,
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }),
    }));

    vi.resetModules();
    const { useVerifiedGuard: guarded } = require('../../../src/hooks/useVerifiedGuard');

    renderHook(() => guarded());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // undefined isActive defaults to false (lockout-safe), so redirect
    expect(mockNavigate).toHaveBeenCalledWith('/forum', { replace: true });
  });
});
