import { useState } from 'react';
import { paymentService } from '../services/payment.service';
import type { PaymentCreateRequest, PaymentLink } from '../types/domain';

interface UseCreatePaymentLinkResult {
  create: (req: PaymentCreateRequest) => Promise<PaymentLink | null>;
  isLoading: boolean;
  error: Error | null;
  data: PaymentLink | null;
  reset: () => void;
}

export function useCreatePaymentLink(): UseCreatePaymentLinkResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<PaymentLink | null>(null);

  const create = async (req: PaymentCreateRequest): Promise<PaymentLink | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const link = await paymentService.createLink(req);
      setData(link);
      setIsLoading(false);
      return link;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create payment link'));
      setIsLoading(false);
      return null;
    }
  };

  return { create, isLoading, error, data, reset: () => { setData(null); setError(null); } };
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
      setError(err instanceof Error ? err : new Error('Failed to cancel payment'));
      setIsLoading(false);
      return false;
    }
  };

  return { cancel, isLoading, error };
}
