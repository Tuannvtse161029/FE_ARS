import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  ForumComment,
  ForumCommentCreateRequest,
  ForumCommentUpdateRequest,
} from '../types/forum.types';

function normalizeComment(raw: unknown): ForumComment {
  const record = (raw ?? {}) as Partial<ForumComment> & {
    forumCommentId?: unknown;
  };
  const resolvedId = Number(record.forumCommentId ?? record.id ?? 0);
  return {
    id: resolvedId,
    forumCommentId: resolvedId,
    userId: record.userId != null ? Number(record.userId) : null,
    paperId: record.paperId != null ? Number(record.paperId) : null,
    forumPostId: record.forumPostId != null ? Number(record.forumPostId) : null,
    content: typeof record.content === 'string' ? record.content : '',
    replyId: record.replyId != null ? Number(record.replyId) : null,
    upvoteCount: record.upvoteCount != null ? Number(record.upvoteCount) : 0,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

export const forumCommentService = {
  // GET /api/ForumComment
  getByPostId: async (postId: number): Promise<ForumComment[]> => {
    try {
      const response = await api.get<ForumComment[]>(
        API_ENDPOINTS.FORUM_COMMENT.GET_ALL,
      );
      const all = Array.isArray(response.data) ? response.data : [];
      return all
        .map(normalizeComment)
        .filter((c) => c.forumPostId === postId);
    } catch {
      return [];
    }
  },

  // GET /api/ForumComment (unfiltered — for admin / debug surfaces)
  getAll: async (): Promise<ForumComment[]> => {
    try {
      const response = await api.get<ForumComment[]>(
        API_ENDPOINTS.FORUM_COMMENT.GET_ALL,
      );
      const all = Array.isArray(response.data) ? response.data : [];
      return all.map(normalizeComment);
    } catch {
      return [];
    }
  },

  // GET /api/ForumComment/{id}
  getById: async (id: number): Promise<ForumComment> => {
    const response = await api.get<ForumComment>(
      API_ENDPOINTS.FORUM_COMMENT.GET_BY_ID(id),
    );
    return normalizeComment(response.data);
  },

  // POST /api/ForumComment
  create: async (data: ForumCommentCreateRequest): Promise<ForumComment> => {
    const response = await api.post<ForumComment>(
      API_ENDPOINTS.FORUM_COMMENT.CREATE,
      data,
    );
    return normalizeComment(response.data);
  },

  // PUT /api/ForumComment/{id}
  update: async (
    id: number,
    data: ForumCommentUpdateRequest,
  ): Promise<ForumComment> => {
    if (!id || id <= 0) {
      throw new Error('Invalid comment ID for update');
    }
    const response = await api.put<ForumComment>(
      API_ENDPOINTS.FORUM_COMMENT.UPDATE(id),
      data,
    );
    return normalizeComment(response.data);
  },

  // DELETE /api/ForumComment/{id}
  delete: async (id: number): Promise<void> => {
    if (!id || id <= 0) {
      throw new Error('Invalid comment ID for deletion');
    }
    await api.delete(API_ENDPOINTS.FORUM_COMMENT.DELETE(id));
  },
};

export default forumCommentService;