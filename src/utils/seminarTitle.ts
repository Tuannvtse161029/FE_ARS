/**
 * Seminar heading cleaner — Oct 2026.
 *
 * The seminar-creation form has a textarea labeled "Seminar Details"
 * (separate from the title input). Some lecturers typed that section
 * label into the title field by mistake and ended up with names like
 *   "AI Research Discussion Seminar Details"
 * showing up in the card heading and the detail modal header.
 *
 * The user-facing heading should be the seminar name only — strip the
 * trailing " Seminar Details" suffix when it was obviously copied from
 * the form label, but keep the original `title` available everywhere
 * else (modal bodies, ARIA labels, search) so we don't silently mangle
 * real titles like "Engineering Seminar Details Workshop" or
 * "Seminar Details Recap" (where "Details" is part of the meaning).
 *
 * Matching rules:
 *   • Only strips the suffix when it appears at the END of the string.
 *   • Allows optional trailing whitespace + optional punctuation
 *     (".", "!", "?") before end-of-string.
 *   • Case-insensitive.
 *   • If stripping would leave a heading shorter than 3 characters,
 *     fall back to the original so we don't show a blank heading.
 */
const STRIP_HEADING_SUFFIX = /\s+Seminar Details\s*[.!?]?\s*$/i;
const MIN_HEADING_LENGTH = 3;

export function cleanSeminarHeading(
  raw: string | null | undefined,
): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(STRIP_HEADING_SUFFIX, '').trim();
  // Guard against accidentally producing whitespace or a single-character
  // heading — fall back to the original title in that case.
  return cleaned.length >= MIN_HEADING_LENGTH ? cleaned : trimmed;
}