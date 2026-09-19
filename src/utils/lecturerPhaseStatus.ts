/**
 * Lecturer Phase Reports — canonical status classifier.
 *
 * Single source of truth for:
 *   - `src/pages/Lecturer/PhaseReports.tsx`
 *   - `src/pages/Lecturer/GroupDetail.tsx`
 *   - `src/features/guidance/components/GroupPhases.tsx`
 *
 * The BE returns free-form status strings; this module normalises them into
 * six mutually-exclusive buckets and provides derived helpers (filter mapping,
 * overdue detection, human-readable labels).
 *
 * Taxonomy (precedence order):
 *   Tier 1  Evaluated  — 'evaluated' | 'passed' | 'approved' | 'graded' | 'complete'
 *   Tier 2  Rejected   — 'rejected' | 'denied' | 'declined'
 *   Tier 3  Submitted  — any real submission signal (truthy submittedAt OR
 *                        canonical submitted-like status), with late-submission
 *                        sub-classification based on submittedAt vs deadlineAt.
 *   Tier 4  Overdue    — no submission + deadline in the past
 *   Tier 5  Awaiting   — default for everything else
 */

import type { PhasedReport } from '../services/phasedReport.service';

// ─── Public types ──────────────────────────────────────────────────────────────

/** The six canonical classification buckets surfaced to the lecturer UI. */
export type PhaseReportStatus =
  | 'evaluated'
  | 'rejected'
  | 'submitted'
  | 'submitted-late'
  | 'overdue'
  | 'awaiting-submission';

/** Result returned by `classifyPhaseReportStatus`. */
export interface PhaseReportClassification {
  status: PhaseReportStatus;
  isSubmitted: boolean;
  isOverdue: boolean;
  isEvaluated: boolean;
  isRejected: boolean;
  isLateSubmission?: boolean;
  submittedAt?: string;
}

/** Filter keys consumed by `filterByPhaseReportStatus` and the tab bar. */
export type PhaseReportStatusFilter =
  | 'all'
  | 'awaiting-submission'
  | 'submitted'
  | 'overdue'
  | 'evaluated'
  | 'rejected';

// ─── Tier sets ───────────────────────────────────────────────────────────────

const EVALUATED_KEYS = new Set([
  'evaluated', 'passed', 'approved', 'graded', 'complete',
]);

const REJECTED_KEYS = new Set([
  'rejected', 'denied', 'declined',
]);

