/**
 * PhasedReport helpers — shared overdue / status derivation used by both
 * the Lecturer GroupDetail timeline and the GradStudent SubmitReport /
 * StudentResearchGroups tables.
 *
 * Why this lives here (and not inlined into either page):
 * --------------------------------------------------------------
 * The BE endpoint `/api/PhasedReport/group/{groupId}` does not always
 * populate the `isOverdue` flag, and it commonly returns `status: "Pending"`
 * for milestones whose `deadlineAt` is already in the past. The Lecturer
 * GroupDetail page (`src/pages/Lecturer/GroupDetail.tsx`) compensates by
 * computing "overdue" client-side when the deadline has passed, but the
 * GradStudent-side pages (SubmitReport, StudentResearchGroups) used to
 * trust the BE payload verbatim — which caused the September 2026
 * regression where Alex's overdue milestones displayed as "Pending".
 *
 * Both sides now route through `derivePhasedReportDisplay()` so the two
 * views stay consistent: if the BE says overdue, trust it; otherwise
 * derive from `deadlineAt` ourselves.
 *
 * Pure functions, no React, no service imports — safe to use in pages,
 * hooks, and unit tests without further mocks.
 */

import type { PhasedReportStatus } from '../types/research';
import { parseApiDate } from './datetime';

/** Minimal PhasedReport shape required by the helpers in this file. The
 * real `PhasedReport` and `SubmittedPhasedReport` interfaces both
 * satisfy this — only the fields we actually inspect are required. */
export interface PhasedReportLike {
  status?: string | null;
  isOverdue?: boolean | null;
  deadlineAt?: string | null;
  submittedAt?: string | null;
}

const TERMINAL_STATUSES = new Set<string>([
  'evaluated',
  'passed',
  'approved',
  'graded',
  'complete',
  'rejected',
  'denied',
  'declined',
]);

const REJECTED_STATUSES = new Set<string>(['rejected', 'denied', 'declined']);

const toLower = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.toLowerCase().trim() : '';

/**
 * Returns true when the supplied status (canonical or BE-vendor string)
 * represents a terminal "won't change" state — i.e. the row is evaluated
 * or rejected and is no longer actionable. Used to decide whether
 * client-side overdue derivation is even relevant.
 */
export const isPhasedReportTerminal = (
  status: string | null | undefined,
): boolean => TERMINAL_STATUSES.has(toLower(status));

/**
 * Returns true when the supplied status represents a rejected row, in
 * either its canonical (`REJECTED`) or vendor (`Rejected`/`Denied`)
 * casing.
 */
export const isPhasedReportRejected = (
  status: string | null | undefined,
): boolean => REJECTED_STATUSES.has(toLower(status));

/**
 * Compute the deadline-as-Date for a report, returning `null` when the
 * BE didn't send one or the string is unparseable.
 */
export const getPhasedReportDeadlineDate = (
  report: PhasedReportLike,
): Date | null => parseApiDate(report.deadlineAt ?? null);

/**
 * Derive the user-facing overdue flag for a PhasedReport row.
 *
 * Priority (highest first):
 *   1. BE-provided `isOverdue` when explicitly true.
 *   2. Already-submitted past the deadline (the submission itself was
 *      late) — this matches the Lecturer GroupDetail timeline semantics.
 *   3. Deadline has passed and the row is not yet submitted AND the
 *      status is not a terminal one (evaluated/rejected). This is the
 *      September 2026 bug fix — without it, Alex's past-deadline
 *      milestones displayed as "Pending" forever.
 *
 * Returns `false` (not `undefined`) when nothing indicates overdue so
 * callers can use the result directly in a ternary without re-checking
 * for nullish.
 */
export const derivePhasedReportOverdue = (
  report: PhasedReportLike,
  now: Date = new Date(),
): boolean => {
  if (report.isOverdue === true) return true;
  const deadline = getPhasedReportDeadlineDate(report);
  const submittedAt = parseApiDate(report.submittedAt ?? null);

  // Late submission: submitted AFTER the deadline.
  if (
    submittedAt &&
    deadline &&
    submittedAt.getTime() > deadline.getTime()
  ) {
    return true;
  }

  // Past-deadline, not yet submitted, not in a terminal state.
  if (deadline && !submittedAt && !isPhasedReportTerminal(report.status)) {
    return deadline.getTime() < now.getTime();
  }

  return false;
};

