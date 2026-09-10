/**
 * Admin hook for the "Subscribers" modal on the Annual Fees page.
 *
 * Wraps `annualFeeService.listAnnualFeePlanSubscribers`:
 *   `GET /api/AnnualFees/{planId}/subscribers`
 *
 * Returns paginated subscriber rows (username, expiresAt, userRole, etc.).
 */

import { useCallback, useEffect, useState } from 'react';
import { annualFeeService } from '../services/annualFee.service';
import type {
  AnnualFeeSubscriber,
  AnnualFeeSubscriberListResult,
} from '../types/annualFee';

export interface UseAnnualFeeSubscribersResult {
  items: AnnualFeeSubscriber[];
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface UseAnnualFeeSubscribersArgs {
  planId: number | null;
  /** When false the hook is dormant — useful while the modal is closed. */
  enabled: boolean;
}

export const useAnnualFeeSubscribers = ({
  planId,
  enabled,
}: UseAnnualFeeSubscribersArgs): UseAnnualFeeSubscribersResult => {
  const [data, setData] = useState<AnnualFeeSubscriberListResult>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bump to force a refetch from outside (e.g. retry button).
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!enabled || planId == null) {
      setData({ items: [], total: 0, page: 1, pageSize: 0 });
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void annualFeeService
      .listAnnualFeePlanSubscribers(planId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : 'Failed to load subscribers',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, planId, reloadToken]);

  return {
    items: data.items,
    total: data.total,
    loading,
    error,
    reload,
  };
};

export default useAnnualFeeSubscribers;
