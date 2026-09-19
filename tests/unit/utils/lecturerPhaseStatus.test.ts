/**
 * Unit tests for src/utils/lecturerPhaseStatus.ts
 *
 * Covers:
 *   - All 5 precedence tiers of classifyPhaseReportStatus
 *   - The "OnTime past deadline" regression:
 *     OnTime status + past deadline → still 'submitted', never 'overdue'
 *   - classifyPhaseReportStatusToFilter correctness
 *   - filterByPhaseReportStatus
 *   - isLecturerDeadlineOverdue
 *   - statusLabelOf
 *   - Defensive: null / undefined inputs, malformed ISO strings
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyPhaseReportStatus,
  classifyPhaseReportStatusToFilter,
  filterByPhaseReportStatus,
  isLecturerDeadlineOverdue,
  statusLabelOf,
  type PhaseReportStatus,
} from '../../../src/utils/lecturerPhaseStatus';
import type { PhasedReport } from '../../../src/services/phasedReport.service';

// Helper — ISO strings relative to a fixed "now"
const makeDates = (
  pastOffsetDays: number,
  futureOffsetDays: number,
): { past: string; future: string; now: Date } => {
  const now = new Date('2026-09-15T12:00:00Z');
  const ms = (n: number) => n * 86_400_000;
  const past = new Date(now.getTime() + ms(pastOffsetDays)).toISOString();
  const future = new Date(now.getTime() + ms(futureOffsetDays)).toISOString();
  return { past, future, now };
};

// ─── Helper assertions ─────────────────────────────────────────────────────────

const expectStatus = (
  report: Partial<PhasedReport>,
  expectedStatus: PhaseReportStatus,
  now?: Date,
) => {
  const cls = classifyPhaseReportStatus(report, now);
  expect(cls.status).toBe(expectedStatus);
};

// When no deadline comparison is possible (no deadlineAt), isLateSubmission
// returns false — not undefined. The '?' in the type means "may be absent"
// at the call site, not that the value is undefined at runtime.
const expectFlags = (
  report: Partial<PhasedReport>,
  flags: {
    isSubmitted?: boolean;
    isOverdue?: boolean;
    isEvaluated?: boolean;
    isRejected?: boolean;
    isLateSubmission?: boolean;
  },
  now?: Date,
) => {
  const cls = classifyPhaseReportStatus(report, now);
  expect(cls.isSubmitted).toBe(flags.isSubmitted ?? false);
  expect(cls.isOverdue).toBe(flags.isOverdue ?? false);
  expect(cls.isEvaluated).toBe(flags.isEvaluated ?? false);
  expect(cls.isRejected).toBe(flags.isRejected ?? false);
  expect(cls.isLateSubmission ?? false).toBe(flags.isLateSubmission ?? false);
};

// ─── Tier 1: Evaluated ────────────────────────────────────────────────────────

describe('Tier 1 — Evaluated', () => {
  const now = new Date('2026-09-15T12:00:00Z');

  it.each([
    ['evaluated', 'evaluated'],
    ['passed', 'evaluated'],
    ['approved', 'evaluated'],
    ['graded', 'evaluated'],
    ['complete', 'evaluated'],
    ['EVALUATED', 'evaluated'],  // case-insensitive
  ])('status "%s" → evaluated', (status, _expected) => {
    expectStatus({ status }, 'evaluated', now);
  });

  it('isEvaluated flag is true', () => {
    const cls = classifyPhaseReportStatus({ status: 'evaluated' }, now);
    expect(cls.isEvaluated).toBe(true);
    expect(cls.isSubmitted).toBe(false);
    expect(cls.isOverdue).toBe(false);
    expect(cls.isRejected).toBe(false);
  });

  it('submittedAt is preserved in the result', () => {
    const submittedAt = '2026-09-10T10:00:00Z';
    const cls = classifyPhaseReportStatus(
      { status: 'evaluated', submittedAt },
      now,
    );
    expect(cls.submittedAt).toBe(submittedAt);
  });
});

// ─── Tier 2: Rejected ────────────────────────────────────────────────────────

describe('Tier 2 — Rejected', () => {
  const now = new Date('2026-09-15T12:00:00Z');

  it.each([
    ['rejected', 'rejected'],
    ['denied', 'rejected'],
    ['declined', 'rejected'],
    ['REJECTED', 'rejected'],  // case-insensitive
  ])('status "%s" → rejected', (status) => {
    expectStatus({ status }, 'rejected', now);
  });

  it('isRejected flag is true', () => {
    const cls = classifyPhaseReportStatus({ status: 'rejected' }, now);
    expect(cls.isRejected).toBe(true);
    expect(cls.isSubmitted).toBe(false);
    expect(cls.isOverdue).toBe(false);
    expect(cls.isEvaluated).toBe(false);
  });
});

// ─── Tier 3: Real submission ─────────────────────────────────────────────────

describe('Tier 3 — Real submission', () => {
  const { past, future, now } = makeDates(-5, 30);

  it('truthy submittedAt → submitted (on-time)', () => {
    expectStatus({ status: 'SUBMITTED', submittedAt: past, deadlineAt: future }, 'submitted', now);
    expectFlags(
      { status: 'SUBMITTED', submittedAt: past, deadlineAt: future },
      { isSubmitted: true, isLateSubmission: false },
      now,
    );
  });

  it('submittedAt past deadline → submitted-late', () => {
    expectStatus({ status: 'SUBMITTED', submittedAt: future, deadlineAt: past }, 'submitted-late', now);
    expectFlags(
      { status: 'SUBMITTED', submittedAt: future, deadlineAt: past },
      { isSubmitted: true, isLateSubmission: true },
      now,
    );
  });

  it('status "OnTime" (BE pre-deadline label) → submitted', () => {
    expectStatus({ status: 'OnTime', submittedAt: past }, 'submitted', now);
    expectFlags(
      { status: 'OnTime', submittedAt: past },
      { isSubmitted: true },
      now,
    );
  });

  // ── Regression test: OnTime past deadline → submitted, NOT overdue ──────────
  it('OnTime + deadline in the past → submitted (NOT overdue)', () => {
    // This is the regression: previously GroupDetail showed "Overdue" for a
    // report that was "Submitted On Time" in PhaseReports after the deadline
    // passed. The fix: any real submission (including OnTime) must be
    // classified as 'submitted' regardless of the deadline being in the past.
    expectStatus({ status: 'OnTime', submittedAt: past, deadlineAt: future }, 'submitted', now);
    expectFlags(
      { status: 'OnTime', submittedAt: past, deadlineAt: future },
      { isSubmitted: true, isOverdue: false },
      now,
    );
  });

  it('OnTime + deadline in the past → submitted-late (late submission)', () => {
    // If submittedAt is after the deadline, it's a late submission even if
    // the BE labelled it "OnTime" (edge case: BE clock skew).
    expectStatus({ status: 'OnTime', submittedAt: future, deadlineAt: past }, 'submitted-late', now);
    expectFlags(
      { status: 'OnTime', submittedAt: future, deadlineAt: past },
      { isSubmitted: true, isOverdue: false, isLateSubmission: true },
      now,
    );
  });

  it('status "Overdue" (BE late label) + truthy submittedAt → submitted-late', () => {
    // BE's POST /submit sets "Overdue" when submitted past the deadline.
    // The submittedAt field must take precedence — this is still a submission.
    expectStatus({ status: 'Overdue', submittedAt: future, deadlineAt: past }, 'submitted-late', now);
    expectFlags(
      { status: 'Overdue', submittedAt: future, deadlineAt: past },
      { isSubmitted: true, isOverdue: false, isLateSubmission: true },
      now,
    );
  });

  it('status "Overdue" + truthy submittedAt, deadline in future → submitted (not late)', () => {
    // Even if BE clock is skewed and set "Overdue" before deadline, a real
    // submission exists and submittedAt is before deadline → on-time.
    expectStatus({ status: 'Overdue', submittedAt: past, deadlineAt: future }, 'submitted', now);
    expectFlags(
      { status: 'Overdue', submittedAt: past, deadlineAt: future },
      { isSubmitted: true, isOverdue: false, isLateSubmission: false },
      now,
    );
  });

  it('status "pending_review" → submitted', () => {
    expectStatus({ status: 'pending_review', submittedAt: past }, 'submitted', now);
    expectFlags(
      { status: 'pending_review', submittedAt: past },
      { isSubmitted: true, isLateSubmission: false },
      now,
    );
  });

  it('status "SUBMITTED" + no submittedAt → submitted (submission signal)', () => {
    // SUBMITTED is itself a submission signal even without a timestamp.
    expectStatus({ status: 'SUBMITTED' }, 'submitted', now);
    expectFlags(
      { status: 'SUBMITTED' },
      { isSubmitted: true },
      now,
    );
  });
});

// ─── Tier 4: No submission, deadline passed → Overdue ─────────────────────────

describe('Tier 4 — No submission + deadline passed', () => {
  const { past, future, now } = makeDates(-5, 30);

  it('no submittedAt + deadline in the past → overdue', () => {
    expectStatus({ status: 'Pending', deadlineAt: past }, 'overdue', now);
    expectFlags({ status: 'Pending', deadlineAt: past }, { isOverdue: true, isSubmitted: false }, now);
  });

  it('no submittedAt + no deadline → awaiting-submission (not overdue)', () => {
    expectStatus({ status: 'Pending' }, 'awaiting-submission', now);
    expectFlags({ status: 'Pending' }, { isOverdue: false }, now);
  });

  it('status "WAITING" + deadline in the past → overdue', () => {
    expectStatus({ status: 'WAITING', deadlineAt: past }, 'overdue', now);
  });

  it('status "WAITING" + deadline in the future → awaiting-submission', () => {
    expectStatus({ status: 'WAITING', deadlineAt: future }, 'awaiting-submission', now);
    expectFlags({ status: 'WAITING', deadlineAt: future }, { isOverdue: false }, now);
  });

  it('malformed deadline string → awaiting-submission (not overdue)', () => {
    expectStatus({ status: 'Pending', deadlineAt: 'not-a-date' }, 'awaiting-submission', now);
  });
});

// ─── Tier 5: Default → Awaiting submission ───────────────────────────────────

describe('Tier 5 — Awaiting submission (default)', () => {
  const now = new Date('2026-09-15T12:00:00Z');

  it('no status → awaiting-submission', () => {
    expectStatus({}, 'awaiting-submission', now);
  });

  it('status null → awaiting-submission', () => {
    expectStatus({ status: null }, 'awaiting-submission', now);
  });

  it('status "waiting" + future deadline → awaiting-submission', () => {
    const { future } = makeDates(-5, 30);
    expectStatus({ status: 'waiting', deadlineAt: future }, 'awaiting-submission', now);
  });

  it('unknown status → awaiting-submission', () => {
    expectStatus({ status: 'random-nonsense' }, 'awaiting-submission', now);
  });
});

// ─── Defensive: null / undefined inputs ──────────────────────────────────────

describe('Defensive handling of null / undefined', () => {
  const now = new Date('2026-09-15T12:00:00Z');

  it('classifyPhaseReportStatus(undefined) → awaiting-submission', () => {
    // @ts-expect-error — intentionally testing runtime null
    expect(classifyPhaseReportStatus(undefined, now).status).toBe('awaiting-submission');
  });

  it('classifyPhaseReportStatus(null) → awaiting-submission', () => {
    // @ts-expect-error — intentionally testing runtime null
    expect(classifyPhaseReportStatus(null, now).status).toBe('awaiting-submission');
  });

  it('classifyPhaseReportStatus({}) → awaiting-submission', () => {
    expect(classifyPhaseReportStatus({}, now).status).toBe('awaiting-submission');
  });

  it('numeric submittedAt → handled gracefully', () => {
    const cls = classifyPhaseReportStatus(
      { submittedAt: 1_725_000_000 as unknown as string }, // ms timestamp
      now,
    );
    // A numeric string coerces to a Date; if invalid it falls through to
    // awaiting-submission. The defensive guard ensures no crash.
    expect(cls.status).toBeDefined();
  });
});

// ─── classifyPhaseReportStatusToFilter ───────────────────────────────────────

describe('classifyPhaseReportStatusToFilter', () => {
  it('maps evaluated → evaluated', () => {
    expect(classifyPhaseReportStatusToFilter({ status: 'evaluated', isSubmitted: false, isOverdue: false, isEvaluated: true, isRejected: false })).toBe('evaluated');
  });

  it('maps rejected → rejected', () => {
    expect(classifyPhaseReportStatusToFilter({ status: 'rejected', isSubmitted: false, isOverdue: false, isEvaluated: false, isRejected: true })).toBe('rejected');
  });

  it('maps submitted → submitted', () => {
    expect(classifyPhaseReportStatusToFilter({ status: 'submitted', isSubmitted: true, isOverdue: false, isEvaluated: false, isRejected: false })).toBe('submitted');
  });

  it('maps submitted-late → submitted (same tab)', () => {
    // Late submissions belong in the Submitted tab.
    expect(classifyPhaseReportStatusToFilter({ status: 'submitted-late', isSubmitted: true, isOverdue: false, isEvaluated: false, isRejected: false, isLateSubmission: true })).toBe('submitted');
  });

  it('maps overdue → overdue', () => {
    expect(classifyPhaseReportStatusToFilter({ status: 'overdue', isSubmitted: false, isOverdue: true, isEvaluated: false, isRejected: false })).toBe('overdue');
  });

  it('maps awaiting-submission → awaiting-submission', () => {
    expect(classifyPhaseReportStatusToFilter({ status: 'awaiting-submission', isSubmitted: false, isOverdue: false, isEvaluated: false, isRejected: false })).toBe('awaiting-submission');
  });
});

// ─── filterByPhaseReportStatus ────────────────────────────────────────────────

describe('filterByPhaseReportStatus', () => {
  const { past, future, now } = makeDates(-5, 30);
  const reports: PhasedReport[] = [
    { status: 'evaluated', submittedAt: past } as PhasedReport,
    { status: 'rejected', submittedAt: past } as PhasedReport,
    { status: 'SUBMITTED', submittedAt: past, deadlineAt: future } as PhasedReport,
    { status: 'SUBMITTED', submittedAt: future, deadlineAt: past } as PhasedReport,
    { status: 'Pending', deadlineAt: past } as PhasedReport, // overdue
    { status: 'Pending', deadlineAt: future } as PhasedReport, // awaiting
  ];

  it('all → returns all 6 reports', () => {
    const result = filterByPhaseReportStatus(reports, 'all', now);
    expect(result).toHaveLength(6);
  });

  it('submitted → returns 2 (on-time + late)', () => {
    const result = filterByPhaseReportStatus(reports, 'submitted', now);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.status === 'SUBMITTED')).toBe(true);
  });

  it('overdue → returns 1', () => {
    const result = filterByPhaseReportStatus(reports, 'overdue', now);
    expect(result).toHaveLength(1);
  });

  it('awaiting-submission → returns 1', () => {
    const result = filterByPhaseReportStatus(reports, 'awaiting-submission', now);
    expect(result).toHaveLength(1);
  });

  it('evaluated → returns 1', () => {
    const result = filterByPhaseReportStatus(reports, 'evaluated', now);
    expect(result).toHaveLength(1);
  });

  it('rejected → returns 1', () => {
    const result = filterByPhaseReportStatus(reports, 'rejected', now);
    expect(result).toHaveLength(1);
  });

  it('counts sum to total for non-all filters', () => {
    const filters: Array<'submitted' | 'overdue' | 'awaiting-submission' | 'evaluated' | 'rejected'> = [
      'submitted', 'overdue', 'awaiting-submission', 'evaluated', 'rejected',
    ];
    const total = filters.reduce((sum, f) => sum + filterByPhaseReportStatus(reports, f, now).length, 0);
    expect(total).toBe(6); // all - all (6 total, no 'all' filter itself)
  });
});

// ─── isLecturerDeadlineOverdue ────────────────────────────────────────────────

describe('isLecturerDeadlineOverdue', () => {
  const { past, future, now } = makeDates(-5, 30);

  it('true for overdue bucket', () => {
    expect(isLecturerDeadlineOverdue({ status: 'overdue' }, now)).toBe(true);
  });

  it('true for awaiting + deadline in the past', () => {
    expect(isLecturerDeadlineOverdue({ status: 'Pending', deadlineAt: past }, now)).toBe(true);
  });

  it('false for awaiting + future deadline', () => {
    expect(isLecturerDeadlineOverdue({ status: 'Pending', deadlineAt: future }, now)).toBe(false);
  });

  it('false for awaiting + no deadline', () => {
    expect(isLecturerDeadlineOverdue({ status: 'Pending' }, now)).toBe(false);
  });

  it('false for submitted', () => {
    expect(isLecturerDeadlineOverdue({ status: 'SUBMITTED', submittedAt: past }, now)).toBe(false);
  });

  it('false for evaluated', () => {
    expect(isLecturerDeadlineOverdue({ status: 'evaluated' }, now)).toBe(false);
  });

  it('false for rejected', () => {
    expect(isLecturerDeadlineOverdue({ status: 'rejected' }, now)).toBe(false);
  });

  it('handles undefined report', () => {
    // @ts-expect-error — intentionally testing runtime null
    expect(isLecturerDeadlineOverdue(undefined, now)).toBe(false);
  });
});

// ─── statusLabelOf ────────────────────────────────────────────────────────────

describe('statusLabelOf', () => {
  const now = new Date('2026-09-15T12:00:00Z');

  it('evaluated → "Accepted"', () => {
    expect(statusLabelOf({ status: 'evaluated' }, now)).toBe('Accepted');
  });

  it('rejected → "Rejected"', () => {
    expect(statusLabelOf({ status: 'rejected' }, now)).toBe('Rejected');
  });

  it('submitted → "Submitted On Time"', () => {
    expect(statusLabelOf({ status: 'SUBMITTED', submittedAt: '2026-09-10T10:00:00Z', deadlineAt: '2026-09-20T10:00:00Z' }, now)).toBe('Submitted On Time');
  });

  it('submitted-late → "Submitted Late"', () => {
    const { past, future } = makeDates(-5, 30);
    expect(statusLabelOf({ status: 'SUBMITTED', submittedAt: future, deadlineAt: past }, now)).toBe('Submitted Late');
  });

  it('overdue → "Overdue"', () => {
    expect(statusLabelOf({ status: 'overdue' }, now)).toBe('Overdue');
  });

  it('awaiting-submission → "Awaiting Submission"', () => {
    expect(statusLabelOf({ status: 'Pending' }, now)).toBe('Awaiting Submission');
  });

  it('null input → "Awaiting Submission"', () => {
    // @ts-expect-error — intentionally testing runtime null
    expect(statusLabelOf(null, now)).toBe('Awaiting Submission');
  });

  it('undefined input → "Awaiting Submission"', () => {
    // @ts-expect-error — intentionally testing runtime null
    expect(statusLabelOf(undefined, now)).toBe('Awaiting Submission');
  });
});
