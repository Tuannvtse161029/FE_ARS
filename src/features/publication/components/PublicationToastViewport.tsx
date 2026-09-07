/**
 * PublicationToastViewport — single-instance UI host for publication
 * lifecycle toasts.
 *
 * Mount this once near the root of the authenticated layout. The toast
 * data lives in module state (see publicationToast.ts) so the viewport
 * does not need to be a controlled component — any mutation anywhere in
 * the app triggers the viewport to render.
 *
 * Positioning rules (covers the requirements in §8 of the incident brief):
 *   - `position: fixed` insets the viewport from the visible window, not
 *     from the scrolled document.
 *   - The toast centers horizontally inside the viewport rather than at
 *     top:0 so it stays in the user's natural eye-line regardless of
 *     how far the page was scrolled when the mutation fired.
 *   - The portal target is `<body>` so the dialog cannot be clipped by an
 *     ancestor with `transform`, `filter`, `overflow: hidden`, or a
 *     stacking context that is lower than the document root.
 *   - Background scrolling is preserved (this is a toast, not a modal).
 *
 * Accessibility:
 *   - `role="status"` for success / info (polite announcement).
 *   - `role="alert"` for error (assertive announcement).
 *   - The dismiss button is reachable by keyboard and is labelled for
 *     screen readers in the active locale.
 */
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';
import {
  usePublicationToast,
  type PublicationToast as ToastShape,
} from '../utils/publicationToast';
import { useT } from '../../../i18n/I18nContext';
import styles from './PublicationToastViewport.module.css';

const KIND_ICON: Record<ToastShape['kind'], JSX.Element> = {
  success: <CheckCircle2 size={18} aria-hidden="true" />,
  error: <AlertCircle size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
};

const KIND_CLASS: Record<ToastShape['kind'], string> = {
  success: styles.toastSuccess ?? '',
  error: styles.toastError ?? '',
  info: styles.toastInfo ?? '',
};

export const PublicationToastViewport = (): JSX.Element | null => {
  const { toast, dismiss } = usePublicationToast();
  const t = useT();

  // Lock body scroll while an error toast is on screen so the user can
  // read the failure reason without losing the dialog context. We only
  // block scroll for errors — success / info toasts are time-limited
  // and never hide interactive content.
  useEffect(() => {
    if (!toast || toast.kind !== 'error') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = previousOverflow;
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [toast]);

  if (typeof document === 'undefined') return null;
  if (!toast) return null;

  const ariaRole = toast.kind === 'error' ? 'alert' : 'status';
  const dismissLabel = t('common.close', 'Close');

  return createPortal(
    <div
      className={styles.viewport}
      data-kind={toast.kind}
      role={ariaRole}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid="publication-toast"
    >
      <div className={`${styles.toast} ${KIND_CLASS[toast.kind]}`}>
        <span className={styles.icon} aria-hidden="true">
          {KIND_ICON[toast.kind]}
        </span>
        <p className={styles.message}>{toast.message}</p>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={dismiss}
          aria-label={dismissLabel}
          data-testid="publication-toast-dismiss"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default PublicationToastViewport;