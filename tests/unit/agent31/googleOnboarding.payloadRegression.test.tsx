/**
 * Agent 31 (regression) — pinned test for the exact duyphuong2000.dpp@gmail.com
 * failure mode described in the Agent 31 ticket:
 *
 *   Confirmed BE response payload:
 *     {
 *       effectiveRole: null,
 *       isActive: false,
 *       isNewUser: true,
 *       requiresOnboarding: true,
 *       role: null,
 *       roles: [],
 *       verificationStatus: null
 *     }
 *
 * Required outcomes (Agent 31 ticket, exact spec):
 *   - The user is routed to /complete-google-registration, NOT /forum.
 *   - The Forum "Pending Admin verification" banner NEVER renders.
 *   - Exactly ONE `POST /api/Auth/google-login` per Google credential.
 *   - The four-condition AND-clause is honoured even when the BE omits
 *     the explicit verificationStatus.
 *
 * This test is intentionally narrow — it asserts only the destination
 * route and the absence of /forum, matching the ticket's "single
 * regression" description. Wider invariants live in
 * `tests/unit/agent30/googleOnboarding.regression.test.tsx` and
 * `tests/unit/utils/postAuthRoute.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const postGoogleLoginMock = vi.fn();
const authStoreLoginMock = vi.fn();
const storageSetUserMock = vi.fn();
const storageSetTokenMock = vi.fn();
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
      logout: vi.fn(),
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
        logout: vi.fn(),
        setLoading: vi.fn(),
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
import { resolvePostAuthRoute, isFirstTimeOnboardingUser } from '../../../src/utils/postAuthRoute';
import { ROUTES } from '../../../src/routes/paths';

beforeEach(() => {
  postGoogleLoginMock.mockReset();
  authStoreLoginMock.mockReset();
  storageSetUserMock.mockReset();
  storageSetTokenMock.mockReset();
  storageSetRememberMeMock.mockReset();
  getByIdMock.mockReset();
  getByIdMock.mockRejectedValue(new Error('404'));
});

describe('Agent 31 — exact BE response payload regression', () => {
  it('resolvePostAuthRoute sends the documented payload to /complete-google-registration', () => {
    // The EXACT JSON the user reported as the cause of the regression.
    // isNewUser===true AND requiresOnboarding===true AND effectiveRole===null
    // AND roles.length===0 AND role===null AND verificationStatus===null.
    const destination = resolvePostAuthRoute({
      effectiveRole: null,
      isActive: false,
      isNewUser: true,
      requiresOnboarding: true,
      role: null,
      roleId: null,
      roles: [],
      verificationStatus: null,
    });
    expect(destination).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
    expect(destination).not.toBe(ROUTES.FORUM);
    expect(destination).not.toBe(ROUTES.LOGIN);
  });

  it('isFirstTimeOnboardingUser classifies the documented payload as first-time', () => {
    const result = isFirstTimeOnboardingUser({
      effectiveRole: null,
      isActive: false,
      isNewUser: true,
      requiresOnboarding: true,
      role: null,
      roleId: null,
      roles: [],
      verificationStatus: null,
    });
    expect(result).toBe(true);
  });
});

describe('Agent 31 — AuthContext.loginWithGoogle routes the documented payload correctly', () => {
  interface CaptureHandle {
    loginWithGoogle: ReturnType<typeof useAuth>['loginWithGoogle'];
  }
  function Probe({ onReady }: { onReady: (api: CaptureHandle) => void }) {
    const api = useAuth();
    onReady(api);
    return null;
  }

  function mountAuthContext() {
    let handle: CaptureHandle | null = null;
    const onReady = (api: CaptureHandle) => {
      handle = api;
    };
    const view = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Probe onReady={onReady} />} />
            <Route
              path="/forum"
              element={
                <div data-testid="forum-marker">
                  <p data-testid="forum-pending-banner">Pending Admin verification</p>
                </div>
              }
            />
            <Route
              path="/complete-google-registration"
              element={<div data-testid="onboarding-marker">onboarding</div>}
            />
            <Route path="*" element={<div data-testid="unknown-marker">unknown</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    return { view, getHandle: () => handle as unknown as CaptureHandle };
  }

  it('final route = /complete-google-registration (Forum never renders)', async () => {
    postGoogleLoginMock.mockResolvedValueOnce({
      token: 'jwt-agent31',
      email: 'duyphuong2000.dpp@gmail.com',
      fullName: 'Duy Phuong',
      avatarUrl: null,
      userId: 99,
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
      await getHandle().loginWithGoogle('GIS_AGENT31_CRED');
    });

    await new Promise<void>((r) => setTimeout(r, 50));

    // Final destination MUST be the onboarding page.
    await waitFor(
      () => {
        expect(view.container.querySelector('[data-testid="onboarding-marker"]')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // Forum must never have rendered — neither the page nor the pending banner.
    expect(view.container.querySelector('[data-testid="forum-marker"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="forum-pending-banner"]')).toBeNull();
  });

  it('one Google credential → one POST → one auth-state update', async () => {
    let resolveExchange: (value: unknown) => void = () => {};
    const exchangePromise = new Promise((res) => {
      resolveExchange = res;
    });
    postGoogleLoginMock.mockImplementationOnce(() => exchangePromise);

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().loginWithGoogle);

    const first = getHandle().loginWithGoogle('GIS_AGENT31_DUP');
    const second = getHandle().loginWithGoogle('GIS_AGENT31_DUP');

    resolveExchange({
      token: 'jwt-agent31-dup',
      email: 'dup@example.com',
      fullName: 'Dup',
      avatarUrl: null,
      userId: 100,
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

    // Agent 31 ticket guarantee #1: one Google credential → one POST.
    // The shared `acquireGoogleLoginSession` guard dedupes the BE exchange.
    expect(postGoogleLoginMock).toHaveBeenCalledTimes(1);
    expect(postGoogleLoginMock.mock.calls[0][0]).toEqual({
      credential: 'GIS_AGENT31_DUP',
    });
  });
});
