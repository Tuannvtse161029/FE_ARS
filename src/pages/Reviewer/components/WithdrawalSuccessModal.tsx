import { X, Check } from 'lucide-react';
import styles from './WithdrawalSuccessModal.module.css';

interface WithdrawalSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
}

export const WithdrawalSuccessModal = ({ isOpen, onClose, requestId }: WithdrawalSuccessModalProps) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconCircle}>
            <Check size={28} strokeWidth={3} color="#ffffff" />
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <h2 className={styles.title}>Withdrawal Request Submitted!</h2>
          <p className={styles.subtitle}>
            Your request has been sent to the admin for review.
          </p>

          <div className={styles.detailsCard}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Request ID</span>
              <span className={styles.detailValue}>{requestId}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status</span>
              <span className={styles.statusPending}>Pending</span>
            </div>
          </div>

          <p className={styles.note}>
            You will be notified once the admin has reviewed and processed your request.
          </p>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.closeFooterBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalSuccessModal;
