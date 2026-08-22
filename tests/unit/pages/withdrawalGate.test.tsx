/**
 * Tests for the centralized withdrawal feature gate
 * (AppConfig.features.enableWithdrawals).
 *
 * Contract:
 *   • When `enableWithdrawals` is `false`:
 *       – Reviewer `EarningsWallet` page renders ONLY the disabled notice;
 *         no "Create New Request" button, no history table, no modal
 *         triggers, no `withdrawalService.create/getAll/getById/update` calls.
 *       – Admin `TransactionsManagement` page hides the
 *         "Reviewer Withdrawal Requests" tab and renders a disabled notice
 *         in its place; the three admin withdrawal modals (details / deny /
 *         approve) cannot be opened; `adminService.getReviewerWithdrawals /
 *         denyWithdrawal / completeWithdrawal / markWithdrawalProcessing`
 *         throw `WithdrawalFeatureDisabledError` and never reach axios.
 *       – Unrelated wallet behavior (balance, top-up, transaction history,
 *         receipts) is NOT touched by the gate.
 *
 *   • When `enableWithdrawals` is `true`:
 *       – EarningsWallet behaves exactly as before — refresh / create /
 *         table / view-reason all fire the underlying service normally.
 *
 * These tests focus on the cross-cutting FE gate, not the underlying
 * withdrawal mechanics (which have their own suites in
 * tests/unit/pages/EarningsWallet.test.tsx and
 * tests/unit/services/admin.endpointContract.test.ts).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Hoist mutable flag — every test can flip this freely.
const { enableWithdrawalsRef } = vi.hoisted(() => ({
  enableWithdrawalsRef: { current: true },
}));

vi.mock('../../../src/config/app', () => ({
  get AppConfig() {
    return {
      appName: 'ARS Platform',
      appVersion: '1.0.0',
      description: 'x',
      features: {
        enableRegistration: true,
        enableORCID: false,
        enablePaperSubmission: true,
        enableWithdrawals: enableWithdrawalsRef.current,
      },
    };
  },
  AuthConfig: { tokenKey: 'ars_token', userKey: 'ars_user', tokenExpirationHours: 24 },
}));

// ── Reviewer-page test doubles ────────────────────────────────────────────────

const mockUser = { id: 7 };

vi.mock('../../../src/store/authSlice', () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));

let useWalletReturnValue = {
  wallet: { id: 8, walletId: 8, userId: 7, balance: 0 },
  walletId: 8,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock('../../../src/hooks/useWallet', () => ({
  useWallet: () => useWalletReturnValue,
  _setUseWalletReturn: (val: typeof useWalletReturnValue) => {
    useWalletReturnValue = val;
  },
}));

vi.mock('../../../src/pages/Reviewer/components/WithdrawalSuccessModal', () => ({
  WithdrawalSuccessModal: ({ isOpen, requestId }: any) =>
    isOpen ? (
      <div>
        <h2>Withdrawal Request Submitted!</h2>
        <span>Request ID: {requestId}</span>
      </div>
    ) : null,
}));

import {
  withdrawalService,
  WithdrawalFeatureDisabledError,
} from '../../../src/services/withdrawal.service';

// ── Admin-page test doubles ──────────────────────────────────────────────────

vi.mock('../../../src/hooks/useAdminGuard', () => ({
  useAdminGuard: () => undefined,
}));

vi.mock('../../../src/services/admin.service', () => ({
  adminService: {
    denyWithdrawal: vi.fn(),
    getRoleRequests: vi.fn(async () => []),
    getRoleRequest: vi.fn(async () => null),
    decideRoleRequest: vi.fn(async () => ({})),
    getAccounts: vi.fn(async () => []),
    suspendAccount: vi.fn(async () => ({})),
    unsuspendAccount: vi.fn(async () => ({})),
    getReviewerWithdrawals: vi.fn(async () => []),
    markWithdrawalProcessing: vi.fn(async () => ({})),
    completeWithdrawal: vi.fn(async () => ({})),
    getAnalyticsSummary: vi.fn(async () => ({ totalMembers: 0, totalPapers: 0 })),
    getAnalyticsTimeseries: vi.fn(async () => ({
      range: 'daily',
      metric: 'revenue',
      points: [],
    })),
    __resetAdminMockStores: vi.fn(),
  },
}));

vi.mock('../../../src/components/table/TableToolbar', () => ({
  TableToolbar: ({ children }: any) => <div data-testid="table-toolbar">{children}</div>,
}));
vi.mock('../../../src/components/table/TablePagination', () => ({
  TablePagination: () => <div data-testid="table-pagination-stub" />,
}));

import { EarningsWallet } from '../../../src/pages/Reviewer/EarningsWallet';
import { TransactionsManagement } from '../../../src/pages/Admin/TransactionsManagement';
import { adminService } from '../../../src/services/admin.service';

const setFlag = (val: boolean) => {
  enableWithdrawalsRef.current = val;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWallet = () => render(<EarningsWallet />);
const renderAdmin = () =>
  render(
    <MemoryRouter>
      <TransactionsManagement />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('ars_reviewer_balance', '4200000');
  window.alert = vi.fn();
  setFlag(false);
});

afterEach(() => {
  setFlag(true);
});

// ─── Service-layer gate (single source of truth for axios short-circuit) ─────

describe('withdrawalService — gate short-circuits every call', () => {
  it('throws WithdrawalFeatureDisabledError from getAll while disabled', async () => {
    setFlag(false);
    await expect(withdrawalService.getAll()).rejects.toBeInstanceOf(
      WithdrawalFeatureDisabledError,
    );
  });

  it('throws WithdrawalFeatureDisabledError from getById while disabled', async () => {
    setFlag(false);
    await expect(withdrawalService.getById(99)).rejects.toBeInstanceOf(
      WithdrawalFeatureDisabledError,
    );
  });

  it('throws WithdrawalFeatureDisabledError from create while disabled', async () => {
    setFlag(false);
    await expect(
      withdrawalService.create({
        userId: 7,
        walletId: 8,
        bankName: 'VCB',
        accountNumber: '123',
        accountName: 'Test',
        amount: 100000,
        note: 'n',
      }),
    ).rejects.toBeInstanceOf(WithdrawalFeatureDisabledError);
  });

  it('throws WithdrawalFeatureDisabledError from updateStatus while disabled', async () => {
    setFlag(false);
    await expect(
      withdrawalService.updateStatus(99, { status: 'Approved' }),
    ).rejects.toBeInstanceOf(WithdrawalFeatureDisabledError);
  });
});

// ─── EarningsWallet (Reviewer) gate behaviour ────────────────────────────────

describe('EarningsWallet — withdrawal gate', () => {
  it('renders the disabled notice and no Create button when disabled', () => {
    setFlag(false);
    renderWallet();

    expect(screen.getByTestId('withdrawal-disabled-notice')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create new request/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^refresh$/i }),
    ).not.toBeInTheDocument();
  });

  it('never calls withdrawalService.getAll while disabled', async () => {
    setFlag(false);
    const spy = vi
      .spyOn(withdrawalService, 'getAll')
      .mockResolvedValue([]);
    renderWallet();
    // Give effect a tick to fire if it would.
    await new Promise((r) => setTimeout(r, 10));
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps the balance card visible (wallet balance is not gated)', () => {
    setFlag(false);
    renderWallet();

    expect(screen.getByText(/4\.200\.000/)).toBeInTheDocument();
    expect(screen.getByText('Fully Unlocked Balance')).toBeInTheDocument();
    expect(screen.getByText('Pending Holds')).toBeInTheDocument();
  });

  it('renders normally when enabled (control test)', async () => {
    setFlag(true);
    vi.spyOn(withdrawalService, 'getAll').mockResolvedValue([]);
    renderWallet();

    expect(
      screen.getByRole('button', { name: /create new request/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('withdrawal-disabled-notice')).toBeNull();
  });

  it('does not surface the create modal under any render path while disabled', async () => {
    setFlag(false);
    renderWallet();
    await waitFor(() => {
      expect(screen.queryByText('Submit Withdrawal Request')).toBeNull();
    });
  });
});

// ─── TransactionsManagement (Admin) gate behaviour ───────────────────────────

describe('TransactionsManagement — withdrawal gate', () => {
  it('hides the Reviewer Withdrawal Requests tab when disabled', () => {
    setFlag(false);
    renderAdmin();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveTextContent(/Platform Revenue/i);
    expect(screen.queryByText(/Reviewer Withdrawal Requests/i)).toBeNull();
  });

  it('does not call adminService.getReviewerWithdrawals while disabled', async () => {
    setFlag(false);
    const spy = vi.spyOn(adminService, 'getReviewerWithdrawals');
    renderAdmin();

    await new Promise((r) => setTimeout(r, 10));
    expect(spy).not.toHaveBeenCalled();
  });

  it('never renders withdrawal modals (details / deny / approve) while disabled', () => {
    setFlag(false);
    renderAdmin();

    expect(screen.queryByText(/Deny Withdrawal/i)).toBeNull();
    expect(screen.queryByText(/Approve & Pay Payout/i)).toBeNull();
    expect(screen.queryByText(/Withdrawal Details/i)).toBeNull();
  });

  it('renders the normal Withdrawal tab + table when enabled (control test)', () => {
    setFlag(true);
    vi.spyOn(adminService, 'getReviewerWithdrawals').mockResolvedValue([]);
    renderAdmin();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole('tab', { name: /Reviewer Withdrawal Requests/i }),
    ).toBeInTheDocument();
  });
});

// ─── Unrelated wallet behavior is not impacted by the gate ───────────────────

describe('WalletTopUpModal — unaffected by withdrawal gate', () => {
  it('renders the top-up shell when withdrawal gate is disabled', async () => {
    setFlag(false);
    const { walletService } = await import('../../../src/services/wallet.service');
    vi.spyOn(walletService, 'autoFund').mockResolvedValue({
      id: 99,
      userId: 18,
      balance: 250000,
      walletId: 42,
    } as any);

    const { WalletTopUpModal } = await import(
      '../../../src/components/wallet/WalletTopUpModal'
    );
    render(
      <WalletTopUpModal
        isOpen
        currentUserId={18}
        currentWalletId={42}
        currentBalance={100000}
        onSuccess={vi.fn()}
        onMessage={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('confirm-pay-button')).toBeInTheDocument();
  });
});
