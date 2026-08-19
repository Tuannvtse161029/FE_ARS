import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { User } from '../types/auth';
import type { PagedResult, PaginationParams } from '../types/api';

export interface UserUpdateRequest {
  username?: string; // partial update — included so BE can return a User with username
  fullName?: string;
  orcidId?: string;
}

export const userService = {
  getAll: async (params?: PaginationParams): Promise<PagedResult<User>> => {
    const response = await api.get<PagedResult<User>>(API_ENDPOINTS.USER.GET_ALL, { params });
    return response.data;
  },

  getById: async (id: number): Promise<User> => {
    const response = await api.get<User>(API_ENDPOINTS.USER.GET_BY_ID(id));
    return response.data;
  },

  update: async (id: number, data: UserUpdateRequest): Promise<User> => {
    const response = await api.put<User>(API_ENDPOINTS.USER.UPDATE(id), data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.USER.DELETE(id));
  },
};

export default userService;
