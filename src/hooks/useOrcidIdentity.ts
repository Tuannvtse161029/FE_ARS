import { useCallback, useEffect, useState } from 'react';
import api from '../services/axios';
import { API_ENDPOINTS } from '../utils/constants';

/**
 * Authoritative ORCID linkage state for the authenticated ARS user.
 * The browser never receives or persists OAuth credentials, codes, or tokens.
 */
export interface OrcidIdentityStatus {
  userId: number;
  isConnected: boolean;
  isVerified: boolean;
  orcidId: string | null;
  verifiedAt: string | null;
  canConnect: boolean;
}

const parseStatus = (value: unknown): OrcidIdentityStatus => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    userId: typeof source.userId === 'number' ? source.userId : 0,
    isConnected: source.isConnected === true,
    isVerified: source.isVerified === true,
    orcidId: typeof source.orcidId === 'string' && source.orcidId.trim() ? source.orcidId : null,
    verifiedAt: typeof source.verifiedAt === 'string' ? source.verifiedAt : null,
    canConnect: source.canConnect === true,
  };
};

export const useOrcidIdentity = (enabled = true) => {
  const [status, setStatus] = useState<OrcidIdentityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return null;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.ORCID_STATUS);
      const next = parseStatus(response.data);
      setStatus(next);
      return next;
    } catch (cause: unknown) {
      const nextError = cause instanceof Error ? cause : new Error('Unable to refresh ORCID connection status.');
      setError(nextError);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { status, isLoading, error, refetch };
};
