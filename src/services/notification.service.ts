import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { NotificationItem, NotificationCreateRequest } from '../types/domain';

export const notificationService = {
  getAll: async (userId?: number): Promise<NotificationItem[]> => {
    const params = userId !== undefined ? { userId } : undefined;
    const response = await api.get<NotificationItem[]>(API_ENDPOINTS.NOTIFICATION.GET_ALL, { params });
    return Array.isArray(response.data) ? response.data : [];
  },

  markRead: async (id: number): Promise<NotificationItem> => {
    const response = await api.put<NotificationItem>(API_ENDPOINTS.NOTIFICATION.UPDATE(id), { isRead: true });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.NOTIFICATION.DELETE(id));
  },

  create: async (data: NotificationCreateRequest): Promise<NotificationItem> => {
    const response = await api.post<NotificationItem>(API_ENDPOINTS.NOTIFICATION.CREATE, data);
    return response.data;
  },
};
