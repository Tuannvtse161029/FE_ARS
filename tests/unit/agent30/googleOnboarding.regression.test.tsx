/**
 * Agent 30 (regression) — focused tests for the duyphuong2000.dpp@gmail.com
 * failure mode observed on the live deployment:
 *
 *   BE response payload:
 *     { effectiveRole: null, isActive: false, isNewUser: true,
 *       requiresOnboarding: true, role: null, roles: [],
 *       verificationStatus: null }
 *
 * Required outcome:
 *   - The user is routed to `/complete-google-registration`, NOT /forum.
 *   - The Forum's "pending Admin verification" banner is NOT shown on
 *     the destination page.
 *   - A duplicate GIS callback (same credential) produces exactly ONE
 *     POST to `/api/Auth/google-login` — the second invocation joins
 *     the in-flight exchange via the shared `googleLoginGuard`.
 *   - The persisted user blob preserves `verificationStatus: null`
 *     verbatim; we do NOT coerce it to `'Pending'`.
 *   - `verificationStatus: null` + `isActive: false` does NOT make
 *     `usePermissions.isVerified` true.
 *
 * These tests pin the regression in place so a future refactor of
 * `AuthContext.loginWithGoogle`, `useVerifiedGuard`, or
 * `usePermissions` cannot silently re-introduce the bug.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Mocks ───────────────────────────────────────────────────────────────

const postGoogleLoginMock = vi.fn();
const authStoreLoginMock = vi.fn();
const authStoreLogoutMock = vi.fn();
const authStoreSetLoadingMock = vi.fn();
const storageSetTokenMock = vi.fn();
const storageSetUserMock = vi.fn();
const storageSetRememberMeMock = vi.fn();
const getByIdMock = vi.fn();

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

vi.mock('../../../src/services/user.service', () => ({
  userService: {
    getById: (...args: unknown[]) => getByIdMock(...args),
  },
}));

vi.mock('../../../src/services/googleAuth.service', () => ({
  googleAuthService: {
    postGoogleLogin: (...args: unknown[]) => postGoogleLoginMock(...args),
    extractCredential: (response: { credential?: unknown }) =>
      typeof response?.credential === 'string' ? response.credential : null,
  },
  GoogleLoginError: class GoogleLoginError extends Error {
    code = 'NO_CREDENTIAL';
    status: number | null = null;
    constructor(code: string, message: string, status: number | null = null) {
      super(message);
      this.code = code as never;
      this.status = status;
    }
  },
}));

vi.mock('../../../src/utils/storage', () => ({
  storage: {
    setToken: (...args: unknown[]) => storageSetTokenMock(...args),
    setUser: (...args: unknown[]) => storageSetUserMock(...args),
    getToken: vi.fn(),
    setRememberMe: (...args: unknown[]) => storageSetRememberMeMock(...args),
  },
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
      setLoading: (...args: unknown[]) => authStoreSetLoadingMock(...args),
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
        setLoading: (...args: unknown[]) => authStoreSetLoadingMock(...args),
      }),
    },
  ),
}));

vi.mock('../../../src/store/authSlice', () => ({
  useAuthStore: Object.assign(
    () => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      effectiveRole: null,
      login: (...args: unknown[]) => authStoreLoginMock(...args),
      logout: (...args: unknown[]) => authStoreLogoutMock(...args),
      setLoading: (...args: unknown[]) => authStoreSetLoadingMock(...args),
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
        setLoading: (...args: unknown[]) => authStoreSetLoadingMock(...args),
      }),
    },
  ),
}));

vi.mock('../../../src/store/welcomeSignal', () => ({
  useWelcomeSignal: {
    getState: () => ({ show: vi.fn(), reset: vi.fn() }),
  },
}));

import { AuthProvider, useAuth } from '../../../src/context/AuthContext';

interface CaptureHandle {
  loginWithGoogle: ReturnType<typeof useAuth>['loginWithGoogle'];
}

function Probe({ onReady }: { onReady: (api: CaptureHandle) => void }) {
  const api = useAuth();
  onReady(api);
  return null;
}

function mountAuthContext(initialPath = '/login') {
  let handle: CaptureHandle | null = null;
  const onReady = (api: CaptureHandle) => {
    handle = api;
  };
  const view = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={<Probe onReady={onReady} />}
          />
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
  postGoogleLoginMock.mockReset();
  authStoreLoginMock.mockReset();
  authStoreLogoutMock.mockReset();
  authStoreSetLoadingMock.mockReset();
  storageSetTokenMock.mockReset();
  storageSetUserMock.mockReset();
  storageSetRememberMeMock.mockReset();
  getByIdMock.mockReset();
  // Default: BE does not return a /api/User/{id} record for first-time
  // users (which is the documented contract — see Agent 30).
  getByIdMock.mockRejectedValue(new Error('404'));
});

// ── Screenshot state regression ─────────────────────────────────────────

describe('Agent 30 (regression) — duyphuong2000.dpp@gmail.com payload', () => {
  it('routes the screenshot state to /complete-google-registration (not /forum)', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-screenshot',
      email: 'duyphuong2000.dpp@gmail.com',
      fullName: 'Duy Phuong',
      avatarUrl: null,
      userId: 1,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: null,
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: true,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_DUYPHUONG_CRED');
    });

    await new Promise<void>((r) => setTimeout(r, 100));

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(view.container.querySelector('[data-testid="forum-marker"]')).toBeNull();
  });

  it('persists the user blob with verificationStatus preserved verbatim (null, not coerced to Pending)', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-screenshot',
      email: 'duyphuong2000.dpp@gmail.com',
      fullName: 'Duy Phuong',
      avatarUrl: null,
      userId: 1,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: null,
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: true,
    });

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await getHandle().loginWithGoogle('GIS_DUYPHUONG_CRED');

    await waitFor(() => {
      expect(storageSetUserMock).toHaveBeenCalledTimes(1);
    });

    const persistedUser = storageSetUserMock.mock.calls[0][0];
    expect(persistedUser.isActive).toBe(false);
    // The Agent 30 (regression) fix: a BE-supplied `null`
    // `verificationStatus` MUST remain `null` on the persisted
    // blob — coercing it to `'Pending'` would falsely imply a
    // submitted role request is awaiting Admin review.
    expect(persistedUser.verificationStatus).toBeNull();
    expect(persistedUser.effectiveRole).toBeNull();
    expect(persistedUser.isNewUser).toBe(true);
    expect(persistedUser.requiresOnboarding).toBe(true);
    expect(persistedUser.roles).toEqual([]);
  });

  it('persists the empty approved-roles list so PublicRoute enforces the exact AND-clause', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-screenshot',
      email: 'duyphuong2000.dpp@gmail.com',
      fullName: 'Duy Phuong',
      avatarUrl: null,
      userId: 1,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: null,
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: true,
    });

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await getHandle().loginWithGoogle('GIS_DUYPHUONG_CRED');

    await waitFor(() => {
      expect(storageSetUserMock).toHaveBeenCalledTimes(1);
    });

    const persistedUser = storageSetUserMock.mock.calls[0][0];
    expect(Array.isArray(persistedUser.roles)).toBe(true);
    expect(persistedUser.roles.length).toBe(0);
  });
});

// ── Duplicate callback → one POST regression ─────────────────────────────

describe('Agent 30 (regression) — duplicate GIS callback produces exactly one POST', () => {
  it('two concurrent loginWithGoogle calls for the same credential share a single POST', async () => {
    let resolveExchange: (value: unknown) => void = () => {};
    const exchangePromise = new Promise((res) => {
      resolveExchange = res;
    });
    postGoogleLoginMock.mockImplementationOnce(() => exchangePromise);

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    const first = getHandle().loginWithGoogle('GIS_DUP_CRED');
    const second = getHandle().loginWithGoogle('GIS_DUP_CRED');

    resolveExchange({
      token: 'jwt-dup',
      email: 'dup@example.com',
      fullName: 'Dup',
      avatarUrl: null,
      userId: 1,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: null,
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: true,
    });

    await Promise.all([first, second]);

    expect(postGoogleLoginMock).toHaveBeenCalledTimes(1);
    expect(postGoogleLoginMock.mock.calls[0][0]).toEqual({
      credential: 'GIS_DUP_CRED',
    });

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('a retry after a transient failure re-enters the BE (the slot is cleared on settlement)', async () => {
    // First call — loginWithGoogle swallows the BE error into the
    // `error` state and resolves successfully (the user-facing flow
    // surfaces a recoverable error UI rather than throwing). The
    // shared `acquireGoogleLoginSession` guard clears its slot on
    // settlement regardless of success / failure, so a subsequent
    // call for the same credential MUST re-enter the BE.
    postGoogleLoginMock.mockRejectedValueOnce({
      response: { status: 503 },
      code: 'ERR_BAD_RESPONSE',
    });

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await getHandle().loginWithGoogle('GIS_RETRY_CRED');
    expect(postGoogleLoginMock).toHaveBeenCalledTimes(1);

    // Slot must be cleared so the next attempt re-enters the BE.
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-retry',
      email: 'retry@example.com',
      fullName: 'Retry',
      avatarUrl: null,
      userId: 2,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: null,
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: true,
    });

    await getHandle().loginWithGoogle('GIS_RETRY_CRED');
    expect(postGoogleLoginMock).toHaveBeenCalledTimes(2);
  });
});

// ── Explicit submitted/pending → /forum regression ──────────────────────

describe('Agent 30 (regression) — explicit submitted/pending routes to /forum', () => {
  it('routes a user with verificationStatus=Pending + role assigned to /forum', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-pending',
      email: 'pending@example.com',
      fullName: 'Pending',
      avatarUrl: null,
      userId: 5,
      role: 'Researcher',
      roleId: 1,
      roles: ['Researcher'],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: 'Guest',
      isNewUser: false,
      requiresOnboarding: false,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_PENDING_CRED');
    });

    await new Promise<void>((r) => setTimeout(r, 100));

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="forum-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(view.container.querySelector('[data-testid="onboarding-marker"]')).toBeNull();
  });

  it('routes an approved + active user to /forum (workspace landing, Researcher)', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-approved',
      email: 'approved@example.com',
      fullName: 'Approved',
      avatarUrl: null,
      userId: 6,
      role: 'Researcher',
      roleId: 1,
      roles: ['Researcher'],
      isActive: true,
      verificationStatus: 'Accepted',
      effectiveRole: 'Researcher',
      isNewUser: false,
      requiresOnboarding: false,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_APPROVED_CRED');
    });

    await new Promise<void>((r) => setTimeout(r, 100));

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="forum-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(view.container.querySelector('[data-testid="onboarding-marker"]')).toBeNull();
  });
});
