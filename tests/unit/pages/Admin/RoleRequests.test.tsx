/**
 * Page-level tests for src/pages/Admin/RoleRequests.tsx.
 *
 * The Admin queue is now driven by the live `/api/RoleRequest` endpoint via
 * `adminService.getRoleRequests()`. The page renders real `RoleRequest`
 * records (PENDING / APPROVED / DENIED) and Accept / Reject buttons call
 * `adminService.decideRoleRequest()` to mutate through the BE.
 *
 * Previous assertions tied to the obsolete `/api/User` derivation were
 * replaced with assertions that match the current behaviour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RoleRequests } from '../../../../src/pages/Admin/RoleRequests';
import { buildMockAuth } from '../../../../src/utils/mockAuth';

const { adminService, _internal } = vi.hoisted(() => {
  const NOW = '2026-08-19T10:30:00Z';

  const baseRequests = [
    {
      id: 9001,
      userId: 501,
      userName: 'Tran Van Khanh',
      email: 'khanh.tran@example.com',
      phone: '+84 901 234 567',
      affiliation: 'HCMUS University',
      department: 'Computer Science',
      currentRoles: [] as string[],
      requestedAdditionalRoles: ['Reviewer'] as string[],
      requestType: 'INITIAL_REGISTRATION' as const,
      orcidId: '0000-0001-2345-6789',
      isOrcidVerified: true,
      orcidVerifiedAt: NOW,
      proofDocumentUrl: 'https://example.com/proof-khanh.pdf',
      submissionDate: NOW,
      status: 'PENDING' as const,
      notes: undefined,
    },
    {
      id: 9002,
      userId: 502,
      userName: 'Le Thi Lan',
      email: 'lan.le@example.com',
      phone: '+84 902 333 444',
      affiliation: 'HCMIU University',
      department: 'Linguistics',
      currentRoles: ['Lecturer'] as string[],
      requestedAdditionalRoles: ['Reviewer'] as string[],
      requestType: 'ADDITIONAL_ROLE' as const,
      orcidId: '0000-0002-3456-7890',
      isOrcidVerified: false,
      orcidVerifiedAt: null,
      proofDocumentUrl: 'https://example.com/proof-lan.pdf',
      submissionDate: NOW,
      status: 'APPROVED' as const,
      notes: 'Approved after reviewer check',
    },
    {
      id: 9003,
      userId: 503,
      userName: 'Pham Hoai Nam',
      email: 'rejected@example.com',
      phone: '+84 903 555 666',
      affiliation: 'HUST University',
      department: 'Mechanical Engineering',
      currentRoles: [] as string[],
      requestedAdditionalRoles: ['Lecturer'] as string[],
      requestType: 'INITIAL_REGISTRATION' as const,
      orcidId: null,
      isOrcidVerified: false,
      orcidVerifiedAt: null,
      proofDocumentUrl: 'https://example.com/proof-nam.pdf',
      submissionDate: NOW,
      status: 'DENIED' as const,
      notes: 'Insufficient evidence',
    },
  ];

  const allRequests = vi.fn(async () => baseRequests.map((row) => ({ ...row })));
  const decide = vi.fn(
    async (id: number, decision: { status: 'APPROVED' | 'DENIED'; notes?: string }) => {
      const target = baseRequests.find((row) => row.id === id);
      if (!target) throw new Error(`Role request ${id} not found`);
      target.status = decision.status;
      target.notes = decision.notes ?? '';
      return { ...target };
    },
  );

  return {
    adminService: { getRoleRequests: allRequests, getRoleRequest: vi.fn(), decideRoleRequest: decide },
    _internal: { requests: baseRequests },
  };
});

vi.mock('../../../../src/services/admin.service', () => ({
  adminService,
  // Keep unused helpers that other surfaces may import from this module.
  __resetAdminMockStores: () => undefined,
}));

vi.mock('../../../../src/services/user.service', () => ({
  displayAccountTier: (tier: string | null | undefined) => tier ?? 'Free',
}));

vi.mock('../../../../src/context/AuthContext', () => ({
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
  // Restore the underlying request list to its hoisted defaults so each
  // test starts from a known state.
  _internal.requests.splice(0, _internal.requests.length, ...[
    {
      id: 9001,
      userId: 501,
      userName: 'Tran Van Khanh',
      email: 'khanh.tran@example.com',
      phone: '+84 901 234 567',
      affiliation: 'HCMUS University',
      department: 'Computer Science',
      currentRoles: [] as string[],
      requestedAdditionalRoles: ['Reviewer'] as string[],
      requestType: 'INITIAL_REGISTRATION' as const,
      orcidId: '0000-0001-2345-6789',
      isOrcidVerified: true,
      orcidVerifiedAt: '2026-08-19T10:30:00Z',
      proofDocumentUrl: 'https://example.com/proof-khanh.pdf',
      submissionDate: '2026-08-19T10:30:00Z',
      status: 'PENDING' as const,
      notes: undefined,
    },
    {
      id: 9002,
      userId: 502,
      userName: 'Le Thi Lan',
      email: 'lan.le@example.com',
      phone: '+84 902 333 444',
      affiliation: 'HCMIU University',
      department: 'Linguistics',
      currentRoles: ['Lecturer'] as string[],
      requestedAdditionalRoles: ['Reviewer'] as string[],
      requestType: 'ADDITIONAL_ROLE' as const,
      orcidId: '0000-0002-3456-7890',
      isOrcidVerified: false,
      orcidVerifiedAt: null,
      proofDocumentUrl: 'https://example.com/proof-lan.pdf',
      submissionDate: '2026-08-19T10:30:00Z',
      status: 'APPROVED' as const,
      notes: 'Approved after reviewer check',
    },
    {
      id: 9003,
      userId: 503,
      userName: 'Pham Hoai Nam',
      email: 'rejected@example.com',
      phone: '+84 903 555 666',
      affiliation: 'HUST University',
      department: 'Mechanical Engineering',
      currentRoles: [] as string[],
      requestedAdditionalRoles: ['Lecturer'] as string[],
      requestType: 'INITIAL_REGISTRATION' as const,
      orcidId: null,
      isOrcidVerified: false,
      orcidVerifiedAt: null,
      proofDocumentUrl: 'https://example.com/proof-nam.pdf',
      submissionDate: '2026-08-19T10:30:00Z',
      status: 'DENIED' as const,
      notes: 'Insufficient evidence',
    },
  ]);
});

describe('<RoleRequests> page (live /api/RoleRequest)', () => {
  it('reads role requests from adminService.getRoleRequests', async () => {
    renderPage();
    await waitFor(() => {
      expect(adminService.getRoleRequests).toHaveBeenCalled();
    });
  });

  it('renders the role-request column headers', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    const labels = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(labels).toContain('User');
    expect(labels).toContain('Requested role');
    expect(labels).toContain('Request type');
    expect(labels).toContain('Verification Status');
    expect(labels).toContain('Actions');
  });

  it('default filter shows only PENDING requests and hides APPROVED / DENIED rows', async () => {
    renderPage();
    expect(await screen.findByText(/Tran Van Khanh/)).toBeInTheDocument();
    expect(screen.queryByText(/Le Thi Lan/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pham Hoai Nam/)).not.toBeInTheDocument();
  });

  it('switching to ACCEPTED reveals the Approved row only', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Tran Van Khanh/);
    await user.selectOptions(
      screen.getByLabelText(/Filter by verification status/i) as HTMLSelectElement,
      'ACCEPTED',
    );
    expect(await screen.findByText(/Le Thi Lan/)).toBeInTheDocument();
    expect(screen.queryByText(/Tran Van Khanh/)).not.toBeInTheDocument();
  });

  it('Accept and Reject buttons are hidden for APPROVED rows', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Tran Van Khanh/);
    const select = screen.getByLabelText(/Filter by verification status/i) as HTMLSelectElement;
    await user.selectOptions(select, 'ACCEPTED');
    const approvedRow = (await screen.findByText(/Le Thi Lan/)).closest('tr') as HTMLElement;
    expect(within(approvedRow).queryByTestId('role-requests-accept')).toBeNull();
    expect(within(approvedRow).queryByTestId('role-requests-reject')).toBeNull();
  });

  it('clicking Accept opens the ApproveRoleRequestModal and dispatches the decision', async () => {
    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    await user.click(within(row).getByTestId('role-requests-accept'));
    // Modal renders a "Confirm approval" submit button (existing ApproveRoleRequestModal).
    const confirm = await screen.findByRole('button', { name: /Confirm approval/i });
    expect(confirm).toBeInTheDocument();
    await user.click(confirm);
    await waitFor(() => {
      expect(adminService.decideRoleRequest).toHaveBeenCalled();
    });
    const [idArg, decisionArg] = (adminService.decideRoleRequest as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [number, { status: string }];
    expect(idArg).toBe(9001);
    expect(decisionArg.status).toBe('APPROVED');
  });

  it('View Details opens the read-only RoleRequestDetailsModal with proof document', async () => {
    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    await user.click(
      within(pendingRow.closest('tr') as HTMLElement).getByRole('button', { name: /View Details/ }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/khanh\.tran@example\.com/);
    expect(dialog.textContent).toMatch(/Tran Van Khanh/);
    expect(within(dialog).getByRole('button', { name: /^Close$/ })).toBeInTheDocument();
  });

  it('surfaces a recoverable error state when the RoleRequest API fails', async () => {
    adminService.getRoleRequests.mockRejectedValueOnce(new Error('BE is down'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/BE is down/);
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
