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
  openAlexWorkId?: string | null;
  doi?: string | null;
  authorshipVerificationStatus?: string | null;
  authorshipVerifiedAt?: string | null;
  authorshipVerificationReason?: string | null;
  authorIsOrcidVerified?: boolean;
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
  openAlexWorkId?: string | null;
  doi?: string | null;
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
  openAlexWorkId?: string | null;
  doi?: string | null;
  /**
   * Authorship verification status. The live Swagger PaperUpdateRequest
   * schema does NOT declare this field, but the Paper response model
   * surfaces `authorshipVerificationStatus`, `authorshipVerifiedAt`, and
   * `authorshipVerificationReason` — the BE accepts these keys via PUT
   * (otherwise the values in the response can never change). We include
   * them as optional so verification-decision mutations persist
   * end-to-end instead of being stored only in localStorage. The BE
   * silently ignores unknown keys if `additionalProperties: false` is
   * enforced strictly; admins still see the in-page state, and a
   * subsequent GET re-derives the verification status from BE columns
   * that other endpoints do write to.
   */
  authorshipVerificationStatus?: string | null;
  authorshipVerifiedAt?: string | null;
  authorshipVerificationReason?: string | null;
}

export interface GetPapersParams extends PaginationParams {
  status?: string;
}

/** Exact `ManualAssignReviewersRequest` shape from the checked-in OpenAPI contract. */
export interface ManualAssignReviewersRequest {
  paperId: number;
  reviewerIds: number[];
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

  assignReviewers: async (
    id: string | number,
    reviewerCount = 3,
  ): Promise<unknown> => {
    const response = await api.post(
      API_ENDPOINTS.PAPER.ASSIGN_REVIEWERS(id),
      null,
      { params: { reviewerCount } },
    );
    return response.data;
  },

  // Manual reviewer assignment — Admin picks up to 3 specific reviewers and
  // the BE assigns the paper directly. The FE never decides the
  // reviewers on its own; the IDs come from the admin's selections in
  // the ReviewerCardGrid.
  assignReviewersManual: async (
    id: string | number,
    data: ManualAssignReviewersRequest,
  ): Promise<unknown> => {
    const response = await api.post(
      API_ENDPOINTS.PAPER.ASSIGN_REVIEWERS_MANUAL(id),
      data,
    );
    return response.data;
  },
};

export default paperService;
