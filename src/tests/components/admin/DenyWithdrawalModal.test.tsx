/**
 * Component tests for src/pages/Admin/DenyWithdrawalModal.tsx (Phase C: Admin).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DenyWithdrawalModal } from '../../../pages/Admin/DenyWithdrawalModal';
import type { WithdrawalRequestItem } from '../../../types/admin';

const NOW = '2026-08-16T10:30:00Z';
const WITHDRAWAL: WithdrawalRequestItem = {
  txId: 8001,
  userId: 18,
  reviewerName: 'Tran Thi Withdrawal',
  amountVnd: 1_750_000,
  currency: 'VND',
  bankName: 'Techcombank',
  accountNumber: '1903 4500 22',
  accountName: 'TRAN THI WITHDRAWAL',
  requestDate: NOW,
  status: 'PENDING',
  proofReceiptUrl: null,
};

const { adminService } = vi.hoisted(() => ({
  adminService: {
    denyWithdrawal: vi.fn(async (id: number, reason: string) => ({
      ...WITHDRAWAL,
      txId: id,
      status: 'DENIED' as const,
      rejectionReason: reason,
    })),
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

vi.mock('../../../services/admin.service', () => ({ adminService }));

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof DenyWithdrawalModal>> = {},
) => {
  const onClose = vi.fn();
  const onDenied = vi.fn();
  const utils = render(
    <DenyWithdrawalModal
      withdrawal={WITHDRAWAL}
      open
      onClose={onClose}
      onDenied={onDenied}
      {...overrides}
    />,
  );
  return { onClose, onDenied, ...utils };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<DenyWithdrawalModal>', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <DenyWithdrawalModal
        withdrawal={WITHDRAWAL}
        open={false}
        onClose={vi.fn()}
        onDenied={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the reviewer summary block', () => {
    renderModal();
    expect(screen.getByText(/Tran Thi Withdrawal/)).toBeInTheDocument();
    expect(screen.getByText(/Techcombank/)).toBeInTheDocument();
    expect(screen.getByText(/1\.750\.000 VND/)).toBeInTheDocument();
  });

  it('rejects a reason shorter than 10 chars', async () => {
    const user = userEvent.setup();
    renderModal();
    const textarea = screen.getByLabelText(/Reason for denial/i);
    await user.type(textarea, 'too short');
    // The submit button is enabled, but on submit the modal should reject the reason.
    await user.click(screen.getByRole('button', { name: /Confirm Denial/i }));
    // Validation error appears
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/at least 10 characters/);
    expect(adminService.denyWithdrawal).not.toHaveBeenCalled();
  });

  it('successful denial passes the reason and calls onDenied + onClose', async () => {
    const user = userEvent.setup();
    const { onClose, onDenied } = renderModal();
    const textarea = screen.getByLabelText(/Reason for denial/i);
    await user.type(textarea, 'Bank account name mismatch');
    await user.click(screen.getByRole('button', { name: /Confirm Denial/i }));
    await waitFor(() => {
      expect(adminService.denyWithdrawal).toHaveBeenCalledWith(
        8001,
        'Bank account name mismatch',
      );
    });
    await waitFor(() => {
      expect(onDenied).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('API error is surfaced as inline alert', async () => {
    adminService.denyWithdrawal.mockRejectedValueOnce(new Error('Server conflict'));
    const user = userEvent.setup();
    const { onClose, onDenied } = renderModal();
    const textarea = screen.getByLabelText(/Reason for denial/i);
    await user.type(textarea, 'Bank account name mismatch');
    await user.click(screen.getByRole('button', { name: /Confirm Denial/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Server conflict/);
    expect(onClose).not.toHaveBeenCalled();
    expect(onDenied).not.toHaveBeenCalled();
  });

  it('Cancel button calls onClose without firing denyWithdrawal', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(onClose).toHaveBeenCalled();
    expect(adminService.denyWithdrawal).not.toHaveBeenCalled();
  });
});