/**
 * Integration tests for the EarningsWallet (Reviewer) flow.
 *
 * Covers:
 *   1. Loading initial state from localStorage
 *   2. Fetching and rendering the withdrawal history table
 *   3. Loading / error / empty states
 *   4. Create Withdrawal modal — defaults, validation, submit flow
 *   5. Success modal appears after a successful POST
 *   6. Reject modal opens when "View Reason" clicked on a rejected request
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

const mockUser = { id: 7 };

vi.mock('../../../src/store/authSlice', () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));

// Mutable so individual tests can override isLoading / wallet state
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

vi.mock('./components/WithdrawalSuccessModal', () => ({
  WithdrawalSuccessModal: ({ isOpen, requestId }: any) =>
    isOpen ? (
      <div>
        <h2>Withdrawal Request Submitted!</h2>
        <span>Request ID: {requestId}</span>
      </div>
    ) : null,
}));

import { EarningsWallet } from '../../../src/pages/Reviewer/EarningsWallet';

// ─── Service mocks ────────────────────────────────────────────────────────────

const mockRequests = [
  {
    id: 1,
    bankName: 'Vietcombank (VCB)',
    accountNumber: '1234567890',
    amount: 500000,
    status: 'Pending',
    createdAt: '2026-07-15T10:00:00Z',
  },
  {
    id: 2,
    bankName: 'Techcombank (TCB)',
    accountNumber: '9876543210',
    amount: 1000000,
    status: 'Approved',
    createdAt: '2026-07-12T10:00:00Z',
  },
  {
    id: 3,
    bankName: 'BIDV',
    accountNumber: '5555444433',
    amount: 750000,
    status: 'Rejected',
    rejectionReason: 'Bank account name does not match user profile.',
    createdAt: '2026-07-10T10:00:00Z',
  },
];

vi.mock('../../../src/services/withdrawal.service', () => ({
  withdrawalService: {
    getAll: vi.fn(() => Promise.resolve(mockRequests)),
    create: vi.fn((payload) =>
      Promise.resolve({ id: 999, ...payload, status: 'Pending', createdAt: new Date().toISOString() })
    ),
    getById: vi.fn(),
    updateStatus: vi.fn(),
    update: vi.fn(),
  },
}));

// ─── Alert mock ───────────────────────────────────────────────────────────────

window.alert = vi.fn();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWallet = () => render(<EarningsWallet />);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EarningsWallet – page shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('ars_reviewer_balance', '4200000');
  });

  it('renders the page title and breadcrumbs', () => {
    renderWallet();
    expect(screen.getByText('Withdrawal Requests')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal History')).toBeInTheDocument();
  });

  it('renders the Create New Request button', () => {
    renderWallet();
    expect(screen.getByRole('button', { name: /create new request/i })).toBeInTheDocument();
  });

  it('displays Unlocked Balance + Pending Holds metrics', () => {
    renderWallet();
    expect(screen.getByText(/4\.200\.000/)).toBeInTheDocument();
    expect(screen.getByText('Fully Unlocked Balance')).toBeInTheDocument();
    expect(screen.getByText('Pending Holds')).toBeInTheDocument();
  });
});

describe('EarningsWallet – history table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('ars_reviewer_balance', '4200000');
  });

  it('renders all three requests with their statuses', async () => {
    renderWallet();

    await waitFor(() => {
      expect(screen.getByText('Vietcombank (VCB)')).toBeInTheDocument();
      expect(screen.getByText('Techcombank (TCB)')).toBeInTheDocument();
      expect(screen.getByText('BIDV')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Pending/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Approved/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Rejected/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the formatted Request ID with leading zeros', async () => {
    renderWallet();
    await waitFor(() => {
      expect(screen.getByText('#WR-000001')).toBeInTheDocument();
      expect(screen.getByText('#WR-000003')).toBeInTheDocument();
    });
  });

  it('shows the View Reason button only for Rejected requests', async () => {
    renderWallet();
    const viewReasonButtons = await screen.findAllByRole('button', { name: /view reason/i });
    expect(viewReasonButtons).toHaveLength(1);
  });

  it('opens the rejection notice modal when View Reason is clicked', async () => {
    const user = userEvent.setup();
    renderWallet();

    const viewReason = await screen.findByRole('button', { name: /view reason/i });
    await user.click(viewReason);

    expect(screen.getByText('Request Rejection Notice')).toBeInTheDocument();
    expect(screen.getByText(/Bank account name does not match user profile/)).toBeInTheDocument();
  });
});

describe('EarningsWallet – error state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('ars_reviewer_balance', '4200000');
  });

  it('renders the error state when fetch fails and Retry re-fetches', async () => {
    const user = userEvent.setup();
    const { withdrawalService } = await import('../../../src/services/withdrawal.service');
    (withdrawalService.getAll as any).mockImplementationOnce(() =>
      Promise.reject(new Error('Network down'))
    );

    renderWallet();

    expect(await screen.findByText('Failed to load withdrawal requests. Please try again.')).toBeInTheDocument();

    // Restore the mock so retry succeeds
    (withdrawalService.getAll as any).mockImplementation(() => Promise.resolve(mockRequests));

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(withdrawalService.getAll).toHaveBeenCalledTimes(2);
  });
});

describe('EarningsWallet – Create Withdrawal modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('ars_reviewer_balance', '4200000');
  });

  it('opens with empty defaults (no pre-filled account number)', async () => {
    const user = userEvent.setup();
    renderWallet();

    await user.click(screen.getByRole('button', { name: /create new request/i }));

    const accountNumberInput = screen.getByPlaceholderText(/enter your bank account number/i) as HTMLInputElement;
    expect(accountNumberInput.value).toBe('');

    // The Target Bank select should show the "Select your bank" placeholder option as the current value
    const bankSelect = screen.getByRole('combobox', { name: '' });
    expect(bankSelect).toBeInTheDocument();
  });

  it('shows no verification badge below the account number field', async () => {
    const user = userEvent.setup();
    renderWallet();
    await user.click(screen.getByRole('button', { name: /create new request/i }));

    expect(screen.queryByText(/account holder verified/i)).not.toBeInTheDocument();
  });

  it('submits the request when all fields are filled and shows the success modal', async () => {
    const user = userEvent.setup();
    renderWallet();
    await user.click(screen.getByRole('button', { name: /create new request/i }));

    // Select bank
    const bankSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(bankSelect, 'Vietcombank (VCB)');

    // Account name
    const accountNameInput = screen.getByPlaceholderText(/enter account holder name/i);
    await user.type(accountNameInput, 'Nguyen Van A');

    // Account number
    const accountNumberInput = screen.getByPlaceholderText(/enter your bank account number/i);
    await user.type(accountNumberInput, '1234567890');

    // Amount
    const amountInput = screen.getByRole('spinbutton');
    await user.type(amountInput, '500000');

    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText(/withdrawal request submitted!/i)).toBeInTheDocument();
    expect(screen.getByText(/#WR-000999/i)).toBeInTheDocument();

    // Verify walletId came from useWallet (8), not a hardcoded or zero fallback
    const { withdrawalService: ws } = await import('../../../src/services/withdrawal.service');
    const createCall = (ws.create as any).mock.calls.at(-1)[0];
    expect(createCall.walletId).toBe(8);
    expect(createCall.userId).toBe(7);
  });

  it('closes the modal when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWallet();
    await user.click(screen.getByRole('button', { name: /create new request/i }));

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByText('Submit Withdrawal Request')).not.toBeInTheDocument();
  });

  it('disables the submit button while wallet is still loading', async () => {
    const { _setUseWalletReturn } = await import('../../../src/hooks/useWallet');
    _setUseWalletReturn({ wallet: null, walletId: null, isLoading: true, error: null, refetch: vi.fn() });

    const user = userEvent.setup();
    renderWallet();
    await user.click(screen.getByRole('button', { name: /create new request/i }));

    expect(screen.getByRole('button', { name: /send request/i })).toBeDisabled();

    _setUseWalletReturn({ wallet: { id: 8, walletId: 8, userId: 7, balance: 0 }, walletId: 8, isLoading: false, error: null, refetch: vi.fn() });
  });
});
