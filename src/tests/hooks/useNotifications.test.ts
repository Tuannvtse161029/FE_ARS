/**
 * useNotifications hook tests.
 *
 * Coverage:
 *   - List, unread count, and loading/error states.
 *   - markRead optimistic + rollback on failure.
 *   - markAllRead fan-out and partial failures.
 *   - Refetch on user change (no leakage between users).
 *   - reset() clears in-memory state without hitting the BE.
 *   - No-op when userId is null (logged-out users).
 *   - Window-focus refetch with in-flight deduplication.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '../../hooks/useNotifications';
import { notificationService } from '../../services/notification.service';

vi.mock('../../services/notification.service', () => ({
  notificationService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
}));

const mocked = notificationService as unknown as {
  getAll: ReturnType<typeof vi.fn>;
  markRead: ReturnType<typeof vi.fn>;
  markAllRead: ReturnType<typeof vi.fn>;
};

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state, then resolves to the BE list with unread count', async () => {
    mocked.getAll.mockResolvedValueOnce([
      { id: 1, userId: 7, message: '[Review] accepted', isRead: false },
      { id: 2, userId: 7, message: '[Paper] status changed', isRead: true },
    ]);

    const { result } = renderHook(() => useNotifications(7));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('surfaces API errors as Error objects', async () => {
    mocked.getAll.mockRejectedValueOnce(new Error('500'));
    const { result } = renderHook(() => useNotifications(7));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('500');
    expect(result.current.notifications).toEqual([]);
  });

  it('returns an empty list and never fetches when userId is null', async () => {
    const { result } = renderHook(() => useNotifications(null));
    // Wait a microtask tick so the effect runs.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocked.getAll).not.toHaveBeenCalled();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('refetches when userId changes and drops stale responses', async () => {
    mocked.getAll
      .mockResolvedValueOnce([
        { id: 1, userId: 1, message: 'old user notif', isRead: false },
      ])
      .mockResolvedValueOnce([
        { id: 2, userId: 2, message: 'new user notif', isRead: false },
      ]);

    const { result, rerender } = renderHook(
      ({ uid }: { uid: number | null }) => useNotifications(uid),
      { initialProps: { uid: 1 } },
    );

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.unreadCount).toBe(1);

    rerender({ uid: 2 });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    await waitFor(() =>
      expect(result.current.notifications[0]?.userId).toBe(2),
    );
    expect(mocked.getAll).toHaveBeenCalledTimes(2);
  });

  it('filters out rows belonging to a different user (defense in depth)', async () => {
    mocked.getAll.mockResolvedValueOnce([
      { id: 1, userId: 7, message: 'mine', isRead: false },
      { id: 2, userId: 999, message: 'someone else', isRead: false },
    ]);
    const { result } = renderHook(() => useNotifications(7));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]?.userId).toBe(7);
  });

  describe('markRead', () => {
    it('optimistically flips isRead and persists via the service', async () => {
      mocked.getAll.mockResolvedValueOnce([
        { id: 1, userId: 7, message: 'x', isRead: false },
      ]);
      mocked.markRead.mockResolvedValueOnce({
        id: 1,
        userId: 7,
        message: 'x',
        isRead: true,
      });

      const { result } = renderHook(() => useNotifications(7));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.unreadCount).toBe(1);

      await act(async () => {
        const ok = await result.current.markRead(1);
        expect(ok).toBe(true);
      });
      expect(result.current.unreadCount).toBe(0);
      expect(mocked.markRead).toHaveBeenCalledWith(1);
    });

    it('rolls back the optimistic flip when the BE refuses the update', async () => {
      mocked.getAll.mockResolvedValueOnce([
        { id: 1, userId: 7, message: 'x', isRead: false },
      ]);
      mocked.markRead.mockRejectedValueOnce(new Error('500'));

      const { result } = renderHook(() => useNotifications(7));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.unreadCount).toBe(1);

      await act(async () => {
        const ok = await result.current.markRead(1);
        expect(ok).toBe(false);
      });
      // Still unread because the BE refused.
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.notifications[0]?.isRead).toBe(false);
    });
  });

  describe('markAllRead', () => {
    it('returns the ids that the BE refused to update', async () => {
      mocked.getAll.mockResolvedValueOnce([
        { id: 1, userId: 7, message: 'a', isRead: false },
        { id: 2, userId: 7, message: 'b', isRead: false },
      ]);
      mocked.markAllRead.mockResolvedValueOnce({
        updated: [
          { id: 1, userId: 7, message: 'a', isRead: true },
        ],
        failures: [2],
      });

      const { result } = renderHook(() => useNotifications(7));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let failures: number[] = [];
      await act(async () => {
        failures = await result.current.markAllRead();
      });
      expect(failures).toEqual([2]);
    });
  });

  describe('reset', () => {
    it('clears in-memory state without hitting the BE', async () => {
      mocked.getAll.mockResolvedValueOnce([
        { id: 1, userId: 7, message: 'x', isRead: false },
      ]);
      const { result } = renderHook(() => useNotifications(7));
      await waitFor(() => expect(result.current.notifications).toHaveLength(1));
      expect(mocked.getAll).toHaveBeenCalledTimes(1);

      act(() => result.current.reset());
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      // No additional BE calls.
      expect(mocked.getAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('window-focus refetch', () => {
    it('refetches when the document becomes visible', async () => {
      mocked.getAll.mockResolvedValue([]);
      renderHook(() => useNotifications(7));
      await waitFor(() => expect(mocked.getAll).toHaveBeenCalledTimes(1));
      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await waitFor(() => expect(mocked.getAll).toHaveBeenCalledTimes(2));
    });

    it('does not issue overlapping refetch calls', async () => {
      // First call returns immediately; second call hangs so the second
      // concurrent refetch() short-circuits via the in-flight guard.
      let secondResolver: ((value: unknown[]) => void) | null = null;
      mocked.getAll
        .mockResolvedValueOnce([])
        .mockImplementationOnce(
          () =>
            new Promise<unknown[]>((resolve) => {
              secondResolver = resolve;
            }),
        );

      const { result } = renderHook(() => useNotifications(7));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mocked.getAll).toHaveBeenCalledTimes(1);

      // Trigger two consecutive refetches; only one of them should reach
      // the service.
      await act(async () => {
        void result.current.refetch();
        void result.current.refetch();
      });

      expect(mocked.getAll).toHaveBeenCalledTimes(2);
      if (secondResolver) secondResolver([]);
    });
  });
});
