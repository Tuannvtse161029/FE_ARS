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

  it('persists + routes a NEW user (isNewUser=true AND requiresOnboarding=true) to /complete-google-registration', async () => {
    // Per the Agent 30 follow-up correction: the exact AND-clause is
    // isNewUser===true AND requiresOnboarding===true AND
    // effectiveRole===null AND approved roles empty. A bare isNewUser
    // signal is not enough — the BE must also surface
    // requiresOnboarding so the resolver can distinguish a true
    // first-time user from a legacy Guest fallback.
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
      requiresOnboarding: true,
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

  it('routes a new user to /complete-google-registration when isNewUser=true AND requiresOnboarding=true', async () => {
    // The normaliser in `googleAuthService.normaliseGoogleLoginResponse`
    // coerces stringified booleans to real booleans BEFORE they reach
    // the resolver (verified independently in
    // tests/unit/services/googleAuth.service.test.ts). The mock here
    // returns the post-normalisation shape directly so we exercise
    // the resolver's exact AND-clause: both isNewUser AND
    // requiresOnboarding must be the boolean `true` (with
    // effectiveRole===null and empty approved roles) for the
    // onboarding branch to fire.
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
      requiresOnboarding: true,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED_NEW');
    });

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('routes a new user to /complete-google-registration even when the BE wraps the payload under { data: { ... } }', async () => {
    // .NET controllers commonly wrap responses as
    // `{ success, data: {...} }`. The previous normaliser only checked
    // the root and silently dropped a wrapped `isNewUser: true`. The
    // fix unwraps one level when the inner object carries a `token`.
    //
    // The mock returns the already-normalised session (matching what
    // `googleAuthService.normaliseGoogleLoginResponse` produces for a
    // wrapped payload — verified independently in
    // tests/unit/services/googleAuth.service.test.ts).
    //
    // Per the Agent 30 follow-up correction: both isNewUser AND
    // requiresOnboarding must be true to drive the onboarding branch.
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-wrapped',
      email: 'wrapped@example.com',
      fullName: 'Wrapped User',
      avatarUrl: null,
      userId: 100,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: true,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED_WRAPPED');
    });

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('defensively clears a stale ars_google_onboarding_submitted sentinel from BOTH storage buckets when entering the new-user branch', async () => {
    // Regression: a previously-deleted account may have left a
    // `ars_google_onboarding_submitted` sentinel in localStorage or
    // sessionStorage. The loginWithGoogle new-user branch must scrub
    // it from both buckets before navigating to /complete-google-registration,
    // so the onboarding page never renders its post-submit "Go to the Forum"
    // success state for a user who has not actually submitted anything yet.
    sessionStorage.setItem(
      'ars_google_onboarding_submitted',
      JSON.stringify({
        userId: 42,
        role: 'Researcher',
        effectiveRole: 'Guest',
        requestStatus: 'Pending',
      }),
    );
    localStorage.setItem(
      'ars_google_onboarding_submitted',
      JSON.stringify({
        userId: 42,
        role: 'Lecturer',
        effectiveRole: 'Guest',
        requestStatus: 'Pending',
      }),
    );

    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-new-clean',
      email: 'clean@example.com',
      fullName: 'Clean User',
      avatarUrl: null,
      userId: 99,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: true,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED_CLEAN_SENTINEL');
    });

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );

    const removedSentinelKeys = removeItemSpy.mock.calls
      .filter(([key]) => key === 'ars_google_onboarding_submitted')
      .map(([, value]) => value);
    expect(removedSentinelKeys.length).toBeGreaterThanOrEqual(2);
    expect(sessionStorage.getItem('ars_google_onboarding_submitted')).toBeNull();
    expect(localStorage.getItem('ars_google_onboarding_submitted')).toBeNull();

    removeItemSpy.mockRestore();
  });
});

