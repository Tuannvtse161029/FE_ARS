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
// The live API now exposes POST /api/Admin/orcid-lookup. It accepts a
// roleRequestId and returns OpenAlex-backed metadata; the frontend must receive
// that correlation ID from the Admin role-request payload before calling it.
//
// ── ProfessionalProfile schema (partial evidence) ─────────────────────────────
// The Swagger does expose a `ProfessionalProfileCreateRequest` with an `orcidId`
// string field (swagger.json lines 5638–5641). This field is stored on
// registration but no GET/PUT endpoint surfaces it in a way that would let the
// Admin retrieve public ORCID metadata (name, works, affiliation, etc.).
//
// ── Decision ─────────────────────────────────────────────────────────────────
import { isAxiosError } from 'axios';
import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

/** OpenAPI `OrcidStatusResponse`. */
export interface OrcidStatusResponse {
  userId: number;
  isConnected: boolean;
  isVerified: boolean;
  orcidId: string | null;
  verifiedAt: string | null;
  canConnect: boolean;
}

export interface OpenAlexAuthorResponse {
  openAlexId: string | null;
  orcid: string | null;
  displayName: string | null;
  fullName: string | null;
  alternativeNames: string[] | null;
  rawAuthorNames: string[] | null;
  externalUrl: string | null;
}

export interface OpenAlexMetricsResponse {
  worksCount: number;
  citedByCount: number;
  hIndex: number | null;
  i10Index: number | null;
  twoYearMeanCitedness: number | null;
}

export interface OpenAlexAffiliationResponse {
  institutionOpenAlexId: string | null;
  institutionName: string | null;
  ror: string | null;
  countryCode: string | null;
  type: string | null;
  years: number[] | null;
}

export interface OpenAlexInstitutionResponse {
  openAlexId: string | null;
  displayName: string | null;
  ror: string | null;
  countryCode: string | null;
  type: string | null;
}

export interface OpenAlexTopicResponse {
  topicId: string | null;
  topicName: string | null;
  count: number;
  subFieldId: string | null;
  subFieldName: string | null;
  fieldId: string | null;
  fieldName: string | null;
  domainId: string | null;
  domainName: string | null;
}

export interface OpenAlexYearCountResponse {
  year: number;
  worksCount: number;
  oaWorksCount: number;
  citedByCount: number;
}

export interface OpenAlexWorkResponse {
  openAlexId: string | null;
  title: string | null;
  doi: string | null;
  publicationYear: number | null;
  publicationDate: string | null;
  type: string | null;
  citedByCount: number;
  sourceName: string | null;
  isOpenAccess: boolean | null;
  openAccessStatus: string | null;
  isRetracted: boolean;
  externalUrl: string | null;
}

/** Exact `OrcidLookupResponse`, returned for all documented lookup outcomes. */
export interface OrcidLookupApiResponse {
  orcidId: string | null;
  lookupStatus: string | null;
  sourceFetchedAt: string;
  author: OpenAlexAuthorResponse;
  metrics: OpenAlexMetricsResponse;
  affiliations: OpenAlexAffiliationResponse[] | null;
  lastKnownInstitutions: OpenAlexInstitutionResponse[] | null;
  topics: OpenAlexTopicResponse[] | null;
  countsByYear: OpenAlexYearCountResponse[] | null;
  works: OpenAlexWorkResponse[] | null;
  missingSections: string[] | null;
  providerWarnings: string[] | null;
  message: string | null;
  retryAfterSeconds: number | null;
}
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
 * Enabled by default because the live Admin ORCID lookup endpoint is now
 * documented and implemented. Set `VITE_ORCID_CHECK_ENABLED=false` only while
 * diagnosing a backend outage.
 *
 */
export const ORCID_CHECK_ENABLED =
  import.meta.env.VITE_ORCID_CHECK_ENABLED !== 'false';

/**
 * Thrown by `lookupOrcid` when the feature flag is disabled.
 * Caught internally; exposed so callers can distinguish "not implemented yet"
 * from "network error during lookup".
 */
