import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { UserRoleItem, UserRoleCreateRequest } from '../types/domain';

export const userRoleService = {
  getAll: async (): Promise<UserRoleItem[]> => {
    const response = await api.get<UserRoleItem[]>(API_ENDPOINTS.USER_ROLE.GET_ALL);
    return Array.isArray(response.data) ? response.data : [];
  },

  assign: async (data: UserRoleCreateRequest): Promise<UserRoleItem> => {
    const response = await api.post<UserRoleItem>(API_ENDPOINTS.USER_ROLE.CREATE, data);
    return response.data;
  },

  revoke: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.USER_ROLE.DELETE(id));
  },
};
