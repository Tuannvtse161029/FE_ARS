// Researcher-side reviewer-name lookup via the User API.
//
// The BE's GET /api/ProfessionalProfile does not return `fullName` (only profile
// metadata), so completed review-request rows show "Reviewer details unavailable"
// when the BE response omits `reviewerName`.  We fill this gap by probing
// `GET /api/User/{reviewerId}` which returns `User.fullName`.
//
// Pattern mirrors `lecturerLookup.service.ts` — fire-and-forget with a module-
// scoped cache so repeated lookups for the same id dedupe to one request per
// session. Failures are silent; the honest fallback (`"Reviewer #<id>"`) is
// always shown rather than hiding the gap behind unavailable text.

import { userService } from './user.service';

const cache = new Map<number, string>();
const inflight = new Map<number, Promise<void>>();

const fallbackName = (reviewerId: number): string => `Reviewer #${reviewerId}`;

/**
 * Synchronously return the cached display name for a reviewer, or the
 * `"Reviewer #<id>"` fallback when the cache is empty. Safe to call inside
 * render — no network, no thrown errors.
 */
export const getReviewerDisplayName = (
  reviewerId: number | string | null | undefined,
): string => {
  if (reviewerId == null) return 'Reviewer';
  const numId = typeof reviewerId === 'string' ? Number(reviewerId) : reviewerId;
  if (!Number.isFinite(numId) || numId <= 0) return 'Reviewer';
  const cached = cache.get(numId);
  return cached ?? fallbackName(numId);
};

/**
 * Trigger a fire-and-forget probe against `GET /api/User/{reviewerId}` to
 * populate the cache. Failures are swallowed. The caller MUST treat this as
 * best-effort decoration — always call `getReviewerDisplayName` for the
 * synchronous fallback.
 */
export const ensureReviewerDisplayName = (
  reviewerId: number | string | null | undefined,
): void => {
  if (reviewerId == null) return;
  const numId = typeof reviewerId === 'string' ? Number(reviewerId) : reviewerId;
  if (!Number.isFinite(numId) || numId <= 0) return;
  if (cache.has(numId) || inflight.has(numId)) return;
  const promise = (async () => {
    try {
      const user = await userService.getById(numId) as { fullName?: string; username?: string };
      const name = (user.fullName ?? user.username ?? '').trim();
      if (name.length > 0) {
        cache.set(numId, name);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ars:reviewer-name-resolved', { detail: { reviewerId: numId } }),
          );
        }
      }
    } catch {
      // Silent failure — keep the `Reviewer #<id>` fallback.
    } finally {
      inflight.delete(numId);
    }
  })();
  inflight.set(numId, promise);
};

/**
 * Resolve a reviewer display name synchronously, optionally triggering a cache
 * population if the name is not yet known. Combines `getReviewerDisplayName`
 * and `ensureReviewerDisplayName` into one call.
 */
export const resolveReviewerName = (
  reviewerId: number | string | null | undefined,
): string => {
  ensureReviewerDisplayName(reviewerId);
  return getReviewerDisplayName(reviewerId);
};

/**
 * Test-only helper. Clears the in-memory cache + inflight set so unit tests
 * don't bleed state between cases. Production code MUST NOT call this.
 */
export const __resetReviewerDisplayNameCacheForTests = (): void => {
  cache.clear();
  inflight.clear();
};

export const reviewerLookupService = {
  getReviewerDisplayName,
  ensureReviewerDisplayName,
  resolveReviewerName,
};

export default reviewerLookupService;
