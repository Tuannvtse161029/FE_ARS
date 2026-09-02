import { useEffect, useState, type FormEvent } from 'react';
import {
  X,
  ClipboardCheck,
  AlertTriangle,
  Loader,
  Check,
  ExternalLink,
  FileText,
} from 'lucide-react';
import LazyPdfViewer from '../PdfViewer/LazyPdfViewer';
import { StatusBadge } from './StatusBadge';
import { useEvaluatePhasedReport } from '../../hooks/useEvaluatePhasedReport';
import type { PhasedReport } from '../../services/phasedReport.service';
import styles from './EvaluateReportModal.module.css';

export type EvaluationAction = 'approve' | 'reject';

export interface EvaluateReportModalProps {
  isOpen: boolean;
  report: PhasedReport | null;
  onClose: () => void;
  onSubmitted?: (action: EvaluationAction, updated: PhasedReport) => void;
}

type Mode = 'approve' | 'reject';

// Sentinel prefix that Agent 2 (GradStudent) writes into `capacityEvaluation`
// when a PhasedReport is a resubmission of a previously rejected one. Format:
//
//   __LINEAGE__:Resubmitted from report #<previousReportId>[<remainder>]
//
// We split it off and render the lineage number in its own row so the
// Lecturer's "Notes / Rejection Reason" section doesn't expose it as the
// rejection reason. The intent map and the gap ticket context live at
// `docs/local-only/lead-phase-c-contract.md` §2.2.A and §E.5.1.
//
// Until Agent 2 lands `parsePhasedReportLineage` on the service export, we
// keep a private local parser so the modal never couples to Agent 2's
// section at module-evaluation time.
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
  // Format is "Resubmitted from report #<n>" optionally followed by a
  // user-supplied remainder separated by whitespace.
  const match = /^Resubmitted from report #(\d+)\s*(.*)$/.exec(after);
  if (!match) {
    // Malformed sentinel — surface the raw payload as the remainder so
    // we never silently drop data.
    return { previousReportId: null, remainder: after };
  }
  const previousReportId = Number(match[1]);
  const remainder = (match[2] ?? '').trim();
  return {
    previousReportId: Number.isFinite(previousReportId) ? previousReportId : null,
    remainder,
  };
};

// Type-guard for the `previousReportId` field that Agent 2 will land on
// `SubmittedPhasedReport` (lead-phase-c-contract.md S-7). We accept the
// field defensively on the BE-resolved PhasedReport shape so we read it
// when present and fall back to the sentinel-detected value otherwise.
const readPreviousReportId = (
  report: PhasedReport,
): number | null => {
  const ext = report as PhasedReport & { previousReportId?: unknown };
  const raw = ext.previousReportId;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
};

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
};

