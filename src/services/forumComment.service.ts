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
    author?: unknown;
    fullName?: unknown;
    authorAvatar?: unknown;
    parentId?: unknown;
    parentCommentId?: unknown;
    parent_comment_id?: unknown;
    replyToId?: unknown;
    replyToCommentId?: unknown;
    isUpvoted?: unknown;
  };
  const resolvedId = Number(record.forumCommentId ?? record.id ?? 0);
  const rawReply =
    record.replyId ??
    record.parentId ??
    record.parentCommentId ??
    record.parent_comment_id ??
    record.replyToId ??
    record.replyToCommentId;
  const resolvedReplyId =
    rawReply != null && !isNaN(Number(rawReply)) && Number(rawReply) > 0
      ? Number(rawReply)
      : null;

  return {
    id: resolvedId,
    forumCommentId: resolvedId,
    userId: record.userId != null ? Number(record.userId) : null,
    author: typeof record.author === 'string' ? record.author : undefined,
    fullName: typeof record.fullName === 'string' ? record.fullName : undefined,
    authorAvatar: typeof record.authorAvatar === 'string' ? record.authorAvatar : undefined,
    paperId: record.paperId != null ? Number(record.paperId) : null,
    forumPostId: record.forumPostId != null ? Number(record.forumPostId) : null,
    content: typeof record.content === 'string' ? record.content : '',
    replyId: resolvedReplyId,
    upvoteCount: record.upvoteCount != null ? Number(record.upvoteCount) : 0,
    isUpvoted: typeof record.isUpvoted === 'boolean' ? record.isUpvoted : false,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

export const forumCommentService = {
  // GET /api/ForumComment?postId={postId}
  getByPostId: async (postId: number): Promise<ForumComment[]> => {
    try {
      const response = await api.get<ForumComment[]>(
        API_ENDPOINTS.FORUM_COMMENT.GET_ALL,
        { params: { postId } },
      );
      const all = Array.isArray(response.data) ? response.data : [];
      return all
        .map(normalizeComment)
        .filter((c) => !c.forumPostId || c.forumPostId === postId);
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
    const parentId = data.replyId != null ? Number(data.replyId) : null;
    const payload = {
      ...data,
      ...(parentId ? {
        replyId: parentId,
        parentId: parentId,
        parentCommentId: parentId,
      } : {}),
    };
    const response = await api.post<ForumComment>(
      API_ENDPOINTS.FORUM_COMMENT.CREATE,
      payload,
    );
    const normalized = normalizeComment(response.data);
    if (parentId && !normalized.replyId) {
      normalized.replyId = parentId;
    }
    return normalized;
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

  // POST /api/ForumComment/{id}/vote (Toggle upvote/unvote)
  toggleVote: async (commentId: number): Promise<{ forumCommentId: number; upvoteCount: number; isUpvoted: boolean }> => {
    const response = await api.post<{ forumCommentId: number; upvoteCount: number; isUpvoted: boolean }>(
      API_ENDPOINTS.FORUM_COMMENT.TOGGLE_VOTE(commentId)
    );
    return response.data;
  },

  // GET /api/ForumComment/my-votes
  getMyVotes: async (): Promise<number[]> => {
    const response = await api.get<number[]>(API_ENDPOINTS.FORUM_COMMENT.MY_VOTES);
    return Array.isArray(response.data) ? response.data : [];
  },
};

export default forumCommentService;
