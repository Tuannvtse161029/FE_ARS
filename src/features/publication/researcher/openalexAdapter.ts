// Local, additive OpenAlex boundary for the Researcher paper-submission form.
//
// This boundary exists so that:
//   - The form has a single, typed call-site for OpenAlex lookups.
//   - The day the BE ships a typed OpenAlex proxy (see
//     docs/PUBLICATION_FLOW_API_BLOCKERS.md §3.2), only this file changes.
//   - No OpenAlex network call is ever issued from the browser today.
//
// The boundary is **strictly FE-local**. It does NOT mutate the shared
// publication adapter or the demo fixtures. It is consumed only by
// ResearcherSubmissionForm.tsx.

import {
  buildOpenAlexScanPreview,
  normalizeOpenAlexId,
  OpenAlexInvalidFormatError,
  OpenAlexUnsupportedVariantError,
  type OpenAlexScanPreview,
} from './openalex';

export type OpenAlexLookupOutcome =
  | { status: 'preview'; preview: OpenAlexScanPreview }
  | { status: 'invalid_format'; message: string }
  | { status: 'unsupported_variant'; message: string }
  | { status: 'unavailable'; message: string };

/**
 * Lookup entry point used by the form. The implementation deliberately
 * does **not** call OpenAlex — it produces a deterministic, format-derived
 * preview that mirrors the future server-side response shape.
 *
 * When the BE proxy ships, replace the body of this function with a
 * `paperService.lookupOpenAlex(id)` call. The return type is already shaped
 * for that swap.
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
  const preview = buildOpenAlexScanPreview(candidate);
  return { status: 'preview', preview };
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
