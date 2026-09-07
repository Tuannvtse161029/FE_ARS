/**
 * Publication toast — single, app-wide feedback channel for user-triggered
 * mutations across the Researcher / Reviewer / Admin publication surfaces.
 *
 * Why a dedicated publication toast?
 *   - The publication lifecycle (submit → assign → review → publish) is a
 *     multi-page, multi-actor workflow. Users need to see confirmation
 *     feedback that survives navigation between roles and pages so a
 *     confirmation emitted on `/researcher/submissions/123` is still
 *     visible after the redirect to `/researcher/submissions`.
 *   - The header MainLayout already exposes a per-session toast state for
 *     narrow actions (availability toggles). Publication flows cross
 *     layout boundaries, so they need a singleton that doesn't depend on
 *     MainLayout being mounted.
 *
 * Design choices:
 *   - Notification model is a single object held in module state. Multiple
 *     emissions in the same tick collapse to the latest message so the UI
 *     never floods with duplicates from a double-click.
 *   - Each notification persists for 6 seconds — long enough to read, short
 *     enough to disappear before the next action.
 *   - Errors stay on screen until the user dismisses them so a failed
 *     submission does not silently disappear.
 *   - Idempotency keys (caller-provided) let the FE suppress identical
 *     notifications fired from rapid double-click submissions.
 *
 * Localisation: messages are passed in already-localised by the consumer.
 * The hook does NOT translate. This keeps the toast format flexible
 * (success / error / info) without a vocabulary contract.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type PublicationToastKind = 'success' | 'error' | 'info';

export interface PublicationToast {
  id: number;
  kind: PublicationToastKind;
  message: string;
  /** Stable identity for deduplication; callers pass a stable key per intent. */
  dedupeKey?: string;
  /** When the toast was emitted, in milliseconds since epoch. */
  createdAt: number;
}

type Listener = (toast: PublicationToast | null) => void;

let nextId = 1;
let activeToast: PublicationToast | null = null;
const listeners = new Set<Listener>();
const dedupeWindowMs = 1500;
const recentByKey = new Map<string, number>();

const emit = (toast: PublicationToast | null) => {
  activeToast = toast;
  for (const listener of listeners) {
    listener(toast);
  }
};

const shouldDedupe = (key: string | undefined): boolean => {
  if (!key) return false;
  const now = Date.now();
  const last = recentByKey.get(key) ?? 0;
  if (now - last < dedupeWindowMs) {
    return true;
  }
  recentByKey.set(key, now);
  // GC stale entries — anything older than the dedupe window is irrelevant
  // because we already accepted it.
  if (recentByKey.size > 32) {
    for (const [storedKey, storedAt] of recentByKey) {
      if (now - storedAt > dedupeWindowMs * 4) {
        recentByKey.delete(storedKey);
      }
    }
  }
  return false;
};

/**
 * Emit a publication-flow toast. Errors stay until dismissed; success / info
 * auto-dismiss after 6 seconds.
 */
export const showPublicationToast = (
  kind: PublicationToastKind,
  message: string,
  options?: { dedupeKey?: string },
): void => {
  if (shouldDedupe(options?.dedupeKey)) {
    return;
  }
  const toast: PublicationToast = {
    id: nextId++,
    kind,
    message,
    dedupeKey: options?.dedupeKey,
    createdAt: Date.now(),
  };
  emit(toast);
};

/** Dismiss the active toast. */
export const dismissPublicationToast = (): void => {
  emit(null);
};

/**
 * Subscribe to the singleton toast stream. Returns the current toast (or
 * null) and a dismiss callback. Multiple subscribers are supported; the
 * most-recently-emitted toast wins.
 */
export const usePublicationToast = (): {
  toast: PublicationToast | null;
  dismiss: () => void;
} => {
  const [toast, setToast] = useState<PublicationToast | null>(activeToast);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const listener: Listener = (next) => {
      if (mountedRef.current) {
        setToast(next);
      }
    };
    listeners.add(listener);
    // Replay current state for late subscribers.
    setToast(activeToast);
    return () => {
      mountedRef.current = false;
      listeners.delete(listener);
    };
  }, []);

  // Auto-dismiss success / info after 6 seconds. Errors stay until the user
  // closes them so a failed submission never silently disappears.
  useEffect(() => {
    if (!toast) return;
    if (toast.kind === 'error') return;
    const timer = window.setTimeout(() => {
      dismissPublicationToast();
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const dismiss = useCallback(() => {
    dismissPublicationToast();
  }, []);

  return { toast, dismiss };
};

/**
 * Convenience wrappers — keep call sites concise.
 */
export const publicationToast = {
  success: (message: string, dedupeKey?: string): void =>
    showPublicationToast('success', message, dedupeKey ? { dedupeKey } : undefined),
  error: (message: string, dedupeKey?: string): void =>
    showPublicationToast('error', message, dedupeKey ? { dedupeKey } : undefined),
  info: (message: string, dedupeKey?: string): void =>
    showPublicationToast('info', message, dedupeKey ? { dedupeKey } : undefined),
  dismiss: (): void => dismissPublicationToast(),
};