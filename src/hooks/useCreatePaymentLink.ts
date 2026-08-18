import { useState } from 'react';
import { paymentService } from '../services/payment.service';
import type {
  PaymentCreateRequest,
  PaymentLink,
  PaymentStatusResult,
} from '../types/domain';

interface UseCreatePaymentLinkResult {
  create: (req: PaymentCreateRequest) => Promise<PaymentLink | null>;
  isLoading: boolean;
  error: Error | null;
  data: PaymentLink | null;
  reset: () => void;
}

// PayOS wallet-top-up flow.
//
// `create()` POSTs to `/api/Payment/create-link` and returns the BE's
// PaymentLink (with PayOS `checkoutUrl`, `orderCode`, etc.) or `null` if the
// BE call fails. Callers MUST treat `null` as "no usable link" and surface
// a user-facing error — they MUST NOT auto-redirect to a fabricated URL.
export function useCreatePaymentLink(): UseCreatePaymentLinkResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<PaymentLink | null>(null);

  const create = async (
    req: PaymentCreateRequest,
  ): Promise<PaymentLink | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const link = await paymentService.createLink(req);
      setData(link);
      setIsLoading(false);
      return link;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to create payment link'),
      );
      setIsLoading(false);
      return null;
    }
  };

  return {
    create,
    isLoading,
    error,
    data,
    reset: () => {
      setData(null);
      setError(null);
    },
  };
}

interface UseConfirmPaymentResult {
  confirm: (
    orderCode: string | number,
    status: string | null,
    code?: string | null,
  ) => Promise<PaymentStatusResult | null>;
  isLoading: boolean;
  error: Error | null;
}

// Confirms the PayOS return-URL outcome with the BE. Used by /payment/return
// so the page never treats URL query params as proof of payment.
export function useConfirmPayment(): UseConfirmPaymentResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const confirm = async (
    orderCode: string | number,
    status: string | null,
    code?: string | null,
  ): Promise<PaymentStatusResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const isPaid = (status ?? '').toUpperCase() === 'PAID';
      const result = isPaid
        ? await paymentService.getSuccess(orderCode, status ?? undefined, code ?? undefined)
        : await paymentService.getCancel(orderCode);
      setIsLoading(false);
      return result;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to confirm payment'),
      );
      setIsLoading(false);
      return null;
    }
  };

  return { confirm, isLoading, error };
}

interface UseCancelPaymentResult {
  cancel: (orderCode: string | number) => Promise<boolean>;
  isLoading: boolean;
  error: Error | null;
}

export function useCancelPayment(): UseCancelPaymentResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cancel = async (orderCode: string | number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await paymentService.cancelOrder(orderCode);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to cancel payment'),
      );
      setIsLoading(false);
      return false;
    }
  };

  return { cancel, isLoading, error };
}