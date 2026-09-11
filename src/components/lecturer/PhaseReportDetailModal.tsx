/**
 * PhaseReportDetailModal — Lecturer click-through surface for one
 * PhasedReport.
 *
 * Single modal that bundles together everything the lecturer needs to
 * review and act on a report:
 *   - Header: research topic title + Phase N · milestone + group name.
 *   - Meta strip: submitted by / submitted on / deadline (overdue in red).
 *   - Existing evaluation summary (read-only, shown when the report has
 *     already been graded so the lecturer sees prior decisions before
 *     re-grading).
 *   - Inline grading form (`EvaluateReportForm`) — the SAME component
 *     used by `EvaluateReportModal`, so approve / request-resubmit logic
 *     stays single-source.
 *   - Footer with "Update Deadline" — the owning page wires this to its
 *     `ExtendDeadlineModal` so we never open a nested modal here.
 *
 * Status filtering, deep-link pre-filters, and submission data fetching
 * live in `PhaseReports.tsx`. This component is purely presentational +
 * form behaviour.
 */

import { useMemo } from 'react';
import {
  Calendar,
  ClipboardCheck,
  Clock,
  FileText,
  Users,
  X,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { EvaluateReportForm, type EvaluationAction } from './EvaluateReportForm';
import type { PhasedReport } from '../../services/phasedReport.service';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '../../utils/datetime';
import styles from './PhaseReportDetailModal.module.css';

export interface PhaseReportDetailModalProps {
  isOpen: boolean;
  report: PhasedReport | null;
  /** Resolved by the parent from `useResearchGroups` to avoid an extra fetch. */
  groupName?: string;
  /**
   * Whether the lecturer is currently allowed to push the deadline
   * forward. The parent decides this (it has the data the BE returns);
   * the modal just disables its Update Deadline button until it
   * becomes true.
   */
  isDeadlineOverdue: boolean;
  onClose: () => void;
  /**
   * Parent opens the existing `ExtendDeadlineModal` in response.
   * We pass the report back so the parent can keep its state minimal.
   */
  onRequestExtendDeadline: (report: PhasedReport) => void;
  /** Fired after a successful evaluate / resubmit. */
  onSubmitted?: (action: EvaluationAction, updated: PhasedReport) => void;
}

/**
 * Is the deadline already past without a successful evaluation?
 * Used to render the deadline label in the danger colour.
 */
const isOverdueDeadline = (report: PhasedReport): boolean => {
  if (!report.deadlineAt) return false;
  const d = new Date(report.deadlineAt);
  if (Number.isNaN(d.getTime())) return false;
  if (report.status === 'EVALUATED' || report.status === 'Passed') return false;
  return d.getTime() < Date.now();
};

export const PhaseReportDetailModal = ({
  isOpen,
  report,
  groupName,
  isDeadlineOverdue,
  onClose,
  onRequestExtendDeadline,
  onSubmitted,
}: PhaseReportDetailModalProps) => {
  const overdue = useMemo(
    () => (report ? isOverdueDeadline(report) : false),
    [report],
  );

  if (!isOpen || !report) return null;

  const id = report.id ?? report.phasedReportId;
  const phaseNumber = report.phaseNumber ?? null;
  const phaseLabel = report.milestoneTitle
    ? phaseNumber !== null
      ? `Phase ${phaseNumber} · ${report.milestoneTitle}`
      : report.milestoneTitle
    : phaseNumber !== null
      ? `Phase ${phaseNumber}`
      : 'Phase';
  const resolvedGroup = groupName ?? report.groupName ?? null;
  const hasPdf = !!report.reportFileUrl;
  const hasExistingEvaluation =
    (report.lectureFeedback !== null && report.lectureFeedback !== undefined) ||
    !!report.finalOutcomeEvaluation ||
    !!report.capacityEvaluation;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="phase-report-detail-title"
    >
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <span className={styles.iconCircle}>
              <ClipboardCheck size={20} aria-hidden />
            </span>
            <div className={styles.titleText}>
              <span className={styles.eyebrow}>
                <FileText size={12} aria-hidden />{' '}
                {report.topicTitle ?? `Research Topic`}
              </span>
              <h3 id="phase-report-detail-title" className={styles.title}>
                {phaseLabel}
              </h3>
              <span className={styles.subtitle}>
                <Users size={12} aria-hidden />{' '}
                {resolvedGroup ?? 'Unassigned group'}
              </span>
            </div>
            <div className={styles.statusColumn}>
              <StatusBadge status={report.status ?? 'WAITING'} />
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close phase report detail"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Meta strip */}
        <div className={styles.metaStrip}>
          <div className={styles.metaItem}>
            <Users size={14} aria-hidden />
            <span className={styles.metaLabel}>Submitted by</span>
            <span className={styles.metaValue}>
              {report.studentName ?? 'Not supplied'}
            </span>
          </div>
          <div className={styles.metaItem}>
            <Calendar size={14} aria-hidden />
            <span className={styles.metaLabel}>Submitted on</span>
            <span className={styles.metaValue}>
              {formatDisplayDateTime(report.submittedAt)}
            </span>
          </div>
          <div
            className={`${styles.metaItem} ${overdue ? styles.metaItemDanger : ''}`}
          >
            <Clock size={14} aria-hidden />
            <span className={styles.metaLabel}>Deadline</span>
            <span className={styles.metaValue}>
              {formatDisplayDateTime(report.deadlineAt)}
              {overdue && (
                <span className={styles.overdueTag}> · overdue</span>
              )}
            </span>
          </div>
        </div>

        {/* Existing evaluation summary — read-only recap of prior grading
             so the lecturer sees what was already decided before changing
             it. Only renders when the BE has any grading fields on record. */}
        {hasExistingEvaluation && (
          <section className={styles.priorBlock}>
            <span className={styles.priorLabel}>PRIOR EVALUATION</span>
            <div className={styles.priorGrid}>
              {report.lectureFeedback !== null &&
                report.lectureFeedback !== undefined && (
                  <div className={styles.priorCell}>
                    <span className={styles.priorCellLabel}>Score</span>
                    <span className={styles.priorCellValue}>
                      {report.lectureFeedback} / 10
                    </span>
                  </div>
                )}
              {report.capacityEvaluation && (
                <div className={styles.priorCell}>
                  <span className={styles.priorCellLabel}>Capacity</span>
                  <span className={styles.priorCellValue}>
                    {report.capacityEvaluation}
                  </span>
                </div>
              )}
              {report.finalOutcomeEvaluation && (
                <div className={`${styles.priorCell} ${styles.priorCellWide}`}>
                  <span className={styles.priorCellLabel}>Outcome notes</span>
                  <span className={styles.priorCellValue}>
                    {report.finalOutcomeEvaluation}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Inline grading form. showCancel={false} — the parent owns the
             modal close button, so we don't need a Cancel button inside
             the form. The form will surface success via onSubmitted; the
             parent decides to close + refresh. */}
        <section className={styles.formSection}>
          <span className={styles.sectionLabel}>LECTURER REVIEW</span>
          <EvaluateReportForm
            report={report}
            onSubmitted={onSubmitted}
            showCancel={false}
          />
        </section>

        {/* Footer — "Update Deadline" hands off to the parent's existing
             ExtendDeadlineModal so we never nest two modals. The footer
             also hosts the file URL display (when no PDF is attached the
             link is omitted). */}
        <footer className={styles.footer}>
          <div className={styles.footerLeft}>
            {!hasPdf && (
              <span className={styles.noFilePill}>
                <FileText size={13} aria-hidden /> No PDF uploaded
              </span>
            )}
            {hasPdf && (
              <span className={styles.filePill}>
                <FileText size={13} aria-hidden /> PDF submitted
              </span>
            )}
          </div>
          <div className={styles.footerRight}>
            <button
              type="button"
              className={styles.updateDeadlineBtn}
              onClick={() => onRequestExtendDeadline(report)}
              disabled={id == null || !isDeadlineOverdue}
              title={
                isDeadlineOverdue
                  ? 'Extend the deadline for this phase report'
                  : 'Update deadline is available once the deadline has passed'
              }
            >
              <Clock size={14} aria-hidden />
              Update deadline
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

// Re-export the date helpers so other surfaces can rely on the same
// formatter contract for `PhaseReportDetailModal` rows (deadline column
// in the parent table reads through `formatDisplayDate`, which the
// parent imports directly from utils).
export { formatDisplayDate };

export default PhaseReportDetailModal;
