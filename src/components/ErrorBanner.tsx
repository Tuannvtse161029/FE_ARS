/**
 * ErrorBanner — full-width inline error with optional retry.
 *
 * Replaces ad-hoc red text strings inside pages. Always paired with an
 * icon + message + optional retry button. The `tone` prop keeps it usable
 * for warning (amber) and info (blue) cases without creating yet another
 * component.
 */
import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import styles from './ErrorBanner.module.css';

export type ErrorBannerTone = 'error' | 'warning' | 'info';

export interface ErrorBannerProps {
  tone?: ErrorBannerTone;
  title?: string;
  message: string;
  retry?: ReactNode;
}

const ICONS: Record<ErrorBannerTone, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export const ErrorBanner = ({
  tone = 'error',
  title,
  message,
  retry,
}: ErrorBannerProps) => {
  const Icon = ICONS[tone];
  return (
    <div
      className={`${styles.banner} ${styles[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
      data-component="ErrorBanner"
    >
      <span className={styles.icon} aria-hidden>
        <Icon size={16} />
      </span>
      <div className={styles.body}>
        {title && <strong className={styles.title}>{title}</strong>}
        <span className={styles.message}>{message}</span>
      </div>
      {retry && <div className={styles.retry}>{retry}</div>}
    </div>
  );
};

export default ErrorBanner;
