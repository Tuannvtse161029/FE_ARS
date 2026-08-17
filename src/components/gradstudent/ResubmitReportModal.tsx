import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import SubmitReportModal from './SubmitReportModal';

export interface ResubmitReportModalProps {
  isOpen: boolean;
  researchGroupId: number;
  groupMemberId?: number;
  phaseKey: string;
  phaseTitle: string;
  lecturerName?: string;
  resubmittingReport: SubmittedPhasedReport | null;
  isSubmitting: boolean;
  lastSubmitted: SubmittedPhasedReport | null;
  onClose: () => void;
  onResubmitted: (report: SubmittedPhasedReport) => void;
}

// Wrapper around SubmitReportModal in "resubmit" mode. Kept as a separate
// component so a caller can wire a single-purpose button without worrying
// about the resubmission flag.
export function ResubmitReportModal({
  isOpen,
  researchGroupId,
  groupMemberId,
  phaseKey,
  phaseTitle,
  lecturerName,
  resubmittingReport,
  isSubmitting,
  lastSubmitted,
  onClose,
  onResubmitted,
}: ResubmitReportModalProps): JSX.Element | null {
  return (
    <SubmitReportModal
      isOpen={isOpen}
      researchGroupId={researchGroupId}
      {...(typeof groupMemberId === 'number' ? { groupMemberId } : {})}
      phaseKey={phaseKey}
      phaseTitle={phaseTitle}
      {...(lecturerName ? { lecturerName } : {})}
      resubmittingReport={resubmittingReport}
      isSubmitting={isSubmitting}
      lastSubmitted={lastSubmitted}
      onClose={onClose}
      onSubmitted={onResubmitted}
    />
  );
}

export default ResubmitReportModal;