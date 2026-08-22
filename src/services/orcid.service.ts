// ORCID / OpenAlex lookup service for the Admin Role Requests ORCID Check feature.
//
// ── Swagger Evidence ──────────────────────────────────────────────────────────
// The live Swagger at https://arsplatform.onrender.com/swagger/v1/swagger.json was
// inspected on 2026-08-22. The complete list of tags/controllers is:
//   Analytics · AuditLog · Auth · CommentVote · DetailedEvaluation · Email ·
//   Follower · ForumComment · ForumPost · GroupMember · GuidanceProject ·
//   LearningMaterial · MajorField · MembershipPackage · MembershipPurchase ·
//   Notification · Paper · Payment · PhasedReport · PremiumPackage ·
//   ProfessionalProfile · Profile · Report · ResearchGroup · ResearchTopic ·
//   ReviewRequest · Role · Seminar · SeminarParticipant · SharedMaterial ·
//   SubField · Transaction · User · UserRole · UserToken · Wallet ·
//   WithdrawalRequest
//
// No tag exposing "ORCID", "OpenAlex", "Orcid", "orcid", "openalex", or any
// lookup-enabling endpoint was found. All 6,784 lines of the swagger.json were
// scanned.
//
// ── ProfessionalProfile schema (partial evidence) ─────────────────────────────
// The Swagger does expose a `ProfessionalProfileCreateRequest` with an `orcidId`
// string field (swagger.json lines 5638–5641). This field is stored on
// registration but no GET/PUT endpoint surfaces it in a way that would let the
// Admin retrieve public ORCID metadata (name, works, affiliation, etc.).
//
// ── Decision ─────────────────────────────────────────────────────────────────
// No ARS-backed ORCID lookup endpoint exists. The feature is implemented behind
// a disabled feature flag. The UI shows a clear "Feature Unavailable" state.
// When the BE team ships a dedicated endpoint, flip
// `VITE_ORCID_CHECK_ENABLED=true` and implement the `_lookupViaBackend` path.
//
// ── ORCID public API notes ────────────────────────────────────────────────────
// ORCID Public API base: https://pub.orcid.org/v3.0
// OpenAlex API base:      https://api.openalex.org
// Both are public, no credentials required for basic metadata retrieval.
// We intentionally DO NOT call them directly from the FE to avoid:
//   1. CORS preflight issues (many public APIs block browser-initiated requests)
//   2. Exposing our ARS infrastructure to rate-limiting by external services
//   3. Security rules — no API credentials may be hardcoded or stored in FE code
// The BE-side proxy approach (recommended BE implementation) avoids all three.

/**
 * Controls whether the ORCID Check button and modal are accessible.
 *
 * Currently `false` — no ARS endpoint is available to proxy the lookup.
 * Flip to `true` once the BE team ships the ORCID lookup endpoint and the
 * `_lookupViaBackend` stub below is implemented.
 *
 * Alternatively, set the env variable `VITE_ORCID_CHECK_ENABLED=true` to
 * override this default during local development / testing.
 */
export const ORCID_CHECK_ENABLED =
  import.meta.env.VITE_ORCID_CHECK_ENABLED === 'true';

/**
 * Thrown by `lookupOrcid` when the feature flag is disabled.
 * Caught internally; exposed so callers can distinguish "not implemented yet"
 * from "network error during lookup".
 */
export class OrcidCheckFeatureDisabledError extends Error {
  constructor() {
    super('ORCID Check is not yet available. The backend proxy endpoint has not been implemented.');
    this.name = 'OrcidCheckFeatureDisabledError';
  }
}

/**
 * Error thrown when the ORCID ID is not valid format.
 * ORCID iDs are exactly 16 digits separated by dashes: XXXX-XXXX-XXXX-XXXX
 * (19 characters total, e.g. "0000-0000-0000-0000").
 */
export class OrcidInvalidFormatError extends Error {
  constructor(value: string) {
    super(`"${value}" is not a valid ORCID iD format. Expected XXXX-XXXX-XXXX-XXXX.`);
    this.name = 'OrcidInvalidFormatError';
  }
}

/**
 * Error thrown when the ORCID lookup returned no matching record.
 */
export class OrcidNotFoundError extends Error {
  constructor(value: string) {
    super(`No public ORCID record found for "${value}". The iD may be incorrect or the record may be private.`);
    this.name = 'OrcidNotFoundError';
  }
}

/**
 * Error thrown when the ORCID or OpenAlex API returns an HTTP error status.
 */
export class OrcidApiError extends Error {
  constructor(public readonly status: number, public readonly orcidId: string) {
    super(`ORCID API returned HTTP ${status} for iD "${orcidId}".`);
    this.name = 'OrcidApiError';
  }
}

/**
 * Error thrown when ORCID API rate-limiting is detected (HTTP 429).
 */
