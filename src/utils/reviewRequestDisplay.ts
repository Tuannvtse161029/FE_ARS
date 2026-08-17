// Centralized presentation for the Review Request status pill.
//
// This module is the ONLY place that decides how a `ReviewRequest.status` value
// is rendered in the Researcher "My Review Requests" table and any future
// Reviewer-side displays. Pages MUST go through `<ReviewRequestStatusBadge>`
// (or `getReviewRequestStatusDisplay`) — do NOT scatter lowercase string
// comparisons or duplicate the icon/color mapping.
//
// Source of truth:
//   - Canonical status union: `src/utils/reviewRequestPolicy.ts`
//     (`normalizeReviewRequestStatus`)
//   - Semantic colors per the Figma design tokens
//   - lucide-react icons only (no emoji / no inline SVG)

import {
  Ban,
  CheckCircle2,
  Circle,
  Loader,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  normalizeRequestPaperId,
  normalizeReviewRequestStatus,
} from './reviewRequestPolicy';
import type { ReviewRequest } from '../services/reviewRequest.service';
import type { Paper } from '../services/paper.service';

export type ReviewRequestStatusTone =
  | 'amber' // PENDING
  | 'blue' // IN_PROGRESS
  | 'green' // COMPLETED
  | 'red' // DECLINED
  | 'neutral'; // CANCELLED / EXPIRED / UNKNOWN

export interface ReviewRequestStatusDisplay {
  label: string;
  tone: ReviewRequestStatusTone;
  icon: LucideIcon;
  // CSS class key for the badge wrapper (one per tone). Tests assert on this
  // value rather than the rendered className so the badge is style-agnostic.
  cssClass: 'statusPending' | 'statusInProgress' | 'statusCompleted' | 'statusDeclined' | 'statusCancelled';
}

/**
 * Map a normalized status to its display shape.
 *
 * IMPORTANT: do NOT coerce unknown / empty strings into a known status here —
 * the FE policy (docs/local-only/review-request-status-policy.md §3) treats
 * UNKNOWN as ACTIVE for paper locking. For presentation purposes UNKNOWN is
 * surfaced as PENDING-tone (amber) so it remains visible to the user without
 * claiming completion. Only `COMPLETED` is allowed to wear the green pill.
 */
export function getReviewRequestStatusDisplay(
  status: string | null | undefined,
): ReviewRequestStatusDisplay {
  // Re-normalize here so callers can pass raw BE strings without first calling
  // `normalizeReviewRequestStatus` themselves.
  const norm = normalizeReviewRequestStatus(status);
  switch (norm) {
    case 'COMPLETED':
      return {
        label: 'Completed',
        tone: 'green',
        icon: CheckCircle2,
        cssClass: 'statusCompleted',
      };
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        tone: 'blue',
        icon: Loader,
        cssClass: 'statusInProgress',
      };
    case 'DECLINED':
      return {
        label: 'Declined',
        tone: 'red',
        icon: XCircle,
        cssClass: 'statusDeclined',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        tone: 'neutral',
        icon: Ban,
        cssClass: 'statusCancelled',
      };
    case 'PENDING':
    case 'UNKNOWN':
    default:
      return {
        label: 'Pending',
        tone: 'amber',
        icon: Circle,
        cssClass: 'statusPending',
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Progressive paper-title hydration (defect 1B)
// ─────────────────────────────────────────────────────────────────────────────
//
// The My Review Requests table needs to render a paper title per row. Three
// problems exist in production:
//
//   1. `paperService.getAll()` is paginated. A completed row whose paper lives
//      on a later page is missing from the in-memory `papers` list.
//   2. Swagger declares `GET /api/ReviewRequest` as "200: OK" with no schema,
//      so the joined `paperTitle` field is unreliable.
//   3. `Paper.id` is `string` but `ReviewRequest.paperId` is `number` — naive
//      `Map` lookups miss unless the keys are normalized.
//
// The helper below resolves a row's paper title in three stages, returning a
// tagged union so the UI can render truthful progressive states:
//
//   - `kind: 'loading'`  → fetch in flight, render "Loading manuscript…"
//   - `kind: 'id'`       → we know the id but no title yet, render "Paper #123"
//   - `kind: 'title'`    → resolved, render the title
//   - `kind: 'unknown'`  → no id, no joined title, render "Details unavailable"
//
// The helper NEVER fabricates a title. If the BE permanently omits the join,
// the consumer MUST escalate the gap (see docs/local-only/backend-gap-request-review-request-joins.md).
export type PaperTitleResolution =
  | { kind: 'loading'; paperId: string }
  | { kind: 'id'; paperId: string }
  | { kind: 'title'; paperId: string; title: string; paper: Paper }
  | { kind: 'unknown' };

export interface ResolvePaperTitleInput {
  /** The review request row (used for `paperTitle` joined display field).
   *  `paperId` is optional on `ReviewRequest` — we accept a `Partial<>` so
   *  callers can pass any row shape without TypeScript narrowing issues. */
  req: Pick<Partial<ReviewRequest>, 'paperId' | 'paperTitle'>;
  /** Page-level papers already fetched (keyed by their string id). */
  papersById: ReadonlyMap<string, Paper>;
  /** Extra papers fetched out-of-band via `getById` (defect 1B — historical). */
  extraPapersById?: ReadonlyMap<string, Paper>;
}

/**
 * Resolve the paper title for a row. Pure / synchronous — caller is responsible
 * for triggering an out-of-band `paperService.getById(...)` when the result is
 * `kind: 'id'`.
 */
export function resolvePaperTitle(input: ResolvePaperTitleInput): PaperTitleResolution {
  const { req, papersById, extraPapersById } = input;

  // Stage 1: inline join from the BE.
  if (req.paperTitle && req.paperTitle.trim()) {
    // We don't have the full Paper row, but the joined title is enough to
    // satisfy the UI. Return as 'title' with a synthetic Paper stub so the
    // downstream `paper` consumer doesn't crash if it tries to read fileUrl.
    const paperId = normalizeRequestPaperId(req.paperId) ?? '';
    return {
      kind: 'title',
      paperId,
      title: req.paperTitle.trim(),
      paper: {
        id: paperId,
        title: req.paperTitle.trim(),
        status: '',
      },
    };
  }

  const paperId = normalizeRequestPaperId(req.paperId);
  if (!paperId) {
    return { kind: 'unknown' };
  }

  // Stage 2: paginated list cache.
  const inPage = papersById.get(paperId);
  if (inPage) {
    return {
      kind: 'title',
      paperId,
      title: inPage.title || `Paper #${paperId}`,
      paper: inPage,
    };
  }

  // Stage 3: out-of-band cache (caller populated via paperService.getById).
  const extra = extraPapersById?.get(paperId);
  if (extra) {
    return {
      kind: 'title',
      paperId,
      title: extra.title || `Paper #${paperId}`,
      paper: extra,
    };
  }

  // Title unknown at the time of this synchronous call. Caller should fire
  // paperService.getById(String(paperId)) to hydrate stage 3.
  return { kind: 'id', paperId };
}

/**
 * Compare two paper-id-shaped values (number, numeric string, string) for
 * equality in a type-stable way. Defect 1B item 1 — the page list keys papers
 * by string but ReviewRequest.paperId is `number`, so `===` misses.
 */
export function samePaperId(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  const na = normalizeRequestPaperId(a);
  const nb = normalizeRequestPaperId(b);
  if (na === null || nb === null) return false;
  return na === nb;
}