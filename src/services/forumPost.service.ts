import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  ForumPost,
  ForumPostCreateRequest,
  ForumPostFilters,
} from '../types/forum.types';

// Filter the BE may receive as query params. The Swagger contract on
// `GET /api/ForumPost` declares `category`, `sort`, and `search` as
// optional query string parameters; anything not supported will be
// ignored by the BE rather than 400-ing. We pass them through as-is.
type ForumPostListParams = ForumPostFilters;

export const forumPostService = {
  // GET /api/ForumPost?category=&sort=&search=
  // Returns an empty array when the BE responds with a non-array payload
  // (e.g. an error envelope) so consumers never crash on `posts.map(...)`.
  getAll: async (params?: ForumPostListParams): Promise<ForumPost[]> => {
    const response = await api.get<ForumPost[]>(
      API_ENDPOINTS.FORUM_POST.GET_ALL,
      { params },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  // GET /api/ForumPost/{id}
  getById: async (id: number): Promise<ForumPost> => {
    const response = await api.get<ForumPost>(
      API_ENDPOINTS.FORUM_POST.GET_BY_ID(id),
    );
    return response.data;
  },

  // POST /api/ForumPost
  // The BE returns the freshly created post (with the assigned id and
  // any server-populated fields like createdAt).
  create: async (data: ForumPostCreateRequest): Promise<ForumPost> => {
    const response = await api.post<ForumPost>(
      API_ENDPOINTS.FORUM_POST.CREATE,
      data,
    );
    return response.data;
  },

  // NOTE: Swagger only exposes GET (list / by-id) and POST for ForumPost.
  // Update (PUT) and delete (DELETE) endpoints are intentionally NOT
  // defined here — if the BE later ships them, add update() and delete()
  // that route through the same `api` client.
};

export default forumPostService;