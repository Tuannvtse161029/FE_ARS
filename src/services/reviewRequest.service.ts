import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

// Mirrors BE ReviewRequest shape. The BE GET response is undocumented in Swagger
// (only "200: OK" is declared), so we model all known fields from the create
// request schema plus the obvious server-managed fields. Anything the BE doesn't
// return will simply be `undefined` — handlers should fall back gracefully.
export interface ReviewRequest {
  id?: number;
  paperId?: number | null;
  reviewerId?: number | null;
  fee?: number | null;
  status?: string | null;
  deadline?: string | null;
  airecommended?: boolean | null;
  type?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Optional joined fields if the BE ever expands them
  paperTitle?: string;
  reviewerName?: string;
}

export interface ReviewRequestCreateRequest {
  paperId?: number | null;
  reviewerId?: number | null;
  fee?: number | null;
  status?: string | null;
  deadline?: string | null;
  airecommended?: boolean | null;
  type?: string | null;
}

export const reviewRequestService = {
  // GET /api/ReviewRequest — returns a raw array per the user's confirmed shape.
  getAll: async (): Promise<ReviewRequest[]> => {
    const response = await api.get<ReviewRequest[]>(API_ENDPOINTS.REVIEW_REQUEST.GET_ALL);
    return Array.isArray(response.data) ? response.data : [];
  },

  getById: async (id: number): Promise<ReviewRequest> => {
    const response = await api.get<ReviewRequest>(API_ENDPOINTS.REVIEW_REQUEST.GET_BY_ID(id));
    return response.data;
  },

  // POST /api/ReviewRequest — body matches ReviewRequestCreateRequest schema.
  // Returns the persisted row (assumed from the BE; if not, callers can fall back
  // to a follow-up getAll()).
  create: async (data: ReviewRequestCreateRequest): Promise<ReviewRequest> => {
    const response = await api.post<ReviewRequest>(API_ENDPOINTS.REVIEW_REQUEST.CREATE, data);
    return response.data;
  },

  update: async (id: number, data: Partial<ReviewRequestCreateRequest>): Promise<ReviewRequest> => {
    const response = await api.put<ReviewRequest>(API_ENDPOINTS.REVIEW_REQUEST.UPDATE(id), data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.REVIEW_REQUEST.DELETE(id));
  },
};

export default reviewRequestService;