export class OrcidRateLimitError extends Error {
  constructor(retryAfterSeconds?: number) {
    const msg = retryAfterSeconds
      ? ` ORCID API rate limit hit. Retry after ${retryAfterSeconds} seconds.`
      : ' ORCID API rate limit hit. Please wait before trying again.';
    super(msg);
    this.name = 'OrcidRateLimitError';
  }
}

// ── Public metadata shape ─────────────────────────────────────────────────────

export interface OrcidWork {
  title: string;
  /** DOI of the work, if present */
  doi?: string;
  /** Year the work was published */
  year?: number;
  /** Work type e.g. "journal-article", "conference-paper" */
  type?: string;
  /** OpenAlex work URL, if fetched via OpenAlex */
  openalexUrl?: string;
}

export interface OrcidPersonMetadata {
  /** Canonical ORCID iD (with dashes) */
  orcid: string;
  /** Given name(s) */
  givenNames?: string;
  /** Family name */
  familyName?: string;
  /** Display name (ORCID canonical name field) */
  displayName?: string;
  /** Affiliation institutions (may be empty) */
  affiliations: string[];
  /** Country code, e.g. "VN", "US" */
  country?: string;
  /** Public email addresses (may be empty) */
  emails: string[];
  /** URL of the person's ORCID public profile page */
  orcidUrl: string;
  /** Self-reported keywords / research interests */
  keywords: string[];
  /** List of works returned by the lookup */
  works: OrcidWork[];
  /** Whether the record appeared to be incomplete / unverified */
  isIncomplete: boolean;
}

// ── ORCID normalization ───────────────────────────────────────────────────────

/**
 * ORCID iD format regex.
 * Valid:  0000-0000-0000-0000  (4 groups of 4 digits, separated by dashes)
 * The check is case-insensitive but the canonical form is upper-case.
 */
const ORCID_REGEX = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

const ORCID_URL_REGEX = /^https?:\/\/(?:www\.)?orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])\/?$/i;

/** Validate the ISO 7064 MOD 11-2 checksum used by ORCID. */
export const hasValidOrcidChecksum = (canonical: string): boolean => {
  if (!ORCID_REGEX.test(canonical)) return false;
  const digits = canonical.replace(/-/g, '').toUpperCase();
  const checkDigit = digits.charAt(digits.length - 1);
  if (!checkDigit) return false;
  let total = 0;
  for (const digit of digits.slice(0, -1)) {
    total = (total + Number(digit)) * 2;
  }
  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const expected = result === 10 ? 'X' : String(result);
  return checkDigit === expected;
};

const extractOrcidCandidate = (raw: string): string => {
  const trimmed = raw.trim();
  const urlMatch = trimmed.match(ORCID_URL_REGEX);
  if (urlMatch) return urlMatch[1];
  return trimmed;
};

/**
 * Normalize a raw ORCID string to the canonical form (upper-case, dashes).
 * Returns the normalized iD on success, or an empty string if the input is
 * not a valid ORCID format.
 *
 * Examples:
 *   normalizeOrcid("0000-0000-0000-0000")  → "0000-0000-0000-0000"
 *   normalizeOrcid("0000000000000000")       → "0000-0000-0000-0000"
 *   normalizeOrcid("0000-0000-0000-000X")   → "0000-0000-0000-000X"
 *   normalizeOrcid("not-an-orcid")          → ""
 *   normalizeOrcid("")                      → ""
 *   normalizeOrcid("  0000-0000-0000-0000  ") → "0000-0000-0000-0000"
 */
