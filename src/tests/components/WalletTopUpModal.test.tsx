/**
 * Tests for the WalletTopUpModal (header pill).
 *
 * Covers:
 *   1. Returns null when isOpen is false
 *   2. Amount validation rejects out-of-range values, accepts preset chips
 *   3. Confirm & Pay POSTs `/api/Payment/create-link` and transitions to
 *      QR with the BE-supplied orderCode + checkoutUrl
 *   4. Simulate Successful Payment triggers onSuccess + onClose
 *   5. DEV-only auto-fund button POSTs `/api/Wallet` via walletService.autoFund
 *      and triggers onSuccess with the returned balance
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { WalletTopUpModal } from '../../components/wallet/WalletTopUpModal';

vi.mock('../../services/wallet.service', () => ({
  walletService: {
    autoFund: vi.fn().mockResolvedValue({
      id: 99,
      userId: 18,
      balance: 250000,
    }),
  },
}));

vi.mock('../../services/payment.service', () => ({
  paymentService: {
    createLink: vi.fn().mockResolvedValue({
      checkoutUrl: 'https://sandbox.vnpayment.vn/pay?token=abc123',
      orderCode: 'ARS-ORDER-9001',
      qrCode: 'data:image/png;base64,iVBORw0KGgo=',
      status: 'PENDING',
    }),
  },
}));

import { walletService } from '../../services/wallet.service';
import { paymentService } from '../../services/payment.service';

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WalletTopUpModal>> = {},
) => {
  const onSuccess = vi.fn();
  const onMessage = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <WalletTopUpModal
      isOpen
      currentUserId={18}
      currentWalletId={42}
      currentBalance={100_000}
      onSuccess={onSuccess}
      onMessage={onMessage}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSuccess, onMessage, onClose, ...utils };
};

describe('WalletTopUpModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply the default resolved value for createLink after clearAllMocks
    // resets call history but NOT the implementation.
    vi.mocked(paymentService.createLink).mockResolvedValue({
      checkoutUrl: 'https://sandbox.vnpayment.vn/pay?token=abc123',
      orderCode: 'ARS-ORDER-9001',
      qrCode: 'data:image/png;base64,iVBORw0KGgo=',
      status: 'PENDING',
    });
  });

  // Note: vi-VN locale uses dots as the thousands separator (e.g. "200.000").
// Build a regex whose leading digits match the chip's thousands-grouping.
const chipMatcher = (amount: number): RegExp => {
  const formatted = amount.toLocaleString('vi-VN').replace(/\./g, '\\.');
  return new RegExp(`^${formatted}\\s*VND`);
};
const rangeErrorMatcher: RegExp =
  /Enter a value between \d{1,3}(?:[.,]\d{3})* and \d{1,3}(?:[.,]\d{3})* VND/;

  it('returns null when isOpen is false', () => {
    render(
      <WalletTopUpModal
        isOpen={false}
        currentUserId={18}
        currentBalance={100_000}
        onSuccess={vi.fn()}
        onMessage={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables Confirm when the amount is out of range, accepts preset chips', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    const confirm = screen.getByRole('button', { name: /Confirm & Pay with VNPay/i });
    // Default seeded amount is 100,000 VND which is valid; the button is enabled.
    expect(confirm).not.toBeDisabled();

    // Type an out-of-range value (5,000 VND < MIN_AMOUNT_VND 10,000).
    const input = screen.getByLabelText(/Amount \(VND\)/i);
    await user.clear(input);
    await user.type(input, '5000');
    expect(confirm).toBeDisabled();
    expect(
      screen.getByText(rangeErrorMatcher),
    ).toBeInTheDocument();

    // Click a preset chip → confirm re-enables.
    await user.click(screen.getByRole('button', { name: chipMatcher(200_000) }));
    expect(confirm).not.toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Confirm & Pay POSTs /api/Payment/create-link and transitions to QR with BE response', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: chipMatcher(200_000) }));
    await user.click(screen.getByRole('button', { name: /Confirm & Pay with VNPay/i }));

    // The BE was called with the right payload (amount in VND, currentUserId,
    // currentWalletId, description, returnUrl + cancelUrl anchored on the
    // current origin).
    await waitFor(() => {
      expect(paymentService.createLink).toHaveBeenCalledTimes(1);
    });
    const callArg = vi.mocked(paymentService.createLink).mock.calls[0]?.[0];
    expect(callArg?.amount).toBe(200_000);
    expect(callArg?.userId).toBe(18);
    expect(callArg?.walletId).toBe(42);
    expect(callArg?.description).toMatch(/Wallet top-up 200\.000 VND/);
    expect(callArg?.returnUrl).toMatch(/^https?:\/\/[^/]+\/wallet\/topup\?status=success&ref=/);
    expect(callArg?.cancelUrl).toMatch(/^https?:\/\/[^/]+\/wallet\/topup\?status=cancelled&ref=/);

    // The QR step now shows: "Scan to Pay" heading, BE-supplied orderCode,
    // BE-supplied checkout link, and a reference that still matches the
    // local ARS-VNP-… pattern (kept even when BE returns its own orderCode
    // so the static-QR fallback path stays consistent).
    expect(await screen.findByRole('heading', { name: /Scan to Pay/i })).toBeInTheDocument();
    expect(screen.getByText(/Reference/)).toBeInTheDocument();
    expect(screen.getByText(/Order Code/)).toBeInTheDocument();
    expect(screen.getByText(/ARS-ORDER-9001/)).toBeInTheDocument();
    // The QR badge reflects the BE-supplied QR (no longer "Mock").
    expect(screen.getByText(/VNPay QR/)).toBeInTheDocument();
    // The checkout link is surfaced as a click-through.
    expect(screen.getByTestId('vnpay-checkout-link')).toHaveAttribute(
      'href',
      'https://sandbox.vnpayment.vn/pay?token=abc123',
    );
    // Countdown is still ticking.
    expect(screen.getByText(/00:30/)).toBeInTheDocument();
    // Reference should match the ARS-VNP-… pattern.
    const refMatch = document.body.textContent?.match(/ARS-VNP-[A-Z0-9-]+/);
    expect(refMatch).not.toBeNull();
  });

  it('falls back to the static mock QR when /api/Payment/create-link rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(paymentService.createLink).mockRejectedValueOnce(
      new Error('Network unreachable'),
    );
    const { onMessage } = renderModal();

    await user.click(screen.getByRole('button', { name: chipMatcher(200_000) }));
    await user.click(screen.getByRole('button', { name: /Confirm & Pay with VNPay/i }));

    // The QR step still appears (fallback path).
    expect(await screen.findByRole('heading', { name: /Scan to Pay/i })).toBeInTheDocument();
    // The badge is now "Mock VNPay QR" because the BE didn't supply a real QR.
    expect(screen.getByText(/Mock VNPay QR/)).toBeInTheDocument();
    // The soft warning toast was emitted.
    expect(onMessage).toHaveBeenCalledWith(
      expect.stringMatching(/Could not reach the payment gateway/),
      'error',
    );
    // No checkout link is surfaced (no BE response).
    expect(screen.queryByTestId('vnpay-checkout-link')).not.toBeInTheDocument();
  });

  it('Simulate Successful Payment calls onSuccess and onClose', async () => {
    const user = userEvent.setup();
    const { onSuccess, onMessage, onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: chipMatcher(200_000) }));
    await user.click(screen.getByRole('button', { name: /Confirm & Pay with VNPay/i }));
    await user.click(screen.getByTestId('simulate-success-button'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(300_000); // 100k + 200k
    });
    expect(onMessage).toHaveBeenCalledWith(expect.stringMatching(/Top-up of 200\.000 VND/), 'success');
    expect(onClose).toHaveBeenCalled();
  });

  it('DEV auto-fund button POSTs /api/Wallet and reports the new balance', async () => {
    const user = userEvent.setup();
    vi.mocked(walletService.autoFund).mockResolvedValueOnce({
      id: 42,
      userId: 18,
      balance: 350_000,
    });

    const { onSuccess, onMessage, onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: chipMatcher(100_000) }));
    await user.click(screen.getByTestId('dev-auto-fund-button'));

    await waitFor(() => {
      expect(walletService.autoFund).toHaveBeenCalledWith({ userId: 18, balance: 100_000 });
    });
    expect(onSuccess).toHaveBeenCalledWith(350_000);
    expect(onMessage).toHaveBeenCalledWith(
      expect.stringMatching(/DEV: Wallet funded 100\.000 VND/),
      'success',
    );
    expect(onClose).toHaveBeenCalled();
  });
});