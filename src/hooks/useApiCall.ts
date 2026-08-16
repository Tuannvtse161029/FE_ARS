import { useState, useCallback } from 'react';

interface UseApiCallState<TResult> {
  data: TResult | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseApiCallReturn<TArgs, TResult> extends UseApiCallState<TResult> {
  mutate: (args: TArgs) => Promise<TResult | null>;
  reset: () => void;
}

/**
 * useApiCall — generic mutation hook for POST/PUT/DELETE calls.
 *
 * Pass a function that performs the API call; `mutate(args)` invokes
 * it and tracks loading/error/data state. Does not auto-fire.
 */
export function useApiCall<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>
): UseApiCallReturn<TArgs, TResult> {
  const [state, setState] = useState<UseApiCallState<TResult>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const mutate = useCallback(
    async (args: TArgs): Promise<TResult | null> => {
      setState({ data: null, isLoading: true, error: null });
      try {
        const result = await fn(args);
        setState({ data: result, isLoading: false, error: null });
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('An error occurred');
        setState({ data: null, isLoading: false, error: e });
        return null;
      }
    },
    // We intentionally allow the caller's `fn` to change on every render;
    // callers usually wrap it in useCallback or supply a stable ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn]
  );

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return { ...state, mutate, reset };
}

export default useApiCall;
