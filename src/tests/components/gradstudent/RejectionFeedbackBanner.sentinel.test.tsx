/**
 * Sibling tests for src/components/gradstudent/RejectionFeedbackBanner.tsx —
 * dedicated to lineage-aware rendering via the `__LINEAGE__:` sentinel.
 *
 * The 9 existing tests in `RejectionFeedbackBanner.test.tsx` are untouched.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  RejectionFeedbackBanner,
} from '../../../components/gradstudent/RejectionFeedbackBanner';
import type { SubmittedPhasedReport } from '../../../services/phasedReport.service';

const BASE_REPORT: SubmittedPhasedReport = {
  id: 9,
  researchGroupId: 7,
  status: 'REJECTED',
  lectureFeedback: 4,
  submittedAt: '2025-01-02T10:00:00Z',
};

describe('<RejectionFeedbackBanner> — lineage sibling tests', () => {
  it('renders "Previous report #5" badge and the remainder text when sentinel is present', () => {
    const report: SubmittedPhasedReport = {
      ...BASE_REPORT,
      capacityEvaluation:
        '__LINEAGE__:Resubmitted from report #5\nTighten section 3.',
      finalOutcomeEvaluation: '',
    };
    render(<RejectionFeedbackBanner report={report} />);
    expect(screen.getByTestId('rejection-lineage')).toHaveTextContent(
      /Resubmitted from report #5/,
    );
    expect(screen.getByText(/Tighten section 3\./)).toBeInTheDocument();
  });

  it('renders the rejection reason verbatim when no sentinel is present', () => {
    const report: SubmittedPhasedReport = {
      ...BASE_REPORT,
      capacityEvaluation: 'No lineage here',
      finalOutcomeEvaluation: '',
    };
    render(<RejectionFeedbackBanner report={report} />);
    expect(screen.getByText(/No lineage here/)).toBeInTheDocument();
    expect(screen.queryByTestId('rejection-lineage')).not.toBeInTheDocument();
  });

  it('prefers report.previousReportId over the sentinel when both are present', () => {
    const report: SubmittedPhasedReport = {
      ...BASE_REPORT,
      previousReportId: 99,
      capacityEvaluation: '__LINEAGE__:Resubmitted from report #5',
      finalOutcomeEvaluation: '',
    };
    render(<RejectionFeedbackBanner report={report} />);
    expect(screen.getByTestId('rejection-lineage')).toHaveTextContent(
      /Resubmitted from report #99/,
    );
    // The sentinel-only id must NOT appear.
    expect(screen.queryByText(/Resubmitted from report #5/)).not.toBeInTheDocument();
  });

  it('empty remainder (sentinel-only) renders lineage badge + muted "No comment"', () => {
    const report: SubmittedPhasedReport = {
      ...BASE_REPORT,
      capacityEvaluation: '__LINEAGE__:Resubmitted from report #5',
      finalOutcomeEvaluation: '',
    };
    render(<RejectionFeedbackBanner report={report} />);
    expect(screen.getByTestId('rejection-lineage')).toHaveTextContent(
      /Resubmitted from report #5/,
    );
    expect(
      screen.getByText(/without leaving a comment/),
    ).toBeInTheDocument();
  });

  it('malformed sentinel ("#abc") renders the entire raw text as the reason', () => {
    const report: SubmittedPhasedReport = {
      ...BASE_REPORT,
      capacityEvaluation: '__LINEAGE__:Resubmitted from report #abc',
      finalOutcomeEvaluation: '',
    };
    render(<RejectionFeedbackBanner report={report} />);
    // The parser returns the raw string as the remainder — verify the
    // text appears verbatim. The lineage id is null so the lineage badge
    // is not rendered.
    expect(
      screen.getByText(/__LINEAGE__:Resubmitted from report #abc/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('rejection-lineage')).not.toBeInTheDocument();
  });
});