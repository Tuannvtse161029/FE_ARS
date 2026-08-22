/**
 * Page-level tests for src/pages/Admin/RoleRequests.tsx (Agent 40).
 *
 * After Agent 29 migrated the Admin User API surface:
 *   - the page reads /api/User via `adminUserService.listAllUsers`
 *   - filters by `verificationStatus` (Pending / Accepted / Rejected)
 *   - Accept / Reject buttons are intentionally disabled because the BE
 *     does not yet expose a verification-mutation endpoint (BTR-AGENT29-C).
 *
 * This suite exercises the new contract — old assertions tied to
 * `/api/RoleRequest` (the obsolete endpoint) were retired because they no
 * longer describe behavior the page implements.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RoleRequests } from '../../../../../src/pages/Admin/RoleRequests';
import { buildMockAuth } from '../../../../../src/utils/mockAuth';

const { adminUserService, _internal } = vi.hoisted(() => {
  const NOW = '2026-08-19T10:30:00Z';
  const users = [
    {
      id: 501,
      email: 'khanh.tran@example.com',
      fullName: 'Tran Van Khanh',
      username: 'khanh',
      roleId: 0,
      roleName: null,
      isActive: false,
      isEmailVerified: true,
      verificationStatus: 'Pending',
      accountTier: 'Free',
      proofDocumentUrl: 'https://example.com/proof-khanh.pdf',
      createdAt: NOW,
    },
    {
      id: 502,
      email: 'lan.le@example.com',
      fullName: 'Le Thi Lan',
      username: 'lan',
      roleId: 0,
      roleName: 'Lecturer',
      isActive: true,
      isEmailVerified: true,
      verificationStatus: 'Accepted',
      accountTier: 'Free',
      proofDocumentUrl: null,
      createdAt: NOW,
    },
    {
      id: 503,
      email: 'rejected@example.com',
      fullName: 'Pham Hoai Nam',
      username: 'nam',
      roleId: 0,
      roleName: null,
      isActive: false,
      isEmailVerified: true,
      verificationStatus: 'Rejected',
      accountTier: 'Free',
      proofDocumentUrl: 'https://example.com/proof-nam.pdf',
      createdAt: NOW,
    },
  ];

  const listAllUsers = vi.fn(async () => ({
    rows: users.map((u) => ({ ...u })),
    totalCount: users.length,
    fetchedAt: NOW,
  }));

  return {
    adminUserService: {
      listAllUsers,
      listPendingVerification: vi.fn(async () => ({
        rows: users.filter((u) => u.verificationStatus === 'Pending'),
        totalCount: users.length,
        fetchedAt: NOW,
      })),
      getById: vi.fn(async (id: number) => {
        const hit = users.find((u) => u.id === id);
        return hit ? { ...hit } : ({} as never);
      }),
    },
    _internal: { users },
  };
});

vi.mock('../../../../../src/services/adminUser.service', () => ({
  adminUserService,
  KNOWN_VERIFICATION_STATUSES: ['Pending', 'Accepted', 'Rejected'],
  normalizeVerificationStatus: (raw: unknown) => (typeof raw === 'string' ? raw : ''),
  isPendingVerification: (user: { verificationStatus?: string }) =>
    user.verificationStatus === 'Pending',
}));

vi.mock('../../../../../src/services/user.service', () => ({
  displayAccountTier: (tier: string | null | undefined) => tier ?? 'Free',
}));

vi.mock('../../../../../src/context/AuthContext', () => ({
  useAuth: () => buildMockAuth({ role: 'Admin', userId: 18 }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <RoleRequests />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the in-memory user list back to the hoisted defaults.
  _internal.users.splice(0, _internal.users.length, ...[
    {
      id: 501,
      email: 'khanh.tran@example.com',
      fullName: 'Tran Van Khanh',
      username: 'khanh',
      roleId: 0,
      roleName: null,
      isActive: false,
      isEmailVerified: true,
      verificationStatus: 'Pending',
      accountTier: 'Free',
      proofDocumentUrl: 'https://example.com/proof-khanh.pdf',
      createdAt: '2026-08-19T10:30:00Z',
    },
    {
      id: 502,
      email: 'lan.le@example.com',
      fullName: 'Le Thi Lan',
      username: 'lan',
      roleId: 0,
      roleName: 'Lecturer',
      isActive: true,
      isEmailVerified: true,
      verificationStatus: 'Accepted',
      accountTier: 'Free',
      proofDocumentUrl: null,
      createdAt: '2026-08-19T10:30:00Z',
    },
    {
      id: 503,
      email: 'rejected@example.com',
      fullName: 'Pham Hoai Nam',
      username: 'nam',
      roleId: 0,
      roleName: null,
      isActive: false,
      isEmailVerified: true,
      verificationStatus: 'Rejected',
      accountTier: 'Free',
      proofDocumentUrl: 'https://example.com/proof-nam.pdf',
      createdAt: '2026-08-19T10:30:00Z',
    },
  ]);
});

describe('<RoleRequests> page (Agent 40 — User-driven)', () => {
  it('reads users from adminUserService.listAllUsers (no RoleRequest endpoint)', async () => {
    renderPage();
    await waitFor(() => {
      expect(adminUserService.listAllUsers).toHaveBeenCalled();
    });
  });

  it('renders the User-driven column headers (no obsolete INITIAL/CURRENT/REQUEST TYPE)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    const labels = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(labels).toContain('Assigned / Pending Role');
    expect(labels).toContain('Email Verification');
    expect(labels).toContain('Verification Status');
    expect(labels).toContain('Actions');
  });

  it('default filter shows only Pending users and hides Accepted/Rejected rows', async () => {
    renderPage();
    expect(await screen.findByText(/Tran Van Khanh/)).toBeInTheDocument();
    expect(screen.queryByText(/Le Thi Lan/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pham Hoai Nam/)).not.toBeInTheDocument();
  });

  it('switching to Accepted reveals the Accepted row only', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Tran Van Khanh/);
    const select = screen.getByLabelText(/Filter by verification status/i) as HTMLSelectElement;
    await user.selectOptions(select, 'ACCEPTED');
    expect(await screen.findByText(/Le Thi Lan/)).toBeInTheDocument();
    expect(screen.queryByText(/Tran Van Khanh/)).not.toBeInTheDocument();
  });

  it('Accept and Reject buttons are rendered but disabled (BTR-AGENT29-C)', async () => {
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    const accept = within(row).getByTestId('role-requests-accept');
    const reject = within(row).getByTestId('role-requests-reject');
    expect(accept).toBeDisabled();
    expect(reject).toBeDisabled();
    expect(accept.getAttribute('title')).toMatch(/verification-mutation endpoint/i);
    expect(reject.getAttribute('title')).toMatch(/verification-mutation endpoint/i);
  });

  it('null roleName displays as "Pending role assignment" (no fake Guest persisted role)', async () => {
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    expect(row.textContent).toMatch(/Pending role assignment/);
  });

  it('assigned role is rendered when roleName is present', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Tran Van Khanh/);
    const select = screen.getByLabelText(/Filter by verification status/i) as HTMLSelectElement;
    await user.selectOptions(select, 'ACCEPTED');
    const row = (await screen.findByText(/Le Thi Lan/)).closest('tr') as HTMLElement;
    expect(row.textContent).toMatch(/Lecturer/);
  });

  it('View Details opens a read-only dialog with the user identity and proof document', async () => {
    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    await user.click(
      within(pendingRow.closest('tr') as HTMLElement).getByRole('button', { name: /View Details/ }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/khanh\.tran@example\.com/);
    expect(dialog.textContent).toMatch(/Tran Van Khanh/);
    // Only Close button allowed.
    expect(within(dialog).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog).getByRole('button', { name: /^Close$/ })).toBeInTheDocument();
  });

  it('surfaces a recoverable error state when the User API fails', async () => {
    adminUserService.listAllUsers.mockRejectedValueOnce(new Error('BE is down'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/BE is down/);
    // Retry button is present
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('never uses window.prompt / window.confirm / window.alert', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /View Details/ }));
    await user.click(screen.getByRole('button', { name: /^Close$/ }));

    expect(promptSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });
});