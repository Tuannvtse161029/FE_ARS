import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { PagedResult, PaginationParams } from '../types/api';
import type { AxiosRequestConfig } from 'axios';

/** Exact `PaperResponse` shape from the checked-in OpenAPI contract. */
export interface Paper {
  id: number;
  title?: string | null;
  abstract?: string | null;
  fileUrl?: string | null;
  issn?: boolean | null;
  isOpenAccess?: boolean | null;
  quartile?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  subFieldId?: number | null;
  authorId?: number | null;
  authorName?: string | null;
}

/** Exact `PaperCreateRequest` shape; title and abstract are required. */
export interface PaperCreateRequest {
  title: string;
  abstract: string;
  fileUrl?: string | null;
  issn?: boolean | null;
  isOpenAccess?: boolean | null;
  quartile?: string | null;
  subFieldId?: number | null;
}

/** Exact `PaperUpdateRequest` shape; title and abstract remain required. */
export interface PaperUpdateRequest {
  title: string;
  abstract: string;
  fileUrl?: string | null;
  status?: string | null;
  issn?: boolean | null;
  isOpenAccess?: boolean | null;
  quartile?: string | null;
  subFieldId?: number | null;
}

export interface GetPapersParams extends PaginationParams {
  status?: string;
}

export const paperService = {
  getAll: async (
    params?: GetPapersParams,
    config?: AxiosRequestConfig,
  ): Promise<PagedResult<Paper>> => {
    const response = await api.get<PagedResult<Paper>>(
      API_ENDPOINTS.PAPER.GET_ALL,
      { params, ...config },
    );
    return response.data;
  },

  getById: async (
    id: number | string,
    config?: AxiosRequestConfig,
  ): Promise<Paper> => {
    const response = await api.get<Paper>(
      API_ENDPOINTS.PAPER.GET_BY_ID(Number(id)),
      config,
    );
    return response.data;
  },

  create: async (data: PaperCreateRequest): Promise<Paper> => {
    const response = await api.post<Paper>(API_ENDPOINTS.PAPER.CREATE, data);
    return response.data;
  },

  update: async (id: number | string, data: PaperUpdateRequest): Promise<Paper> => {
    const response = await api.put<Paper>(API_ENDPOINTS.PAPER.UPDATE(Number(id)), data);
    return response.data;
  },

  delete: async (id: number | string): Promise<void> => {
    await api.delete(API_ENDPOINTS.PAPER.DELETE(Number(id)));
  },
};

export default paperService;
