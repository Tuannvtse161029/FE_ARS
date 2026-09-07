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
  Sliders,
} from 'lucide-react';
import { Button } from '../../../components/Button/Button';
import { useLocale } from '../../../i18n/I18nContext';
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
  onOpenFeedbackSetup?: () => void;
}

export const SummaryDialog: React.FC<SummaryDialogProps> = ({
  isOpen,
  seminarTitle,
  meetLink,
  guestEmails,
  onCopyLink,
  onLaunch,
  onClose,
  onOpenFeedbackSetup,
}) => {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const copy = (en: string, vi: string) => (isVi ? vi : en);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <span className={styles.generatedIcon}>
          <Check size={28} strokeWidth={3} aria-hidden />
        </span>
        <h3 className={styles.generatedTitle}>
          {copy('Seminar Created & Google Meet Link Generated', 'Tạo Hội thảo & Đường dẫn Google Meet thành công')}
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
              {copy('Copy Link', 'Sao chép')}
            </button>
          </div>
        </div>

        <div className={styles.inviteAlert}>
          <div className={styles.inviteAlertTitleRow}>
            <AlertTriangle size={14} aria-hidden />
            <span>
              {copy(
                'Email invitations have been sent to invited guests. An automated reminder will be sent 1 day before the seminar starts.',
                'Thư mời đã được gửi đến các khách mời. Lời nhắc tự động sẽ được gửi trước 1 ngày khi hội thảo diễn ra.'
              )}
            </span>
          </div>
          <div className={styles.inviteAlertSent}>
            <Mail size={12} aria-hidden />
            {copy('Sent to:', 'Gửi đến:')} {guestEmails.join(', ') || '(none)'}
          </div>
        </div>

        <div className={styles.modalFooter} style={{ flexWrap: 'wrap', gap: '8px' }}>
          <Button variant="outline" size="md" onClick={onClose}>
            {copy('Back to Seminars', 'Quay lại danh sách')}
          </Button>
          {onOpenFeedbackSetup && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<Sliders size={14} aria-hidden />}
              onClick={onOpenFeedbackSetup}
              style={{
                borderColor: 'var(--ars-lecturer)',
                color: 'var(--ars-lecturer)',
              }}
            >
              {copy('Set up feedback', 'Thiết lập đánh giá')}
            </Button>
          )}
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
