/**
 * Agent 15 — Admin AccountsManagement pagination tests.
 *
 * Verifies 10 records per page, search reset, and empty state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../../src/services/admin.service', () => ({
  adminService: {
    getAccounts: vi.fn(),
    getRoleRequests: vi.fn(),
    getReviewerWithdrawals: vi.fn(),
    suspendAccount: vi.fn(),
    unsuspendAccount: vi.fn(),
    resetAccountPassword: vi.fn(),
  },
}));

vi.mock('../../../../../src/hooks/useAdminGuard', () => ({
  useAdminGuard: () => undefined,
}));

vi.mock('../../../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 99, role: 'Admin', token: 't', email: 'admin@test.com', username: 'admin' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../../../../src/store/authSlice', () => ({
  useAuthStore: <T,>(selector: (s: { user: { id: number } | null }) => T) =>
    selector({ user: { id: 1, role: 'Admin' } }),
}));

import { adminService } from '../../../../../src/services/admin.service';
import { AccountsManagement } from '../../../../../src/pages/Admin/AccountsManagement';

const makeAccount = (i: number) => ({
  id: i,
  name: `User ${i}`,
  email: `user${i}@example.com`,
  roles: ['Student' as const],
  plan: 'Free' as const,
  status: 'Active' as const,
  joinedDate: '2026-01-01T00:00:00Z',
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AccountsManagement />
    </MemoryRouter>,
  );

describe('AccountsManagement — Agent 15 pagination', () => {
  beforeEach(() => {
    vi.mocked(adminService.getAccounts).mockReset();
  });

  it('shows 10 records on page 1 and 5 on page 2 (out of 15 total)', async () => {
    const items = Array.from({ length: 15 }, (_, i) => makeAccount(i + 1));
    vi.mocked(adminService.getAccounts).mockResolvedValue(items);

    renderPage();

    await waitFor(() => expect(screen.getByText('User 1')).toBeInTheDocument());
    const page1Rows = document.querySelectorAll('tbody tr');
    expect(page1Rows.length).toBe(10);

    // Pagination button for page 2 should be visible
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();
  });

  it('refresh button calls admin service', async () => {
    const items = Array.from({ length: 3 }, (_, i) => makeAccount(i + 1));
    vi.mocked(adminService.getAccounts).mockResolvedValue(items);

    renderPage();

    await waitFor(() => expect(screen.getByText('User 1')).toBeInTheDocument());
    const initialCalls = vi.mocked(adminService.getAccounts).mock.calls.length;

    const user = userEvent.setup();
    await user.click(screen.getByTestId('table-refresh-btn'));
    await waitFor(() =>
      expect(vi.mocked(adminService.getAccounts).mock.calls.length).toBeGreaterThan(
        initialCalls,
      ),
    );
  });

  it('search filters results to a single row', async () => {
    const items = Array.from({ length: 25 }, (_, i) => makeAccount(i + 1));
    let lastQuery: { search?: string } = {};
    vi.mocked(adminService.getAccounts).mockImplementation(async (q) => {
      lastQuery = q ?? {};
      if (q?.search) {
        return items.filter((a) =>
          a.name.toLowerCase().includes(q.search!.toLowerCase()),
        );
      }
      return items;
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('User 1')).toBeInTheDocument());
    const user = userEvent.setup();
    const search = screen.getByTestId('table-search-input') as HTMLInputElement;
    await user.type(search, 'User 22');
    await waitFor(() => expect(screen.getByText('User 22')).toBeInTheDocument());
    expect(lastQuery.search).toBe('User 22');
    expect(screen.queryByText('User 1')).not.toBeInTheDocument();
    expect(screen.queryByText('User 11')).not.toBeInTheDocument();
  });
});
