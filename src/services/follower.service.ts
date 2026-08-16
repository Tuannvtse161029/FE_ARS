import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { Follower, FollowerCreateRequest } from '../types/domain';

export const followerService = {
  getAll: async (): Promise<Follower[]> => {
    const response = await api.get<Follower[]>(API_ENDPOINTS.FOLLOWER.GET_ALL);
    return Array.isArray(response.data) ? response.data : [];
  },

  follow: async (data: FollowerCreateRequest): Promise<Follower> => {
    const response = await api.post<Follower>(API_ENDPOINTS.FOLLOWER.CREATE, data);
    return response.data;
  },

  unfollow: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.FOLLOWER.DELETE(id));
  },
};
