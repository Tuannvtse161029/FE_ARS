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
        <div className={styles.mark} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>{label}</p>
        <span className={styles.detail}>This may take a moment.</span>
      </div>
    </div>
  );
};

export default DelayedLoadingOverlay;
