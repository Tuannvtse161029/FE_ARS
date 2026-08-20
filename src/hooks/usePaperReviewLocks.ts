// usePaperReviewLocks — joins the Researcher's review-request list with
// each paper's id so the FE can decide whether destructive paper actions
// are allowed.
//
// Source of truth: docs/local-only/review-request-status-policy.md §3, §5.
// Policy logic lives in `src/utils/reviewRequestPolicy.ts`; this hook is a
// React-friendly wrapper which:
//   • loads the BE review-request list (defensively, scoped to the
//     authenticated researcher via ownership join — see
//     utils/researcherOwnership.ts)
//   • re-evaluates the lock for a given paper id without re-fetching
//   • exposes a `mergePendingRequest` helper so a successful
//     `reviewRequestService.create` can immediately lock the related
//     paper without waiting for a refetch
//   • tracks loading and error state so callers can render the
//     "could not verify, refresh" state
//   • clears state on account switch so user 22 never sees user 27's
//     review requests
//   • aborts in-flight requests from a previous user

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  reviewRequestService,
  type ReviewRequest,
} from '../services/reviewRequest.service';
import { paperService, type Paper } from '../services/paper.service';
import {
  getPaperReviewLock,
  normalizePaperId,
  type PaperReviewLock,
} from '../utils/reviewRequestPolicy';
import {
  isReviewRequestOwnedBy,
  isPaperOwnedBy,
  buildOwnedPaperIds,
} from '../utils/researcherOwnership';
import { useAuthenticatedResearcher } from './useAuthenticatedResearcher';

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
  /**
   * `true` when the BE returned at least one record that does NOT belong
   * to the authenticated researcher. UI surfaces should render a security
   * warning AND create a BTR.
   */
  detectedCrossAccountLeak: boolean;
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
 *
 * Cross-account isolation:
 *   - ReviewRequest records do NOT carry an explicit ownership field.
 *     Ownership is inferred by joining each request's `paperId` against
 *     the authenticated researcher's paper set.
 *   - The hook first loads the researcher's own papers, builds an
 *     `ownedPaperIds` Set, then filters the review-request list by
 *     `isReviewRequestOwnedBy`.
 *   - If a request's `paperId` does not belong to the authenticated
 *     researcher, it is dropped and `detectedCrossAccountLeak` flips to
 *     `true`.
 */
