import api from '../../../services/axios';
import { API_ENDPOINTS } from '../../../utils/constants';
import {
  normalizeOpenAlexId,
  OpenAlexInvalidFormatError,
  OpenAlexUnsupportedVariantError,
} from './openalex';

export type OpenAlexImportedMetadata = {
  id: string;
  title?: string;
  abstract?: string;
  publicationDate?: string;
  doi?: string;
  authors: string[];
  institutions: string[];
  topics: string[];
  keywords: string[];
};

export type OpenAlexLookupOutcome =
  | { status: 'preview'; metadata: OpenAlexImportedMetadata }
  | { status: 'invalid_format'; message: string }
  | { status: 'unsupported_variant'; message: string }
  | { status: 'unavailable'; message: string };

export interface OpenAlexWorkPreviewAuthorResponse {
  rawAuthorName?: string | null;
  rawOrcid?: string | null;
  authorOpenAlexId?: string | null;
  authorDisplayName?: string | null;
  authorOrcid?: string | null;
  isCorresponding?: boolean | null;
  institutions?: Array<{
    openAlexId?: string | null;
    displayName?: string | null;
    ror?: string | null;
    countryCode?: string | null;
    type?: string | null;
  }> | null;
}

export interface OpenAlexWorkPreviewTopicResponse {
  topicId?: string | null;
  topicName?: string | null;
  score?: number | null;
  subFieldId?: string | null;
  subFieldName?: string | null;
  fieldId?: string | null;
  fieldName?: string | null;
  domainId?: string | null;
  domainName?: string | null;
}

export interface OpenAlexWorkPreviewConceptResponse {
  conceptId?: string | null;
  conceptName?: string | null;
  score?: number | null;
  level?: number | null;
}

export interface OpenAlexWorkPreviewResponse {
  openAlexWorkId?: string | null;
  lookupStatus?: string | null;
  sourceFetchedAt?: string;
  title?: string | null;
  abstract?: string | null;
  publicationYear?: number | null;
  publicationDate?: string | null;
  doi?: string | null;
  type?: string | null;
  citedByCount?: number;
  isRetracted?: boolean;
  isOpenAccess?: boolean | null;
  openAccessStatus?: string | null;
  authors?: OpenAlexWorkPreviewAuthorResponse[] | null;
  topics?: OpenAlexWorkPreviewTopicResponse[] | null;
  concepts?: OpenAlexWorkPreviewConceptResponse[] | null;
  externalUrl?: string | null;
  message?: string | null;
  retryAfterSeconds?: number | null;
}

export const lookupOpenAlexPreview = async (rawId: string): Promise<OpenAlexLookupOutcome> => {
  const candidate = normalizeOpenAlexId(rawId);
  if (!candidate) {
    if (/^doi:/i.test(rawId.trim())) {
      return {
        status: 'unsupported_variant',
        message: new OpenAlexUnsupportedVariantError(rawId).message,
      };
    }
    return {
      status: 'invalid_format',
      message: new OpenAlexInvalidFormatError(rawId).message,
    };
  }

  try {
    const endpoint = API_ENDPOINTS.OPEN_ALEX?.GET_WORK
      ? API_ENDPOINTS.OPEN_ALEX.GET_WORK(candidate)
      : `/api/OpenAlex/works/${candidate}`;

    const response = await api.get<OpenAlexWorkPreviewResponse>(endpoint);
    const data = response.data;

    if (!data) {
      return {
        status: 'unavailable',
        message: `No data returned from OpenAlex for work ${candidate}.`,
      };
    }

    if (data.lookupStatus === 'NOT_FOUND') {
      return {
        status: 'unavailable',
        message: data.message || `No OpenAlex work was found for ID ${candidate}.`,
      };
    }

    const authors: string[] = Array.isArray(data.authors)
      ? data.authors
          .map((a) => (a.authorDisplayName || a.rawAuthorName || '').trim())
          .filter(Boolean)
      : [];

    const institutions: string[] = Array.isArray(data.authors)
      ? Array.from(
          new Set(
            data.authors
              .flatMap((a) => (a.institutions || []).map((i) => (i.displayName || '').trim()))
              .filter(Boolean)
          )
        )
      : [];

    const topics: string[] = Array.isArray(data.topics)
      ? data.topics.map((t) => (t.topicName || '').trim()).filter(Boolean)
      : [];

    const keywords: string[] = Array.isArray(data.concepts)
      ? data.concepts.map((c) => (c.conceptName || '').trim()).filter(Boolean)
      : [];

    const publicationDate = data.publicationDate
      ? typeof data.publicationDate === 'string' && data.publicationDate.length >= 10
        ? data.publicationDate.slice(0, 10)
        : String(data.publicationDate)
      : data.publicationYear
      ? String(data.publicationYear)
      : undefined;

    const metadata: OpenAlexImportedMetadata = {
      id: data.openAlexWorkId || candidate,
      title: data.title?.trim() || undefined,
      abstract: data.abstract?.trim() || undefined,
      publicationDate,
      doi: data.doi?.trim() || undefined,
      authors,
      institutions,
      topics,
      keywords,
    };

    return {
      status: 'preview',
      metadata,
    };
  } catch (err: unknown) {
    const error = err as {
      response?: {
        status?: number;
        data?: { message?: string; title?: string };
      };
      message?: string;
    };

    const status = error.response?.status;
    const serverMessage = error.response?.data?.message || error.response?.data?.title;

    if (status === 404) {
      return {
        status: 'unavailable',
        message: serverMessage || `No OpenAlex work was found for ID ${candidate}.`,
      };
    }
    if (status === 400) {
      return {
        status: 'invalid_format',
        message: serverMessage || `"${candidate}" is not a recognized OpenAlex work format.`,
      };
    }
    if (status === 429) {
      return {
        status: 'unavailable',
        message: 'OpenAlex scanning is temporarily rate limited. Please try again in a few moments.',
      };
    }

    return {
      status: 'unavailable',
      message: serverMessage || error.message || 'OpenAlex scanning is unavailable.',
    };
  }
};

export const openAlexAdapter = {
  lookupPreview: lookupOpenAlexPreview,
  normalize: normalizeOpenAlexId,
};

export default openAlexAdapter;
