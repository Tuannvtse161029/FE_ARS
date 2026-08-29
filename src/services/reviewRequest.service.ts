import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { AxiosRequestConfig } from 'axios';

// Mirrors BE ReviewRequest shape. The BE GET response is undocumented in Swagger
// (only "200: OK" is declared), so we model all known fields from the create
// request schema plus the obvious server-managed fields. Anything the BE doesn't
// return will simply be `undefined` — handlers should fall back gracefully.
//
// NOTE: The BE returns `reviewRequestId` (not `id`). This is normalized to `id`
// in the mapped response so downstream code can use `r.id` consistently.
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
  reviewerEmail?: string | null;
  reviewerAvatarUrl?: string | null;
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

const normalizeReviewRequest = (raw: unknown): ReviewRequest => {
  const row = (raw ?? {}) as Record<string, unknown>;
  const id = Number(row.reviewRequestId ?? row.id);
  return {
    ...(Number.isFinite(id) && id > 0 ? { id } : {}),
    paperId: typeof row.paperId === 'number' ? row.paperId : null,
    reviewerId: typeof row.reviewerId === 'number' ? row.reviewerId : null,
    reviewerName: typeof row.reviewerName === 'string' ? row.reviewerName : undefined,
    reviewerEmail: typeof row.reviewerEmail === 'string' ? row.reviewerEmail : null,
    reviewerAvatarUrl: typeof row.reviewerAvatarUrl === 'string' ? row.reviewerAvatarUrl : null,
    fee: typeof row.fee === 'number' ? row.fee : null,
    status: typeof row.status === 'string' ? row.status : null,
    deadline: typeof row.deadline === 'string' ? row.deadline : null,
    airecommended: typeof row.airecommended === 'boolean' ? row.airecommended : null,
    type: typeof row.type === 'string' ? row.type : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
  };
};

export const reviewRequestService = {
  // GET /api/ReviewRequest — returns a raw array per the user's confirmed shape.
  getAll: async (
    config?: AxiosRequestConfig,
  ): Promise<ReviewRequest[]> => {
    const response = await api.get<ReviewRequest[]>(
      API_ENDPOINTS.REVIEW_REQUEST.GET_ALL,
      config,
    );
    const raw: unknown[] = Array.isArray(response.data) ? response.data : [];
    return raw.map(normalizeReviewRequest);
  },

  /** ReviewRequest has no reviewer-scoped route yet, so filter its live rows
   * by the authenticated reviewer ID before fetching manuscript details. */
  getForReviewer: async (reviewerId: number): Promise<ReviewRequest[]> => {
    if (!Number.isInteger(reviewerId) || reviewerId <= 0) return [];
    return (await reviewRequestService.getAll()).filter(
      (request) => request.reviewerId === reviewerId && request.paperId != null,
    );
  },

  getById: async (id: number): Promise<ReviewRequest> => {
    const response = await api.get<ReviewRequest>(API_ENDPOINTS.REVIEW_REQUEST.GET_BY_ID(id));
    return normalizeReviewRequest(response.data);
  },

  // POST /api/ReviewRequest — body matches ReviewRequestCreateRequest schema.
  // Returns the persisted row (assumed from the BE; if not, callers can fall back
  // to a follow-up getAll()).
  create: async (data: ReviewRequestCreateRequest): Promise<ReviewRequest> => {
    const response = await api.post<ReviewRequest>(API_ENDPOINTS.REVIEW_REQUEST.CREATE, data);
    return normalizeReviewRequest(response.data);
  },

  update: async (id: number, data: Partial<ReviewRequestCreateRequest>): Promise<ReviewRequest> => {
    const response = await api.put<ReviewRequest>(API_ENDPOINTS.REVIEW_REQUEST.UPDATE(id), data);
    return normalizeReviewRequest(response.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.REVIEW_REQUEST.DELETE(id));
  },
};

export default reviewRequestService;
