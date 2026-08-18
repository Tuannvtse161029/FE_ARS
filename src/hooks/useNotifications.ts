import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notificationService } from '../services/notification.service';
import type { NotificationItem } from '../types/domain';

export interface UseNotificationsResult {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  /**
   * Optimistically flip `isRead` to true for a single id, then call the BE
   * to persist. Returns `true` when the BE confirmed the read, `false`
   * when the request failed (the optimistic flag is rolled back in that
   * case). Callers must NEVER report a notification as read purely via
   * local state — the BE confirmation is the source of truth.
   */
  markRead: (id: number) => Promise<boolean>;
  /**
   * Fan-out `markRead` over every unread row. Returns the list of
   * notification ids that the BE refused to update so the caller can show
   * a partial-failure banner.
   */
  markAllRead: () => Promise<number[]>;
  reset: () => void;
}

// Centralised state for the header notification center.
//
// Behavior notes:
//   * When `userId` is `undefined` (logged out / unauthenticated), we
//     intentionally short-circuit to `[]` and never call the BE. This is
//     the "clear notification state on logout" requirement.
//   * The hook re-fetches when `userId` changes — i.e. when a different
//     user logs in, the bell must not show the previous user's unread
//     count.
//   * We expose a `reset()` method that wipes in-memory state without
//     hitting the BE. MainLayout calls this on logout so the dropdown
//     can't briefly flash the previous user's notifications while the
//     navigation animation runs.
//   * On window-focus refetch, we debounce overlapping requests via an
//     in-flight ref so a fast tab-switch cannot trigger two
//     `GET /api/Notification` calls at the same time. This satisfies the
//     "prevent overlapping requests" rule.
export function useNotifications(
  userId?: number | null,
): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Track whether the current user has been resolved so we don't fire a
  // refetch for a stale user after a logout/login cycle.
  const activeUserRef = useRef<number | null>(null);
  // In-flight guard so concurrent refetch() calls don't issue duplicate
  // requests.
  const inFlightRef = useRef<boolean>(false);

  const fetchNotifications = useCallback(async (): Promise<void> => {
    if (typeof userId !== 'number') {
      setNotifications([]);
      setError(null);
      setIsLoading(false);
      activeUserRef.current = null;
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const list = await notificationService.getAll(userId);
      // Race-guard: if the user changed while we were waiting, drop the
      // response and don't update state.
      if (activeUserRef.current !== userId) return;
      // Defense in depth: the BE filters by JWT subject, but the
      // notification list should NEVER contain rows for another user.
      const safeList = list.filter((n) => n.userId === userId);
      setNotifications(safeList);
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error('Failed to load notifications');
      setError(wrapped);
      setNotifications([]);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [userId]);

  // Re-fetch when the user id changes (login, logout, role switch).
  useEffect(() => {
    activeUserRef.current = typeof userId === 'number' ? userId : null;
    void fetchNotifications();
  }, [userId, fetchNotifications]);

  // Window-focus refetch — picks up notifications that arrived while the
  // tab was hidden. We use the in-flight guard above to avoid duplicates.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        void fetchNotifications();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [fetchNotifications]);

  // Snapshot ref used to roll back optimistic updates on failure. Kept in
  // a ref so React 18 strict-mode double-invocation of state updaters
  // doesn't clobber the captured value.
  const snapshotRef = useRef<NotificationItem[]>([]);

  const markRead = useCallback(
    async (id: number): Promise<boolean> => {
      // Capture the latest list BEFORE the optimistic flip. We read the
      // ref-stored value rather than capturing inside the updater so the
      // snapshot is stable across React's dev-mode re-invocations.
      snapshotRef.current = notificationsRef.current;
      // Optimistic UI update so the bell badge decrements immediately.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      try {
        const updated = await notificationService.markRead(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? updated : n)),
        );
        return true;
      } catch (err) {
        // Roll back to the captured snapshot — the BE is the source of
        // truth.
        setNotifications(snapshotRef.current);
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to mark notification as read'),
        );
        return false;
      }
    },
    [],
  );

  // Mirror of the notifications state in a ref so `markRead` can read the
  // latest value without creating a fresh closure on every render.
  const notificationsRef = useRef<NotificationItem[]>([]);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const markAllRead = useCallback(async (): Promise<number[]> => {
    const current = notificationsRef.current;
    if (current.length === 0) return [];
    const { updated, failures } = await notificationService.markAllRead(current);
    setNotifications((prev) => {
      const updateMap = new Map(updated.map((n) => [n.id, n]));
      return prev.map((n) => (updateMap.has(n.id) ? (updateMap.get(n.id) as NotificationItem) : n));
    });
    return failures;
  }, []);

  const reset = useCallback(() => {
    activeUserRef.current = null;
    inFlightRef.current = false;
    snapshotRef.current = [];
    notificationsRef.current = [];
    setNotifications([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markRead,
    markAllRead,
    reset,
  };
}

// Legacy single-mark hook kept for callers that only need the mutation
// (none in the new code, but exporting it preserves the existing barrel
// surface from `src/hooks/useNotifications`).
export interface UseMarkNotificationReadResult {
  markRead: (id: number) => Promise<boolean>;
  isLoading: boolean;
  error: Error | null;
}

export function useMarkNotificationRead(): UseMarkNotificationReadResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const markRead = async (id: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await notificationService.markRead(id);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to mark notification as read'));
      setIsLoading(false);
      return false;
    }
  };

  return { markRead, isLoading, error };
}
