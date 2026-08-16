import { useEffect, useMemo, useState } from 'react';
import { notificationService } from '../services/notification.service';
import type { NotificationItem } from '../types/domain';

interface UseNotificationsResult {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useNotifications(userId?: number): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await notificationService.getAll(userId);
      setNotifications(list);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load notifications'));
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  return { notifications, unreadCount, isLoading, error, refetch };
}

interface UseMarkNotificationReadResult {
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
