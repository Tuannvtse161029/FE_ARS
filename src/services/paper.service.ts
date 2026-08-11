import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { PagedResult, PaginationParams } from '../types/api';

export interface Paper {
  id: string;
  name: string;
  date: string;
  status: string;
  hasNote: boolean;
  pdfUrl?: string;
  researchFields?: string[];
  userId?: number;
}

export interface PaperCreateRequest {
  title: string;
  pdfUrl: string;
  researchFields: string[];
}

export interface PaperUpdateRequest {
  title?: string;
  status?: string;
  note?: string;
  scorecardUrl?: string;
}

export interface GetPapersParams extends PaginationParams {
  status?: string;
}

export const paperService = {
  getAll: async (params?: GetPapersParams): Promise<PagedResult<Paper>> => {
    const response = await api.get<PagedResult<Paper>>(API_ENDPOINTS.PAPER.GET_ALL, { params });
    return response.data;
  },

  getById: async (id: string): Promise<Paper> => {
    const response = await api.get<Paper>(API_ENDPOINTS.PAPER.GET_BY_ID(id as unknown as number));
    return response.data;
  },

  create: async (data: PaperCreateRequest): Promise<Paper> => {
    const response = await api.post<Paper>(API_ENDPOINTS.PAPER.CREATE, data);
    return response.data;
  },

  update: async (id: string, data: PaperUpdateRequest): Promise<Paper> => {
    const response = await api.put<Paper>(API_ENDPOINTS.PAPER.UPDATE(id as unknown as number), data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(API_ENDPOINTS.PAPER.DELETE(id as unknown as number));
  },
};

export default paperService;