export class OrcidCheckFeatureDisabledError extends Error {
  constructor(message = 'ORCID Check requires a role-request identifier from the backend.') {
    super(message);
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

// ── ORCID account-link contract ─────────────────────────────────────────────

/**
 * Starts the registration ORCID OAuth flow. Swagger declares `200` without a
 * response body, so the browser must follow the server/provider redirect.
 */
export async function startRegistrationOrcidLink(): Promise<void> {
  await api.post<void>(API_ENDPOINTS.AUTH.ORCID_REGISTRATION_START);
}

/** Starts the authenticated account ORCID OAuth flow; the server derives user ID from JWT. */
export async function startAccountOrcidLink(): Promise<void> {
  await api.post<void>(API_ENDPOINTS.AUTH.ORCID_ACCOUNT_START);
}

/** Retrieves the current authenticated user's ORCID connection state. */
export async function getOrcidStatus(): Promise<OrcidStatusResponse> {
  const response = await api.get<OrcidStatusResponse>(API_ENDPOINTS.AUTH.ORCID_STATUS);
  return response.data;
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
 * This implementation is BE-proxy-only; the live endpoint resolves the
 * ORCID attached to an Admin role request and returns normalized metadata.
 * The FE must NOT call OpenAlex or ORCID Public API directly from the browser.
 *
 * ── Step 1 (current): BE proxy stub ───────────────────────────────────────
 * `POST /api/Admin/orcid-lookup` { roleRequestId: number }
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
 *
 * @param rawOrcid  The ORCID iD as entered by the user (any common format).
 *                  Will be normalized before lookup.
 */
export const lookupOrcid = async (
  rawOrcid: string,
  roleRequestId?: number,
): Promise<OrcidLookupResponse> => {
  // ── Guard: feature flag ────────────────────────────────────────────────────
  if (!ORCID_CHECK_ENABLED) {
    throw new OrcidCheckFeatureDisabledError();
  }
  // ── Guard: format validation (fast-fail before any network call) ────────────
  const normalized = normalizeOrcid(rawOrcid);
  if (!normalized) {
    throw new OrcidInvalidFormatError(rawOrcid);
  }
  if (!Number.isInteger(roleRequestId) || Number(roleRequestId) <= 0) {
    throw new OrcidCheckFeatureDisabledError();
  }
  const requestId = roleRequestId as number;

  // ── Step 1: ARS backend proxy (current stub) ───────────────────────────────
  try {
    const result = await _lookupViaBackend(normalized, requestId);
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
 * Backend proxy for the live Admin ORCID/OpenAlex lookup endpoint.
 *
 * Request:  POST /api/Admin/orcid-lookup { roleRequestId: number }
 * Response: OrcidPersonMetadata
 * Errors:   404 → OrcidNotFoundError
 *           429 → OrcidRateLimitError
 *           5xx → OrcidApiError
 */
async function _lookupViaBackend(
  _orcid: string,
  roleRequestId: number,
): Promise<OrcidLookupResult> {
  try {
    const response = await api.post<OrcidLookupApiResponse>(
      API_ENDPOINTS.ADMIN.ORCID_LOOKUP,
      { roleRequestId },
    );
    const raw = response.data;
    const author = raw.author;
    const orcid = raw.orcidId ?? _orcid;
    const affiliations = (raw.affiliations ?? [])
      .map((item) => item.institutionName)
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    const keywords = (raw.topics ?? [])
      .map((item) => item.topicName)
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    const works: OrcidWork[] = (raw.works ?? [])
      .filter((item): item is OpenAlexWorkResponse & { title: string } =>
        typeof item.title === 'string' && item.title.trim() !== '',
      )
      .map((item) => ({
        title: item.title,
        ...(typeof item.doi === 'string' ? { doi: item.doi } : {}),
        ...(typeof item.publicationYear === 'number' ? { year: item.publicationYear } : {}),
        ...(typeof item.type === 'string' ? { type: item.type } : {}),
        ...(typeof item.externalUrl === 'string' ? { openalexUrl: item.externalUrl } : {}),
      }));
    const lookupStatus = raw.lookupStatus?.trim().toLowerCase() ?? '';

    return {
      status: 'success',
      meta: {
        orcid,
        displayName: author?.displayName ?? author?.fullName ?? undefined,
        affiliations,
        emails: [],
        orcidUrl: `https://orcid.org/${orcid}`,
        keywords,
        works,
        isIncomplete:
          (raw.missingSections?.length ?? 0) > 0 ||
          Boolean(lookupStatus && !['success', 'found', 'ok'].includes(lookupStatus)),
      },
    };
  } catch (err: unknown) {
    if (!isAxiosError<OrcidLookupApiResponse>(err)) {
      throw new OrcidApiError(0, _orcid);
    }

    const status = err.response?.status ?? 0;
    const retryAfterSeconds = err.response?.data?.retryAfterSeconds ?? undefined;
    if (status === 404) throw new OrcidNotFoundError(_orcid);
    if (status === 429) throw new OrcidRateLimitError(retryAfterSeconds);
    throw new OrcidApiError(status, _orcid);
  }
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
 * The live BE combines the provider data server-side.
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
