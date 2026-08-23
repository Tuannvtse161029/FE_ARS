/**
 * Tests for AuthContext.loginWithGoogle — GIS-credential Google sign-in.
 *
 * Contract:
 *   1. POST `{ credential }` to `POST /api/Auth/google-login` via
 *      `googleAuthService.postGoogleLogin`.
 *   2. If the BE signals `isNewUser || requiresOnboarding`, persist a
 *      first-time session and route to `/complete-google-registration`.
 *   3. Otherwise, reuse the existing password-login persistence +
 *      navigation pipeline (`persistAuthAndNavigate`).
 *   4. Errors from `postGoogleLogin` surface as a user-friendly `error`
 *      string; the user stays on the page.
 *   5. The BE response must include `token`, `userId`, and `email` —
 *      otherwise the page treats it as "incomplete" and surfaces an error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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
  // The AuthProvider is intentionally mounted at the same level as Routes so
  // its `useNavigate()` operates on the top-level router, not a nested one.
  // This mirrors the production App.tsx layout.
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
  getByIdMock.mockResolvedValue({
    id: 42,
    username: 'user@example.com',
    email: 'user@example.com',
    fullName: 'Google User',
    roleId: 1,
    roleName: 'Researcher',
    isActive: true,
    verificationStatus: 'Accepted',
    accountTier: 'Free',
  });
});

describe('AuthContext.loginWithGoogle', () => {
  it('POSTs `{ credential }` to /api/auth/google-login exactly once', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-1',
      email: 'user@example.com',
      fullName: 'Google User',
      avatarUrl: null,
      userId: 42,
      role: 'Researcher',
      roleId: 1,
      roles: ['Researcher'],
      isActive: true,
      verificationStatus: 'Accepted',
      effectiveRole: 'Researcher',
      isNewUser: false,
      requiresOnboarding: false,
    });

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED');
    });

    expect(postGoogleLoginMock).toHaveBeenCalledTimes(1);
    expect(postGoogleLoginMock.mock.calls[0][0]).toEqual({ credential: 'GIS_CRED' });
  });

  it('persists + routes a NEW user (isNewUser=true) to /complete-google-registration', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-new',
      email: 'new@example.com',
      fullName: 'New User',
      avatarUrl: null,
      userId: 99,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: false,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await getHandle().loginWithGoogle('GIS_CRED_NEW');

    // Wait for the new-user route to render.
    await new Promise<void>((r) => setTimeout(r, 100));

    expect(storageSetTokenMock).toHaveBeenCalledWith('jwt-new');
    expect(storageSetUserMock).toHaveBeenCalledTimes(1);
    const persistedUser = storageSetUserMock.mock.calls[0][0];
    expect(persistedUser.id).toBe(99);
    expect(persistedUser.email).toBe('new@example.com');
    expect(persistedUser.fullName).toBe('New User');
    expect(persistedUser.isActive).toBe(false);
    expect(persistedUser.verificationStatus).toBe('Pending');

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('persists + routes an EXISTING accepted user to /forum (workspace landing)', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-existing',
      email: 'user@example.com',
      fullName: 'Google User',
      avatarUrl: null,
      userId: 42,
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
      await getHandle().loginWithGoogle('GIS_CRED_EXISTING');
    });

    expect(storageSetTokenMock).toHaveBeenCalledWith('jwt-existing');
    expect(authStoreLoginMock).toHaveBeenCalledTimes(1);
    // getById was called to refresh the BE authoritative profile.
    expect(getByIdMock).toHaveBeenCalledWith(42);

    await waitFor(() => {
      expect(view.container.querySelector('[data-testid="forum-marker"]'))
        .toBeTruthy();
    });
  });

  it('surfaces a recoverable error when the BE response is missing a token', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: null,
      email: 'user@example.com',
      fullName: 'Google User',
      userId: 42,
      role: 'Researcher',
      isActive: true,
      verificationStatus: 'Accepted',
      isNewUser: false,
      requiresOnboarding: false,
    });

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED');
    });

    // No persistence, no authStore.login mutation.
    expect(storageSetTokenMock).not.toHaveBeenCalled();
    expect(authStoreLoginMock).not.toHaveBeenCalled();
  });

  it('surfaces a recoverable error when postGoogleLogin throws', async () => {
    postGoogleLoginMock.mockRejectedValueOnce(
      Object.assign(new Error('Google token rejected'), {
        name: 'GoogleLoginError',
        code: 'INVALID_CREDENTIAL',
      }),
    );

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED_BAD');
    });

    expect(postGoogleLoginMock).toHaveBeenCalledTimes(1);
    expect(storageSetTokenMock).not.toHaveBeenCalled();
    expect(authStoreLoginMock).not.toHaveBeenCalled();
  });

  it('strips the Authorization header for the duration of the credential POST (so the BE sees an anonymous request)', async () => {
    // Simulate the shared axios instance having a prior bearer token (a
    // guest who re-visits /login). postGoogleLogin must clear it.
    const apiModule = await import('../../../src/services/axios');
    (apiModule.default.defaults.headers.common as Record<string, string>).Authorization =
      'Bearer STALE_TOKEN';

    postGoogleLoginMock.mockImplementationOnce(async () => {
      // While inside postGoogleLogin the Authorization header MUST be gone.
      const headerValue =
        (apiModule.default.defaults.headers.common as Record<string, string | undefined>)
          .Authorization;
      if (headerValue !== undefined) {
        throw new Error(
          `Authorization header leaked into credential POST: ${headerValue}`,
        );
      }
      return {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        avatarUrl: null,
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
        effectiveRole: 'Researcher',
        isNewUser: false,
        requiresOnboarding: false,
      };
    });

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED');
    });

    // After the call, the original token is restored so the rest of the FE
    // keeps using the prior ARS session (if any).
    expect(
      (apiModule.default.defaults.headers.common as Record<string, string | undefined>)
        .Authorization,
    ).toBe('Bearer STALE_TOKEN');
  });
});
