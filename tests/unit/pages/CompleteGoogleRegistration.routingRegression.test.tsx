/**
 * Agent 30 — Bug triage regression: first-time Google user with role=null,
 * roleId=null, verificationStatus=null MUST stay on /complete-google-registration.
 *
 * The reported symptom (BTR-AGENT30-04):
 *   1. POST /api/Auth/google-login returns role=null, roleId=null,
 *      verificationStatus=null (BE first-time-user shape).
 *   2. The dev-diag logs `chosenRoute=/complete-google-registration`.
 *   3. The user lands on /forum instead, with the Google avatar in the header,
 *      the "Forums" sidebar visible, and a 403 from the forum posts API.
 *   4. DevTools reports "Maximum update depth exceeded" with the chain
 *      passing through MainLayout → PrivateRoute → Outlet.
 *
 * Mounts a router that mirrors App.tsx (AuthProvider + Routes, with
 * /complete-google-registration as a SIBLING top-level route OUTSIDE the
 * PrivateRoute + MainLayout chain) and asserts the user lands on the
 * onboarding marker, NOT on /forum.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, Outlet } from 'react-router-dom';

const postGoogleLoginMock = vi.fn();
const userServiceGetByIdMock = vi.fn();

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
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

vi.mock('../../../src/services/user.service', () => ({
  userService: {
    getById: (...args: unknown[]) => userServiceGetByIdMock(...args),
  },
}));

const authStoreState: Record<string, unknown> = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  effectiveRole: null,
  login: vi.fn(),
  logout: vi.fn(),
  setLoading: vi.fn(),
  updateUser: vi.fn(),
  setEffectiveRole: vi.fn(),
};

vi.mock('../../../src/store', () => ({
  useAuthStore: Object.assign(
    () => authStoreState,
    { getState: () => authStoreState },
  ),
}));
vi.mock('../../../src/store/authSlice', () => ({
  useAuthStore: Object.assign(
    () => authStoreState,
    { getState: () => authStoreState },
  ),
}));
vi.mock('../../../src/store/welcomeSignal', () => ({
  useWelcomeSignal: { getState: () => ({ show: vi.fn(), reset: vi.fn() }) },
}));

vi.mock('../../../src/utils/storage', () => ({
  storage: {
    setToken: vi.fn(),
    setUser: vi.fn(),
    getToken: vi.fn(() => null),
    getUser: vi.fn(() => null),
    setRememberMe: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from '../../../src/context/AuthContext';

beforeEach(() => {
  postGoogleLoginMock.mockReset();
  userServiceGetByIdMock.mockReset();
  authStoreState.user = null;
  authStoreState.token = null;
  authStoreState.isAuthenticated = false;
  authStoreState.isLoading = false;
  authStoreState.effectiveRole = null;
  (authStoreState.login as ReturnType<typeof vi.fn>).mockReset();
  (authStoreState.logout as ReturnType<typeof vi.fn>).mockReset();
  (authStoreState.setLoading as ReturnType<typeof vi.fn>).mockReset();
  (authStoreState.updateUser as ReturnType<typeof vi.fn>).mockReset();
  sessionStorage.clear();
  localStorage.clear();
});

// Minimal stubs so the test isolates the routing decision from the
// heavyweight onboarding page, the wallet hooks, the notification centre,
// etc. If the user is ever incorrectly routed into /forum, the sidebar
// stub will render a sidebar anchor and we'll catch it.
const LoginMarker = () => <div data-testid="login-page">login</div>;
const OnboardingMarker = () => (
  <div data-testid="complete-google-registration">onboarding</div>
);
const ForumMarker = () => <div data-testid="forum-page">forum</div>;
const SidebarMarker = () => (
  <aside data-testid="main-sidebar">
    <a href="/forum">Forums</a>
  </aside>
);
const LayoutStub = () => (
  <div>
    <SidebarMarker />
    <Outlet />
  </div>
);
const PrivateRouteStub = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <LoginMarker />;
};
const LoginTrigger = ({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useAuth>) => void;
}) => {
  const api = useAuth();
  onReady(api);
  return null;
};

function mountApp() {
  let api: ReturnType<typeof useAuth> | null = null;
  const onReady = (handle: ReturnType<typeof useAuth>) => {
    api = handle;
  };
  const view = render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginTrigger onReady={onReady} />} />
          <Route
            path="/complete-google-registration"
            element={<OnboardingMarker />}
          />
          <Route element={<PrivateRouteStub />}>
            <Route element={<LayoutStub />}>
              <Route path="/forum" element={<ForumMarker />} />
            </Route>
          </Route>
          <Route path="*" element={<div data-testid="not-found">404</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { view, getApi: () => api };
}

describe('Agent 30 — first-time Google routing (role=null/roleId=null)', () => {
  it('lands on /complete-google-registration, NOT /forum, when the BE returns role=null, roleId=null, verificationStatus=null', async () => {
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
      verificationStatus: null,
      effectiveRole: null,
      isNewUser: false,
      requiresOnboarding: false,
    });

    const { view, getApi } = mountApp();
    await waitFor(() => expect(getApi()).toBeTruthy());

    await act(async () => {
      await getApi()!.loginWithGoogle('GIS_CRED_BUG_REPRO');
    });

    // The user MUST land on /complete-google-registration, NOT /forum.
    await waitFor(() => {
      expect(
        view.container.querySelector('[data-testid="complete-google-registration"]'),
      ).toBeTruthy();
    });
    expect(view.container.querySelector('[data-testid="forum-page"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="main-sidebar"]')).toBeNull();
  });
});