export const normalizeOrcid = (raw: string): string => {
  if (typeof raw !== 'string') return '';
  const trimmed = extractOrcidCandidate(raw);
  if (!trimmed) return '';

  // Already in canonical form
  if (ORCID_REGEX.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Strip all dashes and spaces — raw 16-digit form (allow X as last char)
  const digitsOnly = trimmed.replace(/[\s\-]/g, '');
  if (/^\d{15}[\dX]$/i.test(digitsOnly)) {
    const canonical = [
      digitsOnly.slice(0, 4),
      digitsOnly.slice(4, 8),
      digitsOnly.slice(8, 12),
      digitsOnly.slice(12, 16),
    ].join('-').toUpperCase();
    return canonical;
  }

  return '';
};

/**
 * Returns `true` when `normalizeOrcid` confirms the value is a valid iD.
 * Convenience wrapper for callers that only need the boolean.
 */
export const isValidOrcidFormat = (raw: string): boolean =>
  normalizeOrcid(raw).length > 0;

// ── Lookup entry point ───────────────────────────────────────────────────────

/** Shape of a successful lookup result, for UI consumption. */
export interface OrcidLookupResult {
  status: 'success';
  meta: OrcidPersonMetadata;
}

/** Shape of a failed lookup, with the error type for UI copy. */
export type OrcidLookupFailure =
  | { status: 'not_found'; orcidId: string }
  | { status: 'rate_limited'; retryAfterSeconds?: number }
  | { status: 'api_error'; statusCode: number }
  | { status: 'network_error'; message: string };

export type OrcidLookupResponse = OrcidLookupResult | OrcidLookupFailure;

// ── Live lookup ──────────────────────────────────────────────────────────────

/**
 * Look up public metadata for an ORCID iD.
 *
 * This implementation is BE-proxy-only (currently stubbed/unavailable).
 * The FE must NOT call OpenAlex or ORCID Public API directly from the browser.
 *
 * ── Step 1 (current): BE proxy stub ───────────────────────────────────────
 * `POST /api/OrcidLookup` { orcid: string }
 * Expected BE response: OrcidPersonMetadata
 * Expected BE error responses: 404 (not found), 429 (rate limit), 5xx (error)
 *
 * ── Step 2 (future, ORCID Public API fallback):
 * GET https://pub.orcid.org/v3.0/{orcid-id}
 * Accept: application/vnd.orcid+json
 * (No auth required for public records)
 *
 * ── Step 3 (future, OpenAlex enrichment):
 * GET https://api.openalex.org/authors?orcid={orcid-id}
 * Returns OpenAlex Author object with works, citation counts, etc.
 *
 * Until the BE ships Step 1, this function always throws
 * `OrcidCheckFeatureDisabledError`.
 *
 * @param rawOrcid  The ORCID iD as entered by the user (any common format).
 *                  Will be normalized before lookup.
 */
export const lookupOrcid = async (rawOrcid: string): Promise<OrcidLookupResponse> => {
  // ── Guard: feature flag ────────────────────────────────────────────────────
  if (!ORCID_CHECK_ENABLED) {
    throw new OrcidCheckFeatureDisabledError();
  }

  // ── Guard: format validation (fast-fail before any network call) ────────────
  const normalized = normalizeOrcid(rawOrcid);
  if (!normalized) {
    throw new OrcidInvalidFormatError(rawOrcid);
  }

  // ── Step 1: ARS backend proxy (current stub) ───────────────────────────────
  try {
    const result = await _lookupViaBackend(normalized);
    return result;
  } catch (err) {
    // Re-throw known feature-disabled errors as-is
    if (err instanceof OrcidCheckFeatureDisabledError) throw err;

    // Re-throw known ORCID errors as-is
    if (
      err instanceof OrcidInvalidFormatError ||
      err instanceof OrcidNotFoundError ||
      err instanceof OrcidRateLimitError ||
      err instanceof OrcidApiError
    ) {
      throw err;
    }

    // Unknown error — surface as network error
    throw new OrcidApiError(
      0,
      normalized,
    );
  }
};

/**
 * Backend proxy stub — implement this once BE ships the endpoint.
 *
 * Request:  POST /api/OrcidLookup { orcid: string }
 * Response: OrcidPersonMetadata
 * Errors:   404 → OrcidNotFoundError
 *           429 → OrcidRateLimitError
 *           5xx → OrcidApiError
 */
async function _lookupViaBackend(_orcid: string): Promise<OrcidLookupResult> {
  // TODO (BE Team): implement POST /api/OrcidLookup
  // See "Backend Team Request" section in the feature PR description.
  throw new OrcidCheckFeatureDisabledError();
}

// ── OpenAlex enrichment ──────────────────────────────────────────────────────

/**
 * Enrich an ORCID lookup with OpenAlex author metadata.
 *
 * OpenAlex can resolve ORCID iDs to author records:
 *   GET https://api.openalex.org/authors?orcid={orcid-id}
 *
 * This is a secondary enrichment step — the ORCID public API provides name /
 * affiliation, while OpenAlex adds publication counts, h-index proxies, and
 * top works. Call this after a successful `_lookupViaBackend`.
 *
 * Returns the same OrcidLookupResult enriched with works from OpenAlex, or the
 * original result if OpenAlex returns no match (not an error).
 *
 * Currently unimplemented — BE proxy would combine both sources server-side.
 */
export const enrichWithOpenAlex = async (
  result: OrcidLookupResult,
): Promise<OrcidLookupResult> => {
  // TODO (BE Team): implement combined ORCID + OpenAlex enrichment in
  // POST /api/OrcidLookup and return enriched metadata directly.
  void result;
  return result; // Pass through unchanged until BE ships the combined endpoint.
};

export default {
  lookupOrcid,
  normalizeOrcid,
  isValidOrcidFormat,
  enrichWithOpenAlex,
  ORCID_CHECK_ENABLED,
  OrcidCheckFeatureDisabledError,
  OrcidInvalidFormatError,
  OrcidNotFoundError,
  OrcidApiError,
  OrcidRateLimitError,
};
