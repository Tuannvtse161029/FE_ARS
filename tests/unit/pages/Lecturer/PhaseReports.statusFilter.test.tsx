/**
 * Tests for `statusFilterOf` + `isLecturerDeadlineOverdue` — the
 * lecturer Phase Reports row-bucket classifiers in
 * `src/utils/lecturerPhaseStatus.ts`.
 *
 * Bug fixed (September 2026): the BE's `POST /api/PhasedReport/submit`
 * endpoint auto-assigns a timeliness status (`OnTime`/`Overdue`) based
 * on `deadlineAt`. Previously the classifier only matched the canonical
 * `submitted` literal, so a freshly submitted report fell through to
 * `awaiting` and the lecturer list rendered the grey "Awaiting
 * Submission" pill — even though the row had been uploaded. The
 * lecturer-side milestone count summary already mapped `OnTime →
 * submitted` (see `src/utils/researchStatus.ts`); these tests pin the
 * same rule on the row-level classifier so the regression cannot recur
 * without an explicit fix.
 */
import { describe, it, expect } from 'vitest';
import {
  statusFilterOf,
  statusLabelOf,
  isLecturerDeadlineOverdue,
} from '../../../../src/utils/lecturerPhaseStatus';
import type { PhasedReport } from '../../../../src/services/phasedReport.service';

const NOW = new Date('2026-09-16T12:00:00Z');
const PAST_DEADLINE = '2025-10-01T16:00:00Z';
const FUTURE_DEADLINE = '2027-01-01T00:00:00Z';
const ONTIME_SUBMIT = '2025-09-30T00:00:00Z';
const LATE_SUBMIT = '2025-10-15T00:00:00Z';

const baseReport: PhasedReport = {
  id: 1,
  phasedReportId: 1,
  researchGroupId: 1,
  topicId: 1,
};

describe('statusFilterOf — September 2026 OnTime regression', () => {
  it('classifies a BE OnTime submission as "submitted" (the regression fix)', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'OnTime',
      submittedAt: ONTIME_SUBMIT,
      deadlineAt: FUTURE_DEADLINE,
      reportFileUrl: 'https://fb/x.pdf',
    };
    expect(statusFilterOf(report, NOW)).toBe('submitted');
  });

  it('classifies a BE OnTime submission past the deadline as "overdue" (late submit)', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'OnTime',
      submittedAt: LATE_SUBMIT,
      deadlineAt: PAST_DEADLINE,
      reportFileUrl: 'https://fb/x.pdf',
    };
    expect(statusFilterOf(report, NOW)).toBe('overdue');
  });

  it('classifies a BE Overdue submission (with submittedAt) as "overdue" (late submit)', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'Overdue',
      submittedAt: LATE_SUBMIT,
      deadlineAt: PAST_DEADLINE,
      reportFileUrl: 'https://fb/x.pdf',
    };
    expect(statusFilterOf(report, NOW)).toBe('overdue');
  });

  it('does NOT classify a BE Overdue row with no submittedAt as submitted (must fall through to overdueAwaiting)', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'Overdue',
      deadlineAt: PAST_DEADLINE,
    };
    expect(statusFilterOf(report, NOW)).toBe('overdueAwaiting');
  });

  it('still classifies a canonical "Submitted" row as "submitted"', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'Submitted',
      submittedAt: ONTIME_SUBMIT,
      deadlineAt: FUTURE_DEADLINE,
    };
    expect(statusFilterOf(report, NOW)).toBe('submitted');
  });

  it('still classifies an unsubmitted Pending row with a future deadline as "awaiting"', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'Pending',
      deadlineAt: FUTURE_DEADLINE,
    };
    expect(statusFilterOf(report, NOW)).toBe('awaiting');
  });

  it('classifies a lowercase "ontime" variant the same way (defensive)', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'ontime',
      submittedAt: ONTIME_SUBMIT,
      deadlineAt: FUTURE_DEADLINE,
    };
    expect(statusFilterOf(report, NOW)).toBe('submitted');
  });
});

describe('statusLabelOf', () => {
  it('renders "Submitted On Time" for an OnTime row', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'OnTime',
      submittedAt: ONTIME_SUBMIT,
      deadlineAt: FUTURE_DEADLINE,
    };
    expect(statusLabelOf(report)).toBe('Submitted On Time');
  });

  it('renders "Awaiting Submission" for an unsubmitted future-deadline row', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'Pending',
      deadlineAt: FUTURE_DEADLINE,
    };
    expect(statusLabelOf(report)).toBe('Awaiting Submission');
  });
});

describe('isLecturerDeadlineOverdue', () => {
  it('returns true for an unsubmitted past-deadline row', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'Pending',
      deadlineAt: PAST_DEADLINE,
    };
    expect(isLecturerDeadlineOverdue(report, NOW)).toBe(true);
  });

  it('returns false for a future-deadline unsubmitted row', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'Pending',
      deadlineAt: FUTURE_DEADLINE,
    };
    expect(isLecturerDeadlineOverdue(report, NOW)).toBe(false);
  });

  it('returns false for an already-submitted row even if past deadline', () => {
    const report: PhasedReport = {
      ...baseReport,
      status: 'OnTime',
      submittedAt: ONTIME_SUBMIT,
      deadlineAt: FUTURE_DEADLINE,
    };
    expect(isLecturerDeadlineOverdue(report, NOW)).toBe(false);
  });
});