export function usePaperReviewLocks(): UsePaperReviewLocksResult {
  const { researcherUserId, isLoading: isAuthLoading } =
    useAuthenticatedResearcher();
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [ownedPaperIds, setOwnedPaperIds] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [detectedCrossAccountLeak, setDetectedCrossAccountLeak] =
    useState<boolean>(false);

  // Race-safety: requests issued while user 27 was active must not leak
  // into user 22's session.
  const requestOwnerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const ownerId = researcherUserId;
    requestOwnerRef.current = ownerId;

    setIsLoading(true);
    setError(null);
    setDetectedCrossAccountLeak(false);

    if (ownerId === null) {
      // No authenticated user — clear all Researcher-owned state.
      setRequests([]);
      setOwnedPaperIds(new Set());
      setIsLoading(false);
      return;
    }

    try {
      // 1. Load the authenticated researcher's own papers (defensively
      //    filtered). This is the join key for review-request ownership.
      const paged = await paperService.getAll(
        { pageNumber: 1, pageSize: 200 },
        { signal: controller.signal },
      );
      if (requestOwnerRef.current !== ownerId) return;
      const rawPapers: Paper[] = Array.isArray(paged?.items) ? paged.items : [];
      const ownedPapers: Paper[] = [];
      let paperLeak = false;
      for (const p of rawPapers) {
        if (isPaperOwnedBy(p, ownerId)) {
          ownedPapers.push(p);
        } else {
          paperLeak = true;
        }
      }
      const ownedIds = buildOwnedPaperIds(ownedPapers, ownerId);

      // 2. Load the review-request list and filter by ownedPaperIds.
      const list = await reviewRequestService.getAll({
        signal: controller.signal,
      });
      if (requestOwnerRef.current !== ownerId) return;

      const rawRequests: ReviewRequest[] = Array.isArray(list) ? list : [];
      const filtered: ReviewRequest[] = [];
      let requestLeak = false;
      for (const r of rawRequests) {
        if (isReviewRequestOwnedBy(r, ownedIds)) {
          filtered.push(r);
        } else {
          requestLeak = true;
        }
      }

      setOwnedPaperIds(ownedIds);
      setRequests(filtered);
      if (paperLeak || requestLeak) {
        // eslint-disable-next-line no-console
        console.warn(
          '[paper-review-locks] BE returned records that do not belong to the authenticated researcher; filtering them out. This is a backend security defect — create a BTR.',
        );
      }
      setDetectedCrossAccountLeak(paperLeak || requestLeak);
    } catch (err) {
      if (requestOwnerRef.current !== ownerId) return;
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const e =
        err instanceof Error ? err : new Error('Failed to load review requests.');
      setError(e);
      // Conservative: do NOT clear the list. A previous successful load
      // is still authoritative until the user navigates away. New pages
      // should render the error banner and refuse destructive actions.
    } finally {
      if (requestOwnerRef.current === ownerId) {
        setIsLoading(false);
      }
    }
  }, [researcherUserId]);

  useEffect(() => {
    // Clear stale data immediately when the identity changes so user 22
    // never sees user 27's review requests for a single render frame.
    setRequests([]);
    setOwnedPaperIds(new Set());
    setError(null);
    setDetectedCrossAccountLeak(false);

    if (isAuthLoading) return;
    void refetch();
  }, [refetch, researcherUserId, isAuthLoading]);

  // Keep requests in sync across all views when a review is submitted.
  // Adding the listener inside `refetch`'s scope ensures it always uses the
  // latest `setRequests` — not the stale closure from the mount effect.
  useEffect(() => {
    const handleReviewUpdate = () => void refetch();
    window.addEventListener('review-update', handleReviewUpdate);
    return () => window.removeEventListener('review-update', handleReviewUpdate);
  }, [refetch]);

  // Cancel in-flight requests on unmount.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Defense-in-depth: refuse to inject a brand-new request whose paperId
  // is not owned by the authenticated researcher. Updates to an existing
  // request (matching `id`) are exempted because the paperId is already
  // trusted from the prior load — sparse updates from the BE may
  // legitimately omit `paperId`/`reviewerId` (defect 1B).
  const mergePendingRequest = useCallback(
    (request: ReviewRequest) => {
      if (
        typeof researcherUserId !== 'number' ||
        researcherUserId <= 0
      ) {
        return;
      }
      const isUpdate =
        request.id != null &&
        requests.some((r) => r.id === request.id);
      if (!isUpdate && !isReviewRequestOwnedBy(request, ownedPaperIds)) {
        // Refuse to merge a brand-new payload that doesn't belong to us.
        // eslint-disable-next-line no-console
        console.warn(
          '[paper-review-locks] mergePendingRequest ignored a payload whose paperId is not owned by the authenticated researcher.',
        );
        return;
      }
      setRequests((prev) => {
        const existingIndex =
          request.id != null
            ? prev.findIndex((r) => r.id === request.id)
            : -1;
        if (existingIndex >= 0) {
          const prevRow = prev[existingIndex];
          const preservedPaperId =
            request.paperId != null
              ? request.paperId
              : prevRow.paperId ?? null;
          const preservedReviewerId =
            request.reviewerId != null
              ? request.reviewerId
              : prevRow.reviewerId ?? null;
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
    },
    [ownedPaperIds, requests, researcherUserId],
  );

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
      detectedCrossAccountLeak,
    }),
    [
      getLockForPaper,
      requests,
      isLoading,
      error,
      refetch,
      mergePendingRequest,
      detectedCrossAccountLeak,
    ],
  );
}

export default usePaperReviewLocks;