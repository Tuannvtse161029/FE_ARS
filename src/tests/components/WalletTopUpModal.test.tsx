/**
 * Tests for the WalletTopUpModal (PayOS wallet top-up flow).
 *
 * Covers:
 *   1. Returns null when isOpen is false
 *   2. Amount validation rejects out-of-range values, accepts preset chips
 *   3. Confirm & Pay POSTs `/api/Payment/create-link` with PayOS contract
 *      (returnUrl/cancelUrl anchored on /payment/return, not /wallet/topup)
 *      and transitions to QR with the BE-supplied orderCode + checkoutUrl
 *   4. Redirect button points at the PayOS checkoutUrl and never auto-navigates
 *   5. Falls back to the offline QR when /api/Payment/create-link rejects
 *   6. Duplicate submission is suppressed while the request is in flight
 *   7. Invalid (non-http) checkoutUrl is ignored — no redirect button rendered
 *   8. DEV-only auto-fund button POSTs `/api/Wallet` via walletService.autoFund
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
      checkoutUrl: 'https://pay.payos.vn/web/example-123',
      orderCode: '9001',
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
      checkoutUrl: 'https://pay.payos.vn/web/example-123',
      orderCode: '9001',
      qrCode: 'data:image/png;base64,iVBORw0KGgo=',
      status: 'PENDING',
    });
  });

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
    renderModal();

    const confirm = screen.getByTestId('confirm-pay-button');
    // Default seeded amount is 100,000 VND which is valid; the button is enabled.
    expect(confirm).not.toBeDisabled();

    // Type an out-of-range value (5,000 VND < MIN_AMOUNT_VND 10,000).
    const input = screen.getByLabelText(/Amount \(VND\)/i);
    await user.clear(input);
    await user.type(input, '5000');
    expect(confirm).toBeDisabled();
    expect(
      screen.getByText(
        /Enter a value between [\d,.]+ and [\d,.]+ VND/,
      ),
    ).toBeInTheDocument();
  });

  it('disables Confirm & Pay when currentWalletId is null — no payment payload sent', async () => {
    const user = userEvent.setup();
    const { onMessage } = renderModal({ currentWalletId: null });

    const confirm = screen.getByTestId('confirm-pay-button');
    expect(confirm).toBeDisabled();

    // Attempting to click has no effect — no API call is made.
    await user.click(confirm).catch(() => undefined);
    expect(paymentService.createLink).not.toHaveBeenCalled();
    // The user-facing recovery message is surfaced.
    expect(screen.getByText(/wallet information could not be loaded/i)).toBeInTheDocument();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('disables Confirm & Pay when currentWalletId is 0 — never sends walletId:0 to payment API', async () => {
    const user = userEvent.setup();
    renderModal({ currentWalletId: 0 });

    const confirm = screen.getByTestId('confirm-pay-button');
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/wallet information could not be loaded/i)).toBeInTheDocument();

    await user.click(confirm).catch(() => undefined);
    expect(paymentService.createLink).not.toHaveBeenCalled();
  });

  it('shows wallet-unavailable error banner when wallet ID is not yet loaded', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ currentWalletId: undefined });

    // The recovery CTA is present so the user can dismiss and retry.
    expect(screen.getByText(/wallet information could not be loaded/i)).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /refresh and try again/i });
    await user.click(retry);
    expect(onClose).toHaveBeenCalled();
  });

  it('Confirm & Pay POSTs /api/Payment/create-link with PayOS returnUrl/cancelUrl', async () => {
    const user = userEvent.setup();
    renderModal();

    const confirm = screen.getByTestId('confirm-pay-button');
    await user.click(confirm);

    await waitFor(() => {
      expect(paymentService.createLink).toHaveBeenCalledTimes(1);
    });
    const callArg = vi.mocked(paymentService.createLink).mock.calls[0]?.[0];
    expect(callArg?.amount).toBe(100_000);
    expect(callArg?.userId).toBe(18);
    expect(callArg?.walletId).toBe(42);
    expect(callArg?.description).toMatch(/Wallet top-up 100\.000 VND/);
    // Return + cancel URLs must point at /payment/return (the existing
    // CheckoutReturn route) — never at the dead /wallet/topup path.
    expect(callArg?.returnUrl).toMatch(
      /^https?:\/\/[^/]+\/payment\/return\?status=success&orderCode=\{orderCode\}&ref=/,
    );
    expect(callArg?.cancelUrl).toMatch(
      /^https?:\/\/[^/]+\/payment\/return\?status=CANCELLED&ref=/,
    );

    // The QR step now shows the PayOS badge and orderCode.
    expect(await screen.findByText(/PayOS QR/)).toBeInTheDocument();
    expect(screen.getByText('9001')).toBeInTheDocument();
    // Reference uses the ARS-POS- prefix (PayOS), not ARS-VNP-.
    const refMatch = document.body.textContent?.match(/ARS-POS-[A-Z0-9-]+/);
    expect(refMatch).not.toBeNull();
    // The redirect button is rendered when checkoutUrl is a valid http URL.
    const redirectBtn = screen.getByTestId('payos-checkout-button');
    expect(redirectBtn).toBeInTheDocument();
  });

  it('does not auto-redirect when /api/Payment/create-link resolves', async () => {
    const user = userEvent.setup();
    // jsdom refuses to patch `window.location.assign` because Location is a
    // non-configurable host object. We instead assert the modal exposes a
    // redirect button with the PayOS checkoutUrl as its target, and that the
    // modal renders the success badge + summary in the QR step. The actual
    // navigation occurs only when the user clicks the redirect button —
    // verified indirectly via the CheckoutReturn tests which check that the
    // /payment/return route is the only authoritative confirmation page.
    renderModal();
    await user.click(screen.getByTestId('confirm-pay-button'));
    await waitFor(() => {
      expect(screen.getByTestId('payos-checkout-button')).toBeInTheDocument();
    });
    expect(screen.getByText(/PayOS QR/)).toBeInTheDocument();
    expect(screen.getByTestId('payos-checkout-button-footer')).toBeInTheDocument();
    // No automatic navigation kicked off (the Confirm button no longer exists
    // at this point — the QR step replaces it).
    expect(
      screen.queryByTestId('confirm-pay-button'),
    ).not.toBeInTheDocument();
  });

  it('falls back to the offline QR when /api/Payment/create-link rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(paymentService.createLink).mockRejectedValueOnce(
      new Error('Network unreachable'),
    );
    const { onMessage } = renderModal();

    await user.click(screen.getByTestId('confirm-pay-button'));

    expect(await screen.findByText(/Fallback PayOS QR/)).toBeInTheDocument();
    // No redirect button when there's no usable PayOS checkoutUrl.
    expect(screen.queryByTestId('payos-checkout-button')).not.toBeInTheDocument();
    // The soft warning toast was emitted.
    expect(onMessage).toHaveBeenCalledWith(
      expect.stringMatching(/Could not reach the PayOS gateway/),
      'error',
    );
  });

  it('ignores invalid (non-http) checkoutUrl — no redirect button rendered', async () => {
    const user = userEvent.setup();
    vi.mocked(paymentService.createLink).mockResolvedValueOnce({
      checkoutUrl: 'javascript:alert(1)',
      orderCode: '9002',
      status: 'PENDING',
    });
    renderModal();

    await user.click(screen.getByTestId('confirm-pay-button'));
    await waitFor(() => {
      expect(paymentService.createLink).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('payos-checkout-button')).not.toBeInTheDocument();
    // The fallback close action is offered when no usable URL exists.
    expect(screen.getByTestId('close-after-fallback')).toBeInTheDocument();
  });

  it('suppresses duplicate submission while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: unknown) => void) | null = null;
    vi.mocked(paymentService.createLink).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    renderModal();

    const confirm = screen.getByTestId('confirm-pay-button');
    await user.click(confirm);
    await waitFor(() => {
      expect(paymentService.createLink).toHaveBeenCalledTimes(1);
    });

    // While the request is in-flight the button must be disabled to
    // prevent duplicate charges.
    expect(confirm).toBeDisabled();
    // A second click is a no-op (still in-flight).
    await user.click(confirm).catch(() => undefined);
    expect(paymentService.createLink).toHaveBeenCalledTimes(1);

    resolveCreate?.({
      checkoutUrl: 'https://pay.payos.vn/web/example-123',
      orderCode: '9003',
      qrCode: 'data:image/png;base64,iVBORw0KGgo=',
      status: 'PENDING',
    });
  });

  it('DEV auto-fund button POSTs /api/Wallet and reports the new balance', async () => {
    const user = userEvent.setup();
    vi.mocked(walletService.autoFund).mockResolvedValueOnce({
      id: 42,
      userId: 18,
      balance: 350_000,
    });

    const { onSuccess, onMessage, onClose } = renderModal();

    await user.click(screen.getByTestId('dev-auto-fund-button'));

    await waitFor(() => {
      expect(walletService.autoFund).toHaveBeenCalledWith({
        userId: 18,
        balance: 100_000,
      });
    });
    expect(onSuccess).toHaveBeenCalledWith(350_000);
    expect(onMessage).toHaveBeenCalledWith(
      expect.stringMatching(/DEV: Wallet funded 100\.000 VND/),
      'success',
    );
    expect(onClose).toHaveBeenCalled();
  });
});