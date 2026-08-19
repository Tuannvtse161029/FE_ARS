// usePaperReviewLocks — joins the Researcher's review-request list with
// each paper's id so the FE can decide whether destructive paper actions
// are allowed.
//
// Source of truth: docs/local-only/review-request-status-policy.md §3, §5.
// Policy logic lives in `src/utils/reviewRequestPolicy.ts`; this hook is a
// React-friendly wrapper which:
//   • loads the BE review-request list once (defensively)
//   • re-evaluates the lock for a given paper id without re-fetching
//   • exposes a `markPaperLocked(paperId)` helper so a successful
//     `reviewRequestService.create` can immediately lock the related
//     paper without waiting for a refetch
//   • tracks loading and error state so callers can render the
//     "could not verify, refresh" state

import { useCallback, useEffect, useMemo, useState } from 'react';
import { reviewRequestService, type ReviewRequest } from '../services/reviewRequest.service';
import {
  getPaperReviewLock,
  normalizePaperId,
  type PaperReviewLock,
} from '../utils/reviewRequestPolicy';

interface UsePaperReviewLocksResult {
  // Per-paper lookup (memoized for the current papers list).
  getLockForPaper: (paperId: string | number | null | undefined) => PaperReviewLock;
  // Underlying state (exposed for surfaces that want a table-style view).
  requests: ReadonlyArray<ReviewRequest>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  // Optimistic mutation — used by the Researcher UI immediately after a
  // successful `reviewRequestService.create` so the related paper is
  // locked in the FE before the BE roundtrip resolves.
  mergePendingRequest: (request: ReviewRequest) => void;
}

/**
 * Default hook: loads the Researcher's review requests once on mount and
 * exposes a memoized `getLockForPaper` helper.
 *
 * The hook never silently assumes "no active request" — when the BE call
 * is in flight, the lock is conservatively `false` until the request list
 * resolves; if the BE call errors, `error` is set so the caller can render
 * the "could not verify" state. Per §6 of the audit, callers MUST NOT
 * enable destructive buttons during the loading phase.
 */
export function usePaperReviewLocks(): UsePaperReviewLocksResult {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await reviewRequestService.getAll();
      setRequests(Array.isArray(list) ? list : []);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to load review requests.');
      setError(e);
      // Conservative: do NOT clear the list. A previous successful load
      // is still authoritative until the user navigates away. New pages
      // should render the error banner and refuse destructive actions.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Keep requests in sync across all views when a review is submitted.
  // Adding the listener inside `refetch`'s scope ensures it always uses the
  // latest `setRequests` — not the stale closure from the mount effect.
  useEffect(() => {
    const handleReviewUpdate = () => void refetch();
    window.addEventListener('review-update', handleReviewUpdate);
    return () => window.removeEventListener('review-update', handleReviewUpdate);
  }, [refetch]);

  // Optimistic merge — used by DiscoverReviewers after a successful
  // submission. We trust the caller's payload because the BE has already
  // persisted the row by the time we reach this codepath.
  //
  // Defect 1B (sparse update overwrites IDs): the BE `PUT /api/ReviewRequest/{id}`
  // response is documented as "200: OK" with no schema, so a partial update
  // (e.g. `{ status: 'Completed' }`) may echo back with `paperId` /
  // `reviewerId` omitted or null. Naive spread-merging would erase the
  // researcher-side display fields. We therefore preserve non-null IDs from
  // the cached row whenever the incoming payload omits them.
  const mergePendingRequest = useCallback((request: ReviewRequest) => {
    setRequests((prev) => {
      const existingIndex = request.id != null
        ? prev.findIndex((r) => r.id === request.id)
        : -1;
      if (existingIndex >= 0) {
        const prevRow = prev[existingIndex];
        const preservedPaperId =
          request.paperId != null ? request.paperId : prevRow.paperId ?? null;
        const preservedReviewerId =
          request.reviewerId != null ? request.reviewerId : prevRow.reviewerId ?? null;
        const next = prev.slice();
        next[existingIndex] = {
          ...prevRow,
          ...request,
          paperId: preservedPaperId,
          reviewerId: preservedReviewerId,
        };
        return next;
      }
      return [...prev, request];
    });
  }, []);

  const getLockForPaper = useCallback(
    (paperId: string | number | null | undefined): PaperReviewLock => {
      const norm = normalizePaperId(paperId);
      if (!norm) {
        return {
          paperId: '',
          isLocked: false,
          activeRequestCount: 0,
          reviewerNames: [],
          requestStatuses: [],
        };
      }
      return getPaperReviewLock(norm, requests);
    },
    [requests],
  );

  return useMemo(
    () => ({
      getLockForPaper,
      requests,
      isLoading,
      error,
      refetch,
      mergePendingRequest,
    }),
    [getLockForPaper, requests, isLoading, error, refetch, mergePendingRequest],
  );
}

export default usePaperReviewLocks;