import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { CommentVote, CommentVoteCreateRequest } from '../types/domain';

export const commentVoteService = {
  getAll: async (forumCommentId?: number): Promise<CommentVote[]> => {
    const params = forumCommentId !== undefined ? { forumCommentId } : undefined;
    const response = await api.get<CommentVote[]>(API_ENDPOINTS.COMMENT_VOTE.GET_ALL, { params });
    return Array.isArray(response.data) ? response.data : [];
  },

  vote: async (data: CommentVoteCreateRequest): Promise<CommentVote> => {
    const response = await api.post<CommentVote>(API_ENDPOINTS.COMMENT_VOTE.CREATE, data);
    return response.data;
  },
};
