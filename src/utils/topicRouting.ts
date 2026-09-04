/**
 * URL helpers for the Lecturer topic / phase / report drill-down flow.
 *
 * The Milestones workspace reads its topic id from the URL — never from
 * a global store, never from a hardcoded list. This file centralises the
 * parse / format logic so the Research Topics page, the Milestones page,
 * the Phase Reports page, and the redirect route all agree on the same
 * wire format.
 *
 * Wire format:
 *   /configure-milestones?topicId=<id>[&groupId=<id>]
 *   /lecturer/research-topics/:topicId/milestones
 *
 * Both URLs land on the same component. The path-segment form redirects
 * to the query-string form so we keep one source of truth for the page.
 */

export interface TopicSelection {
  topicId: number | null;
  error: 'missing' | 'invalid' | null;
}

const POSITIVE_INTEGER = /^\d+$/;

import { ROUTES } from '../routes/paths';

/**
 * Parse the topic id from a query-string-style search params object.
 *
 * Returns `{ topicId, error }`:
 *   - `topicId` is `null` only when the value is missing or invalid.
 *   - `error` is `'missing'` when the param is absent, `'invalid'` when
 *     it is present but cannot be coerced to a positive integer.
 *
 * Callers should treat both error states as "show recoverable error UI",
 * because the brief requires that invalid ids do not silently fall back
 * to another topic.
 */
export const parseTopicIdFromSearch = (
  params: URLSearchParams | ReadonlyURLSearchParamsLike | null | undefined,
): TopicSelection => {
  if (!params) return { topicId: null, error: 'missing' };
  const raw = params.get('topicId');
  if (raw === null || raw === undefined || raw === '') {
    return { topicId: null, error: 'missing' };
  }
  if (!POSITIVE_INTEGER.test(raw)) {
    return { topicId: null, error: 'invalid' };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { topicId: null, error: 'invalid' };
  }
  return { topicId: parsed, error: null };
};

/**
 * Parse an arbitrary id (group, phase) from the query string.
 *
 * Returns `null` for missing / invalid values so the caller can keep
 * sensible defaults (e.g. "no group selected").
 */
export const parseIdFromSearch = (
  params: URLSearchParams | ReadonlyURLSearchParamsLike | null | undefined,
  key: string,
): number | null => {
  if (!params) return null;
  const raw = params.get(key);
  if (raw === null || raw === undefined || raw === '') return null;
  if (!POSITIVE_INTEGER.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

/**
 * Build the canonical Milestones URL for a given topic.
 *
 * Used by the Research Topics "Manage Phases" button so every link goes
 * through this one helper — there is no other place that hardcodes the
 * route.
 */
export const buildConfigureMilestonesUrl = (
  topicId: number,
  groupId?: number | null,
  options?: { highlightPhaseNumber?: number | null },
): string => {
  const search = new URLSearchParams();
  search.set('topicId', String(topicId));
  if (typeof groupId === 'number' && Number.isFinite(groupId) && groupId > 0) {
    search.set('groupId', String(groupId));
  }
  if (
    options?.highlightPhaseNumber !== null &&
    options?.highlightPhaseNumber !== undefined &&
    Number.isFinite(options.highlightPhaseNumber) &&
    options.highlightPhaseNumber > 0
  ) {
    search.set('phase', String(options.highlightPhaseNumber));
    search.set('highlight', 'true');
  }
  return `/configure-milestones?${search.toString()}`;
};

/**
 * Build the canonical Research Topics list URL with an optional highlight
 * flag, used when deep-linking from the Materials "Used by" modal back to
 * a specific topic row.
 */
export const buildResearchTopicsUrl = (options?: {
  highlightTopicId?: number | null;
}): string => {
  const search = new URLSearchParams();
  if (
    options?.highlightTopicId !== null &&
    options?.highlightTopicId !== undefined &&
    Number.isFinite(options.highlightTopicId) &&
    options.highlightTopicId > 0
  ) {
    search.set('topicId', String(options.highlightTopicId));
    search.set('highlight', 'true');
  }
  const qs = search.toString();
  return qs.length > 0
    ? `${ROUTES.LECTURER_RESEARCH_TOPICS}?${qs}`
    : ROUTES.LECTURER_RESEARCH_TOPICS;
};

/**
 * Read the boolean `highlight` flag from the search params. Returns true
 * only when the param is explicitly set to `true` / `1` / `yes` — any
 * other value (including absent) is treated as false so a stale URL never
 * surprises the user with an unsolicited animation.
 */
export const parseHighlightFlag = (
  params: URLSearchParams | ReadonlyURLSearchParamsLike | null | undefined,
): boolean => {
  if (!params) return false;
  const raw = params.get('highlight');
  if (raw === null) return false;
  return raw === 'true' || raw === '1' || raw === 'yes';
};

/**
 * Build the canonical Phase Reports URL for a given topic drill-down.
 */
export const buildPhaseReportsUrl = (params: {
  topicId?: number | null;
  groupId?: number | null;
}): string => {
  const search = new URLSearchParams();
  if (typeof params.topicId === 'number' && params.topicId > 0) {
    search.set('topicId', String(params.topicId));
  }
  if (typeof params.groupId === 'number' && params.groupId > 0) {
    search.set('groupId', String(params.groupId));
  }
  const qs = search.toString();
  return qs.length > 0 ? `/lecturer/phase-reports?${qs}` : '/lecturer/phase-reports';
};

/**
 * Minimal interface so callers can pass either the standard
 * `URLSearchParams` or the `ReadonlyURLSearchParams` that React Router's
 * `useSearchParams` returns.
 */
export interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}