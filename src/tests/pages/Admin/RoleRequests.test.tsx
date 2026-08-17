/**
 * Page-level tests for src/pages/Admin/RoleRequests.tsx (Phase C: Admin).
 *
 * Covers the table-driven actions, status-specific buttons, the new column
 * contract (INITIAL / CURRENT ROLE / REQUESTED ADDITIONAL ROLE / REQUEST TYPE),
 * and the "no window.prompt / window.confirm / alert" guarantee.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RoleRequests } from '../../../pages/Admin/RoleRequests';
import { buildMockAuth } from '../../utils/mockAuth';
import { buildMockAdminService } from '../../utils/mockAdminService';

const NOW = '2026-08-16T10:30:00Z';

const { adminService, _internal, fixtures } = vi.hoisted(() => {
  // Hand-rolled copy of mockAdminService inside the hoisted block so vi.mock
  // can hoist it before any module-level imports run.
  const NOW = '2026-08-16T10:30:00Z';
  const requests = [
    {
      id: 9001,
      userId: 501,
      userName: 'Tran Van Khanh',
      email: 'khanh.tran@example.com',
      phone: '+84 901 000 001',
      affiliation: 'VNU University of Science',
      department: 'Computer Science',
      currentRoles: ['RESEARCHER'],
      requestedAdditionalRoles: ['REVIEWER'],
      requestType: 'ADDITIONAL_ROLE',
      proofDocumentUrl: 'https://example.com/proof-khanh.pdf',
      submissionDate: NOW,
      status: 'PENDING',
    },
    {
      id: 9002,
      userId: 502,
      userName: 'Le Thi Lan',
      email: 'lan.le@example.com',
      phone: '+84 901 000 002',
      affiliation: 'HUST',
      department: 'Information Technology',
      currentRoles: [],
      requestedAdditionalRoles: ['LECTURER'],
      requestType: 'INITIAL_REGISTRATION',
      proofDocumentUrl: 'https://example.com/proof-lan.pdf',
      submissionDate: NOW,
      status: 'PENDING',
    },
    {
      id: 9003,
      userId: 503,
      userName: 'Pham Hoai Nam',
      email: 'nam.pham@example.com',
      phone: '+84 901 000 003',
      affiliation: 'HCMUS',
      department: 'Mathematics',
      currentRoles: ['RESEARCHER'],
      requestedAdditionalRoles: ['REVIEWER', 'LECTURER'],
      requestType: 'ADDITIONAL_ROLE',
      proofDocumentUrl: 'https://example.com/proof-nam.pdf',
      submissionDate: NOW,
      status: 'PENDING',
    },
    {
      id: 9004,
      userId: 504,
      userName: 'Doe Approved',
      email: 'approved@example.com',
      affiliation: 'VNU',
      department: 'Physics',
      currentRoles: ['REVIEWER'],
      requestedAdditionalRoles: ['RESEARCHER'],
      requestType: 'ADDITIONAL_ROLE',
      proofDocumentUrl: 'https://example.com/proof-approved.pdf',
      submissionDate: NOW,
      status: 'APPROVED',
      notes: 'Verified by admin',
    },
    {
      id: 9005,
      userId: 505,
      userName: 'Vu Denied',
      email: 'denied@example.com',
      affiliation: 'VNU',
      department: 'Chemistry',
      currentRoles: ['GRADUATE_STUDENT'],
      requestedAdditionalRoles: ['RESEARCHER'],
      requestType: 'ADDITIONAL_ROLE',
      proofDocumentUrl: 'https://example.com/proof-denied.pdf',
      submissionDate: NOW,
      status: 'DENIED',
      notes: 'Proof document was a CV, not a research focus statement.',
    },
  ];

  const getRoleRequests = vi.fn(async () => requests.map((r) => ({ ...r })));
  const getRoleRequest = vi.fn(async (id) => {
    const hit = requests.find((r) => r.id === id);
    return hit ? { ...hit } : null;
  });
  const decideRoleRequest = vi.fn(async (id, decision) => {
    const idx = requests.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Role request ${id} not found`);
    const updated = { ...requests[idx], ...decision };
    requests[idx] = updated;
    return { ...updated };
  });

  return {
    adminService: {
      getRoleRequests,
      getRoleRequest,
      decideRoleRequest,
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
    _internal: { requests },
    fixtures: { NOW },
  };
});

vi.mock('../../../services/admin.service', () => ({
  adminService,
}));

vi.mock('../../../context/AuthContext', () => ({
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
  // Reset the shared fixture store by replacing the in-memory requests
  // with a deep clone of the original hoisted fixtures.
  _internal.requests.splice(
    0,
    _internal.requests.length,
    ...[
      {
        id: 9001,
        userId: 501,
        userName: 'Tran Van Khanh',
        email: 'khanh.tran@example.com',
        phone: '+84 901 000 001',
        affiliation: 'VNU University of Science',
        department: 'Computer Science',
        currentRoles: ['RESEARCHER'],
        requestedAdditionalRoles: ['REVIEWER'],
        requestType: 'ADDITIONAL_ROLE',
        proofDocumentUrl: 'https://example.com/proof-khanh.pdf',
        submissionDate: fixtures.NOW,
        status: 'PENDING',
      },
      {
        id: 9002,
        userId: 502,
        userName: 'Le Thi Lan',
        email: 'lan.le@example.com',
        phone: '+84 901 000 002',
        affiliation: 'HUST',
        department: 'Information Technology',
        currentRoles: [],
        requestedAdditionalRoles: ['LECTURER'],
        requestType: 'INITIAL_REGISTRATION',
        proofDocumentUrl: 'https://example.com/proof-lan.pdf',
        submissionDate: fixtures.NOW,
        status: 'PENDING',
      },
      {
        id: 9003,
        userId: 503,
        userName: 'Pham Hoai Nam',
        email: 'nam.pham@example.com',
        phone: '+84 901 000 003',
        affiliation: 'HCMUS',
        department: 'Mathematics',
        currentRoles: ['RESEARCHER'],
        requestedAdditionalRoles: ['REVIEWER', 'LECTURER'],
        requestType: 'ADDITIONAL_ROLE',
        proofDocumentUrl: 'https://example.com/proof-nam.pdf',
        submissionDate: fixtures.NOW,
        status: 'PENDING',
      },
      {
        id: 9004,
        userId: 504,
        userName: 'Doe Approved',
        email: 'approved@example.com',
        affiliation: 'VNU',
        department: 'Physics',
        currentRoles: ['REVIEWER'],
        requestedAdditionalRoles: ['RESEARCHER'],
        requestType: 'ADDITIONAL_ROLE',
        proofDocumentUrl: 'https://example.com/proof-approved.pdf',
        submissionDate: fixtures.NOW,
        status: 'APPROVED',
        notes: 'Verified by admin',
      },
      {
        id: 9005,
        userId: 505,
        userName: 'Vu Denied',
        email: 'denied@example.com',
        affiliation: 'VNU',
        department: 'Chemistry',
        currentRoles: ['GRADUATE_STUDENT'],
        requestedAdditionalRoles: ['RESEARCHER'],
        requestType: 'ADDITIONAL_ROLE',
        proofDocumentUrl: 'https://example.com/proof-denied.pdf',
        submissionDate: fixtures.NOW,
        status: 'DENIED',
        notes: 'Proof document was a CV, not a research focus statement.',
      },
    ],
  );
});

describe('<RoleRequests> page', () => {
  it('renders table headers including the new INITIAL/CURRENT ROLE, REQUESTED ADDITIONAL ROLE, and REQUEST TYPE columns', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    const headers = screen.getAllByRole('columnheader');
    const labels = headers.map((h) => h.textContent?.trim());
    expect(labels).toContain('Initial / Current Role');
    expect(labels).toContain('Requested Additional Role');
    expect(labels).toContain('Request Type');
    expect(labels).toContain('Actions');
  });

  it('Pending rows show View Details + Approve + Deny buttons', async () => {
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr');
    expect(row).not.toBeNull();
    const util = within(row as HTMLElement);
    expect(util.getByRole('button', { name: /View Details/ })).toBeInTheDocument();
    expect(util.getByRole('button', { name: /^Approve$/ })).toBeInTheDocument();
    expect(util.getByRole('button', { name: /^Deny$/ })).toBeInTheDocument();
  });

  it('Approved rows show only View Details (no Approve / Deny)', async () => {
    renderPage();
    const approvedRow = await screen.findByText(/Doe Approved/);
    const row = approvedRow.closest('tr');
    expect(row).not.toBeNull();
    const util = within(row as HTMLElement);
    expect(util.getByRole('button', { name: /View Details/ })).toBeInTheDocument();
    expect(util.queryByRole('button', { name: /^Approve$/ })).not.toBeInTheDocument();
    expect(util.queryByRole('button', { name: /^Deny$/ })).not.toBeInTheDocument();
  });

  it('Denied rows show only View Details', async () => {
    renderPage();
    const deniedRow = await screen.findByText(/Vu Denied/);
    const row = deniedRow.closest('tr');
    expect(row).not.toBeNull();
    const util = within(row as HTMLElement);
    expect(util.getByRole('button', { name: /View Details/ })).toBeInTheDocument();
    expect(util.queryByRole('button', { name: /^Approve$/ })).not.toBeInTheDocument();
    expect(util.queryByRole('button', { name: /^Deny$/ })).not.toBeInTheDocument();
  });

  it('initial/current role column shows the current roles list, not the requested ones', async () => {
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    const cells = Array.from(row.querySelectorAll('td'));
    const currentCell = cells.find((c) => c.textContent?.includes('RESEARCHER')) ?? null;
    expect(currentCell).not.toBeNull();
    expect(currentCell?.textContent).not.toMatch(/REVIEWER/);
  });

  it('requested additional role column shows the requested roles list', async () => {
    renderPage();
    const multiRoleRow = await screen.findByText(/Pham Hoai Nam/);
    const row = multiRoleRow.closest('tr') as HTMLElement;
    const cells = Array.from(row.querySelectorAll('td'));
    const requestedCell = cells.find(
      (c) =>
        c.textContent?.includes('REVIEWER') && c.textContent?.includes('LECTURER'),
    );
    expect(requestedCell).toBeDefined();
    expect(requestedCell?.textContent).toMatch(/LECTURER/);
  });

  it('REQUEST TYPE column renders separately (INITIAL REGISTRATION vs ADDITIONAL ROLE)', async () => {
    renderPage();
    const initialRow = await screen.findByText(/Le Thi Lan/);
    const initialCells = Array.from(initialRow.closest('tr')!.querySelectorAll('td'));
    expect(
      initialCells.some((c) => c.textContent?.includes('INITIAL REGISTRATION')),
    ).toBe(true);

    const additionalRow = await screen.findByText(/Tran Van Khanh/);
    const additionalCells = Array.from(additionalRow.closest('tr')!.querySelectorAll('td'));
    expect(
      additionalCells.some((c) => c.textContent?.includes('ADDITIONAL ROLE')),
    ).toBe(true);
  });

  it('search filters by user name and email', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Tran Van Khanh/);
    const search = screen.getByLabelText(/Search requests/i);
    await user.type(search, 'khanh');
    expect(screen.getByText(/Tran Van Khanh/)).toBeInTheDocument();
    expect(screen.queryByText(/Le Thi Lan/)).not.toBeInTheDocument();
  });

  it('status filter limits results to selected status', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Tran Van Khanh/);
    const select = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    await user.selectOptions(select, 'APPROVED');
    expect(screen.getByText(/Doe Approved/)).toBeInTheDocument();
    expect(screen.queryByText(/Tran Van Khanh/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vu Denied/)).not.toBeInTheDocument();
  });

  it('opening Approve modal does NOT mutate request status (cancel keeps PENDING)', async () => {
    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /^Approve$/ }));

    // Modal opens
    expect(
      screen.getByRole('dialog', { name: /Approve Role Request/i }),
    ).toBeInTheDocument();

    // Cancel via the dialog's Cancel button
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /Approve Role Request/i }),
      ).not.toBeInTheDocument();
    });

    // No mutation: store still has 3 PENDING requests.
    const still = _internal.requests.find((r) => r.userName === 'Tran Van Khanh');
    expect(still?.status).toBe('PENDING');
    expect(adminService.decideRoleRequest).not.toHaveBeenCalled();
  });

  it('successful approval moves the row to APPROVED', async () => {
    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /^Approve$/ }));

    // Modal opens — submit with optional notes
    const textarea = screen.getByLabelText(/Internal verification notes/i);
    await user.type(textarea, 'Looks good');
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    await waitFor(() => {
      expect(adminService.decideRoleRequest).toHaveBeenCalledWith(
        9001,
        expect.objectContaining({ status: 'APPROVED', notes: 'Looks good' }),
      );
    });
    await waitFor(() => {
      const updated = screen.getByText(/Tran Van Khanh/).closest('tr') as HTMLElement;
      expect(within(updated).getByText('APPROVED')).toBeInTheDocument();
    });
    // Now no Approve/Deny buttons remain on the approved row
    const finalRow = screen.getByText(/Tran Van Khanh/).closest('tr') as HTMLElement;
    expect(
      within(finalRow).queryByRole('button', { name: /^Approve$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(finalRow).queryByRole('button', { name: /^Deny$/ }),
    ).not.toBeInTheDocument();
  });

  it('failed approval preserves PENDING and surfaces an inline API error', async () => {
    adminService.decideRoleRequest.mockImplementationOnce(async () => {
      throw new Error('Server says no');
    });
    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /^Approve$/ }));
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Server says no/);

    // Status still PENDING
    const still = _internal.requests.find((r) => r.userName === 'Tran Van Khanh');
    expect(still?.status).toBe('PENDING');
    // The row must still be present (modal may also reference the name, so
    // assert via the table instead of `getByText` to dodge the duplicate).
    const tbodyRows = document.querySelectorAll('tbody tr');
    const rowTexts = Array.from(tbodyRows).map((r) => r.textContent ?? '');
    expect(rowTexts.some((t) => t.includes('Tran Van Khanh'))).toBe(true);
  });

  it('denial requires ≥ 10 chars and ≤ 1,000 chars + shows a counter', async () => {
    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /^Deny$/ }));
    const textarea = screen.getByLabelText(/Reason for denial/i);
    expect(textarea).toHaveAttribute('minLength', '10');
    expect(textarea).toHaveAttribute('maxLength', '1000');
    expect(textarea).toBeRequired();

    // Counter is visible
    expect(screen.getByText(/0 \/ 1,000/)).toBeInTheDocument();
  });

  it('successful denial updates the row to DENIED and View Details shows the reason', async () => {
    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /^Deny$/ }));
    const textarea = screen.getByLabelText(/Reason for denial/i);
    await user.type(textarea, 'Proof document was unreadable');
    await user.click(screen.getByRole('button', { name: /Confirm Denial/i }));

    await waitFor(() => {
      expect(adminService.decideRoleRequest).toHaveBeenCalledWith(
        9001,
        expect.objectContaining({
          status: 'DENIED',
          notes: 'Proof document was unreadable',
        }),
      );
    });

    // Open View Details on the (now denied) row
    const updatedRow = screen.getByText(/Tran Van Khanh/).closest('tr') as HTMLElement;
    await user.click(within(updatedRow).getByRole('button', { name: /View Details/ }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Proof document was unreadable/)).toBeInTheDocument();
  });

  it('View Details dialog is read-only (no input/textarea/select inside)', async () => {
    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /View Details/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryAllByRole('textbox')).toHaveLength(0);
    expect(
      within(dialog).queryAllByRole('button', {
        name: /^(Approve|Deny|Confirm)/i,
      }),
    ).toHaveLength(0);
    // Only Close button allowed
    expect(within(dialog).getByRole('button', { name: /^Close$/ })).toBeInTheDocument();
  });

  it('never calls window.prompt / window.confirm / alert during the touched flows', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    const user = userEvent.setup();
    renderPage();
    const pendingRow = await screen.findByText(/Tran Van Khanh/);
    const row = pendingRow.closest('tr') as HTMLElement;

    // View Details
    await user.click(within(row).getByRole('button', { name: /View Details/ }));
    await user.click(screen.getByRole('button', { name: /^Close$/ }));

    // Approve → Cancel
    await user.click(within(row).getByRole('button', { name: /^Approve$/ }));
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));

    // Deny → Cancel
    await user.click(within(row).getByRole('button', { name: /^Deny$/ }));
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));

    expect(promptSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });
});

describe('<RoleRequests> missing-role handling', () => {
  it('renders Unavailable when currentRoles is absent and requestType is missing', async () => {
    adminService.getRoleRequests.mockResolvedValueOnce([
      {
        id: 9101,
        userId: 601,
        userName: 'Sparse User',
        email: 'sparse@example.com',
        affiliation: 'Unknown',
        department: 'Unknown',
        proofDocumentUrl: 'https://example.com/missing.pdf',
        submissionDate: NOW,
        status: 'PENDING',
      },
    ]);

    renderPage();
    const sparseRow = await screen.findByText(/Sparse User/);
    const cells = Array.from(sparseRow.closest('tr')!.querySelectorAll('td'));
    expect(cells.some((c) => c.textContent?.match(/Unavailable/))).toBe(true);
    expect(cells.some((c) => c.textContent?.match(/UNAVAILABLE/))).toBe(true);
  });
});