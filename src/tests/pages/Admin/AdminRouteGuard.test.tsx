/**
 * Regression tests for the Admin route guard.
 *
 * `useAdminGuard` is called from every Admin/* page. The contract:
 *   - Admin users stay on Admin pages.
 *   - Non-Admin users get redirected to /forum (per roleNormalizer).
 *
 * We render the `RoleRequests` page inside a MemoryRouter and assert the
 * rendered output (Admin user sees the page; non-Admin users trigger the
 * `navigate(ROUTES.FORUM)` effect).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleRequests } from '../../../pages/Admin/RoleRequests';
import { buildMockAuth } from '../../utils/mockAuth';
import { ROUTES } from '../../../routes/paths';

// Use a minimal mock for adminService — only used to load the page.
const { adminService } = vi.hoisted(() => ({
  adminService: {
    getRoleRequests: vi.fn(async () => []),
    getRoleRequest: vi.fn(async () => null),
    decideRoleRequest: vi.fn(async () => ({})),
    getAccounts: vi.fn(async () => []),
    suspendAccount: vi.fn(async () => ({})),
    unsuspendAccount: vi.fn(async () => ({})),
    getReviewerWithdrawals: vi.fn(async () => []),
    markWithdrawalProcessing: vi.fn(async () => ({})),
    completeWithdrawal: vi.fn(async () => ({})),
    denyWithdrawal: vi.fn(async () => ({})),
    getAnalyticsSummary: vi.fn(async () => ({ totalMembers: 0, totalPapers: 0 })),
    getAnalyticsTimeseries: vi.fn(async () => ({
      range: 'daily',
      metric: 'revenue',
      points: [],
    })),
    __resetAdminMockStores: vi.fn(),
  },
}));

vi.mock('../../../services/admin.service', () => ({ adminService }));

const ROLE_FORUM = '/forum';
const ROLE_ADMIN = '/admin/role-requests';

const renderWithAuth = (
  role: string | null,
  initialPath: string,
) => {
  vi.mocked(useAuthMock).mockReturnValue(buildMockAuth({ role, isAuthenticated: role !== null }));
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path={ROUTES.ADMIN_ROLE_REQUESTS} element={<RoleRequests />} />
        <Route path={ROLE_FORUM} element={<div data-testid="forum-redirected" />} />
      </Routes>
    </MemoryRouter>,
  );
};

// Mock the auth hook with a mutable ref so each test can swap roles.
const useAuthMock = vi.fn();
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Admin route guard regression', () => {
  it('Admin role can render RoleRequests page', async () => {
    renderWithAuth('Admin', ROLE_ADMIN);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Role Requests/i })).toBeInTheDocument();
    });
  });

  it('Non-Admin role (Researcher) is redirected away from /admin/role-requests', async () => {
    const user = userEvent.setup();
    renderWithAuth('Researcher', ROLE_ADMIN);
    // The Researcher is bounced to /forum.
    await waitFor(() => {
      expect(screen.queryByTestId('forum-redirected')).toBeInTheDocument();
    });
    // The page chrome never renders.
    expect(screen.queryByRole('heading', { name: /Role Requests/i })).not.toBeInTheDocument();
    void user;
  });

  it('Graduate Student role is redirected away from /admin/role-requests', async () => {
    renderWithAuth('Graduate Student', ROLE_ADMIN);
    await waitFor(() => {
      expect(screen.queryByTestId('forum-redirected')).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /Role Requests/i })).not.toBeInTheDocument();
  });

  it('Reviewer role is redirected away from /admin/role-requests', async () => {
    renderWithAuth('Reviewer', ROLE_ADMIN);
    await waitFor(() => {
      expect(screen.queryByTestId('forum-redirected')).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /Role Requests/i })).not.toBeInTheDocument();
  });

  it('Lecturer role is redirected away from /admin/role-requests', async () => {
    renderWithAuth('Lecturer', ROLE_ADMIN);
    await waitFor(() => {
      expect(screen.queryByTestId('forum-redirected')).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /Role Requests/i })).not.toBeInTheDocument();
  });
});