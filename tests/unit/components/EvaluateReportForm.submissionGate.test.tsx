/**
 * Tests for the lecturer-side "is this report ready to grade?" gate in
 * `src/components/lecturer/EvaluateReportForm.tsx`.
 *
 * Oct 2026 regression suite for the user-reported bug:
 *   "when user click see detail, it didn't show the submit yet for
 *   lecturer to evaluate — in Database it need to check that report
 *   file url is not null, and status is Submitted, then it open
 *   evaluation form for lecturer to fill in"
 *
 * The original gate was `!!report.submittedAt && hasPdf`. That missed a
 * real class of cases: when the student had uploaded a PDF and the BE
 * had stamped `status: 'SUBMITTED'` but the GET response did not echo
 * back a `submittedAt` timestamp. The grading form stayed hidden and
 * the lecturer saw an empty "Not submitted yet" panel.
 *
 * The fix is `hasPdf && classifyPhaseReportStatus(report).isSubmitted`
 * — the classifier treats both `status === 'Submitted'` AND a truthy
 * `submittedAt` as submission signals, so the form opens whenever
 * either gate is satisfied, *as long as* there is a real PDF to grade.
 *
 * These tests pin the new gate by mounting the real component and
 * asserting the rendered DOM: when the gate passes we see the grading
 * form (Grade / Outcome notes); when it fails we see the "Not
 * submitted yet" placeholder.
 */
import { describe, it, expect as expectFn, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluateReportForm } from '../../../src/components/lecturer/EvaluateReportForm';
import type { PhasedReport } from '../../../src/services/phasedReport.service';

// Mock the hook so the form can mount cleanly without a network call.
vi.mock('../../../src/hooks/useEvaluatePhasedReport', () => ({
  useEvaluatePhasedReport: () => ({
    submit: vi.fn(),
    isLoading: false,
    error: null,
    result: null,
    reset: vi.fn(),
  }),
}));

// Mock the PDF viewer to avoid jsdom/IntersectionObserver pain.
vi.mock('../../../src/components/PdfViewer/LazyPdfViewer', () => ({
  default: () => null,
}));

const baseReport: PhasedReport = {
  id: 5,
  researchGroupId: 7,
  phaseNumber: 3,
  milestoneTitle: 'Phase 3 — Reading Comprehension',
  groupName: 'NLP Lab Group A',
  topicTitle: 'Reading Comprehension',
};

describe('<EvaluateReportForm> submission gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Form should OPEN (grading UI visible) ───────────────────────────

  it('opens the grading form when reportFileUrl is set AND status is SUBMITTED', () => {
    render(
      <EvaluateReportForm
        report={{
          ...baseReport,
          status: 'SUBMITTED',
          reportFileUrl: 'https://fb.storage/x.pdf',
          submittedAt: '2026-10-06T10:30:00Z',
        }}
      />,
    );
    // Mode switcher is the canonical "form is open" signal.
    expectFn(
      screen.getByRole('button', { name: /Request Resubmit with Feedback/i }),
    ).toBeInTheDocument();
    // Grade input is rendered (label "Grade (0 – 10)").
    expectFn(screen.getByLabelText(/Grade/i)).toBeInTheDocument();
    // The "Not submitted yet" placeholder must NOT be on screen.
    expectFn(screen.queryByText(/Not submitted yet/i)).not.toBeInTheDocument();
  });

  it('opens the grading form when reportFileUrl is set AND status is OnTime (BE timeliness label)', () => {
    // The BE stamps post-submit rows with 'OnTime' (or 'Overdue') as a
    // timeliness label. These are submitted-state values too — the
    // classifier treats them as Tier-3 (submitted).
    render(
      <EvaluateReportForm
        report={{
          ...baseReport,
          status: 'OnTime',
          reportFileUrl: 'https://fb.storage/x.pdf',
        }}
      />,
    );
    expectFn(
      screen.getByRole('button', { name: /Request Resubmit with Feedback/i }),
    ).toBeInTheDocument();
  });

  it('opens the grading form when reportFileUrl is set AND submittedAt is set (even if status is missing)', () => {
    // The reverse direction of the user-reported bug: the student
    // uploaded a PDF, the BE echoed `submittedAt` but not `status` on
    // the GET response. The form must still open because there is a
    // real submission.
    render(
      <EvaluateReportForm
        report={{
          ...baseReport,
          status: undefined as unknown as string,
          reportFileUrl: 'https://fb.storage/x.pdf',
          submittedAt: '2026-10-06T10:30:00Z',
        }}
      />,
    );
    expectFn(
      screen.getByRole('button', { name: /Request Resubmit with Feedback/i }),
    ).toBeInTheDocument();
  });

  // ── Form should STAY CLOSED (placeholder visible) ────────────────────

  it('shows the Not submitted placeholder when reportFileUrl is null even though status is SUBMITTED', () => {
    // The user's exact wording: "report file url is not null" is a
    // hard requirement. A row stamped SUBMITTED without a PDF cannot
    // be graded, so the form must stay closed.
    render(
      <EvaluateReportForm
        report={{
          ...baseReport,
          status: 'SUBMITTED',
          reportFileUrl: undefined,
          submittedAt: '2026-10-06T10:30:00Z',
        }}
      />,
    );
    expectFn(screen.getByText(/Not submitted yet/i)).toBeInTheDocument();
    // Resubmit button must not exist (form is closed).
    expectFn(
      screen.queryByRole('button', { name: /Request Resubmit with Feedback/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the Not submitted placeholder when status is WAITING and submittedAt is not set, even with a PDF', () => {
    // The lecturer only grades submitted work. A row that is still in
    // WAITING with no submittedAt timestamp (e.g. the student uploaded
    // a draft but the BE has not accepted it as a submission) must not
    // open the grading form. We use null submittedAt so the
    // classifier's "Tier 3" submission signal is NOT triggered.
    render(
      <EvaluateReportForm
        report={{
          ...baseReport,
          status: 'WAITING',
          reportFileUrl: 'https://fb.storage/x.pdf',
          submittedAt: null,
        }}
      />,
    );
    expectFn(screen.getByText(/Not submitted yet/i)).toBeInTheDocument();
    expectFn(
      screen.queryByRole('button', { name: /Request Resubmit with Feedback/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the Not submitted placeholder when the report has no file and no status (fresh row)', () => {
    render(<EvaluateReportForm report={{ ...baseReport }} />);
    expectFn(screen.getByText(/Not submitted yet/i)).toBeInTheDocument();
    expectFn(
      screen.queryByRole('button', { name: /Request Resubmit with Feedback/i }),
    ).not.toBeInTheDocument();
  });
});