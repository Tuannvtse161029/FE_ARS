/**
 * Component tests for src/components/gradstudent/RejectionFeedbackBanner.tsx.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RejectionFeedbackBanner } from '../../components/gradstudent/RejectionFeedbackBanner';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';

const REPORT: SubmittedPhasedReport = {
  id: 5,
  researchGroupId: 7,
  reportFileUrl: 'https://fb.storage/x.pdf',
  capacityEvaluation: 'Needs more detail on the methodology.',
  lectureFeedback: 4,
  submittedAt: '2025-01-02T10:00:00Z',
  status: 'REJECTED',
};

describe('<RejectionFeedbackBanner>', () => {
  it('shows the lecturer feedback when capacityEvaluation is present', () => {
    render(<RejectionFeedbackBanner report={REPORT} />);
    expect(
      screen.getByText(/Needs more detail on the methodology/),
    ).toBeInTheDocument();
  });

  it('shows the grade pill when lectureFeedback is a number', () => {
    render(<RejectionFeedbackBanner report={REPORT} />);
    expect(screen.getByText(/Grade: 4\/10/)).toBeInTheDocument();
  });

  it('falls back to finalOutcomeEvaluation when capacityEvaluation is empty', () => {
    render(
      <RejectionFeedbackBanner
        report={{
          ...REPORT,
          capacityEvaluation: '',
          finalOutcomeEvaluation: 'Overall verdict: redo the experiments.',
        }}
      />,
    );
    expect(
      screen.getByText(/Overall verdict: redo the experiments/),
    ).toBeInTheDocument();
  });

  it('shows a muted "no comment" message when both fields are blank', () => {
    render(
      <RejectionFeedbackBanner
        report={{
          ...REPORT,
          capacityEvaluation: '',
          finalOutcomeEvaluation: '',
        }}
      />,
    );
    expect(
      screen.getByText(/without leaving a comment/),
    ).toBeInTheDocument();
  });

  it('hides the grade pill when lectureFeedback is not a number', () => {
    render(
      <RejectionFeedbackBanner
        report={{ ...REPORT, lectureFeedback: undefined as unknown as number }}
      />,
    );
    expect(screen.queryByText(/Grade:/)).not.toBeInTheDocument();
  });

  it('formats the submitted date in the title', () => {
    render(<RejectionFeedbackBanner report={REPORT} lecturerName="Dr. Test" />);
    expect(screen.getByText(/Reviewed on/)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Test/)).toBeInTheDocument();
  });

  it('fires onResubmit when the user clicks Resubmit', async () => {
    const onResubmit = vi.fn();
    render(<RejectionFeedbackBanner report={REPORT} onResubmit={onResubmit} />);
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Resubmit revised version/i }),
    );
    expect(onResubmit).toHaveBeenCalledWith(REPORT);
  });

  it('fires onDownloadOriginal when the user clicks Download', async () => {
    const onDownload = vi.fn();
    render(
      <RejectionFeedbackBanner
        report={REPORT}
        onDownloadOriginal={onDownload}
      />,
    );
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Download original/i }),
    );
    expect(onDownload).toHaveBeenCalledWith('https://fb.storage/x.pdf');
  });

  it('hides Download button when reportFileUrl is missing', () => {
    render(
      <RejectionFeedbackBanner
        report={{ ...REPORT, reportFileUrl: undefined }}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /Download original/i }),
    ).not.toBeInTheDocument();
  });

  it('parses the __LINEAGE__: sentinel and surfaces previousReportId as a separate row', () => {
    render(
      <RejectionFeedbackBanner
        report={{
          ...REPORT,
          capacityEvaluation: '__LINEAGE__:Resubmitted from report #42',
          finalOutcomeEvaluation: '',
        }}
      />,
    );
    // The lineage row surfaces the parsed id
    expect(screen.getByTestId('rejection-lineage')).toHaveTextContent(
      /Resubmitted from report #42/,
    );
    // The lecturer feedback body must NOT include the sentinel or the
    // "Resubmitted from report" phrase — lineage is NOT a rejection reason.
    expect(
      screen.getByText(/The lecturer rejected this submission without leaving a comment/),
    ).toBeInTheDocument();
  });

  it('renders remainder text after the sentinel as the rejection reason', () => {
    render(
      <RejectionFeedbackBanner
        report={{
          ...REPORT,
          capacityEvaluation:
            '__LINEAGE__:Resubmitted from report #7 still too short',
          finalOutcomeEvaluation: '',
        }}
      />,
    );
    expect(screen.getByTestId('rejection-lineage')).toHaveTextContent(
      /Resubmitted from report #7/,
    );
    expect(screen.getByText(/still too short/)).toBeInTheDocument();
  });
});