export const EvaluateReportModal = ({
  isOpen,
  report,
  onClose,
  onSubmitted,
}: EvaluateReportModalProps) => {
  const [mode, setMode] = useState<Mode>('approve');
  const [lectureFeedback, setLectureFeedback] = useState<string>('8');
  const [capacityEvaluation, setCapacityEvaluation] = useState<string>('Tốt');
  const [finalOutcomeEvaluation, setFinalOutcomeEvaluation] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showPdf, setShowPdf] = useState(false);

  const reportId =
    report && typeof report.id === 'number' ? report.id : null;
  const { submit, isLoading, error, result, reset } =
    useEvaluatePhasedReport(reportId);

  // Reset form whenever we open the modal for a fresh report.
  useEffect(() => {
    if (isOpen && report) {
      setMode('approve');
      setLectureFeedback('8');
      setCapacityEvaluation(report.capacityEvaluation || 'Tốt');
      setFinalOutcomeEvaluation(report.finalOutcomeEvaluation ?? report.lecturerDescription ?? '');
      setRejectionReason('');
      setShowPdf(false);
      reset();
    }
  }, [isOpen, report, reset]);

  // Close on successful evaluation (parent will refresh the list).
  useEffect(() => {
    if (result && onSubmitted) {
      onSubmitted(mode, result);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!isOpen || !report) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const grade = Number(lectureFeedback);
    const trimmedOutcome = finalOutcomeEvaluation.trim();
    const trimmedReason = rejectionReason.trim();
    if (mode === 'reject' && !trimmedReason && !trimmedOutcome) {
      // The service rejects this too, but we surface the message locally for
      // an instant UX without an extra round-trip.
      return;
    }
    if (mode === 'approve' && (Number.isNaN(grade) || grade < 0 || grade > 10)) {
      return;
    }
    await submit(mode, {
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

  const isRejectMode = mode === 'reject';
  const hasPdf = !!report.reportFileUrl;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        {/* Header — show topic / phase / group context instead of raw IDs.
              The lecturer almost never reads `#3427` cold; they read "the
              literature review submission from NLP Lab Group A". */}
        <div className={styles.modalHeaderRow}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.modalIconCircle}>
              <ClipboardCheck size={18} aria-hidden />
            </span>
            <div>
              <h3 className={styles.modalTitle}>
                {report.milestoneTitle ??
                  `Phase ${report.phaseNumber ?? '—'}`}
              </h3>
              <span className={styles.modalSubtitle}>
                {report.groupName ?? report.topicTitle
                  ? `${report.groupName ?? 'Unassigned group'}${
                      report.topicTitle
                        ? ` · ${report.topicTitle}`
                        : ''
                    }`
                  : `Report #${report.id ?? '—'}`}
                {' · '}
                Submitted {formatDateTime(report.submittedAt)}
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close evaluation modal"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Status pill + open-in-new-tab row */}
        <div className={styles.metaRow}>
          <StatusBadge status={report.status ?? 'WAITING'} />
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

        {/* Optional inline PDF viewer */}
        {showPdf && hasPdf && (
          <div className={styles.pdfViewerBox}>
            <LazyPdfViewer url={report.reportFileUrl ?? null} />
          </div>
        )}

        {/* Mode switcher */}
        <div className={styles.modeSwitcher}>
          <button
            type="button"
            className={`${styles.modeBtn} ${!isRejectMode ? styles.modeBtnActiveApprove : ''}`}
            onClick={() => setMode('approve')}
            aria-pressed={!isRejectMode}
          >
            <Check size={14} aria-hidden />
            Approve &amp; Evaluate
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${isRejectMode ? styles.modeBtnActiveReject : ''}`}
            onClick={() => setMode('reject')}
            aria-pressed={isRejectMode}
          >
            <AlertTriangle size={14} aria-hidden />
            Reject with Feedback
          </button>
        </div>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          {!isRejectMode && (
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
              {isRejectMode
                ? 'Feedback for the student'
                : 'Outcome notes'}
            </label>
            <textarea
              id="finalOutcomeEvaluation"
              className={styles.formTextarea}
              rows={5}
              value={finalOutcomeEvaluation}
              onChange={(e) => setFinalOutcomeEvaluation(e.target.value)}
              placeholder={
                isRejectMode
                  ? 'Summarise what is working and what needs to change.'
                  : 'A short paragraph describing the final outcome and what was learned.'
              }
            />
            <span className={styles.helperText}>
              Visible to the student on their submission.
            </span>
          </div>

          {isRejectMode && (
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
                placeholder="Why is this submission being rejected? (Required for a request-revision decision.)"
                required
              />
              <span className={styles.helperText}>
                A specific reason is required before the lecturer can submit
                a revision request.
              </span>
            </div>
          )}

          {/* Existing feedback (read-only). When `capacityEvaluation` carries a
              `__LINEAGE__:` sentinel (lead-phase-c-contract.md §2.2.A) we split
              the lineage row off from the rejection-reason row, so the
              Lecturer never sees the resubmit lineage labelled as a
              rejection reason. The optional `previousReportId` field
              (Agent-2-side on SubmittedPhasedReport) is preferred when
              both signals are present. */}
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
                    {/* When a sentinel is present, the remainder is what
                        the GradStudent left *after* the lineage header
                        (typically empty). We render it only when non-blank,
                        so legacy non-sentinel rows keep showing the full
                        capacityEvaluation as "Notes / Rejection Reason". */}
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
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={isRejectMode ? styles.submitRejectBtn : styles.submitApproveBtn}
              disabled={
                isLoading ||
                (isRejectMode && !rejectionReason.trim() && !finalOutcomeEvaluation.trim())
              }
              title={
                isLoading
                  ? 'Submission in progress'
                  : isRejectMode && !rejectionReason.trim() && !finalOutcomeEvaluation.trim()
                    ? 'Add a rejection reason or feedback before submitting.'
                    : undefined
              }
            >
              {isLoading ? (
                <Loader size={14} className={styles.spinningIcon} aria-hidden />
              ) : isRejectMode ? (
                <AlertTriangle size={14} aria-hidden />
              ) : (
                <Check size={14} aria-hidden />
              )}
              {isLoading
                ? 'Submitting…'
                : isRejectMode
                ? 'Request Revision'
                : 'Approve & Evaluate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EvaluateReportModal;