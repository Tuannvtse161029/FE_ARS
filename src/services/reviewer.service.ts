import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

// Mirrors GET /api/ProfessionalProfile response shape:
// { userId, orcidId, hindex, totalCitations, publicationCount, syncStatus, reviewFee, updatedAt }
export interface ReviewerProfile {
  userId: number;
  orcidId: string | null;
  hindex: number | null;
  totalCitations: number | null;
  publicationCount: number | null;
  syncStatus: string | null;
  reviewFee: number | null;
  updatedAt?: string;
}

export interface ProfessionalProfileUpdateRequest {
  orcidId?: string | null;
  hindex?: number | null;
  totalCitations?: number | null;
  publicationCount?: number | null;
  syncStatus?: string | null;
  reviewFee?: number | null;
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

  update: async (userId: number, data: Partial<ProfessionalProfileUpdateRequest>): Promise<ReviewerProfile> => {
    const response = await api.put<ReviewerProfile>(API_ENDPOINTS.PROFESSIONAL_PROFILE.UPDATE(userId), data);
    return response.data;
  },

  updateAvailability: async (userId: number, isAvailable: boolean): Promise<void> => {
    await api.patch(API_ENDPOINTS.PROFESSIONAL_PROFILE.UPDATE_AVAILABILITY(userId), { isAvailable });
  },
};

export default reviewerService;
