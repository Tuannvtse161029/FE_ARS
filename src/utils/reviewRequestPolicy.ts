// Centralized policy for Review Request lifecycle + paper-locking decisions.
//
// Source of truth: docs/local-only/review-request-status-policy.md
//
// This module is the only place in the codebase that decides whether a
// Review Request is "active" (i.e. it locks its associated paper from
// Researcher-driven deletion). Components MUST go through these helpers
// rather than comparing status strings directly — the policy table is the
// only place allowed to enumerate the BE's status vocabulary, and the
// UNKNOWN → ACTIVE default is what keeps the Reviewer's evaluation record,
// access, and payment/refund history intact.

import type { ReviewRequest } from '../services/reviewRequest.service';

// ─────────────────────────────────────────────────────────────────────────────
// Status vocabulary (mirror of §3 in the status-policy doc)
// ─────────────────────────────────────────────────────────────────────────────

// Canonical review-request status union (single source of truth across the FE).
// Any raw status string the BE may emit is normalized into one of these values
// via `normalizeReviewRequestStatus` (defined below). Downstream code MUST go
// through the normalizer rather than comparing raw `req.status` strings —
// Swagger declares `ReviewRequest.Status` as a free-form `string` with no enum
// constraint (see docs/local-only/review-request-status-policy.md §1), and the
// BE may evolve the vocabulary independently of this codebase.
export type ReviewRequestStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'UNKNOWN';

export const REVIEW_REQUEST_STATUSES: readonly ReviewRequestStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
  'UNKNOWN',
] as const;

// Status vocabulary (mirror of §3 in the status-policy doc). Centralized so the
// Researcher table, Reviewer tabs, and presentation helper never disagree.
const PENDING_VARIANTS = new Set<string>([
  'PENDING',
  'REQUESTED',
  'CREATED',
  'AWAITING',
]);

const IN_PROGRESS_VARIANTS = new Set<string>([
  'IN_PROGRESS',
  'INPROGRESS',
  'IN PROGRESS',
  'IN-PROGRESS',
  'ONGOING',
  'EVALUATING',
  'PROCESSING',
]);

const COMPLETED_VARIANTS = new Set<string>([
  'COMPLETED',
  'COMPLETE',
  'DONE',
  'REVIEWED',
  'CLOSED',
  'DELIVERED',
  'ACCEPTED',
]);

const DECLINED_VARIANTS = new Set<string>([
  'DECLINED',
  'REJECTED',
]);

const CANCELLED_VARIANTS = new Set<string>([
  'CANCELLED',
  'CANCELED',
  'EXPIRED',
  'TIMEOUT',
  'REFUNDED',
  'RETURNED',
  'WITHDRAWN',
  'FAILED',
  'ERROR',
]);

// Normalize once at the boundary; downstream comparisons are case-insensitive.
const normalizeStatus = (raw: string | null | undefined): string =>
  (raw ?? '').toString().trim().toUpperCase();

/**
 * Normalize a raw status string into the canonical `ReviewRequestStatus` union.
 *
 * - `PENDING` ↔ Pending / pending / Requested / Created / Awaiting
 * - `IN_PROGRESS` ↔ InProgress / In Progress / in-progress / Ongoing /
 *   Evaluating / Processing
 * - `COMPLETED` ↔ Completed / Complete / Done / Reviewed / Closed / Delivered /
 *   Accepted
 * - `DECLINED` ↔ Declined / Rejected
 * - `CANCELLED` ↔ Cancelled / Canceled / Expired / Timeout / Refunded /
 *   Returned / Withdrawn / Failed / Error
 * - anything else → `UNKNOWN`
 *
 * Per the policy doc §3 "Why unknown = active", `UNKNOWN` is treated as ACTIVE
 * by `isReviewRequestActive` so a brand-new status the FE hasn't seen yet
 * keeps the paper locked and the Reviewer's evaluation history intact.
 */
export function normalizeReviewRequestStatus(
  status: string | null | undefined,
): ReviewRequestStatus {
  const norm = normalizeStatus(status);
  if (!norm) return 'UNKNOWN';
  if (PENDING_VARIANTS.has(norm)) return 'PENDING';
  if (IN_PROGRESS_VARIANTS.has(norm)) return 'IN_PROGRESS';
  if (COMPLETED_VARIANTS.has(norm)) return 'COMPLETED';
  if (DECLINED_VARIANTS.has(norm)) return 'DECLINED';
  if (CANCELLED_VARIANTS.has(norm)) return 'CANCELLED';
  return 'UNKNOWN';
}

/**
 * Map a (possibly-raw) status to the Reviewer tab it belongs to.
 *
 * Centralized so the Reviewer's tab filter and count use the SAME normalizer
 * as the Researcher-side badge (defects 1A + 2A). Returns `'pending'`,
 * `'inprogress'`, or `'completed'`. `declined` and `cancelled` are not a tab
 * in the current UI but are included in the canonical enum so a future
 * terminal-tab feature does not need a new normalizer.
 */
export function getReviewRequestTab(
  status: string | null | undefined,
): 'pending' | 'inprogress' | 'completed' {
  const norm = normalizeReviewRequestStatus(status);
  if (norm === 'IN_PROGRESS') return 'inprogress';
  if (norm === 'COMPLETED') return 'completed';
  // Pending / Declined / Cancelled / Unknown all map to the Pending tab on the
  // Reviewer side — the conservative default per the policy doc (unknown is
  // treated as active / not-yet-closed).
  return 'pending';
}

