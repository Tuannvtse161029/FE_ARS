// OpenAlex work-ID normalization and preview helper for the Researcher
// paper-submission form.
//
// ── Scope ────────────────────────────────────────────────────────────────────
// The publication UI runs against the demo adapter today
// (see docs/PUBLICATION_FLOW_API_BLOCKERS.md §3.2). The BE has not shipped a
// typed OpenAlex lookup endpoint yet, and the OpenAlex public API must not be
// called from the browser (CORS, rate-limiting, key handling). This module is
// therefore an **additive, FE-only boundary** that:
//   1. Normalises and validates an OpenAlex work identifier.
//   2. Surfaces a deterministic, format-derived "scan preview" that explains
//      what the identifier looks like and what metadata will be requested
//      when the BE proxy ships.
//   3. Exposes typed errors so the form can render distinct messages.
//
// No network calls are issued from this module. The form must NEVER call the
// OpenAlex API directly and must NEVER embed an API key.
//
// ── OpenAlex identifier format ───────────────────────────────────────────────
// OpenAlex work IDs look like: W followed by up to 10 digits
//   - canonical example:  W2741809807
//   - bare example:       2741809807
//   - URL form:           https://api.openalex.org/works/W2741809807
//   - DOI form:           doi:10.5555/ars.demo.2026.001
// We only validate the `W...` short form (work IDs); the DOI and URL forms
// are rejected with a distinct error so the researcher types the correct
// identifier.

export const OPENALEX_ID_REGEX = /^W\d{1,10}$/;

export const OPENALEX_URL_REGEX = /^https?:\/\/(?:api\.)?openalex\.org\/works\/(W\d{1,10})\/?$/i;

export const OPENALEX_DOI_REGEX = /^doi:.{3,}$/i;

export class OpenAlexInvalidFormatError extends Error {
  constructor(value: string) {
    super(
      `"${value}" is not a valid OpenAlex work ID. Expected format: W followed by digits (e.g. W2741809807).`,
    );
    this.name = 'OpenAlexInvalidFormatError';
  }
}

export class OpenAlexUnsupportedVariantError extends Error {
  constructor(value: string) {
    super(
      `"${value}" is not a supported OpenAlex identifier form. Paste the short W-prefixed ID (e.g. W2741809807) — DOIs and full URLs are not yet supported by the research submission form.`,
    );
    this.name = 'OpenAlexUnsupportedVariantError';
  }
}

/**
 * Strip OpenAlex-specific framing from a raw string.
 * Returns a `mode` discriminator and the payload that should be validated.
 *  - "short"   → looks like a bare W-prefixed ID
 *  - "url"     → an api.openalex.org/works/W... URL
 *  - "doi"     → a DOI-style identifier
 *  - "unknown" → nothing matched; the caller should reject with an
 *                 OpenAlexInvalidFormatError.
 */
export type OpenAlexCandidate =
  | { mode: 'short'; payload: string }
  | { mode: 'url'; payload: string }
  | { mode: 'doi'; payload: string }
  | { mode: 'unknown'; payload: string };

export const classifyOpenAlexCandidate = (raw: string): OpenAlexCandidate => {
  if (typeof raw !== 'string') return { mode: 'unknown', payload: String(raw ?? '') };
  const trimmed = raw.trim();
  if (!trimmed) return { mode: 'unknown', payload: '' };

  if (OPENALEX_URL_REGEX.test(trimmed)) {
    const match = trimmed.match(OPENALEX_URL_REGEX);
    return { mode: 'url', payload: match?.[1] ?? '' };
  }

  if (OPENALEX_DOI_REGEX.test(trimmed)) {
    return { mode: 'doi', payload: trimmed };
  }

  if (/^W\d+$/i.test(trimmed)) {
    return { mode: 'short', payload: trimmed.toUpperCase() };
  }

  return { mode: 'unknown', payload: trimmed };
};

/**
 * Normalise a raw user-entered OpenAlex identifier to the canonical
 * short form (uppercase W + digits). Returns the canonical ID on success,
 * or an empty string if the input cannot be normalised.
 *
 * Examples:
 *   normalizeOpenAlexId("W2741809807")      → "W2741809807"
 *   normalizeOpenAlexId("w2741809807")      → "W2741809807"
 *   normalizeOpenAlexId("  W2741809807 ")   → "W2741809807"
 *   normalizeOpenAlexId("https://api.openalex.org/works/W2741809807")
 *                                            → "W2741809807"
 *   normalizeOpenAlexId("doi:10.5555/...")  → ""
 *   normalizeOpenAlexId("W2741809807ABCD")  → ""
 *   normalizeOpenAlexId("")                 → ""
 */
export const normalizeOpenAlexId = (raw: string): string => {
  const candidate = classifyOpenAlexCandidate(raw);
  if (candidate.mode === 'short' && OPENALEX_ID_REGEX.test(candidate.payload)) {
    return candidate.payload;
  }
  if (candidate.mode === 'url' && OPENALEX_ID_REGEX.test(candidate.payload)) {
    return candidate.payload;
  }
  return '';
};

/**
 * Returns `true` when the raw string normalises to a valid OpenAlex work ID.
 */
export const isValidOpenAlexId = (raw: string): boolean =>
  normalizeOpenAlexId(raw).length > 0;

export interface OpenAlexScanPreview {
  /** Canonical OpenAlex ID (e.g. W2741809807) */
  id: string;
  /** Stable preview derived from the ID — no network involved. */
  display: {
    title: string;
    summary: string;
    source: 'demo' | 'api';
    sourceLabel: string;
  };
}

/**
 * Build a deterministic, ID-derived preview that the form shows to the
 * researcher **before** the BE proxy ships. The preview intentionally does
 * NOT call OpenAlex from the browser; the moment the BE proxy lands, this
 * helper will be replaced by a typed adapter call.
 *
 * The shape mirrors what the future BE proxy will return so the form does not
 * need to be rewritten when the endpoint ships.
 */
export const buildOpenAlexScanPreview = (id: string): OpenAlexScanPreview => {
  if (!OPENALEX_ID_REGEX.test(id)) {
    throw new OpenAlexInvalidFormatError(id);
  }
  return {
    id,
    display: {
      title: `OpenAlex record ${id}`,
      summary:
        'Identifier recognised. Metadata enrichment will be supplied by the backend publication proxy when it ships.',
      source: 'demo',
      sourceLabel: 'Identifier preview (no live OpenAlex call)',
    },
  };
};

/**
 * Throw the appropriate error for an input the form should reject.
 * Used by the form's confirm/edit flow to surface distinct copy for:
 *   - DOI forms → OpenAlexUnsupportedVariantError
 *   - any other non-conforming value → OpenAlexInvalidFormatError
 *   - valid input → returns the canonical ID, does not throw
 */
export const rejectInvalidOpenAlexId = (raw: string): string => {
  const candidate = classifyOpenAlexCandidate(raw);
  if (candidate.mode === 'doi') {
    throw new OpenAlexUnsupportedVariantError(raw);
  }
  const normalized = normalizeOpenAlexId(raw);
  if (!normalized) {
    throw new OpenAlexInvalidFormatError(raw);
  }
  return normalized;
};

export const openAlexErrors = {
  invalid: OpenAlexInvalidFormatError,
  unsupported: OpenAlexUnsupportedVariantError,
};

export default {
  normalizeOpenAlexId,
  isValidOpenAlexId,
  classifyOpenAlexCandidate,
  buildOpenAlexScanPreview,
  rejectInvalidOpenAlexId,
  openAlexErrors,
};
