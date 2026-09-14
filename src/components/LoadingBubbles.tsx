import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { loadingTracker } from '../services/loadingTracker';
import { useI18n } from '../i18n/I18nContext';

/**
 * Global toast notifier for the loading overlay lifecycle.
 *
 * Two distinct toast moments:
 *
 *  1. **Minimized (first 4 s elapsed, overlay shrinks away)** —
 *     Fires a neutral info toast so the user knows the spinner is gone
 *     and they can keep working while the request finishes in the background.
 *     Only shown while loading is still in flight.
 *
 *  2. **Completed (all requests resolved while minimized)** —
 *     Fires a success toast telling the user their data is ready and they
 *     can click "Back" to return to where they started. Only fires once
 *     per loading cycle and only if the overlay was actually minimized
 *     (otherwise the page rendered inline with no disruption).
 *
 * This component is intentionally side-effect-only (no render output) so
 * it can be mounted once at the app root without adding DOM nodes.
 */
export const LoadingBubbles = () => {
  const { t } = useI18n();

  // Track whether we have shown the "minimized" toast this cycle so
  // we only show it once. Ref avoids triggering re-renders on every tick.
  const minimizedToastFired = useRef(false);

  useEffect(() => {
    // Subscribe to loadingTracker so we can react to load completion.
    const unsub = loadingTracker.subscribe(() => {
      const isLoading = loadingTracker.getSnapshot();
      if (!isLoading) {
        // Loading completed — fire the "done" toast if we previously
        // minimized. Reset the guard so the next cycle starts clean.
        if (minimizedToastFired.current) {
          minimizedToastFired.current = false;
          toast.success(t('loadingBubble.done'), {
            id: 'loading-done',
            duration: 6000,
            icon: <Info size={16} aria-hidden />,
          });
        }
      }
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
        toast.info(t('loadingBubble.keepExploring'), {
          id: 'loading-minimized',
          duration: Infinity,
          icon: <Info size={16} aria-hidden />,
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