// ACTIVE statuses lock the paper + the request.
const ACTIVE_STATUSES = new Set<string>([
  'PENDING',
  'INPROGRESS',
  'IN PROGRESS',
  'IN-PROGRESS',
  'ACCEPTED',
  'EVALUATING',
  'DELIVERED',
  'ONGOING',
]);

// TERMINAL statuses release the lock.
const TERMINAL_STATUSES = new Set<string>([
  'COMPLETED',
  'COMPLETE',
  'DONE',
  'REVIEWED',
  'CLOSED',
  'DECLINED',
  'REJECTED',
  'CANCELLED',
  'CANCELED',
  'EXPIRED',
  'TIMEOUT',
  'REFUNDED',
  'RETURNED',
  'WITHDRAWN',
  'FAILED',
  'ERROR',
]);

export type ReviewRequestPolicyBucket = 'ACTIVE' | 'TERMINAL' | 'UNKNOWN';

/**
 * Classifies a raw status string into ACTIVE / TERMINAL / UNKNOWN.
 *
 * - ACTIVE: status is recognized as locking the paper
 * - TERMINAL: status is recognized as releasing the lock
 * - UNKNOWN: status is not in either set; per the audit's conservative
 *   policy we treat this as ACTIVE elsewhere (see `isReviewRequestActive`)
 */
export function classifyReviewRequestStatus(
  status: string | null | undefined,
): ReviewRequestPolicyBucket {
  const norm = normalizeStatus(status);
  if (!norm) return 'UNKNOWN';
  if (ACTIVE_STATUSES.has(norm)) return 'ACTIVE';
  if (TERMINAL_STATUSES.has(norm)) return 'TERMINAL';
  return 'UNKNOWN';
}

/**
 * Returns true when the request is still locking its paper from Researcher
 * actions. UNKNOWN is treated as ACTIVE — see audit §3 "Why unknown = active".
 */
export function isReviewRequestActive(
  status: string | null | undefined,
): boolean {
  const bucket = classifyReviewRequestStatus(status);
  return bucket === 'ACTIVE' || bucket === 'UNKNOWN';
}

/**
 * Returns true when the request is in a known terminal state.
 * UNKNOWN statuses return false (they are treated as ACTIVE elsewhere).
 */
export function isReviewRequestTerminal(
  status: string | null | undefined,
): boolean {
  return classifyReviewRequestStatus(status) === 'TERMINAL';
}

/**
 * Whether the Researcher is allowed to delete this review request.
 *
 * Per the audit, the Researcher UI MUST NOT call `reviewRequestService.delete`
 * while the request is ACTIVE. We do not expose a UI delete at all today; this
 * helper exists for forward compatibility (e.g. an admin-side or post-terminal
 * cleanup flow) so the policy decision lives in one place.
 */
export function canResearcherDeleteReviewRequest(
  request: Pick<ReviewRequest, 'status'> | null | undefined,
): boolean {
  if (!request) return false;
  return isReviewRequestTerminal(request.status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paper ↔ ReviewRequest join
// ─────────────────────────────────────────────────────────────────────────────

export interface PaperReviewLock {
  paperId: string;
  isLocked: boolean;
  activeRequestCount: number;
  reviewerNames: string[];
  requestStatuses: string[];
}

/**
 * Normalize a paper id (number / string / numeric string) into a stable
 * string so the lookup `paperId ↔ reviewRequest.paperId` never misses an
 * unnormalized numeric mismatch.
 *
 * Returns null when the input is missing or unparseable.
 */
export function normalizePaperId(
  raw: string | number | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return String(raw);
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed;
}

/**
 * Normalize a review-request paper id (BE returns `number | null`) into a
 * stable string. Null is preserved so we can distinguish "no paper" from
 * "paper id = 0".
 */
export function normalizeRequestPaperId(
  raw: number | string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return String(raw);
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed;
}

/**
 * Computes the lock state of a single paper by joining against all review
 * requests the Researcher has access to.
 *
 * The lock is `true` when at least one matching request is ACTIVE or
 * UNKNOWN (per the conservative policy). Reviewer display names and
 * observed statuses are returned for the UI to surface in the lock tooltip.
 */
export function getPaperReviewLock(
  paperIdInput: string | number | null | undefined,
  requests: ReadonlyArray<ReviewRequest>,
): PaperReviewLock {
  const paperId = normalizePaperId(paperIdInput) ?? '';
  const matching = requests.filter((req) => {
    const reqPaperId = normalizeRequestPaperId(req.paperId);
    return reqPaperId !== null && reqPaperId === paperId;
  });

  const activeMatches = matching.filter((req) => isReviewRequestActive(req.status));

  const reviewerNames: string[] = [];
  const requestStatuses: string[] = [];
  for (const req of activeMatches) {
    const name = (req.reviewerName ?? '').trim();
    if (name) reviewerNames.push(name);
    const rawStatus = (req.status ?? '').toString().trim();
    if (rawStatus) requestStatuses.push(rawStatus);
  }

  return {
    paperId,
    isLocked: activeMatches.length > 0,
    activeRequestCount: activeMatches.length,
    reviewerNames,
    requestStatuses,
  };
}