// Status values that ARE themselves a submission signal, even without a
// submittedAt timestamp.  'ontime' is included because the BE sets it
// as the post-submit timeliness label before the deadline passes.
const SUBMITTED_SIGNALS = new Set([
  'submitted', 'submittedforreview', 'pending_review', 'ontime', 'overdue',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safe Date coercion; returns NaN on failure. */
const toMs = (v: unknown): number => {
  if (typeof v !== 'string') return NaN;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? NaN : d.getTime();
};

// ─── Core classifier ─────────────────────────────────────────────────────────

/**
 * Classify a single PhasedReport into one of six canonical buckets.
 *
 * Accepts `Partial<PhasedReport> | null | undefined` for defensive use at
 * call sites that may pass incomplete data.
 */
export const classifyPhaseReportStatus = (
  report: Partial<PhasedReport> | null | undefined,
  now: Date = new Date(),
): PhaseReportClassification => {
  // Defensive: treat null / undefined / missing status as awaiting
  if (!report) {
    return {
      status: 'awaiting-submission',
      isSubmitted: false,
      isOverdue: false,
      isEvaluated: false,
      isRejected: false,
    };
  }

  const raw = (report.status ?? '').toLowerCase().trim();
  const submittedAt = report.submittedAt;
  const deadlineAt = report.deadlineAt;
  const hasRealSubmission = Boolean(submittedAt);
  const submittedAtMs = toMs(submittedAt);
  const deadlineMs = toMs(deadlineAt);

  // ── Tier 1: Evaluated ─────────────────────────────────────────────────────
  if (EVALUATED_KEYS.has(raw)) {
    return {
      status: 'evaluated',
      isSubmitted: false,
      isOverdue: false,
      isEvaluated: true,
      isRejected: false,
      ...(typeof submittedAt === 'string' ? { submittedAt } : {}),
    };
  }

  // ── Tier 2: Rejected ──────────────────────────────────────────────────────
  if (REJECTED_KEYS.has(raw)) {
    return {
      status: 'rejected',
      isSubmitted: false,
      isOverdue: false,
      isEvaluated: false,
      isRejected: true,
    };
  }

  // ── Tier 3: Real submission ───────────────────────────────────────────────
  // A "real" submission exists when:
  //   (a) submittedAt is truthy (most reliable signal), OR
  //   (b) the status string is a known submission label OTHER THAN 'overdue'.
  //      ('overdue' is the BE's post-submit timeliness label; it only counts
  //      as a submission when submittedAt is also present. Without submittedAt,
  //      the BE's 'overdue' is an explicit deadline-passed signal → Tier 4.)
  const tier3 =
    hasRealSubmission ||
    (raw !== 'overdue' && SUBMITTED_SIGNALS.has(raw));

  if (tier3) {
    // Determine lateness only when both timestamps are valid ISO strings.
    // If we cannot compare, default to on-time.
    let isLate = false;
    if (
      typeof submittedAt === 'string' &&
      submittedAt.trim() !== '' &&
      typeof deadlineAt === 'string' &&
      deadlineAt.trim() !== ''
    ) {
      const sMs = toMs(submittedAt);
      const dMs = toMs(deadlineAt);
      if (Number.isFinite(sMs) && Number.isFinite(dMs)) {
        isLate = sMs > dMs;
      }
    }
    return {
      status: isLate ? 'submitted-late' : 'submitted',
      isSubmitted: true,
      isOverdue: false,
      isEvaluated: false,
      isRejected: false,
      isLateSubmission: isLate,
      ...(typeof submittedAt === 'string' ? { submittedAt } : {}),
    };
  }

  // ── Tier 4: Overdue ──────────────────────────────────────────────────────
  // Two paths converge here:
  //   (a) BE explicitly labelled this report 'overdue' (deadline passed, no
  //       submission yet). This is the primary signal — use it directly.
  //   (b) No explicit label but Tier 3/Tier 1/Tier 2 didn't match, and the
  //       deadline is a valid ISO string that has already passed.
  if (
    raw === 'overdue' ||
    (!hasRealSubmission &&
      Number.isFinite(deadlineMs) &&
      deadlineMs < now.getTime())
  ) {
    return {
      status: 'overdue',
      isSubmitted: false,
      isOverdue: true,
      isEvaluated: false,
      isRejected: false,
    };
  }

  // ── Tier 5: Default → awaiting-submission ─────────────────────────────────
  return {
    status: 'awaiting-submission',
    isSubmitted: false,
    isOverdue: false,
    isEvaluated: false,
    isRejected: false,
  };
};

// ─── Filter mapping ───────────────────────────────────────────────────────────

/**
 * Map a classifier result to a PhaseReportStatusFilter value.
 * Both 'submitted' and 'submitted-late' map to 'submitted' (same tab).
 */
export const classifyPhaseReportStatusToFilter = (
  cls: PhaseReportClassification,
): PhaseReportStatusFilter => {
  switch (cls.status) {
    case 'evaluated':          return 'evaluated';
    case 'rejected':           return 'rejected';
    case 'submitted':
    case 'submitted-late':      return 'submitted';
    case 'overdue':            return 'overdue';
    case 'awaiting-submission': return 'awaiting-submission';
  }
};

// ─── Bulk filter ─────────────────────────────────────────────────────────────

/**
 * Filter an array of PhasedReport by a PhaseReportStatusFilter value.
 * Pass 'all' to return the full array.
 */
export const filterByPhaseReportStatus = (
  reports: readonly PhasedReport[],
  filter: PhaseReportStatusFilter | 'all',
  now: Date = new Date(),
): PhasedReport[] => {
  if (filter === 'all') return [...reports];
  return reports.filter(
    (r) => {
      const cls = classifyPhaseReportStatus(r, now);
      return classifyPhaseReportStatusToFilter(cls) === filter;
    },
  );
};

// ─── Deadline-overdue helper ──────────────────────────────────────────────────

/**
 * True when the lecturer should be allowed to extend the deadline.
 *
 * Returns true for:
 *   - classifier status 'overdue' (no submission + deadline passed)
 *   - classifier status 'awaiting-submission' with a valid past deadline
 *   - report.isOverdue === true (defensive BE echo)
 */
export const isLecturerDeadlineOverdue = (
  report: Partial<PhasedReport> | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!report) return false;

  if (report.isOverdue === true) return true;

  const cls = classifyPhaseReportStatus(report, now);

  if (cls.status === 'overdue') return true;
  if (cls.status === 'awaiting-submission') {
    const dMs = toMs(report.deadlineAt);
    if (Number.isFinite(dMs) && dMs < now.getTime()) return true;
  }
  return false;
};

// ─── Human-readable label ────────────────────────────────────────────────────

const STATUS_LABELS: Record<PhaseReportStatus, string> = {
  'evaluated':         'Accepted',
  'rejected':          'Rejected',
  'submitted':         'Submitted On Time',
  'submitted-late':    'Submitted Late',
  'overdue':           'Overdue',
  'awaiting-submission': 'Awaiting Submission',
};

/**
 * Human-readable label for a PhasedReport.
 * Defensive on null / undefined inputs (returns 'Awaiting Submission').
 */
export const statusLabelOf = (
  report: Partial<PhasedReport> | null | undefined,
  now: Date = new Date(),
): string => {
  if (!report) return 'Awaiting Submission';
  const cls = classifyPhaseReportStatus(report, now);
  return STATUS_LABELS[cls.status] ?? 'Awaiting Submission';
};

// ─── Legacy API (kept for backward compatibility with pre-W4 callers) ──────────
//
// The legacy filter union distinguished a "submitted-late-but-no-file" row from
// a "deadline-passed-no-submission" row (the latter was called `overdueAwaiting`).
// W4 collapsed these into the new `PhaseReportStatusFilter` union (which no longer
// has `overdueAwaiting`) and the `PhaseReports.tsx` tab bar migrated accordingly.
// These exports preserve the **old** shape so external tests pinning the legacy
// contract (e.g. `tests/unit/pages/Lecturer/PhaseReports.statusFilter.test.tsx`)
// continue to pass without forcing a rewrite of those expectations.

/** Legacy filter union — same shape as the pre-W4 `PhaseReportStatusFilter`. */
export type LegacyPhaseReportStatusFilter =
  | 'awaiting'
  | 'submitted'
  | 'overdue'
  | 'overdueAwaiting'
  | 'evaluated'
  | 'rejected';

/**
 * Legacy row-bucket classifier. Mirrors the pre-W4 contract:
 *   - 'submitted'      — has a real submission (on time or late)
 *   - 'overdue'        — submitted but past deadline
 *   - 'overdueAwaiting'— BE labelled `Overdue` with no submittedAt (deadline passed)
 *   - 'awaiting'       — unsubmitted, deadline in the future (or no deadline)
 *   - 'evaluated' / 'rejected' — terminal states
 *
 * The `Overdue` + no-submission case is split out before delegating to the new
 * classifier because the new classifier collapses it into the regular 'overdue'
 * bucket. The legacy semantics preserved here distinguish those two states.
 */
export const statusFilterOf = (
  report: Partial<PhasedReport> | null | undefined,
  now: Date = new Date(),
): LegacyPhaseReportStatusFilter => {
  if (!report) return 'awaiting';

  const raw = (report.status ?? '').toLowerCase().trim();
  const submittedAt = report.submittedAt;

  // Legacy special-case: BE labelled `Overdue` with no submission yet.
  // In the pre-W4 taxonomy this surfaced as `overdueAwaiting` so the lecturer
  // list could keep the row in the "needs submission" bucket despite the
  // BE's timeliness label.
  if (raw === 'overdue' && !submittedAt) {
    return 'overdueAwaiting';
  }

  const cls = classifyPhaseReportStatus(report, now);

  switch (cls.status) {
    case 'evaluated':           return 'evaluated';
    case 'rejected':            return 'rejected';
    case 'submitted':
    case 'submitted-late':
      // Legacy semantics: a late submission (submittedAt > deadlineAt) was
      // always promoted to the `overdue` bucket regardless of the BE's
      // post-submit timeliness label. The new classifier splits it into
      // `submitted-late`; the wrapper collapses it back to `overdue` so the
      // existing test contract is preserved.
      if (cls.isLateSubmission === true) return 'overdue';
      return 'submitted';
    case 'overdue':             return 'overdue';
    case 'awaiting-submission': return 'awaiting';
  }
};