/**
 * Compute the user-facing status badge text for a PhasedReport row.
 *
 * The BE returns `status: "Pending"` for milestones that have been
 * configured but whose deadline has already passed without a submission.
 * The Lecturer GroupDetail page (and the user-visible contract) treats
 * those rows as overdue, not pending — so we re-derive the badge label
 * here instead of trusting `getStatusBadge()` to fall through to its
 * default.
 *
 * Returns one of: `'Overdue'`, `'Submitted'`, `'Passed'`, `'Rejected'`,
 * `'Pending'`. The caller is responsible for translating to the active
 * UI locale.
 */
export const derivePhasedReportBadge = (
  report: PhasedReportLike,
  now: Date = new Date(),
): 'Overdue' | 'Submitted' | 'Passed' | 'Rejected' | 'Pending' => {
  const status = toLower(report.status);
  if (status === 'rejected' || status === 'denied' || status === 'declined') {
    return 'Rejected';
  }
  if (
    status === 'evaluated' ||
    status === 'passed' ||
    status === 'approved' ||
    status === 'graded' ||
    status === 'complete'
  ) {
    return 'Passed';
  }
  // Bug fix (September 2026): the `/api/PhasedReport/submit` BE endpoint
  // auto-assigns timeliness states `OnTime` or `Overdue` based on the
  // configured `deadlineAt` (see swagger §
  // "Trưởng nhóm (Leader) nộp bài báo cáo vào giai đoạn Phase Report
  // (Tự động kiểm tra Deadline & gán trạng thái OnTime / Overdue)").
  // Previously this helper only recognised `submitted` / `pending_review`
  // as the "submitted" sentinel, so a freshly submitted milestone came
  // back as `status: 'OnTime'` from `/api/PhasedReport/group/{groupId}`
  // and the badge logic fell through to `Pending` — which the StatusBadge
  // then rendered as the grey "WAITING" pill. The lecturer-side
  // `researchStatus.ts` already maps `OnTime → submitted` for the
  // milestone summary count; this helper now does the same for the
  // row-level badge so the graduate student sees the yellow "Submitted"
  // pill after a successful upload.
  //
  // Distinguishing the two timeliness variants:
  //   - `OnTime`             → submitted before the deadline  → "Submitted".
  //   - `Overdue` + submittedAt → submitted after the deadline   → "Submitted"
  //                              (still considered submitted, the late flag
  //                              is informational only).
  //   - `Overdue` + no submission → past-deadline, not yet submitted
  //                                 → falls through to the Overdue/Pending
  //                                 branches below (unchanged behaviour).
  if (status === 'submitted' || status === 'pending_review' || status === 'ontime') {
    return 'Submitted';
  }
  if (
    status === 'overdue' &&
    typeof report.submittedAt === 'string' &&
    report.submittedAt.length > 0
  ) {
    return 'Submitted';
  }
  if (derivePhasedReportOverdue(report, now)) {
    return 'Overdue';
  }
  return 'Pending';
};

/**
 * Convenience helper that bundles both the overdue flag and the badge
 * label for a single PhasedReport row. Use this everywhere a page
 * renders the milestone table — it guarantees the Lecturer and
 * GradStudent sides agree on the row state.
 */
export interface PhasedReportDisplay {
  overdue: boolean;
  badge: 'Overdue' | 'Submitted' | 'Passed' | 'Rejected' | 'Pending';
}

export const derivePhasedReportDisplay = (
  report: PhasedReportLike,
  now: Date = new Date(),
): PhasedReportDisplay => {
  const overdue = derivePhasedReportOverdue(report, now);
  const badge = (() => {
    if (overdue) {
      // Don't override a Submitted/Passed/Rejected row with Overdue just
      // because of a stale BE payload — only flip a still-pending row.
      const status = toLower(report.status);
      const isSubmittedLike =
        status === 'submitted' ||
        status === 'pending_review' ||
        status === 'ontime' ||
        (status === 'overdue' &&
          typeof report.submittedAt === 'string' &&
          report.submittedAt.length > 0);
      if (
        isSubmittedLike ||
        status === 'evaluated' ||
        status === 'passed' ||
        status === 'approved' ||
        status === 'graded' ||
        status === 'complete' ||
        status === 'rejected' ||
        status === 'denied' ||
        status === 'declined'
      ) {
        return derivePhasedReportBadge(report, now);
      }
      return 'Overdue' as const;
    }
    return derivePhasedReportBadge(report, now);
  })();
  return { overdue, badge };
};

// Re-export the canonical PhasedReportStatus for downstream consumers
// that import this module as their single source of truth.
export type { PhasedReportStatus };