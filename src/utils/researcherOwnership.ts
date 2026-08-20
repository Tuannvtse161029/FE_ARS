// Researcher ownership predicates — defense-in-depth filtering used to
// guard the Researcher page against cross-account data leaks.
//
// The BE is the SOLE authoritative source of authorization. These
// predicates are a UI guard only; they MUST NOT replace backend-side
// JWT-derived ownership checks. See
// docs/local-only/be-requests/researcher-data-isolation-btr.md.
//
// Identity source: the authenticated `user.id` resolved by
// `useAuthenticatedResearcher`. NEVER read from a route param, a query
// string, a UI control, a hardcoded constant, a previously-logged-in
// account, or a mock profile.

import type { Paper } from '../services/paper.service';
import type { ReviewRequest } from '../services/reviewRequest.service';

/**
 * Documented ownership fields on a Paper record, ordered by specificity.
 *
 * The BE response shape is not guaranteed (Swagger marks several fields
 * optional). We accept any of:
 *   - userId   (BE `dbo.Paper.userId` per `research-workflow-contract.md`)
 *   - authorId (legacy/alias for the paper owner)
 *
 * If a record carries an ownership field that disagrees with the
 * authenticated id, it MUST be excluded — it is a backend data leak.
 */
type PaperOwnershipField = keyof Pick<Paper, 'userId' | 'authorId'>;

const PAPER_OWNERSHIP_FIELDS: readonly PaperOwnershipField[] = [
  'userId',
  'authorId',
];

function toComparableId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Returns `true` if the Paper record carries an ownership field that
 * explicitly matches `authenticatedUserId`.
 *
 * Returns `false` when:
 *   - the record has NO ownership field (data leak — do not render)
 *   - the ownership field disagrees with the authenticated user (data leak)
 *
 * Never returns `true` based on a missing or undefined ownership field.
 * A backend that omits the field for the legitimate owner is also a
 * leak — log it and create a Backend Team Request.
 */
export function isPaperOwnedBy(
  paper: Paper | null | undefined,
  authenticatedUserId: number | null,
): boolean {
  if (!paper) return false;
  if (typeof authenticatedUserId !== 'number' || authenticatedUserId <= 0) {
    // No authenticated identity — refuse to render any record.
    return false;
  }

  for (const field of PAPER_OWNERSHIP_FIELDS) {
    const rawValue = paper[field];
    if (rawValue === undefined || rawValue === null) continue;
    const candidate = toComparableId(rawValue);
    if (candidate === null) continue;
    // First available ownership field is authoritative — disagree with
    // the authenticated user means exclude.
    return candidate === authenticatedUserId;
  }

  // No ownership field present — refuse to render. This is the documented
  // behavior; flag the BE for shipping records without owner info.
  return false;
}

/**
 * Same as `isPaperOwnedBy` but resilient when the record has no
 * ownership field — useful for UI states where the BE has historically
 * omitted the field (e.g. older versions). Callers MUST NOT rely on this
 * for security; it is purely cosmetic to avoid removing rows that the
 * legacy BE happens to omit the field on.
 */
export function isPaperOwnedByOrUntagged(
  paper: Paper | null | undefined,
  authenticatedUserId: number | null,
): boolean {
  if (!paper) return false;
  if (typeof authenticatedUserId !== 'number' || authenticatedUserId <= 0) {
    return false;
  }
  for (const field of PAPER_OWNERSHIP_FIELDS) {
    const rawValue = paper[field];
    if (rawValue === undefined || rawValue === null) continue;
    const candidate = toComparableId(rawValue);
    if (candidate === null) continue;
    return candidate === authenticatedUserId;
  }
  // No ownership field at all → assume it's mine (legacy BE). Use only
  // when the surface is consumer-facing and the BE doesn't ship the
  // field consistently. UI MUST be paired with a warning banner.
  return true;
}

/**
 * ReviewRequest ownership:
 *   The Swagger schema for `/api/ReviewRequest` does NOT include a
 *   requester/researcher id field — ownership flows through `paperId`
 *   → Paper → `userId`.
 *
 * Callers must supply a set of Paper records owned by the authenticated
 * researcher. The predicate joins by `paperId` and confirms the request
 * attaches to one of those papers.
 *
 * `requesterId`, `reviewerId`, and `userId` on the request are NOT
 * ownership fields: `reviewerId` is the assigned reviewer, the others
 * are unused by the current BE.
 */
export function isReviewRequestOwnedBy(
  request: ReviewRequest | null | undefined,
  ownedPaperIds: ReadonlySet<number>,
): boolean {
  if (!request) return false;
  if (ownedPaperIds.size === 0) return false;
  const paperId = toComparableId(request.paperId);
  if (paperId === null) return false;
  return ownedPaperIds.has(paperId);
}

/**
 * Build a Set<number> from a Paper list, taking only those records
 * whose ownership field matches the authenticated user.
 *
 * Used to power `isReviewRequestOwnedBy` joins without re-implementing
 * the predicate at every call site.
 */
export function buildOwnedPaperIds(
  papers: ReadonlyArray<Paper>,
  authenticatedUserId: number | null,
): Set<number> {
  const ids = new Set<number>();
  if (typeof authenticatedUserId !== 'number' || authenticatedUserId <= 0) {
    return ids;
  }
  for (const paper of papers) {
    if (!isPaperOwnedBy(paper, authenticatedUserId)) continue;
    const numericId = toComparableId(paper.id);
    if (numericId !== null) ids.add(numericId);
  }
  return ids;
}