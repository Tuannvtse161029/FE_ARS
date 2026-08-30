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

  return {
    status: 'unavailable',
    message:
      `OpenAlex work ${candidate} is valid, but metadata scanning is unavailable until the ARS backend publishes its OpenAlex import contract. You can enter the identifier manually.`,
  };
};

export const openAlexAdapter = {
  lookupPreview: lookupOpenAlexPreview,
  normalize: normalizeOpenAlexId,
};

export default openAlexAdapter;
