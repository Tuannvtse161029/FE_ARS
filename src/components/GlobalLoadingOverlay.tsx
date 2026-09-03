import { useSyncExternalStore } from 'react';
import { loadingTracker } from '../services/loadingTracker';
import { DelayedLoadingOverlay } from './DelayedLoadingOverlay';

/**
 * Renders one delayed loading surface for all shared API requests.
 *
 * The overlay only appears after a request is still in flight at the
 * 5-second mark. Quick responses complete without flashing a spinner, and
 * genuinely slow calls get clear feedback (e.g. cold-cache reloads or
 * network hiccups). Tune the delay here — every shared request feeds
 * into `loadingTracker`, so this single threshold controls when the
 * "Loading ARS" overlay becomes visible.
 */
export const GlobalLoadingOverlay = () => {
  const isLoading = useSyncExternalStore(
    loadingTracker.subscribe,
    loadingTracker.getSnapshot,
    loadingTracker.getSnapshot,
  );

  return (
    <DelayedLoadingOverlay
      isLoading={isLoading}
      label="Loading ARS"
      delay={5000}
    />
  );
};
