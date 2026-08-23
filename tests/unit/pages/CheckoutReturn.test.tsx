/**
 * Tests for the PayOS redirect confirmation page (`/payment/return`).
 *
 * Covers:
 *   1. PAID status calls /api/Payment/success and shows the success screen
 *      with the refetched wallet balance.
 *   2. CANCELLED status calls /api/Payment/cancel and shows the cancelled
 *      screen.
 *   3. PENDING / unknown status calls /api/Payment/cancel as a safe default
 *      and shows the pending screen with a retry CTA.
 *   4. Missing orderCode shows the failure screen immediately.
 *   5. BE confirmation error shows the failure screen with the server
 *      message and retry CTA.
 *   6. Wallet refetch failures do NOT block the success screen.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CheckoutReturn from '../../../src/pages/Payment/CheckoutReturn';
import { ROUTES } from '../../../src/routes/paths';

vi.mock('../../../src/services/payment.service', () => ({
  paymentService: {
    getSuccess: vi.fn().mockResolvedValue({ status: 'PAID' }),
    getCancel: vi.fn().mockResolvedValue({ status: 'CANCELLED' }),
    cancelOrder: vi.fn(),
    createLink: vi.fn(),
  },
}));

vi.mock('../../../src/services/wallet.service', () => ({
  walletService: {
    getAll: vi.fn().mockResolvedValue([
      { id: 42, userId: 18, balance: 350_000 },
    ]),
  },
}));

import { paymentService } from '../../../src/services/payment.service';
import { walletService } from '../../../src/services/wallet.service';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.PAYMENT_RETURN} element={<CheckoutReturn />} />
        <Route path={ROUTES.FORUM} element={<div>Forum Page</div>} />
        <Route path={ROUTES.HOME} element={<div>Wallet Home</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('CheckoutReturn (PayOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(paymentService.getSuccess).mockResolvedValue({ status: 'PAID' });
    vi.mocked(paymentService.getCancel).mockResolvedValue({ status: 'CANCELLED' });
    vi.mocked(walletService.getAll).mockResolvedValue([
      { id: 42, userId: 18, balance: 350_000 },
    ]);
  });

  it('confirms PAID with /api/Payment/success and shows the refetched balance', async () => {
    renderAt(
      `${ROUTES.PAYMENT_RETURN}?orderCode=9001&status=PAID&code=00`,
    );
    await waitFor(() => {
      expect(paymentService.getSuccess).toHaveBeenCalledWith(
        '9001',
        'PAID',
        '00',
      );
    });
    expect(
      await screen.findByRole('heading', { name: /Payment successful/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/New balance:/)).toBeInTheDocument();
    expect(screen.getByText(/350\.000 VND/)).toBeInTheDocument();
    expect(walletService.getAll).toHaveBeenCalledTimes(1);
  });

  it('shows the cancelled screen for CANCELLED status', async () => {
    renderAt(
      `${ROUTES.PAYMENT_RETURN}?orderCode=9002&status=CANCELLED`,
    );
    await waitFor(() => {
      expect(paymentService.getCancel).toHaveBeenCalledWith('9002');
    });
    expect(
      await screen.findByRole('heading', { name: /Payment cancelled/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('9002')).toBeInTheDocument();
    // Success endpoint must NOT be called on cancellation.
    expect(paymentService.getSuccess).not.toHaveBeenCalled();
  });

  it('treats PENDING / unknown status as pending and offers a retry CTA', async () => {
    renderAt(
      `${ROUTES.PAYMENT_RETURN}?orderCode=9003&status=PENDING`,
    );
    await waitFor(() => {
      // We call /api/Payment/cancel as a safe default for non-PAID statuses.
      expect(paymentService.getCancel).toHaveBeenCalledWith('9003');
    });
    expect(
      await screen.findByRole('heading', { name: /Payment pending/i }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Back to forums/i }));
    expect(await screen.findByText('Forum Page')).toBeInTheDocument();
  });

  it('shows the failure screen when orderCode is missing', async () => {
    renderAt(`${ROUTES.PAYMENT_RETURN}?status=PAID`);
    expect(
      await screen.findByRole('heading', {
        name: /We couldn't confirm your payment/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Missing orderCode/)).toBeInTheDocument();
    // Neither success nor cancel should be called when orderCode is missing.
    expect(paymentService.getSuccess).not.toHaveBeenCalled();
    expect(paymentService.getCancel).not.toHaveBeenCalled();
  });

  it('shows the failure screen with the server error message', async () => {
    vi.mocked(paymentService.getSuccess).mockRejectedValueOnce(
      new Error('Signature mismatch'),
    );
    renderAt(
      `${ROUTES.PAYMENT_RETURN}?orderCode=9004&status=PAID&code=00`,
    );
    expect(
      await screen.findByRole('heading', {
        name: /We couldn't confirm your payment/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Signature mismatch/)).toBeInTheDocument();
  });

  it('does not block the success screen when wallet refetch fails', async () => {
    vi.mocked(walletService.getAll).mockRejectedValueOnce(
      new Error('Wallet service down'),
    );
    renderAt(
      `${ROUTES.PAYMENT_RETURN}?orderCode=9005&status=PAID`,
    );
    expect(
      await screen.findByRole('heading', { name: /Payment successful/i }),
    ).toBeInTheDocument();
    // No "New balance" line is shown when the refetch fails.
    expect(screen.queryByText(/New balance:/)).not.toBeInTheDocument();
  });
});