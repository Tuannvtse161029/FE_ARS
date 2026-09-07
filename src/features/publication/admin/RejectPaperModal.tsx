import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import styles from './RejectPaperModal.module.css';

interface RejectPaperModalProps {
  paperTitle: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  identity?: boolean;
  error?: string;
}

export const RejectPaperModal = ({
  paperTitle,
  isSubmitting,
  onClose,
  onConfirm,
  identity = false,
  error,
}: RejectPaperModalProps): JSX.Element => {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    textareaRef.current?.focus();
    return () => previous?.focus();
  }, []);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed && !isSubmitting) onConfirm(trimmed);
  };

  return createPortal(
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSubmitting) onClose();
    }}>
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="reject-paper-title" onKeyDown={(event) => {
        if (event.key === 'Escape' && !isSubmitting) onClose();
        if (event.key !== 'Tab') return;
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)');
        if (!controls?.length) { event.preventDefault(); return; }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <AlertTriangle size={18} aria-hidden="true" />
            <h2 id="reject-paper-title">{identity ? 'Reject identity verification' : 'Reject paper'}</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={isSubmitting} aria-label="Close rejection dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form onSubmit={submit}>
          {error ? <p role="alert" className={styles.description}>{error}</p> : null}
          <p className={styles.description}>
            Provide a reason for {identity ? 'rejecting identity verification for' : 'rejecting'} “{paperTitle}”.
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
              {isSubmitting ? 'Rejecting…' : identity ? 'Reject identity' : 'Reject paper'}
            </button>
          </footer>
        </form>
      </div>
    </div>, document.body
  );
};

export default RejectPaperModal;
