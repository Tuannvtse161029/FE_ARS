import {
  X,
  ClipboardCheck,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import {
  EvaluateReportForm,
  type EvaluationAction,
} from './EvaluateReportForm';
import type { PhasedReport } from '../../services/phasedReport.service';
import { formatDisplayDateTime } from '../../utils/datetime';
import styles from './EvaluateReportModal.module.css';

export type { EvaluationAction };

export interface EvaluateReportModalProps {
  isOpen: boolean;
  report: PhasedReport | null;
  onClose: () => void;
  onSubmitted?: (action: EvaluationAction, updated: PhasedReport) => void;
}

// Thin wrapper around `EvaluateReportForm`. The form was extracted so it
// can be reused inside `PhaseReportDetailModal` (the lecturer's
// click-through surface) without duplicating grading logic. This modal
// keeps the original public API so existing call sites
// (`EvaluateReports.tsx`, the legacy PhaseReports reviewer console) keep
// working unchanged.
export const EvaluateReportModal = ({
  isOpen,
  report,
  onClose,
  onSubmitted,
}: EvaluateReportModalProps) => {
  if (!isOpen || !report) return null;

  const handleSubmitted = (action: EvaluationAction, updated: PhasedReport) => {
    onSubmitted?.(action, updated);
    onClose();
  };

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
                Submitted {formatDisplayDateTime(report.submittedAt)}
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

        {/* Status pill row — kept in the modal header so the lecturer can
              read the current state without scrolling into the form body. */}
        <div className={styles.metaRow}>
          <StatusBadge status={report.status ?? 'WAITING'} />
        </div>

        <EvaluateReportForm
          report={report}
          onSubmitted={handleSubmitted}
          onCancel={onClose}
        />
      </div>
    </div>
  );
};

export default EvaluateReportModal;
