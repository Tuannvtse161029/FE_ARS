import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Info, X } from 'lucide-react';
import { loadingTracker } from '../services/loadingTracker';
import { useI18n } from '../i18n/I18nContext';

/**
 * Custom dismiss button rendered inside the "keep exploring" toast via Sonner's
 * `action` slot.  Sonner renders the action button as a sibling of the toast body,
 * but the toast container carries an `onClick` listener that fires the "done" toast
 * when the loading tracker is already idle.  Stopping propagation here guarantees
 * the button click does not bubble to that container handler.
 */
const DismissButton = () => (
  <button
    type="button"
    aria-label="Dismiss notification"
    onClick={(e) => {
      e.stopPropagation();
      e.preventDefault();
      toast.dismiss('loading-minimized');
    }}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '2px 4px',
      borderRadius: '4px',
      color: 'inherit',
      lineHeight: 1,
    }}
  >
    <X size={14} aria-hidden />
  </button>
);

/**
 * Global toast notifier for the loading overlay lifecycle.
 *
 * Two distinct toast moments:
 *
 *  1. **Minimized (first 4 s elapsed, overlay shrinks away)** —
 *     Fires a neutral info toast so the user knows the spinner is gone
 *     and they can keep working while the request finishes in the background.
 *     Only shown while loading is still in flight. Auto-dismisses after 12s so
 *     a stuck request doesn't leave the notification on screen indefinitely.
 *
 *  2. **Completed (all requests resolved)** —
 *     Fires a success toast telling the user their data is ready and they
 *     can click "Back" to return to where they started. Only fires once
 *     per loading cycle and only if the overlay was actually minimized
 *     (otherwise the page rendered inline with no disruption).
 *
 * This component is intentionally side-effect-only (no render output) so
 * it can be mounted once at the app root without adding DOM nodes.
 */
// Auto-dismiss the "keep exploring" toast after this many ms even if the
// request never resolves, so the notification can't get stuck on screen.
const KEEP_EXPLORING_TIMEOUT_MS = 12_000;

export const LoadingBubbles = () => {
  const { t } = useI18n();

  // Track whether we have shown the "minimized" toast this cycle so
  // we only show it once. Ref avoids triggering re-renders on every tick.
  const minimizedToastFired = useRef(false);
  // Track the previous loading state so we only fire the "done" toast on
  // the loading -> idle transition (not on every subsequent snapshot).
  const wasLoading = useRef(false);

  useEffect(() => {
    // Subscribe to loadingTracker so we can react to load completion.
    const unsub = loadingTracker.subscribe(() => {
      const isLoading = loadingTracker.getSnapshot();
      // Edge-trigger: only fire when transitioning from loading -> idle.
      if (wasLoading.current && !isLoading) {
        if (minimizedToastFired.current) {
          minimizedToastFired.current = false;
          toast.success(t('loadingBubble.done'), {
            id: 'loading-done',
            duration: 6000,
            icon: <Info size={16} aria-hidden />,
          });
        }
      }
      wasLoading.current = isLoading;
    });

    return unsub;
  }, [t]);

  // Listen for the custom "overlay minimized" event dispatched by
  // GlobalLoadingOverlay. We deliberately decouple this from the
  // loadingTracker subscription so the timing is explicit and testable.
  useEffect(() => {
    const MINIMIZE_EVENT = 'ars:loading-minimized';

    const handleMinimize = () => {
      // Only fire the "keep exploring" toast while loading is still
      // in flight. If loading already completed we don't need it.
      if (loadingTracker.getSnapshot()) {
        minimizedToastFired.current = true;
        wasLoading.current = true;
        toast.info(t('loadingBubble.keepExploring'), {
          id: 'loading-minimized',
          // Cap the duration so a stuck request doesn't leave the toast
          // on screen forever. If loading completes before the timeout,
          // the "done" toast replaces it (same id -> Sonner replaces).
          duration: KEEP_EXPLORING_TIMEOUT_MS,
          icon: <Info size={16} aria-hidden />,
          action: <DismissButton />,
        });
      }
    };

    window.addEventListener(MINIMIZE_EVENT, handleMinimize);
    return () => window.removeEventListener(MINIMIZE_EVENT, handleMinimize);
  }, [t]);

  // Zero render — pure side-effect subscriber.
  return null;
};

export default LoadingBubbles;
