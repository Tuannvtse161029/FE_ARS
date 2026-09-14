import { type ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { loadingTracker } from '../services/loadingTracker';
import { DelayedLoadingOverlay } from './DelayedLoadingOverlay';

export interface GlobalLoadingOverlayProps {
  /**
   * Optional child content rendered immediately below the provider so callers
   * can embed the tracker inside a layout without an extra DOM wrapper.
   */
  children?: ReactNode;
}

/**
 * Renders one delayed loading surface for all shared API requests.
 *
 * The overlay only appears after a request is still in flight at the
 * 5-second mark. Quick responses complete without flashing a spinner, and
 * genuinely slow calls get clear feedback (e.g. cold-cache reloads or
 * network hiccups). Tune the delay here — every shared request feeds
 * into `loadingTracker`, so this single threshold controls when the
 * "Loading ARS" overlay becomes visible.
 *
 * When the overlay minimizes (4 s after appearing), a
 * `ars:loading-minimized` custom DOM event is dispatched so the
 * `LoadingBubbles` component can surface a toast telling the user they
 * can keep exploring while the request finishes in the background.
 */
export const GlobalLoadingOverlay = ({ children }: GlobalLoadingOverlayProps) => {
  const isLoading = useSyncExternalStore(
    loadingTracker.subscribe,
    loadingTracker.getSnapshot,
    loadingTracker.getSnapshot,
  );

  const handleMinimize = () => {
    window.dispatchEvent(new CustomEvent('ars:loading-minimized'));
  };

  return (
    <>
      <DelayedLoadingOverlay
        isLoading={isLoading}
        label="Loading ARS"
        delay={5000}
        minimizeAfter={4000}
        onMinimize={handleMinimize}
      />
      {children}
    </>
  );
};
