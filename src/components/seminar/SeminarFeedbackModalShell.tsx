/**
 * SeminarFeedbackModalShell — pop-up shell that hosts the owner feedback
 * panel. Replaces the previous inline section with a focus-trapped,
 * scroll-locked modal overlay that respects Escape and click-outside.
 *
 * Animations: subtle scale-in via the existing modalCardIn pattern. Body
 * scroll is locked while the modal is open so the page underneath cannot
 * scroll under the dialog.
 */

import { useEffect, useRef } from 'react';
import { X, ClipboardList } from 'lucide-react';
import { useLocale } from '../../i18n/I18nContext';
import { formatDisplayDate, formatDisplayTime } from '../../utils/datetime';
import styles from './SeminarFeedbackModalShell.module.css';

interface SeminarFeedbackModalShellProps {
  seminarTitle: string;
  startTime?: string;
  endTime?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const SeminarFeedbackModalShell: React.FC<
  SeminarFeedbackModalShellProps
> = ({ seminarTitle, startTime, endTime, onClose, children }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const locale = useLocale();

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() =>
      dialogRef.current?.focus(),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, [onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seminar-feedback-modal-title"
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className={styles.modalCard}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div className={styles.headerTitleBlock}>
            <span className={styles.headerIcon} aria-hidden>
              <ClipboardList size={18} />
            </span>
            <div>
              <p className={styles.modalEyebrow}>Feedback &amp; Grading</p>
              <h2
                id="seminar-feedback-modal-title"
                className={styles.modalTitle}
              >
                {seminarTitle}
              </h2>
              {startTime && (
                <p className={styles.modalSubtitle}>
                  {formatDisplayDate(startTime, locale)}
                  {endTime
                    ? ` · ${formatDisplayTime(startTime, locale)} – ${formatDisplayTime(
                        endTime,
                        locale,
                      )}`
                    : ''}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close feedback panel"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
};

export default SeminarFeedbackModalShell;
