import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { PagedResult, PaginationParams } from '../types/api';
import type { AxiosRequestConfig } from 'axios';

/** Exact `PaperResponse` shape from the checked-in OpenAPI contract. */
export interface Paper {
  paperType?: string | null;
  publicationDate?: string | null;
  sourceName?: string | null;
  issnValue?: string | null;
  authorOrcidId?: string | null;
  authorOrcidDisplayName?: string | null;
  authors?: PaperAuthorResponse[] | null;
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
  paperType: 'Journal' | 'Conference';
  publicationDate?: string | null;
  sourceName?: string | null;
  issnValue?: string | null;
  authors?: PaperAuthorRequest[] | null;
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

/** Update input; paperType is filled from the authoritative record before PUT. */
export interface PaperUpdateRequest {
  // Manual decision fields retained for the Admin workflow. Persistence must
  // be confirmed from the authoritative response, not assumed from HTTP 200.
  authorshipVerificationStatus?: string;
  authorshipVerifiedAt?: string;
  authorshipVerificationReason?: string;
  paperType?: 'Journal' | 'Conference';
  publicationDate?: string | null;
  sourceName?: string | null;
  issnValue?: string | null;
  authors?: PaperAuthorRequest[] | null;
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
}

export interface GetPapersParams extends PaginationParams {
  status?: string;
}

/** Exact required wire fields from the live Swagger update contract. */
export interface PaperUpdateWireRequest extends PaperUpdateRequest {
  paperType: 'Journal' | 'Conference';
}

export interface PaperAuthorRequest {
  authorName: string;
  rawAuthorName?: string | null;
  orcidId?: string | null;
  openAlexAuthorId?: string | null;
  isCorresponding?: boolean | null;
}
export interface PaperAuthorResponse extends PaperAuthorRequest {
  paperAuthorId: number;
  authorOrder: number;
  source?: string | null;
  createdAt: string;
}

/** Exact `ManualAssignReviewersRequest` shape from the checked-in OpenAPI contract. */
export interface ManualAssignReviewersRequest {
  paperId: number;
  reviewerIds: number[];
}

export const paperService = {
  verifyAuthorship: async (id: number | string, openAlexWorkId: string | null): Promise<{
    paperId: number;
    authorshipVerificationStatus?: string | null;
    authorshipVerificationReason?: string | null;
    authorshipVerifiedAt?: string | null;
  }> => {
    const response = await api.post(API_ENDPOINTS.PAPER.VERIFY_AUTHORSHIP(id), { openAlexWorkId });
    return response.data;
  },
  testUpdateNoVerify: async (id: number | string): Promise<{
    paperId: number;
    authorshipVerificationStatus?: string | null;
    authorshipVerificationReason?: string | null;
    authorshipVerifiedAt?: string | null;
  }> => {
    const response = await api.put(API_ENDPOINTS.PAPER.TEST_UPDATE_NO_VERIFY(id));
    return response.data;
  },

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
    if (!Number.isInteger(response.data?.id) || response.data.id <= 0) {
      throw new Error('The backend did not return the created paper ID. Refresh your submissions before retrying.');
    }
    return paperService.getById(response.data.id);
  },

  update: async (id: number | string, data: PaperUpdateRequest): Promise<Paper> => {
    const current = await paperService.getById(id);
    const paperType = data.paperType ?? current.paperType;
    if (paperType !== 'Journal' && paperType !== 'Conference') {
      throw new Error('The backend requires a Journal or Conference paper type. Update the paper metadata before continuing.');
    }
    const body: PaperUpdateWireRequest = {
      fileUrl: current.fileUrl, status: current.status, issn: current.issn,
      isOpenAccess: current.isOpenAccess, quartile: current.quartile,
      subFieldId: current.subFieldId, openAlexWorkId: current.openAlexWorkId,
      doi: current.doi, publicationDate: current.publicationDate,
      sourceName: current.sourceName, issnValue: current.issnValue,
      authors: current.authors?.map(({ authorName, rawAuthorName, orcidId, openAlexAuthorId, isCorresponding }) => ({ authorName, rawAuthorName, orcidId, openAlexAuthorId, isCorresponding })),
      ...data, paperType,
    };
    await api.put(API_ENDPOINTS.PAPER.UPDATE(Number(id)), body);
    const refreshed = await paperService.getById(id);
    if (data.status && refreshed.status?.trim().toLowerCase() !== data.status.trim().toLowerCase()) {
      throw new Error('The backend did not confirm the requested paper status. Refresh and try again.');
    }
    return refreshed;
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
