/**
 * Lecturer Phase Reports — row-bucket classifier.
 *
 * Single source of truth for `src/pages/Lecturer/PhaseReports.tsx` so the
 * filter tabs (Awaiting / Submitted / Overdue / Overdue-awaiting /
 * Evaluated / Rejected) and the row badge agree on what bucket a given
 * PhasedReport belongs to.
 *
 * Why this lives in its own file (and not inline in the page):
 * --------------------------------------------------------------
 * The BE's `POST /api/PhasedReport/submit` endpoint auto-assigns a
 * timeliness status (`OnTime` or `Overdue`) based on `deadlineAt` — see
 * the Swagger summary "Tự động kiểm tra Deadline & gán trạng thái OnTime
 * / Overdue". A previous version of the inline classifier only matched
 * the canonical `submitted` literal, so a freshly submitted report fell
 * through to the default "awaiting" branch and the lecturer saw a grey
 * "Awaiting Submission" pill on a row the student had already uploaded.
 *
 * `src/utils/researchStatus.ts` already maps `OnTime → submitted` for the
 * milestone count summary on the lecturer dashboard. This module is the
 * row-level counterpart and keeps the same taxonomy.
 *
 * Exported as a pure function with no React dependencies, so unit tests
 * can drive every branch (incl. the OnTime/Overdue edge cases) without
 * mounting the page component.
 */
import type { PhasedReport } from '../services/phasedReport.service';

export type PhaseReportStatusFilter =
  | 'all'
  | 'awaiting'
  | 'submitted'
  | 'overdue'
  | 'overdueAwaiting'
  | 'evaluated'
  | 'rejected';

const REJECTED = new Set(['rejected', 'denied', 'declined']);
const EVALUATED = new Set([
  'evaluated',
  'passed',
  'approved',
  'graded',
  'complete',
]);
// Submitted-like timeliness states. `OnTime` and `Overdue` are the BE's
// post-submit timeliness labels; `submitted`, `submittedforreview`,
// `pending_review` cover the canonical SUBMITTED shape and its common
// BE casing variants.
const SUBMITTED = new Set([
  'submitted',
  'submittedforreview',
  'pending_review',
  'ontime',
]);

export const statusFilterOf = (
  report: PhasedReport,
  now: Date = new Date(),
): PhaseReportStatusFilter => {
  const raw = (report.status ?? '').toLowerCase().trim();
  if (REJECTED.has(raw)) return 'rejected';
  if (EVALUATED.has(raw)) return 'evaluated';

  if (SUBMITTED.has(raw)) {
    const overdue =
      report.isOverdue ??
      Boolean(
        report.submittedAt &&
          report.deadlineAt &&
          new Date(report.submittedAt) > new Date(report.deadlineAt),
      );
    return overdue ? 'overdue' : 'submitted';
  }

  // `Overdue` with a real submission timestamp is a late submission — it
  // belongs in the `overdue` bucket (the same place the SUBMITTED branch
  // would route it). Without a `submittedAt`, the BE's `Overdue` label
  // is just signalling a past-deadline milestone that hasn't been
  // submitted yet, which falls through to the deadline-aware default.
  if (
    raw === 'overdue' &&
    typeof report.submittedAt === 'string' &&
    report.submittedAt.length > 0
  ) {
    return 'overdue';
  }

  // Default: anything else counts as "awaiting submission" — the safest
  // fallback for the lecturer. Promote any past-deadline row to the
  // dedicated `overdueAwaiting` bucket so the lecturer can see and
  // extend the deadline for at-risk rows quickly.
  if (report.deadlineAt) {
    const d = new Date(report.deadlineAt);
    if (!Number.isNaN(d.getTime()) && d.getTime() < now.getTime()) {
      return 'overdueAwaiting';
    }
  }
  return 'awaiting';
};

/**
 * True when the lecturer should be allowed to push the deadline forward:
 *   - the BE flagged the report as overdue, OR
 *   - the report's status bucket is `overdue` (submitted past deadline), OR
 *   - the row bucket is `overdueAwaiting` / `awaiting` and the deadline has
 *     already passed.
 *
 * `statusFilterOf` already promotes any past-deadline row into
 * `overdueAwaiting`, so the explicit `awaiting` branch is only here as a
 * safety net in case the deadline string is malformed.
 */
export const isLecturerDeadlineOverdue = (
  report: PhasedReport,
  now: Date = new Date(),
): boolean => {
  if (report.isOverdue === true) return true;
  const filter = statusFilterOf(report, now);
  if (filter === 'overdue' || filter === 'overdueAwaiting') return true;
  if (filter !== 'awaiting') return false;
  if (!report.deadlineAt) return false;
  const d = new Date(report.deadlineAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
};

/**
 * Human-readable status label for the row badge. Matches the labels the
 * existing `PhaseReports` page used so existing screenshots / muscle
 * memory still apply.
 */
export const statusLabelOf = (
  report: PhasedReport,
): string => {
  const filter = statusFilterOf(report);
  switch (filter) {
    case 'all':
      return '—';
    case 'awaiting':
      return 'Awaiting Submission';
    case 'submitted':
      return 'Submitted On Time';
    case 'overdue':
      return 'Overdue Submitted';
    case 'overdueAwaiting':
      return 'Overdue';
    case 'evaluated':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
  }
};
