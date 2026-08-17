import { AlertTriangle, Download, Link2, RefreshCw } from 'lucide-react';
import {
  parsePhasedReportLineage,
  type SubmittedPhasedReport,
} from '../../services/phasedReport.service';
import styles from './RejectionFeedbackBanner.module.css';

export interface RejectionFeedbackBannerProps {
  report: SubmittedPhasedReport;
  lecturerName?: string;
  onDownloadOriginal?: (url: string) => void;
  onResubmit?: (report: SubmittedPhasedReport) => void;
}

// Surfaces the lecturer's rejection feedback for a single PhasedReport.
// Per docs/local-only/research-workflow-contract.md §2 (grad student
// acceptance criteria), the FE displays whatever the BE provides in
// `finalOutcomeEvaluation` (free-text feedback / rejection reason) and
// `lectureFeedback` (number grade). The structured rejection columns
// (`grade`, `feedbackComment`, `annotatedFileUrl`) are documented as
// missing from the BE — until they ship, only the free-text fields are
// rendered.
//
// Per lead-phase-c-contract.md G2(c), this banner uses
// `parsePhasedReportLineage` to strip the `__LINEAGE__:Resubmitted from
// report #N` sentinel from `capacityEvaluation` so the lineage pointer is
// NOT rendered as part of the rejection reason. The parsed `previousReportId`
// is surfaced as a separate row above the body so the student can see the
// chain.
export function RejectionFeedbackBanner({
  report,
  lecturerName,
  onDownloadOriginal,
  onResubmit,
}: RejectionFeedbackBannerProps): JSX.Element {
  // Prefer the structured `previousReportId` field if BE has shipped it
  // (api-gap-ticket-for-be.md §E.5.1); fall back to sentinel detection so
  // existing rows that pre-date the column still render lineage.
  const lineage = parsePhasedReportLineage(report.capacityEvaluation);
  const previousReportId =
    typeof report.previousReportId === 'number' && report.previousReportId > 0
      ? report.previousReportId
      : lineage.previousReportId;
  const remainderReason = lineage.remainder;
  const rejectionReason =
    report.finalOutcomeEvaluation?.trim() ||
    (typeof remainderReason === 'string' && remainderReason.trim().length > 0
      ? remainderReason
      : undefined);
  const grade =
    typeof report.lectureFeedback === 'number' ? report.lectureFeedback : null;
  const originalUrl = report.reportFileUrl ?? null;
  const submittedAt = report.submittedAt ?? null;

  return (
    <div role="alert" className={styles.banner}>
      <div className={styles.header}>
        <span className={styles.iconCircle} aria-hidden>
          <AlertTriangle size={18} />
        </span>
        <div className={styles.headerText}>
          <h4 className={styles.title}>Submission rejected by lecturer</h4>
          {submittedAt ? (
            <p className={styles.subtitle}>
              Reviewed on{' '}
              {new Date(submittedAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              {lecturerName ? ` by ${lecturerName}` : ''}
            </p>
          ) : null}
        </div>
        {grade !== null ? (
          <span className={styles.gradePill}>Grade: {grade}/10</span>
        ) : null}
      </div>

      {previousReportId !== null ? (
        <p className={styles.lineageRow} data-testid="rejection-lineage">
          <span className={styles.lineageIcon} aria-hidden>
            <Link2 size={12} />
          </span>
          <span>
            Resubmitted from report #{previousReportId}. Lecturer feedback below
            applies to that submission.
          </span>
        </p>
      ) : null}

      {rejectionReason ? (
        <div className={styles.body}>
          <span className={styles.bodyLabel}>Lecturer feedback</span>
          <p className={styles.bodyText}>{rejectionReason}</p>
        </div>
      ) : (
        <p className={styles.bodyMuted}>
          The lecturer rejected this submission without leaving a comment. Review
          the original file and resubmit a revised version.
        </p>
      )}

      <div className={styles.actions}>
        {originalUrl ? (
          <button
            type="button"
            className={styles.downloadBtn}
            onClick={() =>
              onDownloadOriginal ? onDownloadOriginal(originalUrl) : undefined
            }
          >
            <Download size={14} />
            <span>Download original</span>
          </button>
        ) : null}
        <button
          type="button"
          className={styles.resubmitBtn}
          onClick={() => (onResubmit ? onResubmit(report) : undefined)}
        >
          <RefreshCw size={14} />
          <span>Resubmit revised version</span>
        </button>
      </div>
    </div>
  );
}

export default RejectionFeedbackBanner;