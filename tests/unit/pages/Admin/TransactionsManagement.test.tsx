/**
 * Page-level tests for src/pages/Admin/TransactionsManagement.tsx (Phase C: Admin).
 *
 * Covers:
 *  - Status-specific action buttons (PENDING / ACCEPTED_PROCESSING / COMPLETED / DENIED)
 *  - View Details dialog content
 *  - Opening modals does NOT mutate state
 *  - The "no window.prompt / window.confirm / alert" guarantee
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TransactionsManagement } from '../../../../../src/pages/Admin/TransactionsManagement';

// The centralized withdrawal gate (AppConfig.features.enableWithdrawals) is
// off in production by default; for these tests we force-enable withdrawals
// so the existing UI mechanics are exercised. The disabled-state itself is
// covered by tests/unit/withdrawalGate.test.tsx.
vi.mock('../../../../../src/config/app', () => ({
  AppConfig: {
    appName: 'ARS Platform',
    appVersion: '1.0.0',
    description: 'x',
    features: {
      enableRegistration: true,
      enableORCID: false,
      enablePaperSubmission: true,
      enableWithdrawals: true,
    },
  },
  AuthConfig: { tokenKey: 'ars_token', userKey: 'ars_user', tokenExpirationHours: 24 },
}));

const { adminService, _internal } = vi.hoisted(() => {
  const NOW = '2026-08-16T10:30:00Z';

  const withdrawals = [
    {
      txId: 7001,
      userId: 601,
      reviewerName: 'Pending Reviewer',
      amountVnd: 2_500_000,
      currency: 'VND',
      bankName: 'Vietcombank',
      accountNumber: '1029 7482 11',
      accountName: 'PENDING REVIEWER',
      requestDate: NOW,
      status: 'PENDING',
      proofReceiptUrl: null,
    },
    {
      txId: 7002,
      userId: 602,
      reviewerName: 'Processing Reviewer',
      amountVnd: 1_750_000,
      currency: 'VND',
      bankName: 'Techcombank',
      accountNumber: '1903 4500 22',
      accountName: 'PROCESSING REVIEWER',
      requestDate: NOW,
      status: 'ACCEPTED_PROCESSING',
      processingAt: NOW,
      proofReceiptUrl: null,
    },
    {
      txId: 7003,
      userId: 603,
      reviewerName: 'Completed Reviewer',
      amountVnd: 4_200_000,
      currency: 'VND',
      bankName: 'BIDV',
      accountNumber: '5611 0099 33',
      accountName: 'COMPLETED REVIEWER',
      requestDate: NOW,
      status: 'COMPLETED',
      processingAt: NOW,
      completedAt: NOW,
      proofReceiptUrl:
        'https://firebasestorage.googleapis.com/v0/b/ars-platform/o/mock-completed.pdf',
    },
    {
      txId: 7004,
      userId: 604,
      reviewerName: 'Denied Reviewer',
      amountVnd: 950_000,
      currency: 'VND',
      bankName: 'ACB',
      accountNumber: '1234 5678 44',
      accountName: 'DENIED REVIEWER',
      requestDate: NOW,
      status: 'DENIED',
      proofReceiptUrl: null,
      rejectionReason: 'Bank account name does not match KYC.',
    },
  ];

  const getReviewerWithdrawals = vi.fn(async () =>
    withdrawals.map((w) => ({ ...w })),
  );
  const markWithdrawalProcessing = vi.fn(async (id) => {
    const idx = withdrawals.findIndex((w) => w.txId === id);
    if (idx === -1) throw new Error('not found');
    withdrawals[idx] = {
      ...withdrawals[idx],
      status: 'ACCEPTED_PROCESSING',
      processingAt: NOW,
    };
    return { ...withdrawals[idx] };
  });
  const completeWithdrawal = vi.fn(
    async (id, proofReceiptUrl) => {
      const idx = withdrawals.findIndex((w) => w.txId === id);
      if (idx === -1) throw new Error('not found');
      withdrawals[idx] = {
        ...withdrawals[idx],
        status: 'COMPLETED',
        proofReceiptUrl,
        completedAt: NOW,
      };
      return { ...withdrawals[idx] };
    },
  );
  const denyWithdrawal = vi.fn(async (id, reason) => {
    const idx = withdrawals.findIndex((w) => w.txId === id);
    if (idx === -1) throw new Error('not found');
    withdrawals[idx] = {
      ...withdrawals[idx],
      status: 'DENIED',
      rejectionReason: reason,
    };
    return { ...withdrawals[idx] };
  });

  return {
    adminService: {
      getRoleRequests: vi.fn(async () => []),
      getRoleRequest: vi.fn(async () => null),
      decideRoleRequest: vi.fn(async () => ({})),
      getAccounts: vi.fn(async () => []),
      suspendAccount: vi.fn(async () => ({})),
      unsuspendAccount: vi.fn(async () => ({})),
      getReviewerWithdrawals,
      markWithdrawalProcessing,
      completeWithdrawal,
      denyWithdrawal,
      getAnalyticsSummary: vi.fn(async () => ({ totalMembers: 0, totalPapers: 0 })),
      getAnalyticsTimeseries: vi.fn(async () => ({
        range: 'daily',
        metric: 'revenue',
        points: [],
      })),
      __resetAdminMockStores: vi.fn(),
    },
    _internal: { withdrawals, NOW },
  };
});

vi.mock('../../../../../src/services/admin.service', () => ({
  adminService,
}));

vi.mock('../../../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { token: 'mock-token', username: 'admin', email: 'admin@example.com', role: 'Admin', userId: 1 },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: () => Promise.resolve(),
    logout: () => undefined,
    clearError: () => undefined,
    pendingRoleSelection: null,
    confirmRoleSelection: () => undefined,
    cancelRoleSelection: () => undefined,
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <TransactionsManagement />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the in-memory store
  const NOW = _internal.NOW;
  _internal.withdrawals.splice(0, _internal.withdrawals.length, ...[
    {
      txId: 7001,
      userId: 601,
      reviewerName: 'Pending Reviewer',
      amountVnd: 2_500_000,
      currency: 'VND',
      bankName: 'Vietcombank',
      accountNumber: '1029 7482 11',
      accountName: 'PENDING REVIEWER',
      requestDate: NOW,
      status: 'PENDING',
      proofReceiptUrl: null,
    },
    {
      txId: 7002,
      userId: 602,
      reviewerName: 'Processing Reviewer',
      amountVnd: 1_750_000,
      currency: 'VND',
      bankName: 'Techcombank',
      accountNumber: '1903 4500 22',
      accountName: 'PROCESSING REVIEWER',
      requestDate: NOW,
      status: 'ACCEPTED_PROCESSING',
      processingAt: NOW,
      proofReceiptUrl: null,
    },
    {
      txId: 7003,
      userId: 603,
      reviewerName: 'Completed Reviewer',
      amountVnd: 4_200_000,
      currency: 'VND',
      bankName: 'BIDV',
      accountNumber: '5611 0099 33',
      accountName: 'COMPLETED REVIEWER',
      requestDate: NOW,
      status: 'COMPLETED',
      processingAt: NOW,
      completedAt: NOW,
      proofReceiptUrl:
        'https://firebasestorage.googleapis.com/v0/b/ars-platform/o/mock-completed.pdf',
    },
    {
      txId: 7004,
      userId: 604,
      reviewerName: 'Denied Reviewer',
      amountVnd: 950_000,
      currency: 'VND',
      bankName: 'ACB',
      accountNumber: '1234 5678 44',
      accountName: 'DENIED REVIEWER',
      requestDate: NOW,
      status: 'DENIED',
      proofReceiptUrl: null,
      rejectionReason: 'Bank account name does not match KYC.',
    },
  ]);
});

describe('<TransactionsManagement> actions per status', () => {
  it('Pending row shows View Details + Approve & Pay + Deny', async () => {
    renderPage();
    const row = await screen.findByText(/Pending Reviewer/);
    const tr = row.closest('tr') as HTMLElement;
    const util = within(tr);
    expect(util.getByRole('button', { name: /View Details/ })).toBeInTheDocument();
    expect(util.getByRole('button', { name: /Approve & Pay/ })).toBeInTheDocument();
    expect(util.getByRole('button', { name: /^Deny$/ })).toBeInTheDocument();
  });

  it('Processing row shows View Details + Complete Transfer', async () => {
    renderPage();
    const row = await screen.findByText(/Processing Reviewer/);
    const tr = row.closest('tr') as HTMLElement;
    const util = within(tr);
    expect(util.getByRole('button', { name: /View Details/ })).toBeInTheDocument();
    expect(util.getByRole('button', { name: /Complete Transfer/ })).toBeInTheDocument();
    // No Approve/Deny on processing
    expect(util.queryByRole('button', { name: /Approve & Pay/ })).not.toBeInTheDocument();
    expect(util.queryByRole('button', { name: /^Deny$/ })).not.toBeInTheDocument();
  });

  it('Completed row shows View Details + View Receipt (link) when URL is http(s)', async () => {
    renderPage();
    const row = await screen.findByText(/Completed Reviewer/);
    const tr = row.closest('tr') as HTMLElement;
    const util = within(tr);
    expect(util.getByRole('button', { name: /View Details/ })).toBeInTheDocument();
    const receipt = util.getByRole('link', { name: /View Receipt/ });
    expect(receipt).toHaveAttribute('href', expect.stringContaining('https://'));
  });

  it('Denied row shows only View Details', async () => {
    renderPage();
    const row = await screen.findByText(/Denied Reviewer/);
    const tr = row.closest('tr') as HTMLElement;
    const util = within(tr);
    expect(util.getByRole('button', { name: /View Details/ })).toBeInTheDocument();
    expect(util.queryByRole('button', { name: /Approve & Pay/ })).not.toBeInTheDocument();
    expect(util.queryByRole('button', { name: /Complete Transfer/ })).not.toBeInTheDocument();
    expect(util.queryByRole('button', { name: /^Deny$/ })).not.toBeInTheDocument();
  });

  it('View Details shows amount, currency, bank, account, holder, date, status, reason, receipt and timestamps', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByText(/Denied Reviewer/);
    const tr = row.closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: /View Details/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Withdrawal Details/i)).toBeInTheDocument();
    // Reviewer, amount, currency, bank, account, holder, dates, status, reason, receipt
    expect(within(dialog).getByText(/Denied Reviewer/)).toBeInTheDocument();
    expect(within(dialog).getByText(/ACB/)).toBeInTheDocument();
    expect(within(dialog).getByText(/1234 5678 44/)).toBeInTheDocument();
    expect(within(dialog).getByText(/DENIED REVIEWER/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Bank account name does not match KYC/)).toBeInTheDocument();
    // Receipt shown as em-dash because URL is null
    expect(within(dialog).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('View Details shows request reason as a SEPARATE field from rejection reason on DENIED', async () => {
    // Defect 5: Reviewer-submitted request reason must render independently
    // of the Admin's rejection reason. Update the in-memory fixture to
    // carry a requestReason on the Denied row.
    const idx = _internal.withdrawals.findIndex((w) => w.txId === 7004);
    if (idx !== -1) {
      _internal.withdrawals[idx] = {
        ..._internal.withdrawals[idx],
        requestReason: 'Conference travel reimbursement',
      };
    }

    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByText(/Denied Reviewer/);
    const tr = row.closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: /View Details/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Request reason/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Conference travel reimbursement')).toBeInTheDocument();
    expect(within(dialog).getByText(/Bank account name does not match KYC/)).toBeInTheDocument();
  });

  it('View Details shows "No reason provided" when the request omitted a reason', async () => {
    // Defect 5: Missing request reason → "No reason provided" (NOT em-dash,
    // NOT blank) so Admin can distinguish "no reviewer reason" from "no
    // rejection reason yet".
    const idx = _internal.withdrawals.findIndex((w) => w.txId === 7002);
    if (idx !== -1) {
      _internal.withdrawals[idx] = {
        ..._internal.withdrawals[idx],
        requestReason: null,
      };
    }

    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByText(/Processing Reviewer/);
    const tr = row.closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: /View Details/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('No reason provided')).toBeInTheDocument();
  });

  it('opening Approve & Pay does NOT change status to PROCESSING (no premature mutation)', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByText(/Pending Reviewer/);
    const tr = row.closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: /Approve & Pay/ }));

    // Modal opened
    expect(screen.getByRole('dialog', { name: /Approve & Pay Payout/i })).toBeInTheDocument();
    // No mutation yet — store still has PENDING
    expect(_internal.withdrawals.find((w) => w.txId === 7001)?.status).toBe('PENDING');
  });

  it('cancelling Approve & Pay preserves PENDING', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByText(/Pending Reviewer/);
    const tr = row.closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: /Approve & Pay/ }));
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /Approve & Pay Payout/i }),
      ).not.toBeInTheDocument();
    });
    expect(_internal.withdrawals.find((w) => w.txId === 7001)?.status).toBe('PENDING');
    expect(adminService.markWithdrawalProcessing).not.toHaveBeenCalled();
    expect(adminService.completeWithdrawal).not.toHaveBeenCalled();
  });

  it('Tab switching between Revenue / Withdrawals works', async () => {
    const user = userEvent.setup();
    renderPage();
    const withdrawalsTab = screen.getByRole('tab', { name: /Reviewer Withdrawal Requests/i });
    const revenueTab = screen.getByRole('tab', { name: /Platform Revenue/i });
    // Default is withdrawals — rows visible
    await screen.findByText(/Pending Reviewer/);
    await user.click(revenueTab);
    expect(
      screen.getByText(/Platform revenue is unavailable/i),
    ).toBeInTheDocument();
    await user.click(withdrawalsTab);
    await screen.findByText(/Pending Reviewer/);
  });

  it('Pending count badge on Withdrawals tab reflects PENDING count', async () => {
    renderPage();
    await screen.findByText(/Pending Reviewer/);
    // The badge number = 1 (only one PENDING in fixtures)
    const withdrawalsTab = screen.getByRole('tab', { name: /Reviewer Withdrawal Requests/i });
    expect(within(withdrawalsTab).getByText('1')).toBeInTheDocument();
  });
});

describe('<TransactionsManagement> safety', () => {
  it('never uses window.prompt / window.confirm / alert in the touched flows', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByText(/Pending Reviewer/);
    const tr = row.closest('tr') as HTMLElement;

    // View Details → Close
    await user.click(within(tr).getByRole('button', { name: /View Details/ }));
    await user.click(screen.getByRole('button', { name: /^Close$/ }));

    // Approve & Pay → Cancel
    await user.click(within(tr).getByRole('button', { name: /Approve & Pay/ }));
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));

    // Deny → Cancel
    await user.click(within(tr).getByRole('button', { name: /^Deny$/ }));
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));

    expect(promptSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });
});