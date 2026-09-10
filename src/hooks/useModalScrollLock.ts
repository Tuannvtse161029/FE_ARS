import { useEffect } from 'react';

/**
 * Checks if any modal or dialog overlay is currently rendered in the DOM.
 */
const hasActiveModalInDom = (): boolean => {
  const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
  if (dialog) return true;

  // Fallback for overlays with common modal overlay classes
  const customOverlay = document.querySelector(
    '[class*="modalOverlay"], [class*="overlay"], [class*="backdrop"], [class*="confirmOverlay"]',
  );
  if (customOverlay) {
    const style = window.getComputedStyle(customOverlay);
    if (style.position === 'fixed' || style.position === 'absolute') {
      return true;
    }
  }
  return false;
};

/**
 * Synchronizes body scroll lock with active modals in the document.
 */
export const syncModalBodyScrollLock = (): void => {
  if (typeof document === 'undefined') return;

  const hasModal = hasActiveModalInDom();
  const isLocked = document.body.dataset.modalLocked === 'true';

  if (hasModal && !isLocked) {
    document.body.dataset.originalOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    document.body.dataset.modalLocked = 'true';
  } else if (!hasModal && isLocked) {
    document.body.style.overflow = document.body.dataset.originalOverflow || '';
    delete document.body.dataset.modalLocked;
    delete document.body.dataset.originalOverflow;
  }
};

/**
 * Hook to lock background scrolling for a specific modal lifecycle,
 * or globally watch for mounted dialogs.
 *
 * @param active Optional boolean flag when used inside a specific modal component.
 */
export const useModalScrollLock = (active?: boolean): void => {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (typeof active === 'boolean') {
      if (active) {
        if (document.body.dataset.modalLocked !== 'true') {
          document.body.dataset.originalOverflow = document.body.style.overflow || '';
          document.body.style.overflow = 'hidden';
          document.body.dataset.modalLocked = 'true';
        }
      } else {
        syncModalBodyScrollLock();
      }
      return () => {
        syncModalBodyScrollLock();
      };
    }

    // Global observer mode: watch for DOM additions/removals
    syncModalBodyScrollLock();

    const observer = new MutationObserver(() => {
      syncModalBodyScrollLock();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (document.body.dataset.modalLocked === 'true') {
        document.body.style.overflow = document.body.dataset.originalOverflow || '';
        delete document.body.dataset.modalLocked;
        delete document.body.dataset.originalOverflow;
      }
    };
  }, [active]);
};
