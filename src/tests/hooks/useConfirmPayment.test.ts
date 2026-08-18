/**
 * Tests for the new useConfirmPayment hook.
 *
 * Verifies that:
 *   - PAID statuses route to paymentService.getSuccess with status+code
 *   - non-PAID statuses route to paymentService.getCancel
 *   - errors surface via the hook's `error` state and the confirm() call
 *     resolves to `null`
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/payment.service', () => ({
  paymentService: {
    getSuccess: vi.fn().mockResolvedValue({ status: 'PAID' }),
    getCancel: vi.fn().mockResolvedValue({ status: 'CANCELLED' }),
    cancelOrder: vi.fn(),
    createLink: vi.fn(),
  },
}));

import { useConfirmPayment } from '../../hooks/useCreatePaymentLink';
import { paymentService } from '../../services/payment.service';

describe('useConfirmPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(paymentService.getSuccess).mockResolvedValue({ status: 'PAID' });
    vi.mocked(paymentService.getCancel).mockResolvedValue({ status: 'CANCELLED' });
  });

  it('calls getSuccess when status is PAID', async () => {
    const { result } = renderHook(() => useConfirmPayment());

    await act(async () => {
      await result.current.confirm('9001', 'PAID', '00');
    });

    await waitFor(() => {
      expect(paymentService.getSuccess).toHaveBeenCalledWith('9001', 'PAID', '00');
    });
    expect(paymentService.getCancel).not.toHaveBeenCalled();
  });

  it('calls getCancel when status is CANCELLED', async () => {
    const { result } = renderHook(() => useConfirmPayment());

    await act(async () => {
      await result.current.confirm('9002', 'CANCELLED', null);
    });

    await waitFor(() => {
      expect(paymentService.getCancel).toHaveBeenCalledWith('9002');
    });
    expect(paymentService.getSuccess).not.toHaveBeenCalled();
  });

  it('surfaces errors and resolves to null', async () => {
    vi.mocked(paymentService.getSuccess).mockRejectedValueOnce(
      new Error('boom'),
    );
    const { result } = renderHook(() => useConfirmPayment());

    let resolved: unknown = 'sentinel';
    await act(async () => {
      resolved = await result.current.confirm('9003', 'PAID', null);
    });

    expect(resolved).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('boom');
  });
});