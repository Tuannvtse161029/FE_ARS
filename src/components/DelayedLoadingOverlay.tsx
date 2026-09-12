import { useEffect, useState } from 'react';
import styles from './DelayedLoadingOverlay.module.css';

export interface DelayedLoadingOverlayProps {
  isLoading: boolean;
  label?: string;
  delay?: number;
  /**
   * After this many milliseconds of the overlay still being visible,
   * play the minimize animation so the page becomes interactive again.
   * The header widget (`LoadingTaskWidget`) takes over the loading
   * feedback from there. Defaults to 3000 ms — short enough that a
   * user never has to stare at the spinner for long, but long enough
   * that genuinely responsive requests (<3 s) finish without
   * triggering the minimize choreography at all.
   */
  minimizeAfter?: number;
  /**
   * Fired once the minimize animation finishes so the parent can unmount
   * the overlay element. The overlay starts with `pointer-events: none`
   * the moment the animation begins, so this is mostly cleanup so we
   * stop holding the backdrop paint layers open.
   */
  onMinimized?: () => void;
}

/**
 * Shows a full-page loading state only when an async task outlasts the delay.
 * This avoids a distracting flash for responsive requests while preserving
 * clear feedback for slower API calls.
 *
 * When a request outlasts `minimizeAfter` (default 3 s), the overlay plays
 * a scale-down + fade and releases pointer-events so the user can keep
 * navigating. The header `LoadingTaskWidget` carries the spinner from that
 * point on until the task actually completes.
 */
export const DelayedLoadingOverlay = ({
  isLoading,
  label = 'Loading your workspace',
  delay = 1000,
  minimizeAfter = 3000,
  onMinimized,
}: DelayedLoadingOverlayProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Existing 1 s (configurable) delay before showing.
  useEffect(() => {
    if (!isLoading) {
      setIsVisible(false);
      setIsMinimizing(false);
      setShouldRender(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsVisible(true);
      setShouldRender(true);
    }, delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, isLoading]);

  // Second timer — fires `minimizeAfter` ms after the overlay actually
  // becomes visible (not after the original request kicked off). Without
  // this distinction the minimize would fire too early on a request that
  // happened to be still in flight at the global 5 s threshold but was
  // already mid-flight when the overlay appeared.
  useEffect(() => {
    if (!isVisible) {
      setIsMinimizing(false);
      return undefined;
    }

    const minimizeTimer = window.setTimeout(() => {
      setIsMinimizing(true);
    }, minimizeAfter);

    return () => window.clearTimeout(minimizeTimer);
  }, [isVisible, minimizeAfter]);

  // Once the minimize animation finishes, notify the parent so it can
  // unmount the overlay node entirely. We listen for `animationend`
  // rather than relying on a fixed timeout so the cleanup is robust
  // against animation-duration changes (e.g. `prefers-reduced-motion`
  // zeroes the duration in CSS).
  useEffect(() => {
    if (!isMinimizing) return undefined;

    const handleAnimationEnd = (event: AnimationEvent) => {
      if (event.target instanceof Element && event.target.classList.contains(styles.backdrop)) {
        setShouldRender(false);
        onMinimized?.();
      }
    };

    window.document.addEventListener('animationend', handleAnimationEnd);
    return () => window.document.removeEventListener('animationend', handleAnimationEnd);
  }, [isMinimizing, onMinimized]);

  if (!shouldRender) return null;

  const backdropClass = isMinimizing
    ? `${styles.backdrop} ${styles.minimizing}`
    : styles.backdrop;

  return (
    <div className={backdropClass} role="status" aria-live="polite" aria-label={label}>
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
