/**
 * EvaluateReportForm — shared grading form body for Phased Reports.
 *
 * Extracted from `EvaluateReportModal` so the same form can be reused
 * inside `PhaseReportDetailModal` (the new lecturer click-through surface)
 * without duplicating the approve / request-resubmit logic. The original
 * `EvaluateReportModal` is preserved as a thin wrapper around this
 * component so existing call sites in `EvaluateReports.tsx` keep working
 * unchanged.
 *
 * The form owns:
 *  - The approve / request-resubmit mode toggle
 *  - Score, capacity assessment, outcome notes, rejection reason fields
 *  - The read-only "existing feedback on record" block
 *  - The inline PDF preview / open-in-new-tab links (because they share
 *    state with the form's collapse behaviour)
 *  - The submit button + error banner
 *
 * The owning surface owns:
 *  - The overlay / card chrome
 *  - The header (title + topic/phase/group context)
 *  - The Cancel button (when rendered as a top-level modal)
 *
 * On successful evaluation the form calls `props.onSubmitted?.(...)` and
 * resets. The owning surface is responsible for closing any wrapping
 * modal and refreshing its data source.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Loader,
  Check,
  ExternalLink,
  FileText,
  Inbox,
} from 'lucide-react';
import LazyPdfViewer from '../PdfViewer/LazyPdfViewer';
import { useEvaluatePhasedReport } from '../../hooks/useEvaluatePhasedReport';
import type { PhasedReport } from '../../services/phasedReport.service';
import styles from './EvaluateReportModal.module.css';

export type EvaluationAction = 'approve' | 'requestResubmit';

export interface EvaluateReportFormProps {
  report: PhasedReport;
  /** Fires after a successful evaluation; the owning surface decides what to do. */
  onSubmitted?: (action: EvaluationAction, updated: PhasedReport) => void;
  /** When true, render the inline Cancel button (default true). */
  showCancel?: boolean;
  /** Click handler for the Cancel button. */
  onCancel?: () => void;
}

type Mode = 'approve' | 'requestResubmit';

// Sentinel prefix that Agent 2 (GradStudent) writes into `capacityEvaluation`
// when a PhasedReport is a resubmission of a previously rejected one. Format:
//
//   __LINEAGE__:Resubmitted from report #<previousReportId>[<remainder>]
//
// We split it off and render the lineage number in its own row so the
// Lecturer's "Notes / Rejection Reason" section doesn't expose it as the
// rejection reason. The intent map and the gap ticket context live at
// `docs/local-only/lead-phase-c-contract.md` §2.2.A and §E.5.1.
const LINEAGE_PREFIX = '__LINEAGE__:';

const parseLineage = (
  raw: string | null | undefined,
): { previousReportId: number | null; remainder: string } => {
  const safe = (raw ?? '').trim();
  if (!safe) return { previousReportId: null, remainder: '' };
  if (!safe.startsWith(LINEAGE_PREFIX)) {
    return { previousReportId: null, remainder: safe };
  }
  const after = safe.slice(LINEAGE_PREFIX.length);
  const match = /^Resubmitted from report #(\d+)\s*(.*)$/.exec(after);
  if (!match) {
    return { previousReportId: null, remainder: after };
  }
  const previousReportId = Number(match[1]);
  const remainder = (match[2] ?? '').trim();
  return {
    previousReportId: Number.isFinite(previousReportId) ? previousReportId : null,
    remainder,
  };
};

const readPreviousReportId = (report: PhasedReport): number | null => {
  const ext = report as PhasedReport & { previousReportId?: unknown };
  const raw = ext.previousReportId;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
};

