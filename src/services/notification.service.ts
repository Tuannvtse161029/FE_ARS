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
  // GET /api/Notification — returns the BE-owned list for the authenticated
  // user. The BE filters by userId on the JWT subject; the optional `userId`
  // query is kept for parity with the existing FE surface, but the FE
  // service layer is responsible for verifying that the returned list only
  // contains rows that belong to the currently authenticated user before
  // rendering them.
  getAll: async (userId?: number): Promise<NotificationItem[]> => {
    const params = userId !== undefined ? { userId } : undefined;
    const response = await api.get<NotificationItem[]>(
      API_ENDPOINTS.NOTIFICATION.GET_ALL,
      { params },
    );
    const raw = Array.isArray(response.data) ? response.data : [];
    return raw.map(normalizeNotification);
  },

  // GET /api/Notification/{id} — fetch a single notification. Returns
  // `null` when the BE responds with 404 so callers can decide whether to
  // surface "notification not found" or simply drop it.
  getById: async (id: number): Promise<NotificationItem | null> => {
    try {
      const response = await api.get<NotificationItem>(
        API_ENDPOINTS.NOTIFICATION.GET_BY_ID(id),
      );
      return normalizeNotification(response.data);
    } catch (err) {
      // 404 means the notification was deleted or never existed; surface
      // a `null` so the UI can clear stale state without throwing.
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

  // PUT /api/Notification/{id} with `{ isRead: true }` — mark a single
  // notification as read. The BE keeps the rest of the row untouched
  // (userId, message). Returns the updated row.
  markRead: async (id: number): Promise<NotificationItem> => {
    const body: NotificationUpdateRequest = { isRead: true };
    const response = await api.put<NotificationItem>(
      API_ENDPOINTS.NOTIFICATION.UPDATE(id),
      body,
    );
    return normalizeNotification(response.data);
  },

  // Fan-out `PUT /api/Notification/{id}` for every unread row. The BE has
  // no bulk endpoint, so we walk the list and patch each one. We never
  // throw out of the loop — partial failures bubble up via `failures` so
  // the caller can decide whether to refetch the list.
  //
  // Returns:
  //   `{ updated: NotificationItem[]; failures: number[] }`
  markAllRead: async (
    notifications: NotificationItem[],
  ): Promise<{ updated: NotificationItem[]; failures: number[] }> => {
    const unread = notifications.filter((n) => !n.isRead);
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
  },

  // DELETE /api/Notification/{id} — remove a notification permanently.
  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.NOTIFICATION.DELETE(id));
  },

  // POST /api/Notification — BE-owned creation path. The FE exposes this
  // helper for completeness / future server-driven workflows but does not
  // invoke it from the user-facing notification center; the rule is that
  // notification creation lives on the BE so users see the same rows across
  // devices.
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
    isRead?: unknown;
  };
  return {
    id: Number(record.id ?? 0),
    userId: Number(record.userId ?? 0),
    message: typeof record.message === 'string' ? record.message : '',
    isRead: Boolean(record.isRead),
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
  };
}

export default notificationService;
