import { useEffect, useState } from 'react';
import styles from './DelayedLoadingOverlay.module.css';

export interface DelayedLoadingOverlayProps {
  isLoading: boolean;
  label?: string;
  delay?: number;
}

/**
 * Shows a full-page loading state only when an async task outlasts the delay.
 * This avoids a distracting flash for responsive requests while preserving
 * clear feedback for slower API calls.
 */
export const DelayedLoadingOverlay = ({
  isLoading,
  label = 'Loading your workspace',
  delay = 1000,
}: DelayedLoadingOverlayProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsVisible(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setIsVisible(true), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, isLoading]);

  if (!isVisible) return null;

  return (
    <div className={styles.backdrop} role="status" aria-live="polite" aria-label={label}>
      <div className={styles.content}>
        <svg
          className={styles.illustration}
          viewBox="0 0 56 56"
          width="56"
          height="56"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
          data-testid="loading-illustration"
        >
          {/* Paper outline */}
          <rect className={styles.paper} x="6" y="8" width="26" height="40" rx="2" />

          {/* Ruled research lines (sequentially drawn) */}
          <line className={`${styles.line} ${styles.line1}`} x1="11" y1="18" x2="27" y2="18" />
          <line className={`${styles.line} ${styles.line2}`} x1="11" y1="26" x2="25" y2="26" />
          <line className={`${styles.line} ${styles.line3}`} x1="11" y1="34" x2="27" y2="34" />

          {/* Hand + pencil group (travels down through the lines) */}
          <g className={styles.handPen}>
            <ellipse className={styles.hand} cx="42" cy="14" rx="6" ry="4.5" />
            <line className={styles.pencil} x1="44" y1="12" x2="27" y2="18" />
          </g>
        </svg>
        <p>{label}</p>
        <span className={styles.detail}>This may take a moment.</span>
      </div>
    </div>
  );
};

export default DelayedLoadingOverlay;