export const EvaluateReportForm = ({
  report,
  onSubmitted,
  showCancel = true,
  onCancel,
}: EvaluateReportFormProps) => {
  const [mode, setMode] = useState<Mode>('approve');
  const [lectureFeedback, setLectureFeedback] = useState<string>('8');
  const [capacityEvaluation, setCapacityEvaluation] = useState<string>('Tốt');
  const [finalOutcomeEvaluation, setFinalOutcomeEvaluation] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showPdf, setShowPdf] = useState(false);

  const reportId =
    typeof report.id === 'number' ? report.id : null;
  const { submit, isLoading, error, result, reset } =
    useEvaluatePhasedReport(reportId);

  // Reset the form whenever the parent passes a new report.
  useEffect(() => {
    setMode('approve');
    setLectureFeedback('8');
    setCapacityEvaluation(report.capacityEvaluation || 'Tốt');
    setFinalOutcomeEvaluation(
      report.finalOutcomeEvaluation ?? report.lecturerDescription ?? '',
    );
    setRejectionReason('');
    setShowPdf(false);
    reset();
  }, [report, reset]);

  // Notify the owning surface once the BE returns a result. The parent
  // decides whether to close the modal, refresh the list, etc. We read
  // `onSubmitted` through a ref so a parent that recreates the callback
  // on every render does not re-fire on the same successful result.
  const onSubmittedRef = useRef(onSubmitted);
  onSubmittedRef.current = onSubmitted;
  useEffect(() => {
    if (result) {
      onSubmittedRef.current?.(mode, result);
    }
  }, [result, mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const grade = Number(lectureFeedback);
    const trimmedOutcome = finalOutcomeEvaluation.trim();
    const trimmedReason = rejectionReason.trim();
    if (mode === 'requestResubmit' && !trimmedReason && !trimmedOutcome) {
      return;
    }
    if (mode === 'approve' && (Number.isNaN(grade) || grade < 0 || grade > 10)) {
      return;
    }
    await submit(mode === 'requestResubmit' ? 'reject' : 'approve', {
      ...(mode === 'approve'
        ? {
            lectureFeedback: grade,
            capacityEvaluation,
          }
        : {}),
      lecturerDescription: trimmedReason || trimmedOutcome,
      finalOutcomeEvaluation: trimmedOutcome,
      rejectionReason: trimmedReason,
    });
  };

  const isResubmitMode = mode === 'requestResubmit';
  const hasPdf = !!report.reportFileUrl;
  // The grading UI is only meaningful once the student has uploaded their
  // file and a submitted-at timestamp is on record. Until then we hide
  // every input and render an honest "not submitted yet" panel — the
  // lecturer can still extend the deadline from the owning modal.
  const isSubmitted = !!report.submittedAt && hasPdf;

  return (
    <>
      {/* PDF preview controls (rendered before the form so the toggle is
         immediately visible at the top of the section). */}
      <div className={styles.metaRow}>
        {hasPdf && (
          <>
            <button
              type="button"
              className={styles.viewPdfBtn}
              onClick={() => setShowPdf((v) => !v)}
            >
              <FileText size={14} aria-hidden />
              {showPdf ? 'Hide PDF Preview' : 'Preview PDF Inline'}
            </button>
            <a
              className={styles.openExternalBtn}
              href={report.reportFileUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} aria-hidden />
              Open in New Tab
            </a>
          </>
        )}
      </div>

      {showPdf && hasPdf && (
        <div className={styles.pdfViewerBox}>
          <LazyPdfViewer url={report.reportFileUrl ?? null} />
        </div>
      )}

      {/* Mode switcher — only render once the student has submitted.
          Pre-submission we show the not-submitted panel below instead. */}
      {isSubmitted && (
        <div className={styles.modeSwitcher}>
          <button
            type="button"
            className={`${styles.modeBtn} ${!isResubmitMode ? styles.modeBtnActiveApprove : ''}`}
            onClick={() => setMode('approve')}
            aria-pressed={!isResubmitMode}
          >
            <Check size={14} aria-hidden />
            Approve &amp; Evaluate
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${isResubmitMode ? styles.modeBtnActiveReject : ''}`}
            onClick={() => setMode('requestResubmit')}
            aria-pressed={isResubmitMode}
          >
            <AlertTriangle size={14} aria-hidden />
            Request Resubmit with Feedback
          </button>
        </div>
      )}

      {!isSubmitted && (
        <div className={styles.notSubmittedPanel} role="status">
          <div className={styles.notSubmittedIcon} aria-hidden>
            <Inbox size={18} />
          </div>
          <div className={styles.notSubmittedBody}>
            <span className={styles.notSubmittedTitle}>Not submitted yet</span>
            <span className={styles.notSubmittedDescription}>
              The student hasn&apos;t uploaded their file yet, so there&apos;s
              nothing to grade. You can extend the deadline from the modal
              footer to give them more time.
            </span>
          </div>
        </div>
      )}

      {/* The grading form is only meaningful once a submission exists. */}
      {isSubmitted && (
        <form className={styles.modalForm} onSubmit={handleSubmit}>
        {!isResubmitMode && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="lectureFeedback">
                Grade (0 – 10)
              </label>
              <input
                id="lectureFeedback"
                type="number"
                min={0}
                max={10}
                step={0.5}
                className={styles.formInput}
                value={lectureFeedback}
                onChange={(e) => setLectureFeedback(e.target.value)}
              />
              <span className={styles.helperText}>
                Numeric grade that students will see on their dashboard.
              </span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="capacityEvaluation">
                Capacity assessment
              </label>
              <select
                id="capacityEvaluation"
                className={styles.formInput}
                value={capacityEvaluation}
                onChange={(e) => setCapacityEvaluation(e.target.value)}
              >
                <option value="Xuất sắc">Excellent</option>
                <option value="Tốt">Good</option>
                <option value="Khá">Fair</option>
                <option value="Đạt yêu cầu">Pass</option>
                <option value="Chưa đạt">Needs improvement</option>
              </select>
            </div>
          </>
        )}

        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="finalOutcomeEvaluation">
            {isResubmitMode ? 'Feedback for the student' : 'Outcome notes'}
          </label>
          <textarea
            id="finalOutcomeEvaluation"
            className={styles.formTextarea}
            rows={5}
            value={finalOutcomeEvaluation}
            onChange={(e) => setFinalOutcomeEvaluation(e.target.value)}
            placeholder={
              isResubmitMode
                ? 'Summarise what is working and what needs to change.'
                : 'A short paragraph describing the final outcome and what was learned.'
            }
          />
          <span className={styles.helperText}>
            Visible to the student on their submission.
          </span>
        </div>

        {isResubmitMode && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="rejectionReason">
              What needs to change?{' '}
              <span className={styles.requiredStar}>*</span>
            </label>
            <textarea
              id="rejectionReason"
              className={styles.formTextarea}
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="What does the student need to change before resubmitting? (Required for a request-resubmit decision.)"
              required
            />
            <span className={styles.helperText}>
              A specific reason is required before the lecturer can request a resubmit.
            </span>
          </div>
        )}

        {(report.lectureFeedback !== null && report.lectureFeedback !== undefined) ||
        report.finalOutcomeEvaluation ||
        report.capacityEvaluation ||
        readPreviousReportId(report) !== null ? (
          <div className={styles.existingFeedbackBlock}>
            <span className={styles.existingFeedbackLabel}>
              EXISTING FEEDBACK ON RECORD
            </span>
            {(() => {
              const { previousReportId: sentinelId, remainder } = parseLineage(
                report.capacityEvaluation,
              );
              const previousReportId =
                readPreviousReportId(report) ?? sentinelId;
              return (
                <>
                  {previousReportId !== null && (
                    <div className={styles.existingRow}>
                      <b>Previous report:</b> #{previousReportId}
                    </div>
                  )}
                  {report.lectureFeedback !== null &&
                    report.lectureFeedback !== undefined && (
                      <div className={styles.existingRow}>
                        <b>Score:</b> {report.lectureFeedback} / 10
                      </div>
                    )}
                  {report.finalOutcomeEvaluation && (
                    <div className={styles.existingRow}>
                      <b>Final Outcome:</b> {report.finalOutcomeEvaluation}
                    </div>
                  )}
                  {(remainder || (report.capacityEvaluation && !sentinelId)) && (
                    <div className={styles.existingRow}>
                      <b>Notes / Rejection Reason:</b>{' '}
                      {sentinelId !== null ? remainder : report.capacityEvaluation}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : null}

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>{error.message}</span>
          </div>
        )}

        <div className={styles.modalFooter}>
          {showCancel && (
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className={
              isResubmitMode ? styles.submitRejectBtn : styles.submitApproveBtn
            }
            disabled={
              isLoading ||
              (isResubmitMode &&
                !rejectionReason.trim() &&
                !finalOutcomeEvaluation.trim())
            }
            title={
              isLoading
                ? 'Submission in progress'
                : isResubmitMode &&
                    !rejectionReason.trim() &&
                    !finalOutcomeEvaluation.trim()
                  ? 'Add a reason or feedback before requesting a resubmit.'
                  : undefined
            }
          >
            {isLoading ? (
              <Loader size={14} className={styles.spinningIcon} aria-hidden />
            ) : isResubmitMode ? (
              <AlertTriangle size={14} aria-hidden />
            ) : (
              <Check size={14} aria-hidden />
            )}
            {isLoading
              ? 'Submitting…'
              : isResubmitMode
                ? 'Request Resubmit'
                : 'Approve & Evaluate'}
          </button>
        </div>
      </form>
      )}
    </>
  );
};

export default EvaluateReportForm;
