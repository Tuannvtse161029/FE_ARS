import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

// Mirrors GET /api/ProfessionalProfile response shape:
// { userId, orcidId, hindex, totalCitations, publicationCount, syncStatus, updatedAt }
export interface ReviewerProfile {
  userId: number;
  orcidId: string | null;
  hindex: number | null;
  totalCitations: number | null;
  publicationCount: number | null;
  syncStatus: string | null;
  updatedAt?: string;
}

export const reviewerService = {
  getAll: async (): Promise<ReviewerProfile[]> => {
    const response = await api.get<ReviewerProfile[]>(API_ENDPOINTS.PROFESSIONAL_PROFILE.GET_ALL);
    return response.data;
  },

  getById: async (userId: number): Promise<ReviewerProfile> => {
    const response = await api.get<ReviewerProfile>(API_ENDPOINTS.PROFESSIONAL_PROFILE.GET_BY_ID(userId));
    return response.data;
  },
};

export default reviewerService;
