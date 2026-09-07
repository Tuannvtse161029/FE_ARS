/**
 * friendlyAuthorshipVerificationLabel
 *
 * Translates the structured `authorshipVerificationStatus` tokens emitted by
 * the BE (`PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP`,
 * `PENDING_ADMIN_REVIEW__PAPER_UPDATED_REQUIRES_REVIEW`, …) into human-readable
 * phrases the admin UI can show directly.
 *
 * Three-tier resolution:
 *
 *   1. If the raw token exactly matches a known entry in
 *      `KNOWN_VERIFICATION_TOKENS`, return that friendly phrase.
 *   2. If the token begins with the `PENDING_ADMIN_REVIEW__` prefix, strip the
 *      prefix and Title Case the rest ("ORCID_NOT_IN_AUTHORSHIP" →
 *      "Orcid Not In Authorship") so the admin never sees double-underscored
 *      enum strings in production UI.
 *   3. Otherwise Title Case the raw value as a final fallback.
 *
 * Keeping the lookup table small and explicit is deliberate: the BE token
 * vocabulary is owned by the publication backend team, and this file is the
 * FE's documented translator. When BE adds a new token, the FE gets a single
 * edit here — no scattered `switch` statements to track down.
 *
 * Returning a string (never throwing) is intentional — callers fall back to
 * `t(..., fallback)` patterns that already own i18n.
 */
const KNOWN_VERIFICATION_TOKENS: Record<string, string> = {
  // Verified states (already normalised by the adapter, listed for completeness).
  ALLOW: 'Verified',
  ALLOWED: 'Verified',
  VERIFIED: 'Verified',
  // Rejected states.
  REJECTED: 'Verification rejected',
  DENIED: 'Verification rejected',
  // Pending / awaiting states — these are the ones the BE actually emits today.
  NOT_CHECKED: 'Not yet checked',
  PENDING_ADMIN_REVIEW: 'Awaiting admin review',
  AWAITING_ADMIN_VERIFICATION: 'Awaiting admin verification',
  PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP:
    "Submitter's ORCID is not in the author list — recheck the listed authors and ORCID IDs.",
  PENDING_ADMIN_REVIEW__ORCID_NOT_VERIFIED:
    'Submitter ORCID has not been verified against ORCID/OAuth yet.',
  PENDING_ADMIN_REVIEW__OPENALEX_LOOKUP_FAILED:
    'OpenAlex lookup could not confirm authorship — provide a DOI or OpenAlex Work ID.',
  PENDING_ADMIN_REVIEW__PAPER_UPDATED_REQUIRES_REVIEW:
    'The manuscript was edited after the last verification — re-run authorship check.',
  PENDING_ADMIN_REVIEW__AWAITING_ADMIN_VERIFICATION:
    'Awaiting admin verification — please run the authorship check.',
};

const PENDING_PREFIX = 'PENDING_ADMIN_REVIEW__';

const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

/** Returns a friendly label for a single raw verification token. */
export const friendlyAuthorshipVerificationLabel = (
  raw: string | null | undefined,
): string => {
  if (!raw) return 'Not yet checked';
  const trimmed = raw.trim();
  if (!trimmed) return 'Not yet checked';
  const upper = trimmed.toUpperCase();
  if (KNOWN_VERIFICATION_TOKENS[upper]) return KNOWN_VERIFICATION_TOKENS[upper];
  if (upper.startsWith(PENDING_PREFIX)) {
    const tail = trimmed.slice(PENDING_PREFIX.length).trim();
    return tail ? titleCase(tail) : 'Awaiting admin review';
  }
  return titleCase(trimmed);
};

/**
 * Combines a verification status with its (optional) free-text reason into a
 * single user-facing string suitable for an inline error banner. Avoids
 * duplication when BE already returned a friendly phrase as the status and
 * echoed the same phrase as the reason.
 */
export const friendlyAuthorshipVerificationError = (
  status: string | null | undefined,
  reason: string | null | undefined,
): string => {
  const statusLabel = friendlyAuthorshipVerificationLabel(status);
  const cleanedReason = reason?.trim();
  if (!cleanedReason) return statusLabel;
  // If the reason is just the raw token the BE echoed back, drop it —
  // statusLabel already carries the friendly version.
  if (cleanedReason.toUpperCase() === (status ?? '').trim().toUpperCase()) {
    return statusLabel;
  }
  // If the reason equals the status label we already produced, also drop it.
  if (cleanedReason === statusLabel) return statusLabel;
  return `${statusLabel}. ${cleanedReason}`;
};
