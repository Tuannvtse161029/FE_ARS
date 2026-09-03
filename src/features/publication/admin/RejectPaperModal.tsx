import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import styles from './RejectPaperModal.module.css';

interface RejectPaperModalProps {
  paperTitle: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const RejectPaperModal = ({
  paperTitle,
  isSubmitting,
  onClose,
  onConfirm,
}: RejectPaperModalProps): JSX.Element => {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSubmitting) onClose();
    }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="reject-paper-title">
        <header className={styles.header}>
          <div className={styles.heading}>
            <AlertTriangle size={18} aria-hidden="true" />
            <h2 id="reject-paper-title">Reject paper</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={isSubmitting} aria-label="Close rejection dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form onSubmit={submit}>
          <p className={styles.description}>
            Provide the reason that will be sent to the author for “{paperTitle}”.
          </p>
          <label className={styles.field}>
            <span>Rejection reason</span>
            <textarea
              ref={textareaRef}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what needs to be addressed…"
              rows={5}
              disabled={isSubmitting}
              required
            />
          </label>
          <footer className={styles.footer}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className={styles.confirmButton} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting ? 'Rejecting…' : 'Reject paper'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default RejectPaperModal;
