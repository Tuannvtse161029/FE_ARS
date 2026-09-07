import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './RejectPaperModal.module.css';

export function PublicationConfirmation({ title, message, busy, error, onClose, onConfirm }: {
  title: string;
  message: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => {
      if (!busy && event.target === event.currentTarget) onClose();
    }}>
      <div ref={dialog} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="publication-confirm-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) onClose();
          if (event.key === 'Tab') {
            const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
            if (!buttons?.length) { event.preventDefault(); return; }
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
              event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault(); first.focus();
            }
          }
        }}>
        <header className={styles.header}><h2 id="publication-confirm-title">{title}</h2></header>
        <p className={styles.description}>{message}</p>
        {error ? <p role="alert" className={styles.description}>{error}</p> : null}
        <footer className={styles.footer}>
          <button type="button" className={styles.cancelButton} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.confirmButton} disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : title}</button>
        </footer>
      </div>
    </div>, document.body,
  );
}
