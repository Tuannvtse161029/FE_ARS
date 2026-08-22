/**
 * Regression for App.tsx's Researcher-only wrapping of `/papers` and
 * `/reviewers` (Agent-12, AGENT_12_GS_NAV_READY).
 *
 * Contract:
 *   - Graduate Student typing /papers or /reviewers directly → bounced to
 *     the role-based landing route (per roleNormalizer). At present
 *     `landingRouteForRoleName('Graduate Student')` returns `/dashboard`
 *     — the test pins the current behavior and does not silently change
 *     the normalizer (see defect report comment block).
 *   - Researcher user accessing /papers or /reviewers → still renders the
 *     sentinel page (route guard allows it).
 *   - Multi-role users who chose Researcher at login still pass
 *     (RoleRouteGuard at-least-one semantics).
 *   - Lecturer, Reviewer, Admin → bounced to their landing route.
 *
 * Implementation:
 *   Re-implement a minimal App-shape Routes tree (mirror of the relevant
 *   block in App.tsx) using the real RoleRouteGuard component, with stub
 *   page components. We then assert routing outcomes via
 *   test-id sentinels mounted under the redirect targets.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleRouteGuard } from '@/routes/RoleRouteGuard';
import { ROUTES } from '@/routes/paths';
import {
  landingRouteForRoleName,
  isAdminUser,
} from '@/utils/roleNormalizer';

// ── Auth mock — swap role per test ──────────────────────────────────────────
const useAuthMock = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

const buildUser = (
  role: string | null,
  opts: { roleId?: number | null } = {},
) => ({
  user: role
    ? {
        token: 'mock-token',
        username: 'tester',
        email: 'tester@example.com',
        role,
        userId: 99,
        isActive: true,
        roleId: opts.roleId ?? 0,
      }
    : null,
  isAuthenticated: role !== null,
  isLoading: false,
  error: null,
  login: () => Promise.resolve(),
  logout: () => undefined,
  clearError: () => undefined,
  pendingRoleSelection: null,
  confirmRoleSelection: () => undefined,
  cancelRoleSelection: () => undefined,
});

const setupRole = (
  role: string | null,
  opts: { roleId?: number | null } = {},
) => {
  useAuthMock.mockReturnValue(buildUser(role, opts));
};

beforeEach(() => {
  vi.clearAllMocks();
});

// Minimum "App.tsx-equivalent" route tree:
// - private routes assume authed (we mock useAuth to keep this simple).
// - we mount a RoleRouteGuard that mirrors App.tsx, plus sentinel routes at
//   /papers, /reviewers, the role landing routes, and /login (defensive).
const ProtectedRoutes = (
  <Routes>
    <Route element={<RoleRouteGuard allow={['Researcher']} />}>
      <Route
        path={ROUTES.PAPERS}
        element={<div data-testid="papers-page">papers-page</div>}
      />
      <Route
        path={ROUTES.REVIEWERS}
        element={<div data-testid="reviewers-page">reviewers-page</div>}
      />
    </Route>
    <Route
      path="/forum"
      element={<div data-testid="forum-landing">forum-landing</div>}
    />
    <Route
      path="/admin"
      element={<div data-testid="admin-landing">admin-landing</div>}
    />
    <Route
      path={ROUTES.LOGIN}
      element={<div data-testid="login-page">login-page</div>}
    />
    <Route
      path="*"
      element={<div data-testid="fallback">fallback</div>}
    />
  </Routes>
);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>{ProtectedRoutes}</MemoryRouter>,
  );

describe('RoleRouteGuard — /papers and /reviewers (AGENT_12_GS_NAV_READY)', () => {
  it('Graduate Student is bounced away from /papers to their landing route', async () => {
    setupRole('Graduate Student');
    renderAt(ROUTES.PAPERS);

    await waitFor(() => {
      expect(
        screen.queryByTestId('papers-page'),
      ).not.toBeInTheDocument();
    });

    // `landingRouteForRoleName('Graduate Student')` now returns `/forum` —
    // every non-Admin role lands on the Forum as the post-login landing page.
    const landing = landingRouteForRoleName('Graduate Student');
    expect(landing).toBe('/forum');
    await waitFor(() => {
      expect(
        screen.queryByTestId('forum-landing'),
      ).toBeInTheDocument();
    });
  });

  it('Graduate Student is bounced away from /reviewers to their landing route', async () => {
    setupRole('Graduate Student');
    renderAt(ROUTES.REVIEWERS);

    await waitFor(() => {
      expect(
        screen.queryByTestId('reviewers-page'),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.queryByTestId('forum-landing'),
      ).toBeInTheDocument();
    });
  });

  it('Researcher can access /papers', async () => {
    setupRole('Researcher');
    renderAt(ROUTES.PAPERS);

    await waitFor(() => {
      expect(screen.queryByTestId('papers-page')).toBeInTheDocument();
    });
  });

  it('Researcher can access /reviewers', async () => {
    setupRole('Researcher');
    renderAt(ROUTES.REVIEWERS);

    await waitFor(() => {
      expect(screen.queryByTestId('reviewers-page')).toBeInTheDocument();
    });
  });

  it('Lecturer is bounced away from /papers to their landing route', async () => {
    setupRole('Lecturer');
    renderAt(ROUTES.PAPERS);

    await waitFor(() => {
      expect(
        screen.queryByTestId('papers-page'),
      ).not.toBeInTheDocument();
    });
    const landing = landingRouteForRoleName('Lecturer');
    expect(landing).toBe('/forum');
    await waitFor(() => {
      expect(
        screen.queryByTestId('forum-landing'),
      ).toBeInTheDocument();
    });
  });

  it('Reviewer is bounced away from /reviewers to their landing route', async () => {
    setupRole('Reviewer');
    renderAt(ROUTES.REVIEWERS);

    await waitFor(() => {
      expect(
        screen.queryByTestId('reviewers-page'),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.queryByTestId('forum-landing'),
      ).toBeInTheDocument();
    });
  });

  it('Admin (roleName) is bounced away from /papers to their landing route', async () => {
    setupRole('Admin');
    renderAt(ROUTES.PAPERS);

    await waitFor(() => {
      expect(
        screen.queryByTestId('papers-page'),
      ).not.toBeInTheDocument();
    });
    // Admin user's landing route is /admin per roleNormalizer.
    expect(isAdminUser({ roleName: 'Admin' })).toBe(true);
    await waitFor(() => {
      expect(
        screen.queryByTestId('admin-landing'),
      ).toBeInTheDocument();
    });
  });

  it('Multi-role user who picked Researcher at login still passes /papers', async () => {
    // The BE returns `roles: ['Graduate Student', 'Researcher']`; after
    // the picker, the active role is the chosen one — Researcher — and the
    // guard reads `user.role === 'Researcher'`. Allow-list includes
    // Researcher, so access is granted.
    setupRole('Researcher');
    renderAt(ROUTES.PAPERS);

    await waitFor(() => {
      expect(screen.queryByTestId('papers-page')).toBeInTheDocument();
    });
  });

  it('Unauthenticated user is bounced to /login (defensive double-check)', async () => {
    setupRole(null);
    renderAt(ROUTES.PAPERS);

    await waitFor(() => {
      expect(
        screen.queryByTestId('papers-page'),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('login-page')).toBeInTheDocument();
    });
  });
});