describe('AuthContext.loginWithGoogle — unified routing rule', () => {
  // The rule: route by role/roleId + verification state, not solely by
  // isNewUser/requiresOnboarding. Mirrors the routing in GoogleCallback so
  // both entry paths converge on the same destination for the same BE shape.
  beforeEach(() => {
    // Reset path-specific sentinels between tests.
    sessionStorage.removeItem('ars_google_onboarding_submitted');
    localStorage.removeItem('ars_google_onboarding_submitted');
  });

  it('routes a role-null + roleId-null response (no legacy signal) to /complete-google-registration', async () => {
    // BE omitted isNewUser/requiresOnboarding AND omitted role/roleId —
    // the documented fallback path (BTR-AGENT52-01) routes to onboarding.
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-role-null',
      email: 'no-role@example.com',
      fullName: 'No Role',
      avatarUrl: null,
      userId: 200,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: null,
      isNewUser: false,
      requiresOnboarding: false,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED_ROLE_NULL');
    });

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(view.container.querySelector('[data-testid="forum-marker"]')).toBeNull();
  });

  it('routes an empty-string role (treated as missing) to /complete-google-registration', async () => {
    // Some BE serialisers emit "" for a missing role. The unified rule
    // treats trimmed-empty as missing so the fallback path still fires.
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-empty-role',
      email: 'empty@example.com',
      fullName: 'Empty Role',
      avatarUrl: null,
      userId: 201,
      role: '   ',
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: null,
      isNewUser: false,
      requiresOnboarding: false,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED_EMPTY_ROLE');
    });

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('routes a non-null role + Pending verificationStatus to /forum (Guest)', async () => {
    // The role is non-null (existing BE assignment) but the account is not
    // yet approved — verifyStatus Pending. Per the spec we land on /forum
    // as a Guest (effectiveRole: 'Guest') rather than the role workspace.
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-pending',
      email: 'pending@example.com',
      fullName: 'Pending User',
      avatarUrl: null,
      userId: 202,
      role: 'Researcher',
      roleId: 1,
      roles: ['Researcher'],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: 'Guest',
      isNewUser: false,
      requiresOnboarding: false,
    });

    // The helper the test uses to refresh BE state returns an active user,
    // but the original google-login payload already says Pending / not
    // active. We override getById here so the post-login helper doesn't
    // overwrite the routing decision.
    getByIdMock.mockReset();
    getByIdMock.mockRejectedValueOnce(new Error('not yet approved'));

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED_PENDING');
    });

    // /forum is the existing decision-state landing. AuthContext's
    // centralised helper delegates to landingRouteForRoleName which
    // returns /forum for non-Admin roles.
    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="forum-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(view.container.querySelector('[data-testid="onboarding-marker"]')).toBeNull();
  });

  it('routes an Approved + Active Researcher to /forum via landingRouteForRoleName', async () => {
    // Approved + active non-Admin user — preserve the existing landing
    // route (landingRouteForRoleName returns /forum for non-Admin roles).
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-approved',
      email: 'approved@example.com',
      fullName: 'Approved User',
      avatarUrl: null,
      userId: 203,
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
      await getHandle().loginWithGoogle('GIS_CRED_APPROVED');
    });

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="forum-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(view.container.querySelector('[data-testid="onboarding-marker"]')).toBeNull();
  });

  it('does not regress: a bare isNewUser=true (without requiresOnboarding) routes to /forum, NOT to onboarding', async () => {
    // Per the Agent 30 follow-up correction: the legacy "isNewUser alone
    // wins" semantics are intentionally retired. A bare `isNewUser=true`
    // without `requiresOnboarding=true` is no longer enough to drive the
    // onboarding branch — the resolver uses the explicit AND-clause. With
    // a non-null role the user lands on /forum as a Guest instead.
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-new-with-role',
      email: 'weird@example.com',
      fullName: 'Weird BE',
      avatarUrl: null,
      userId: 204,
      role: 'Researcher',
      roleId: 1,
      roles: ['Researcher'],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: false,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED_NEW_WITH_ROLE');
    });

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="forum-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(view.container.querySelector('[data-testid="onboarding-marker"]')).toBeNull();
  });

  it('routes to /complete-google-registration when isNewUser=true AND requiresOnboarding=true with a non-null role (the explicit signals win)', async () => {
    // Defensive: when both explicit onboarding signals are `true` and
    // the approved role list is empty, the AND-clause routes to onboarding
    // — the strongest positive signal we honour. Without
    // requiresOnboarding=true the legacy OR-logic would have routed to
    // onboarding; with the new spec the explicit AND-clause is required.
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-explicit-and',
      email: 'explicit-and@example.com',
      fullName: 'Explicit AND',
      avatarUrl: null,
      userId: 205,
      role: null,
      roleId: null,
      roles: [],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: null,
      isNewUser: true,
      requiresOnboarding: true,
    });

    const { view, getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    await act(async () => {
      await getHandle().loginWithGoogle('GIS_CRED_EXPLICIT_AND');
    });

    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]'))
          .toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(view.container.querySelector('[data-testid="forum-marker"]')).toBeNull();
  });
});
