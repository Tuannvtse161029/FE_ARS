import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

// Mirrors GET /api/ProfessionalProfile response shape:
// { userId, orcidId, hindex, totalCitations, publicationCount, syncStatus, isAvailable, updatedAt }
export interface ReviewerProfile {
  userId: number;
  orcidId: string | null;
  hindex: number | null;
  totalCitations: number | null;
  publicationCount: number | null;
  syncStatus: string | null;
  majorFieldId?: number | null;
  majorFieldName?: string | null;
  subFieldId?: number | null;
  subFieldName?: string | null;
  // Whether this reviewer is currently accepting review requests.
  // May be missing on older API responses — treat as false in that case.
  isAvailable?: boolean;
  updatedAt?: string;
}

export interface ProfessionalProfileUpdateRequest {
  userId?: number;
  orcidId?: string | null;
  hindex?: number | null;
  totalCitations?: number | null;
  publicationCount?: number | null;
  syncStatus?: string | null;
  majorFieldId?: number | null;
  subFieldId?: number | null;
  isAvailable?: boolean | null;
}

export const reviewerService = {
  getAll: async (): Promise<ReviewerProfile[]> => {
    const response = await api.get<ReviewerProfile[]>(API_ENDPOINTS.PROFESSIONAL_PROFILE.GET_ALL);
    return Array.isArray(response.data) ? response.data : [];
  },

  getById: async (userId: number): Promise<ReviewerProfile> => {
    const response = await api.get<ReviewerProfile>(API_ENDPOINTS.PROFESSIONAL_PROFILE.GET_BY_ID(userId));
    return response.data;
  },

  // Use the authenticated user ID as the path identity; never expose a caller-selected fee target.
  update: async (userId: number, data: ProfessionalProfileUpdateRequest): Promise<ReviewerProfile> => {
    const response = await api.put<ReviewerProfile>(API_ENDPOINTS.PROFESSIONAL_PROFILE.UPDATE(userId), data);
    return response.data;
  },

  updateAvailability: async (userId: number, isAvailable: boolean): Promise<void> => {
    await api.patch(API_ENDPOINTS.PROFESSIONAL_PROFILE.UPDATE_AVAILABILITY(userId), { isAvailable });
  },
};

export default reviewerService;
