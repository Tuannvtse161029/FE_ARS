// Returns the first completed ReviewRequest for a given paperId.
//
// The ScorecardModal needs a `reviewRequest` to fetch the evaluation.  The
// Researcher paper-list page knows the paper but not which review request
// belongs to it.  This hook bridges that gap by joining against the requests
// that `usePaperReviewLocks` already fetches.

import { useMemo } from 'react';
import type { ReviewRequest } from '../services/reviewRequest.service';
import { normalizeReviewRequestStatus } from '../utils/reviewRequestPolicy';

export function useCompletedReviewRequestForPaper(
  paperId: string | null | undefined,
  requests: ReadonlyArray<ReviewRequest>,
): ReviewRequest | null {
  return useMemo(() => {
    if (!paperId) return null;
    return (
      requests.find((req) => {
        if (req.paperId == null) return false;
        // Match by normalized string equality (handles number vs string mismatch).
        if (String(req.paperId) !== String(paperId)) return false;
        return normalizeReviewRequestStatus(req.status) === 'COMPLETED';
      }) ?? null
    );
  }, [paperId, requests]);
}
