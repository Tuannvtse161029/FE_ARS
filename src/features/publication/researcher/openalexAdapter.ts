// Local, additive OpenAlex boundary for the Researcher paper-submission form.
//
// This boundary exists so that:
//   - The form has a single, typed call-site for OpenAlex lookups.
//   - The day the BE ships a typed OpenAlex proxy (see
//     docs/PUBLICATION_FLOW_API_BLOCKERS.md §3.2), only this file changes.
//   - No OpenAlex network call is ever issued from the browser today.
//
// The boundary is **strictly FE-local**. It does NOT mutate the shared
// publication adapter. It is consumed only by
// ResearcherSubmissionForm.tsx.

import {
  normalizeOpenAlexId,
  OpenAlexInvalidFormatError,
  OpenAlexUnsupportedVariantError,
} from './openalex';

export type OpenAlexLookupOutcome =
  | { status: 'invalid_format'; message: string }
  | { status: 'unsupported_variant'; message: string }
  | { status: 'unavailable'; message: string };

/**
 * Lookup entry point used by the form. The implementation deliberately
 * does **not** call OpenAlex from the browser. Valid identifiers return an
 * explicit unavailable state until the backend proxy exists.
 *
 * When the BE proxy ships, replace the body of this function with a
 * `paperService.lookupOpenAlex(id)` call when the backend ticket is shipped.
 */
export const lookupOpenAlexPreview = async (rawId: string): Promise<OpenAlexLookupOutcome> => {
  const candidate = normalizeOpenAlexId(rawId);
  if (!candidate) {
    if (/^doi:/i.test(rawId.trim())) {
      const message = new OpenAlexUnsupportedVariantError(rawId).message;
      return { status: 'unsupported_variant', message };
    }
    const message = new OpenAlexInvalidFormatError(rawId).message;
    return { status: 'invalid_format', message };
  }
  return {
    status: 'unavailable',
    message:
      `OpenAlex work ${candidate} is valid, but metadata scanning is unavailable until the backend OpenAlex proxy is implemented. See tickets/backend/BE_OPENALEX_PROXY_TICKET.md. You can enter the identifier manually.`,
  };
};

export interface OpenAlexAdapterBoundary {
  lookupPreview: (rawId: string) => Promise<OpenAlexLookupOutcome>;
  normalize: (rawId: string) => string;
}

export const openAlexAdapter: OpenAlexAdapterBoundary = {
  lookupPreview: lookupOpenAlexPreview,
  normalize: normalizeOpenAlexId,
};

export default openAlexAdapter;
