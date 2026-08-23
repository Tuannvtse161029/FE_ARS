/**
 * WelcomeBackBanner — shared authenticated-layout welcome banner.
 *
 * Renders once at the top of the destination page main content area inside
 * the MainLayout. Reads its visibility from the ephemeral welcome-signal
 * store (set by AuthContext on email/password success and GoogleCallback
 * on Google OAuth success) and the user's full name from the trusted
 * AuthContext.
 *
 * Spec contract:
 *   - Shows only after a GENUINE login (signal flipped by AuthContext /
 *     GoogleCallback), not on a normal refresh or route change.
 *   - Logout clears the signal — the next login flips it again and shows
 *     the banner for the new user.
 *   - Reads `userFullName` from authenticated state. Falls back to
 *     "Welcome back!" when the name is missing (never shows "undefined",
 *     an email address, or a stale previous user's name).
 *   - Dismissable via an accessible close button. Auto-dismisses after
 *     ~5s. The auto-dismiss timer is cleared on manual dismissal.
 *   - Subtle entrance animation; respects prefers-reduced-motion.
 *   - Renders with `role="status"` so screen-reader users hear it without
 *     focus shift. Uses `aria-live="polite"` so it doesn't interrupt the
 *     user mid-task.
 *   - Positioned below the top header and above the page content area.
 *   - Colors / typography / radius match the ARS design tokens.
 */

import { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useWelcomeSignal } from '../../store/welcomeSignal';
import { useAuthStore } from '../../store';
import styles from './WelcomeBackBanner.module.css';

const AUTO_DISMISS_MS = 5000;

/**
 * Choose the user-facing greeting.
 *
 * Rules:
 *   - Never echo "undefined" / null / undefined values.
 *   - Never echo the user's email address — the banner calls users by name.
 *   - Trim surrounding whitespace; if the trimmed value is empty, fall back
 *     to the generic "Welcome back!".
 *   - If the value looks like an email (contains '@'), fall back too.
 *     We never trust a stray email-shaped string as a display name.
 */
function resolveGreetingName(fullName: string | null | undefined): string | null {
  if (typeof fullName !== 'string') return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  // Guard against email addresses mistakenly surfaced as "full name".
  if (trimmed.includes('@')) return null;
  // Guard against the literal string "undefined" that older code paths
  // sometimes produced when an optional chain fell through.
  if (trimmed.toLowerCase() === 'undefined') return null;
  return trimmed;
}

export const WelcomeBackBanner = () => {
  const visible = useWelcomeSignal((s) => s.visible);
  const hide = useWelcomeSignal((s) => s.hide);
  // Read directly from the trusted, persisted auth store. The store carries
  // the full `User` record including `fullName` (the BE-derived display name
  // — see auth.service.ts and authSlice.ts). AuthContext's `value.user`
  // exposes only a trimmed subset (username/email/role); the full `User`
  // record lives in the zustand store. Either source is fine, but the
  // store guarantees the `fullName` field is populated from the BE.
  const fullName = useAuthStore((s) => s.user?.fullName);

  const autoTimerRef = useRef<number | null>(null);

  // Auto-dismiss once after AUTO_DISMISS_MS. The effect runs only while
  // `visible` is true; the cleanup clears the timer the moment the user
  // manually closes the banner OR the banner unmounts OR a new login
  // re-renders with a different visible value.
  useEffect(() => {
    if (!visible) return;
    autoTimerRef.current = window.setTimeout(() => {
      hide();
    }, AUTO_DISMISS_MS);
    return () => {
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [visible, hide]);

  // Nothing to render when the banner isn't flagged — keeps the DOM clean
  // (and makes the test query predictable).
  if (!visible) return null;

  const name = resolveGreetingName(fullName);
  const greeting = name ? `Welcome back, ${name}` : 'Welcome back!';

  return (
    <div
      className={styles.banner}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="welcome-back-banner"
    >
      <span className={styles.bannerIcon} aria-hidden="true">
        <Sparkles size={18} />
      </span>
      <span className={styles.bannerText} data-testid="welcome-back-banner-text">
        {greeting}
      </span>
      <button
        type="button"
        className={styles.bannerClose}
        onClick={() => hide()}
        aria-label="Dismiss welcome message"
        data-testid="welcome-back-banner-close"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
};

export default WelcomeBackBanner;
