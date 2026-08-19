import { useEffect, useState } from 'react';
import { walletService } from '../services/wallet.service';
import type { Wallet } from '../types/domain';

interface UseWalletResult {
  wallet: Wallet | null;
  balance: number | null;
  // The canonical wallet ID for the payment API — prefers the BE's `walletId`
  // field (if present and positive), falls back to `id`.
  walletId: number | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useWallet(userId?: number): UseWalletResult {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await walletService.getAll(userId);
      // The BE returns the user's wallet(s) — pick the first matching userId if provided.
      const match = userId !== undefined
        ? list.find((w) => w.userId === userId) ?? list[0] ?? null
        : list[0] ?? null;
      setWallet(match);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load wallet'));
      setWallet(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Normalize walletId: prefer the BE's `walletId` field, fall back to `id`.
  // Both must be positive integers — null otherwise.
  const rawId = wallet?.walletId ?? wallet?.id ?? null;
  const walletId = typeof rawId === 'number' && rawId > 0 ? rawId : null;

  return {
    wallet,
    balance: wallet?.balance ?? null,
    walletId,
    isLoading,
    error,
    refetch,
  };
}
