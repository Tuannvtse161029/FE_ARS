import { useSyncExternalStore } from 'react';
import { loadingTracker } from '../services/loadingTracker';
import { DelayedLoadingOverlay } from './DelayedLoadingOverlay';

/** Renders one delayed loading surface for all shared API requests. */
export const GlobalLoadingOverlay = () => {
  const isLoading = useSyncExternalStore(
    loadingTracker.subscribe,
    loadingTracker.getSnapshot,
    loadingTracker.getSnapshot,
  );

  return <DelayedLoadingOverlay isLoading={isLoading} label="Loading ARS" />;
};
