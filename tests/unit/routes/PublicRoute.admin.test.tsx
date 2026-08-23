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