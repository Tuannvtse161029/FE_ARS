import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

export interface DetailedEvaluation {
  detailedEvaluationId?: number;
  reviewRequestId?: number | null;
  reviewerId?: number | null;
  scoreOriginality?: number | null;
  notesOriginality?: string | null;
  scoreLiterature?: number | null;
  notesLiterature?: string | null;
  scoreMethodology?: number | null;
  notesMethodology?: string | null;
  scoreResults?: number | null;
  notesResults?: string | null;
  scoreFormatting?: number | null;
  notesFormatting?: string | null;
  generalComments?: string | null;
  finalDecision?: string | null;
  createdAt?: string;
}

export interface DetailedEvaluationCreateRequest {
  reviewRequestId?: number | null;
  reviewerId?: number | null;
  scoreOriginality?: number | null;
  notesOriginality?: string | null;
  scoreLiterature?: number | null;
  notesLiterature?: string | null;
  scoreMethodology?: number | null;
  notesMethodology?: string | null;
  scoreResults?: number | null;
  notesResults?: string | null;
  scoreFormatting?: number | null;
  notesFormatting?: string | null;
  generalComments?: string | null;
  finalDecision?: string | null;
}

export interface DetailedEvaluationUpdateRequest extends DetailedEvaluationCreateRequest {}

export const detailedEvaluationService = {
  getByReviewRequestId: async (reviewRequestId: number): Promise<DetailedEvaluation> => {
    // The BE returns a raw object; the unique constraint on DetailedEvaluation means
    // there is at most one evaluation per review request.
    const response = await api.get<DetailedEvaluation>(
      `${API_ENDPOINTS.DETAILED_EVALUATION.GET_ALL}?reviewRequestId=${reviewRequestId}`
    );
    // GET /api/DetailedEvaluation returns an array — take the first matching item
    const data = response.data;
    if (Array.isArray(data)) {
      return (data as DetailedEvaluation[]).find(
        (e) => e.reviewRequestId === reviewRequestId
      ) ?? ({} as DetailedEvaluation);
    }
    return data;
  },

  create: async (data: DetailedEvaluationCreateRequest): Promise<DetailedEvaluation> => {
    const response = await api.post<DetailedEvaluation>(
      API_ENDPOINTS.DETAILED_EVALUATION.GET_ALL,
      data
    );
    return response.data;
  },

  update: async (
    id: number,
    data: DetailedEvaluationUpdateRequest
  ): Promise<DetailedEvaluation> => {
    const response = await api.put<DetailedEvaluation>(
      API_ENDPOINTS.DETAILED_EVALUATION.UPDATE(id),
      data
    );
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.DETAILED_EVALUATION.UPDATE(id));
  },
};

export default detailedEvaluationService;
