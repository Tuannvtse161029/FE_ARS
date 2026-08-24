/**
 * Regression test for defect 3A: an Admin who lands on /login (or any
 * public route) while authenticated must be redirected to /admin, not
 * /forum. Previously `PublicRoute` hard-coded `ROUTES.FORUM` which routed
 * the Admin to the wrong surface.
 *
 * Scope: the authenticated-user branch of `PublicRoute` in
 * `src/routes/PrivateRoute.tsx`. The unauthenticated branch is unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicRoute } from '../../../src/routes/PrivateRoute';
import { ROUTES } from '../../../src/routes/paths';
import { buildMockAuth } from '../../../src/utils/mockAuth';

// `useAuth` is replaced per-test so we can swap role + auth state.
const useAuthMock = vi.fn();
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

// Sentinel routes that prove the redirect actually fired.
const AdminLanding = () => <div data-testid="admin-landing" />;
const ForumLanding = () => <div data-testid="forum-landing" />;
const LoginSurface = () => <div data-testid="login-surface" />;
const OnboardingLanding = () => <div data-testid="onboarding-landing" />;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('<PublicRoute> — authenticated Admin lands on /admin', () => {
  it('redirects Admin from /login to /admin (not /forum)', async () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({ role: 'Admin', isAuthenticated: true }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.LOGIN} element={<LoginSurface />} />
          </Route>
          <Route path={ROUTES.ADMIN} element={<AdminLanding />} />
          <Route path={ROUTES.FORUM} element={<ForumLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-landing')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('forum-landing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-surface')).not.toBeInTheDocument();
  });

  it('redirects Researcher from /login to /forum', async () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({ role: 'Researcher', isAuthenticated: true }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.LOGIN} element={<LoginSurface />} />
          </Route>
          <Route path={ROUTES.ADMIN} element={<AdminLanding />} />
          <Route path={ROUTES.FORUM} element={<ForumLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('forum-landing')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('admin-landing')).not.toBeInTheDocument();
  });

  it('redirects Reviewer from /login to /forum', async () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({ role: 'Reviewer', isAuthenticated: true }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.LOGIN} element={<LoginSurface />} />
          </Route>
          <Route path={ROUTES.ADMIN} element={<AdminLanding />} />
          <Route path={ROUTES.FORUM} element={<ForumLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('forum-landing')).toBeInTheDocument();
    });
  });

  it('redirects Lecturer from /register to /forum', async () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({ role: 'Lecturer', isAuthenticated: true }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.REGISTER]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.REGISTER} element={<div data-testid="register-surface" />} />
          </Route>
          <Route path={ROUTES.FORUM} element={<ForumLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('forum-landing')).toBeInTheDocument();
    });
  });

  it('does NOT redirect an unauthenticated user — the public route renders', () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({ role: null, isAuthenticated: false }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.LOGIN} element={<LoginSurface />} />
          </Route>
          <Route path={ROUTES.ADMIN} element={<AdminLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    // The login surface must remain rendered; the redirect must not fire.
    expect(screen.getByTestId('login-surface')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-landing')).not.toBeInTheDocument();
  });
});

// Agent 30 — regression test for the agent-30 onboarding redirect defect.
// A first-time Google user who reaches /login (or any other public route)
// while their session is already authenticated must be routed to
// /complete-google-registration, NOT to /forum. Without this branch the
// authenticated-user branch of PublicRoute would silently drop the user
// on /forum, bypassing the onboarding page they were meant to land on.
//
// The /forum-as-Guest fallback MUST NOT precede the onboarding branch.
describe('<PublicRoute> — first-time Google user lands on /complete-google-registration', () => {
  it('redirects a role-null authenticated user from /login to /complete-google-registration (not /forum)', async () => {
    // Mirror the BE response shape for a brand-new Google account:
    // role/roleId empty, isActive=false, effectiveRole=Guest. Without the
    // priority-1 onboarding branch, PublicRoute would fall through to
    // /forum and bypass the onboarding page.
    useAuthMock.mockReturnValue(
      buildMockAuth({
        role: null,
        roleId: 0,
        isActive: false,
        verificationStatus: 'Pending',
        effectiveRole: 'Guest',
        isAuthenticated: true,
      }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.LOGIN} element={<LoginSurface />} />
          </Route>
          <Route path={ROUTES.COMPLETE_GOOGLE_REGISTRATION} element={<OnboardingLanding />} />
          <Route path={ROUTES.FORUM} element={<ForumLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-landing')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('forum-landing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-surface')).not.toBeInTheDocument();
  });

  it('redirects a role-null authenticated user from /register to /complete-google-registration', async () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({
        role: null,
        roleId: 0,
        isActive: false,
        verificationStatus: 'Pending',
        effectiveRole: 'Guest',
        isAuthenticated: true,
      }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.REGISTER]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.REGISTER} element={<div data-testid="register-surface" />} />
          </Route>
          <Route path={ROUTES.COMPLETE_GOOGLE_REGISTRATION} element={<OnboardingLanding />} />
          <Route path={ROUTES.FORUM} element={<ForumLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-landing')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('forum-landing')).not.toBeInTheDocument();
  });

  it('still routes an unverified (Pending) user with a non-null role to /forum (as Guest)', async () => {
    // Pending user (role assigned but not yet approved) must continue to
    // land on /forum — the verified-guard renders the pending banner.
    useAuthMock.mockReturnValue(
      buildMockAuth({
        role: 'Researcher',
        isActive: false,
        verificationStatus: 'Pending',
        effectiveRole: 'Guest',
        isAuthenticated: true,
      }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.LOGIN} element={<LoginSurface />} />
          </Route>
          <Route path={ROUTES.COMPLETE_GOOGLE_REGISTRATION} element={<OnboardingLanding />} />
          <Route path={ROUTES.FORUM} element={<ForumLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('forum-landing')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-landing')).not.toBeInTheDocument();
  });

  // Agent 30 — verifies the exact approved-role-list condition from the
  // follow-up correction. When ALL four exact-AND-clause conditions
  // hold the user lands on /complete-google-registration, but when the
  // BE's `roles` list is non-empty (the user already has an accepted
  // role) they land on /forum as a Guest (the stronger approved-role
  // signal wins). This guards against the bug where PublicRoute
  // hard-codes `approvedRoles: null` — without forwarding `user.roles`
  // the exact priority would degrade to a looser three-condition
  // check and an explicit-onboarding-signal user with an accepted role
  // would be silently sent to /complete-google-registration.
  it('routes to /forum (not /complete-google-registration) when explicit onboarding signals are set BUT the user already has an accepted role', async () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher' as const],
        isActive: false,
        verificationStatus: 'Pending',
        effectiveRole: null,
        isNewUser: true,
        requiresOnboarding: true,
        isAuthenticated: true,
      }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.LOGIN} element={<LoginSurface />} />
          </Route>
          <Route path={ROUTES.COMPLETE_GOOGLE_REGISTRATION} element={<OnboardingLanding />} />
          <Route path={ROUTES.FORUM} element={<ForumLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('forum-landing')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-landing')).not.toBeInTheDocument();
  });

  it('routes to /complete-google-registration when the exact AND-clause holds AND the approved-roles list is empty', async () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({
        role: null,
        roleId: 0,
        roles: [],
        isActive: false,
        verificationStatus: 'Pending',
        effectiveRole: null,
        isNewUser: true,
        requiresOnboarding: true,
        isAuthenticated: true,
      }),
    );

    render(
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path={ROUTES.LOGIN} element={<LoginSurface />} />
          </Route>
          <Route path={ROUTES.COMPLETE_GOOGLE_REGISTRATION} element={<OnboardingLanding />} />
          <Route path={ROUTES.FORUM} element={<ForumLanding />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-landing')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('forum-landing')).not.toBeInTheDocument();
  });
});