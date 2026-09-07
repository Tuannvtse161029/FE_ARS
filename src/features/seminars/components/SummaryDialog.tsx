/**
 * SummaryDialog — confirmation dialog after seminar creation
 *
 * Extracted from src/pages/Lecturer/SeminarWorkspace.tsx
 */
import {
  Check,
  Video,
  FileText,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../../components/Button/Button';
// CSS module kept at the original SeminarWorkspace CSS location for now.
import styles from '../../../pages/Lecturer/SeminarWorkspace.module.css';

export interface SummaryDialogProps {
  isOpen: boolean;
  seminarTitle: string;
  meetLink: string;
  guestEmails: string[];
  onCopyLink: () => void;
  onLaunch: () => void;
  onClose: () => void;
}

export const SummaryDialog: React.FC<SummaryDialogProps> = ({
  isOpen,
  seminarTitle,
  meetLink,
  guestEmails,
  onCopyLink,
  onLaunch,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <span className={styles.generatedIcon}>
          <Check size={28} strokeWidth={3} aria-hidden />
        </span>
        <h3 className={styles.generatedTitle}>
          Seminar Created &amp; Google Meet Link Generated
        </h3>
        <p className={styles.generatedSub}>{seminarTitle}</p>

        <div className={styles.meetCard}>
          <span className={styles.meetCardLabel}>
            <Video size={14} aria-hidden />
            Google Meet Link
          </span>
          <div className={styles.meetCardRow}>
            <input type="text" className={styles.meetCardInput} value={meetLink} readOnly />
            <button type="button" className={styles.copyBtn} onClick={onCopyLink}>
              <FileText size={14} aria-hidden />
              Copy Link
            </button>
          </div>
        </div>

        <div className={styles.inviteAlert}>
          <div className={styles.inviteAlertTitleRow}>
            <AlertTriangle size={14} aria-hidden />
            <span>
              Email invitations have been sent to invited guests. An
              automated reminder will be sent <strong>1 day before</strong> the seminar starts.
            </span>
          </div>
          <div className={styles.inviteAlertSent}>
            <Mail size={12} aria-hidden />
            Sent to: {guestEmails.join(', ') || '(none)'}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <Button variant="outline" size="md" onClick={onClose}>
            Back to Seminars
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Video size={14} aria-hidden />}
            onClick={onLaunch}
            className={styles.actionBtnSuccess}
          >
            Launch Google Meet
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SummaryDialog;
