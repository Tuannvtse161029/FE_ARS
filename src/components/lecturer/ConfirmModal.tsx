/**
 * ConfirmModal — a styled, accessible replacement for `window.confirm()`.
 *
 * Use this for any destructive or confirmatory action that requires the user
 * to explicitly accept before proceeding. Pass the i18n labels and action
 * callbacks from the parent — the modal renders inline, does not block the
 * thread, and can be tested with Playwright.
 *
 * @example
 * ```tsx
 * const [confirmOpen, setConfirmOpen] = useState(false);
 *
 * <button onClick={() => setConfirmOpen(true)}>Delete</button>
 *
 * <ConfirmModal
 *   open={confirmOpen}
 *   title={t('common.areYouSure')}
 *   description={t('common.destructiveWarning')}
 *   variant="destructive"
 *   confirmLabel={t('common.delete')}
 *   cancelLabel={t('common.cancel')}
 *   onConfirm={handleDelete}
 *   onClose={() => setConfirmOpen(false)}
 * />
 * ```
 */

import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import styles from './ConfirmModal.module.css';

export type ConfirmModalVariant = 'default' | 'destructive';

export interface ConfirmModalProps {
  /** Whether the modal is open. When false the component renders nothing. */
  open: boolean;
  /** Bold title shown at the top of the modal. */
  title: string;
  /**
   * Optional descriptive text shown below the title.
   * Pass a second line of context (e.g. "This will archive the group.").
   */
  description?: string;
  /**
   * Visual variant — `destructive` shows a red confirm button and warning icon;
   * `default` shows a blue confirm button and an info icon.
   */
  variant?: ConfirmModalVariant;
  /** Label for the primary (right) action button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the secondary (left) action button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Called when the user clicks the confirm button. */
  onConfirm: () => void;
  /** Called when the user clicks the cancel button or the backdrop. */
  onClose: () => void;
}

export const ConfirmModal = ({
  open,
  title,
  description,
  variant = 'default',
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
}: ConfirmModalProps) => {
  if (!open) return null;

  const isDestructive = variant === 'destructive';
  const Icon = isDestructive ? AlertTriangle : Info;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop, not the card itself
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby={description ? 'confirm-modal-desc' : undefined}
      onClick={handleBackdropClick}
    >
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={`${styles.iconWrap} ${isDestructive ? styles.iconWrapDestructive : styles.iconWrapDefault}`}>
            <Icon size={18} aria-hidden />
          </div>
          <div className={styles.titleBlock}>
            <h3 id="confirm-modal-title" className={styles.title}>
              {title}
            </h3>
            {description && (
              <p id="confirm-modal-desc" className={styles.description}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={cancelLabel ?? 'Close'}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
          >
            {cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            className={`${styles.confirmBtn} ${isDestructive ? styles.confirmBtnDestructive : styles.confirmBtnDefault}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
