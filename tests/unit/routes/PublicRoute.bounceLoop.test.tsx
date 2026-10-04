/**
 * Regression for the `/login` blank-page loop:
 *
 * When `resolvePostAuthRoute` falls through to its Priority-4 "malformed
 * snapshot" branch it returns `ROUTES.LOGIN`. If the user is already on
 * `/login` (a common scenario: previous session is corrupted or the
 * resolver is not ready yet), `<Navigate replace to={ROUTES.LOGIN} />`
 * from a `/login` mount produces no URL change. PublicRoute re-renders,
 * recomputes the same destination, fires another Navigate, and the page
 * sits at `/login` with the Login form never actually mounted — the user
 * sees a permanently blank page.
 *
 * The fix: PublicRoute tracks how many times it has bounced to the same
 * destination in the same mount. On the second bounce it treats the
 * session as unrecoverable, calls `handleSessionFailure()` to clear it,
 * and renders the public `<Outlet />` so the login form mounts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicRoute } from '@/routes/PrivateRoute';
import { ROUTES } from '@/routes/paths';
import { buildMockAuth } from '@/utils/mockAuth';

const useAuthMock = vi.fn();
const handleSessionFailureMock = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

const LoginSurface = () => <div data-testid="login-surface" />;
const AdminLanding = () => <div data-testid="admin-landing" />;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('<PublicRoute> — same-path bounce loop guard', () => {
  it('clears the session and renders the login surface when the resolver keeps returning the current path', async () => {
    // Snapshot that triggers Priority 4 (malformed) → /login.
    // - isActive is null (not strictly true) → isApprovedActiveUser false
    // - effectiveRole is not 'Guest' and no `verificationStatus` match
    //   for the pending branch → falls through to /login.
    useAuthMock.mockReturnValue({
      ...buildMockAuth({ role: null, isAuthenticated: true }),
      handleSessionFailure: handleSessionFailureMock,
      effectiveRole: null,
    });

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

    // PublicRoute will:
    //   1st render — destination = /login, current = /login → bounce (1/1)
    //   2nd render — same path, calls handleSessionFailure(), returns
    //                <Outlet />. The Login form mounts.
    await waitFor(() => {
      expect(handleSessionFailureMock).toHaveBeenCalled();
    });
    expect(screen.getByTestId('login-surface')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-landing')).not.toBeInTheDocument();
  });
});
