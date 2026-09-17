/**
 * Tests for src/utils/phasedReport.ts — the shared overdue / badge
 * derivation helper used by both the Lecturer GroupDetail timeline and
 * the GradStudent SubmitReport / StudentResearchGroups tables.
 *
 * Bug fixed by this module (Sep 2026): the BE commonly serializes
 *   { status: "Pending", isOverdue: undefined, deadlineAt: <past> }
 * for milestones whose deadline has passed without a submission. The
 * Lecturer view recomputed "overdue" client-side; the GradStudent views
 * didn't, which left Alex looking at "Pending" forever. These tests pin
 * the new behaviour so the regression can't sneak back in.
 */
import { describe, it, expect } from 'vitest';
import {
  derivePhasedReportDisplay,
  derivePhasedReportOverdue,
  derivePhasedReportBadge,
  isPhasedReportTerminal,
  isPhasedReportRejected,
  getPhasedReportDeadlineDate,
} from '../../../src/utils/phasedReport';

const NOW = new Date('2026-09-16T12:00:00Z');
const PAST_DEADLINE = '2025-10-01T16:00:00Z';
const FUTURE_DEADLINE = '2027-01-01T00:00:00Z';

describe('derivePhasedReportOverdue', () => {
  it('returns true when the BE explicitly flags isOverdue', () => {
    const report = { status: 'Pending', isOverdue: true };
    expect(derivePhasedReportOverdue(report, NOW)).toBe(true);
  });

  it('returns true for a past-deadline WAITING row with no submission (the Alex bug)', () => {
    const report = {
      status: 'Pending',
      deadlineAt: PAST_DEADLINE,
    };
    expect(derivePhasedReportOverdue(report, NOW)).toBe(true);
  });

  it('returns true for a past-deadline WAITING row regardless of casing', () => {
    const report = {
      status: 'waiting',
      deadlineAt: PAST_DEADLINE,
    };
    expect(derivePhasedReportOverdue(report, NOW)).toBe(true);
  });

  it('returns false for a future-deadline WAITING row', () => {
    const report = {
      status: 'Pending',
      deadlineAt: FUTURE_DEADLINE,
    };
    expect(derivePhasedReportOverdue(report, NOW)).toBe(false);
  });

  it('returns true when the submission timestamp is after the deadline (late submit)', () => {
    const report = {
      status: 'Submitted',
      deadlineAt: PAST_DEADLINE,
      submittedAt: '2025-10-15T00:00:00Z',
    };
    expect(derivePhasedReportOverdue(report, NOW)).toBe(true);
  });

  it('returns false when an evaluated row has a past deadline (terminal state wins)', () => {
    const report = {
      status: 'Evaluated',
      deadlineAt: PAST_DEADLINE,
      submittedAt: '2025-09-30T00:00:00Z',
    };
    expect(derivePhasedReportOverdue(report, NOW)).toBe(false);
  });

  it('returns false when a rejected row has a past deadline (terminal state wins)', () => {
    const report = {
      status: 'REJECTED',
      deadlineAt: PAST_DEADLINE,
    };
    expect(derivePhasedReportOverdue(report, NOW)).toBe(false);
  });

  it('returns false when the deadline is missing (cannot derive)', () => {
    const report = { status: 'Pending' };
    expect(derivePhasedReportOverdue(report, NOW)).toBe(false);
  });
});

describe('derivePhasedReportBadge', () => {
  it('returns Overdue for a past-deadline WAITING row (the Alex bug)', () => {
    const report = { status: 'Pending', deadlineAt: PAST_DEADLINE };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Overdue');
  });

  it('returns Pending for a future-deadline WAITING row', () => {
    const report = { status: 'Pending', deadlineAt: FUTURE_DEADLINE };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Pending');
  });

  it('returns Submitted for a SUBMITTED row even when past the deadline (no flip)', () => {
    const report = {
      status: 'SUBMITTED',
      deadlineAt: PAST_DEADLINE,
      submittedAt: '2025-09-30T00:00:00Z',
    };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Submitted');
  });

  it('returns Passed for an evaluated row', () => {
    const report = {
      status: 'EVALUATED',
      lectureFeedback: 8,
      deadlineAt: PAST_DEADLINE,
    };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Passed');
  });

  it('returns Passed for a canonical Passed row', () => {
    const report = { status: 'Passed' };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Passed');
  });

  it('returns Rejected for a REJECTED row', () => {
    const report = { status: 'REJECTED' };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Rejected');
  });

  it('returns Rejected for the Rejected casing variant', () => {
    const report = { status: 'Rejected' };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Rejected');
  });

  // Regression — September 2026 student-submission status bug:
  //
  // `/api/PhasedReport/submit` auto-assigns a timeliness status based
  // on the deadline (swagger: "Tự động kiểm tra Deadline & gán trạng
  // thái OnTime / Overdue"). After a successful upload, a milestone
  // submitted before the deadline comes back from
  // `/api/PhasedReport/group/{groupId}` as `status: 'OnTime'`. The badge
  // helper previously only recognised `submitted` / `pending_review`
  // and fell through to `Pending`, which the StatusBadge rendered as
  // the grey "WAITING" pill. The lecturer-side `researchStatus.ts`
  // already maps `OnTime → submitted`; this helper now does the same.
  it('returns Submitted for an OnTime row (post-submit BE timeliness state)', () => {
    const report = {
      status: 'OnTime',
      submittedAt: '2025-09-30T00:00:00Z',
      deadlineAt: '2025-10-15T00:00:00Z',
    };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Submitted');
  });

  // A late submission (BE marks `Overdue` once `submittedAt` exceeds
  // `deadlineAt`) is still a successful submission from the student's
  // perspective — they uploaded the file and the server acknowledged
  // it. We render it as "Submitted" rather than leaving the user
  // staring at "Overdue" without context.
  it('returns Submitted for an Overdue row that has a submittedAt (late submit)', () => {
    const report = {
      status: 'Overdue',
      submittedAt: '2025-10-15T00:00:00Z',
      deadlineAt: '2025-10-01T00:00:00Z',
    };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Submitted');
  });

  // But a past-deadline milestone that hasn't been submitted yet must
  // still read as Overdue/Pending — the previous "Alex" bug fix
  // guarantees that, and we mustn't regress it.
  it('returns Overdue for an Overdue row with no submittedAt (not yet submitted)', () => {
    const report = {
      status: 'Overdue',
      deadlineAt: PAST_DEADLINE,
    };
    expect(derivePhasedReportBadge(report, NOW)).toBe('Overdue');
  });
});

