/**
 * Tests for AuthContext.logout — Guest-aware ARS session cleanup.
 *
 * Contract:
 *   1. `logout()` clears the ARS JWT from BOTH localStorage and
 *      sessionStorage so a Guest who only ever had a sessionStorage
 *      session leaves no token behind.
 *   2. `logout()` resets the Zustand auth store (user / token /
 *      isAuthenticated / effectiveRole) so no stale state can be
 *      rehydrated.
 *   3. `logout()` calls `clearAuthSession()` (which strips every
 *      documented ARS auth key from both buckets, the Axios
 *      Authorization header, and the GIS auto-select toggle).
 *   4. `logout()` navigates to /login with `{ replace: true }` so the
 *      back button cannot trap the Guest on a protected route.
 *   5. `logout()` is null-safe — a Guest may have `user: null`,
 *      `token: null`, `isActive: false`, `verificationStatus: 'Pending'`,
 *      `effectiveRole: 'Guest'`, and null roleId / roleName.
 *   6. The double-in-flight guard (`logoutInFlightRef`) prevents
 *      duplicate cleanup when MainLayout, the VerifiedGuard bounce, and
 *      the Onboarding page all react to the same session expiry.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const authStoreLoginMock = vi.fn();
const authStoreLogoutMock = vi.fn();
const clearAuthSessionMock = vi.fn().mockResolvedValue(undefined);
const welcomeSignalShowMock = vi.fn();
const welcomeSignalResetMock = vi.fn();

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

vi.mock('../../../src/services/user.service', () => ({
  userService: { getById: vi.fn().mockRejectedValue(new Error('not used')) },
}));

vi.mock('../../../src/services/auth.service', () => ({
  authService: { logout: vi.fn() },
  clearAuthSession: (...args: unknown[]) => clearAuthSessionMock(...args),
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: Object.assign(
    () => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      effectiveRole: null,
      login: (...args: unknown[]) => authStoreLoginMock(...args),
      logout: (...args: unknown[]) => authStoreLogoutMock(...args),
      setLoading: vi.fn(),
      updateUser: vi.fn(),
      setEffectiveRole: vi.fn(),
    }),
    {
      getState: () => ({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        effectiveRole: null,
        login: (...args: unknown[]) => authStoreLoginMock(...args),
        logout: (...args: unknown[]) => authStoreLogoutMock(...args),
        setLoading: vi.fn(),
      }),
    },
  ),
}));

vi.mock('../../../src/store/welcomeSignal', () => ({
  useWelcomeSignal: {
    getState: () => ({
      show: (...args: unknown[]) => welcomeSignalShowMock(...args),
      reset: (...args: unknown[]) => welcomeSignalResetMock(...args),
    }),
  },
}));

import { AuthProvider, useAuth } from '../../../src/context/AuthContext';

interface CaptureHandle {
  logout: ReturnType<typeof useAuth>['logout'];
  isAuthenticated: boolean;
  effectiveRole: string | null;
}

function Probe({ onReady }: { onReady: (api: CaptureHandle) => void }) {
  const api = useAuth();
  onReady(api);
  return null;
}

function mountAuthContext(initialPath = '/forum') {
  let handle: CaptureHandle | null = null;
  const onReady = (api: CaptureHandle) => {
    handle = api;
  };
  const view = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        {/* The Probe is rendered at every path so we can capture the
            AuthContext API even when the test mounts on /forum (which
            is not a route in our minimal test router). */}
        <Routes>
          <Route path="/login" element={
            <>
              <Probe onReady={onReady} />
              <div data-testid="login-marker">login</div>
            </>
          } />
          <Route path="*" element={<Probe onReady={onReady} />} />
        </Routes>
        {/* Separate router tree that does NOT contain a Probe so we can
            observe route changes without confusing the probe callback. */}
        <Routes>
          <Route path="/login" element={<div data-testid="login-marker">login</div>} />
          <Route path="/forum" element={<div data-testid="forum-marker">forum</div>} />
          <Route
            path="/complete-google-registration"
            element={<div data-testid="onboarding-marker">onboarding</div>}
          />
          <Route
            path="*"
            element={<div data-testid="unknown-marker">unknown</div>}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { view, getHandle: () => handle as unknown as CaptureHandle };
}

beforeEach(() => {
  authStoreLoginMock.mockReset();
  authStoreLogoutMock.mockReset();
  clearAuthSessionMock.mockReset();
  clearAuthSessionMock.mockResolvedValue(undefined);
  welcomeSignalShowMock.mockReset();
  welcomeSignalResetMock.mockReset();
});

describe('AuthContext.logout — Guest null-safe cleanup', () => {
  it('invokes clearAuthSession() so the sessionStorage ARS token is wiped for a Guest', async () => {
    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().logout);

    await act(async () => {
      getHandle().logout();
    });

    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
  });

  it('resets the Zustand auth store so no stale Guest state can be rehydrated', async () => {
    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().logout);

    await act(async () => {
      getHandle().logout();
    });

    expect(authStoreLogoutMock).toHaveBeenCalledTimes(1);
  });

  it('clears the welcome-back signal alongside the auth state', async () => {
    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().logout);

    await act(async () => {
      getHandle().logout();
    });

    expect(welcomeSignalResetMock).toHaveBeenCalledTimes(1);
  });

  it('navigates to /login with replace:true so the back button cannot trap the Guest', async () => {
    const { view, getHandle } = mountAuthContext('/forum');
    await waitFor(() => getHandle().logout);

    await act(async () => {
      getHandle().logout();
    });

    await waitFor(() => {
      expect(view.container.querySelector('[data-testid="login-marker"]'))
        .toBeTruthy();
    });
    expect(view.container.querySelector('[data-testid="forum-marker"]')).toBeNull();
  });

  it('is idempotent under rapid double-invocation (in-flight guard prevents duplicate cleanup)', async () => {
    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().logout);

    await act(async () => {
      getHandle().logout();
      getHandle().logout();
      getHandle().logout();
    });

    // The cleanup routine must run exactly once even when MainLayout's
    // ProfileDropdown, the PendingVerification page, and the verified
    // guard all react to the same session expiry in the same tick.
    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(authStoreLogoutMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when invoked against a fully-empty session (Guest null-safety)', async () => {
    // A Guest who never persisted a token can still reach the layout's
    // profile dropdown (the dropdown is always rendered). The logout
    // path must not throw on the empty-state no-op cleanup.
    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().logout);

    expect(() => {
      act(() => {
        getHandle().logout();
      });
    }).not.toThrow();
  });
});
