import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/axios';

interface UseFetchOptions<T> {
  immediate?: boolean;
  params?: Record<string, unknown>;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseFetchReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * useFetch — minimal GET hook for the ARS FE.
 *
 * Returns `response.data` directly — our services return the payload
 * as-is (a PagedResult<T>, a T, or an array), NOT wrapped in an
 * envelope like { data: T }. Use this when you need a thin GET wrapper
 * with loading/error/refetch; for endpoints that already have a service
 * function, prefer calling the service + local useState (or wrap it
 * in useApiCall for mutations).
 */
export function useFetch<T>(
  url: string | null,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const { immediate = true, params, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(immediate && url));
  const [error, setError] = useState<Error | null>(null);

  // Stable refs for callbacks + params so we don't re-fire on every render.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const paramsRef = useRef(params);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  paramsRef.current = params;

  const fetchData = useCallback(async () => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<T>(url, { params: paramsRef.current });
      setData(response.data);
      onSuccessRef.current?.(response.data);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('An error occurred');
      setError(e);
      onErrorRef.current?.(e);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (immediate && url) {
      void fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, immediate]);

  return { data, isLoading, error, refetch: fetchData, setData };
}

export default useFetch;