describe('derivePhasedReportDisplay', () => {
  it('reports overdue + Overdue badge for the canonical Alex bug shape', () => {
    const report = { status: 'Pending', deadlineAt: PAST_DEADLINE };
    const display = derivePhasedReportDisplay(report, NOW);
    expect(display.overdue).toBe(true);
    expect(display.badge).toBe('Overdue');
  });

  it('reports no overdue + Pending for an in-flight future milestone', () => {
    const report = { status: 'Pending', deadlineAt: FUTURE_DEADLINE };
    const display = derivePhasedReportDisplay(report, NOW);
    expect(display.overdue).toBe(false);
    expect(display.badge).toBe('Pending');
  });

  it('does NOT downgrade a SUBMITTED row just because the deadline passed', () => {
    const report = {
      status: 'SUBMITTED',
      deadlineAt: PAST_DEADLINE,
      submittedAt: '2025-09-30T00:00:00Z',
    };
    const display = derivePhasedReportDisplay(report, NOW);
    expect(display.badge).toBe('Submitted');
  });
});

describe('isPhasedReportTerminal', () => {
  it('returns true for evaluated/passed/approved/graded/complete', () => {
    expect(isPhasedReportTerminal('evaluated')).toBe(true);
    expect(isPhasedReportTerminal('Passed')).toBe(true);
    expect(isPhasedReportTerminal('approved')).toBe(true);
    expect(isPhasedReportTerminal('graded')).toBe(true);
    expect(isPhasedReportTerminal('complete')).toBe(true);
  });

  it('returns true for rejected/denied/declined', () => {
    expect(isPhasedReportTerminal('rejected')).toBe(true);
    expect(isPhasedReportTerminal('Denied')).toBe(true);
    expect(isPhasedReportTerminal('declined')).toBe(true);
  });

  it('returns false for in-flight statuses', () => {
    expect(isPhasedReportTerminal('Pending')).toBe(false);
    expect(isPhasedReportTerminal('WAITING')).toBe(false);
    expect(isPhasedReportTerminal('SUBMITTED')).toBe(false);
    expect(isPhasedReportTerminal(undefined)).toBe(false);
    expect(isPhasedReportTerminal(null)).toBe(false);
  });
});

describe('isPhasedReportRejected', () => {
  it('returns true for rejected/denied/declined casings', () => {
    expect(isPhasedReportRejected('REJECTED')).toBe(true);
    expect(isPhasedReportRejected('rejected')).toBe(true);
    expect(isPhasedReportRejected('Denied')).toBe(true);
    expect(isPhasedReportRejected('declined')).toBe(true);
  });

  it('returns false for everything else', () => {
    expect(isPhasedReportRejected('Pending')).toBe(false);
    expect(isPhasedReportRejected(undefined)).toBe(false);
  });
});

describe('getPhasedReportDeadlineDate', () => {
  it('returns a Date for a parseable deadlineAt', () => {
    const d = getPhasedReportDeadlineDate({ deadlineAt: PAST_DEADLINE });
    expect(d).toBeInstanceOf(Date);
    // Date#toISOString always emits `.000Z`; compare the wall-clock millis
    // so this test isn't brittle to the ISO formatting.
    expect(d?.getTime()).toBe(new Date(PAST_DEADLINE).getTime());
  });

  it('returns null when the deadline is missing', () => {
    expect(getPhasedReportDeadlineDate({})).toBeNull();
    expect(getPhasedReportDeadlineDate({ deadlineAt: null })).toBeNull();
    expect(
      getPhasedReportDeadlineDate({ deadlineAt: 'not-a-date' }),
    ).toBeNull();
  });
});