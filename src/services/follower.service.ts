import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  FollowerResponse,
  FollowerCreateRequest,
  FollowCountsResponse,
  FollowerPagedResult,
} from '../types/domain';

export const followerService = {
  /**
   * Lấy toàn bộ danh sách theo dõi
   */
  getAll: async (): Promise<FollowerResponse[]> => {
    try {
      const response = await api.get<FollowerResponse[]>(API_ENDPOINTS.FOLLOWER.GET_ALL);
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  },

  /**
   * Lấy danh sách theo dõi có phân trang
   */
  getPaged: async (pageNumber = 1, pageSize = 20): Promise<FollowerPagedResult> => {
    const response = await api.get<FollowerPagedResult>(API_ENDPOINTS.FOLLOWER.GET_PAGED, {
      params: { PageNumber: pageNumber, PageSize: pageSize },
    });
    return response.data;
  },

  /**
   * Lấy danh sách người đang theo dõi một người dùng (Followers) có phân trang
   */
  getFollowers: async (
    userId: number,
    pageNumber = 1,
    pageSize = 20
  ): Promise<FollowerPagedResult> => {
    const response = await api.get<FollowerPagedResult>(
      API_ENDPOINTS.FOLLOWER.FOLLOWERS_PAGED(userId),
      {
        params: { PageNumber: pageNumber, PageSize: pageSize },
      }
    );
    return response.data;
  },

  /**
   * Lấy danh sách người mà người dùng đang theo dõi (Following) có phân trang
   */
  getFollowing: async (
    userId: number,
    pageNumber = 1,
    pageSize = 20
  ): Promise<FollowerPagedResult> => {
    const response = await api.get<FollowerPagedResult>(
      API_ENDPOINTS.FOLLOWER.FOLLOWING_PAGED(userId),
      {
        params: { PageNumber: pageNumber, PageSize: pageSize },
      }
    );
    return response.data;
  },

  /**
   * Lấy thống kê số lượng Followers và Following của một người dùng
   */
  getCounts: async (userId: number): Promise<FollowCountsResponse> => {
    const response = await api.get<FollowCountsResponse>(
      API_ENDPOINTS.FOLLOWER.COUNTS(userId)
    );
    return response.data;
  },

  /**
   * Kiểm tra người dùng hiện tại có đang theo dõi tác giả/người dùng này hay không
   */
  isFollowing: async (followedId: number): Promise<boolean> => {
    const response = await api.get<boolean>(
      API_ENDPOINTS.FOLLOWER.IS_FOLLOWING(followedId)
    );
    return Boolean(response.data);
  },

  /**
   * Theo dõi một tác giả / người dùng
   */
  follow: async (data: FollowerCreateRequest): Promise<FollowerResponse> => {
    const response = await api.post<FollowerResponse>(
      API_ENDPOINTS.FOLLOWER.CREATE,
      data
    );
    return response.data;
  },

  /**
   * Hủy theo dõi (Unfollow) một tác giả / người dùng theo ID người được theo dõi
   */
  unfollow: async (followedId: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.FOLLOWER.DELETE(followedId));
  },

  /**
   * Bật/Tắt theo dõi (Toggle Follow/Unfollow)
   */
  toggle: async (followedId: number): Promise<any> => {
    const response = await api.post(API_ENDPOINTS.FOLLOWER.TOGGLE(followedId));
    return response.data;
  },
};

export default followerService;
