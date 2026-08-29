import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  NotificationItem,
  NotificationUpdateRequest,
} from '../types/domain';

// ARS Notification service.
//
// Source of truth:
//   https://arsplatform.onrender.com/swagger/index.html#/Notification
//   `/api/Notification` (GET, POST), `/api/Notification/{id}` (GET, PUT, DELETE).
//
// The Swagger schema is intentionally minimal — `id`, `userId`, `message`,
// `isRead`, optional `createdAt`. There is no `type`, no `targetUrl`, no
// `relatedEntityId`, no separate unread-count endpoint, and no bulk
// "mark-all-as-read" endpoint. So:
//
//   * The unread count is derived client-side from `GET /api/Notification`.
//   * "Mark all as read" fans out `PUT /api/Notification/{id}` per unread row.
//   * Navigation targets are inferred locally (see
//     `notificationRouteMap.ts`); the FE never trusts external URLs.
//
// The FE must not fabricate notifications with localStorage or component
// state — every notification in the UI comes from a backend-authored row.
export const notificationService = {
  /**
   * Lấy danh sách thông báo của người dùng hiện tại (tự động theo JWT token).
   */
  getAll: async (userId?: number): Promise<NotificationItem[]> => {
    try {
      const params = userId !== undefined ? { userId } : undefined;
      const response = await api.get<NotificationItem[]>(
        API_ENDPOINTS.NOTIFICATION.GET_ALL,
        { params },
      );
      const raw = Array.isArray(response.data) ? response.data : [];
      return raw.map(normalizeNotification);
    } catch {
      return [];
    }
  },

  /**
   * Lấy số lượng thông báo chưa đọc của người dùng hiện tại.
   */
  getUnreadCount: async (): Promise<number> => {
    try {
      const response = await api.get<{ unreadCount: number }>(
        API_ENDPOINTS.NOTIFICATION.UNREAD_COUNT,
      );
      return Number(response.data?.unreadCount ?? 0);
    } catch {
      return 0;
    }
  },

  /**
   * Lấy chi tiết một thông báo theo ID.
   */
  getById: async (id: number): Promise<NotificationItem | null> => {
    try {
      const response = await api.get<NotificationItem>(
        API_ENDPOINTS.NOTIFICATION.GET_BY_ID(id),
      );
      return normalizeNotification(response.data);
    } catch (err) {
      if (
        err !== null &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 404
      ) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Đánh dấu 1 thông báo cụ thể là đã đọc.
   */
  markRead: async (id: number): Promise<NotificationItem> => {
    try {
      // Ưu tiên endpoint PUT /api/Notification/{id}/read
      const response = await api.put<NotificationItem>(
        API_ENDPOINTS.NOTIFICATION.MARK_READ(id),
      );
      return normalizeNotification(response.data);
    } catch {
      // Fallback sang PUT /api/Notification/{id} với { isRead: true }
      const body: NotificationUpdateRequest = { isRead: true };
      const fallbackRes = await api.put<NotificationItem>(
        API_ENDPOINTS.NOTIFICATION.UPDATE(id),
        body,
      );
      return normalizeNotification(fallbackRes.data);
    }
  },

  /**
   * Đánh dấu tất cả thông báo của người dùng hiện tại là đã đọc (Single Atomic Request).
   */
  markAllRead: async (
    notifications?: NotificationItem[],
  ): Promise<{ updated: NotificationItem[]; failures: number[] }> => {
    try {
      await api.put(API_ENDPOINTS.NOTIFICATION.MARK_ALL_READ);
      return {
        updated: (notifications ?? []).map((n) => ({ ...n, isRead: true })),
        failures: [],
      };
    } catch {
      // Fallback nếu endpoint mark-all-read lỗi: gọi song song từng thông báo
      const unread = (notifications ?? []).filter((n) => !n.isRead);
      const results = await Promise.allSettled(
        unread.map((n) => notificationService.markRead(n.id)),
      );
      const updated: NotificationItem[] = [];
      const failures: number[] = [];
      results.forEach((r, idx) => {
        const id = unread[idx]?.id;
        if (r.status === 'fulfilled') {
          updated.push(r.value);
        } else if (typeof id === 'number') {
          failures.push(id);
        }
      });
      return { updated, failures };
    }
  },

  /**
   * Xóa một thông báo.
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.NOTIFICATION.DELETE(id));
  },

  /**
   * Tạo mới một thông báo thủ công.
   */
  create: async (data: {
    userId?: number | null;
    message?: string | null;
    isRead?: boolean | null;
  }): Promise<NotificationItem> => {
    const response = await api.post<NotificationItem>(
      API_ENDPOINTS.NOTIFICATION.CREATE,
      data,
    );
    return normalizeNotification(response.data);
  },
};

// Coerce the Swagger DTO into the strict TS shape we use inside the FE.
// The BE occasionally echoes `null` for optional fields or omits `createdAt`
// entirely; this normalizer keeps the consumer side strict without
// scattering null checks across components.
function normalizeNotification(raw: unknown): NotificationItem {
  const record = (raw ?? {}) as Partial<NotificationItem> & {
    notificationId?: unknown;
    isRead?: unknown;
  };
  const resolvedId = Number(record.notificationId ?? record.id ?? 0);
  return {
    id: resolvedId,
    notificationId: resolvedId,
    userId: Number(record.userId ?? 0),
    message: typeof record.message === 'string' ? record.message : '',
    isRead: Boolean(record.isRead),
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
  };
}

export default notificationService;
