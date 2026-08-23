/**
 * Component tests for src/pages/Admin/WithdrawalDetailsModal.tsx (Phase C: Admin).
 *
 * Covers all metadata fields + receipt link behaviour.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WithdrawalDetailsModal } from '../../../../src/pages/Admin/WithdrawalDetailsModal';
import type { WithdrawalRequestItem } from '../../../../src/types/admin';

const NOW = '2026-08-16T10:30:00Z';
const BASE_W: WithdrawalRequestItem = {
  txId: 7001,
  userId: 18,
  reviewerName: 'Tran Thi Withdrawal',
  amountVnd: 1_750_000,
  currency: 'VND',
  bankName: 'Techcombank',
  accountNumber: '1903 4500 22',
  accountName: 'TRAN THI WITHDRAWAL',
  requestDate: NOW,
  status: 'COMPLETED',
  processingAt: NOW,
  completedAt: NOW,
  proofReceiptUrl: 'https://firebasestorage.googleapis.com/v0/b/ars/o/receipt.pdf',
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WithdrawalDetailsModal>> = {},
) => {
  const onClose = vi.fn();
  const utils = render(
    <WithdrawalDetailsModal
      withdrawal={BASE_W}
      open
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onClose, ...utils };
};

describe('<WithdrawalDetailsModal>', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <WithdrawalDetailsModal
        withdrawal={BASE_W}
        open={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing when withdrawal is null', () => {
    render(<WithdrawalDetailsModal withdrawal={null} open onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows all metadata: reviewer, amount, currency, bank, account, holder, dates, status, reason, receipt', () => {
    renderModal({
      withdrawal: { ...BASE_W, status: 'DENIED', rejectionReason: 'Bank name mismatch' },
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Tran Thi Withdrawal/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Techcombank/)).toBeInTheDocument();
    expect(within(dialog).getByText(/1903 4500 22/)).toBeInTheDocument();
    expect(within(dialog).getByText(/TRAN THI WITHDRAWAL/)).toBeInTheDocument();
    expect(within(dialog).getByText('VND')).toBeInTheDocument();
    expect(within(dialog).getByText(/Bank name mismatch/)).toBeInTheDocument();
    // The receipt link is rendered with an external anchor
    const receiptLink = within(dialog).getByRole('link', { name: /View receipt/i });
    expect(receiptLink).toHaveAttribute('href', expect.stringContaining('https://'));
  });

  it('renders an em-dash when receipt URL is missing', () => {
    renderModal({ withdrawal: { ...BASE_W, proofReceiptUrl: null } });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('link', { name: /View receipt/i })).not.toBeInTheDocument();
    // At least one em-dash present (for receipt)
    expect(within(dialog).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders an em-dash when receipt URL is invalid (e.g. firebase storage path)', () => {
    renderModal({
      withdrawal: {
        ...BASE_W,
        proofReceiptUrl: 'gs://bucket/receipt.pdf', // not http(s)
      },
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('link', { name: /View receipt/i })).not.toBeInTheDocument();
  });

  it('em-dash for missing optional timestamps (processingAt, completedAt)', () => {
    renderModal({
      withdrawal: {
        ...BASE_W,
        processingAt: null,
        completedAt: null,
      },
    });
    const dialog = screen.getByRole('dialog');
    // Two em-dashes for the missing timestamps
    expect(within(dialog).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('Close button calls onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: /^Close$/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('read-only — no inputs / selects / textareas inside', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
  });

  describe('Request reason (defect 5)', () => {
    it('renders the reviewer-submitted request reason when present', () => {
      renderModal({
        withdrawal: { ...BASE_W, requestReason: 'Conference registration fees' },
      });
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/Request reason/i)).toBeInTheDocument();
      expect(within(dialog).getByText('Conference registration fees')).toBeInTheDocument();
    });

    it('renders "No reason provided" when requestReason is null', () => {
      renderModal({ withdrawal: { ...BASE_W, requestReason: null } });
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/Request reason/i)).toBeInTheDocument();
      expect(within(dialog).getByText('No reason provided')).toBeInTheDocument();
    });

    it('renders "No reason provided" when requestReason is undefined (omitted)', () => {
      renderModal({ withdrawal: { ...BASE_W } });
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('No reason provided')).toBeInTheDocument();
    });

    it('renders "No reason provided" when requestReason is whitespace-only', () => {
      renderModal({ withdrawal: { ...BASE_W, requestReason: '   ' } });
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('No reason provided')).toBeInTheDocument();
    });

    it('keeps request reason and rejection reason as separate fields on a DENIED row', () => {
      renderModal({
        withdrawal: {
          ...BASE_W,
          status: 'DENIED',
          requestReason: 'Urgent home repair',
          rejectionReason: 'Bank account name does not match KYC.',
        },
      });
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Urgent home repair')).toBeInTheDocument();
      expect(within(dialog).getByText(/Bank account name does not match KYC/)).toBeInTheDocument();
    });
  });
});