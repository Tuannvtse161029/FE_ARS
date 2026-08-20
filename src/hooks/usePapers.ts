import { useCallback, useEffect, useRef, useState } from 'react';
import { paperService, type Paper } from '../services/paper.service';
import type { PagedResult } from '../types/api';
import { isPaperOwnedBy } from '../utils/researcherOwnership';
import { useAuthenticatedResearcher } from './useAuthenticatedResearcher';

interface UsePapersResult {
  papers: Paper[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  /**
   * `true` when the BE returned at least one record that does NOT belong
   * to the authenticated researcher. UI surfaces should render a security
   * warning AND create a BTR — frontend filtering alone is not a fix.
   */
  detectedCrossAccountLeak: boolean;
}

/**
 * usePapers
 *
 * Loads the authenticated researcher's papers via the BE's
 * `GET /api/paper` endpoint and applies a defense-in-depth ownership
 * filter on the response.
 *
 * The BE is expected to enforce ownership via JWT and return only the
 * researcher's records. The frontend filter exists because the BE
 * currently returns ALL papers (per the data-isolation defect observed
 * on 2026-08-19). Until BE-side enforcement ships, the FE strips any
 * record whose ownership field disagrees with the authenticated user.
 *
 * Cross-account behavior:
 *   - The hook tracks `currentUserId` via `useAuthenticatedResearcher`.
 *     When the identity changes (e.g. user 22 logs in after user 27), the
 *     previous list is cleared and a fresh fetch is issued.
 *   - In-flight requests for the previous user are aborted via
 *     `AbortController` so a slow request from user 27 cannot populate
 *     the UI after user 22 has logged in.
 *   - Records that fail the ownership predicate are dropped silently and
 *     counted in `detectedCrossAccountLeak` so the UI can surface a
 *     warning. NEVER echo record contents (title, abstract) to logs or
 *     telemetry.
 */
export function usePapers(params?: {
  pageNumber?: number;
  pageSize?: number;
  status?: string;
}): UsePapersResult {
  const { researcherUserId, isLoading: isAuthLoading } =
    useAuthenticatedResearcher();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [detectedCrossAccountLeak, setDetectedCrossAccountLeak] =
    useState<boolean>(false);
  // Tracks the userId at fetch-start; results from a different userId are
  // discarded so a slow response from user 27 cannot leak into user 22's
  // session.
  const requestOwnerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPapers = useCallback(async () => {
    // Cancel any in-flight request from a previous user.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Snapshot the user id this request is for; reject results that
    // belong to a different user (race-safe).
    const ownerId = researcherUserId;
    requestOwnerRef.current = ownerId;

    setIsLoading(true);
    setError(null);
    setDetectedCrossAccountLeak(false);

    // No authenticated user → nothing to fetch. Clear the list so the
    // previous user's papers do NOT remain on screen.
    if (ownerId === null) {
      setPapers([]);
      setIsLoading(false);
      return;
    }

    try {
      const result: PagedResult<Paper> = await paperService.getAll(
        {
          pageNumber: params?.pageNumber ?? 1,
          pageSize: params?.pageSize ?? 50,
          status: params?.status,
        },
        { signal: controller.signal },
      );
      // Race-safe: drop the response if the user changed mid-flight.
      if (requestOwnerRef.current !== ownerId) return;
      const raw = Array.isArray(result?.items) ? result.items : [];
      const owned: Paper[] = [];
      let leak = false;
      for (const p of raw) {
        if (isPaperOwnedBy(p, ownerId)) {
          owned.push(p);
        } else {
          leak = true;
        }
      }
      setPapers(owned);
      if (leak) {
        // Surface to console without echoing record contents. The BE
        // should not be returning cross-owner records at all.
        // eslint-disable-next-line no-console
        console.warn(
          '[papers] BE returned records that do not belong to the authenticated user; filtering them out. This is a backend security defect — create a BTR.',
        );
      }
      setDetectedCrossAccountLeak(leak);
    } catch (err) {
      if (requestOwnerRef.current !== ownerId) return;
      // Aborted requests are expected on user switch — don't surface them
      // as errors.
      if (
        err instanceof DOMException &&
        err.name === 'AbortError'
      ) {
        return;
      }
      setError(err instanceof Error ? err : new Error('Failed to load papers'));
      setPapers([]);
    } finally {
      if (requestOwnerRef.current === ownerId) {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    researcherUserId,
    params?.pageNumber,
    params?.pageSize,
    params?.status,
  ]);

  useEffect(() => {
    // Clear stale data immediately when the identity changes so user 22
    // never sees user 27's papers for a single render frame.
    setPapers([]);
    setError(null);
    setDetectedCrossAccountLeak(false);

    // Wait until the auth store has rehydrated before issuing any
    // request — otherwise we'd send an unauthenticated call.
    if (isAuthLoading) return;
    void fetchPapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researcherUserId, isAuthLoading, params?.pageNumber, params?.pageSize, params?.status]);

  // Cancel in-flight requests on unmount.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    papers,
    isLoading,
    error,
    refetch: fetchPapers,
    detectedCrossAccountLeak,
  };
}