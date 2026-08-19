import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  ForumComment,
  ForumCommentCreateRequest,
  ForumCommentUpdateRequest,
} from '../types/forum.types';

export const forumCommentService = {
  // GET /api/ForumComment
  // The Swagger contract for this endpoint does NOT declare a `forumPostId`
  // query parameter — the BE returns every comment in one shot. For
  // per-post views we filter client-side. This is inefficient at scale but
  // matches the current BE contract; if the BE later adds a
  // `?forumPostId=` query param, prefer that.
  // See "Backend Team Requests" in the agent-32 report.
  getByPostId: async (postId: number): Promise<ForumComment[]> => {
    const response = await api.get<ForumComment[]>(
      API_ENDPOINTS.FORUM_COMMENT.GET_ALL,
    );
    const all = Array.isArray(response.data) ? response.data : [];
    return all.filter((c) => c.forumPostId === postId);
  },

  // GET /api/ForumComment (unfiltered — for admin / debug surfaces)
  getAll: async (): Promise<ForumComment[]> => {
    const response = await api.get<ForumComment[]>(
      API_ENDPOINTS.FORUM_COMMENT.GET_ALL,
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  // GET /api/ForumComment/{id}
  getById: async (id: number): Promise<ForumComment> => {
    const response = await api.get<ForumComment>(
      API_ENDPOINTS.FORUM_COMMENT.GET_BY_ID(id),
    );
    return response.data;
  },

  // POST /api/ForumComment
  create: async (data: ForumCommentCreateRequest): Promise<ForumComment> => {
    const response = await api.post<ForumComment>(
      API_ENDPOINTS.FORUM_COMMENT.CREATE,
      data,
    );
    return response.data;
  },

  // PUT /api/ForumComment/{id}
  update: async (
    id: number,
    data: ForumCommentUpdateRequest,
  ): Promise<ForumComment> => {
    const response = await api.put<ForumComment>(
      API_ENDPOINTS.FORUM_COMMENT.UPDATE(id),
      data,
    );
    return response.data;
  },

  // DELETE /api/ForumComment/{id}
  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.FORUM_COMMENT.DELETE(id));
  },
};

export default forumCommentService;