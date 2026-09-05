/**
 * useAuthorFlair — module-cached subscriber for a single author's unlocked medals.
 *
 * Why this hook exists
 * --------------------
 * Forum card grids (20+ cards per page) and the profile identity row both
 * render a flair badge next to a username. If each card independently calls
 * `medalService.getUserMedals`, we hammer the /api/Medal/user/:id endpoint
 * once per author per page render.
 *
 * This hook keeps a module-level cache (`flairCache`) that survives unmounts
 * within the same page session, so:
 *   - 20 forum cards for the same author → 1 network call (the rest read cache)
 *   - Card unmounts (route change, tab switch) → cache stays warm
 *   - Browser refresh → cache resets (intentional; safer for stale data)
 *
 * The hook returns the user's full unlocked-medals list (unsorted) plus a
 * loading flag. Callers that need to pick a single "featured" badge use
 * `pickFeaturedMedal()` from this module — pure, testable, deterministic.
 */

import { useEffect, useState } from 'react';
import { medalService } from '../services/medal.service';
import type { MedalTier, UserMedal } from '../services/medal.service';

// Module-level cache: { [userId]: UserMedal[] }
// Lives as long as the JS bundle lives in the browser — i.e. for the entire
// page session (F5 resets it). Keys are String(userId) so callers can pass
// either `number` or `string` IDs without missing the cache.
const flairCache: Record<string, UserMedal[]> = {};

/** Tier rank for tie-breaking featured-flair selection. Higher = better. */
const TIER_RANK: Record<MedalTier, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
};

/**
 * Picks the user's featured flair medal.
 *
 * Algorithm (deterministic):
 *   1. If `flairMedalId` is set AND that medal is in the user's unlocked list,
 *      return it. (User explicitly pinned a badge.)
 *   2. Else if `flairOrder` is set, walk the order array and return the
 *      first medal from the unlocked list. (Per-user ordering preference.)
 *   3. Else pick the highest-tier unlocked medal (Platinum > Gold > Silver >
 *      Bronze), tie-breaking by most-recent `unlockedAt`.
 *   4. Return `null` if `medals` is empty or no match is found.
 *
 * Pure function — no React, no side effects, easy to unit-test.
 */
export function pickFeaturedMedal(
  medals: UserMedal[],
  flairMedalId?: string | null,
  flairOrder?: string[] | null,
): UserMedal | null {
  if (!Array.isArray(medals) || medals.length === 0) return null;

  const unlocked = medals.filter((m) => m && m.medal && m.isUnlocked);
  if (unlocked.length === 0) return null;

  // 1. Explicit pinned flair
  if (flairMedalId) {
    const pinned = unlocked.find((m) => m.medal.id === flairMedalId);
    if (pinned) return pinned;
    // Pinned ID is set but not unlocked → fall through to next strategies
    // (we silently return a different badge rather than render nothing, so
    // the user always sees SOMETHING for their unlocked set).
  }

  // 2. User-defined order preference
  if (Array.isArray(flairOrder) && flairOrder.length > 0) {
    for (const id of flairOrder) {
      const hit = unlocked.find((m) => m.medal.id === id);
      if (hit) return hit;
    }
  }

  // 3. Highest tier, tie-break by most recent unlockedAt
  const sorted = [...unlocked].sort((a, b) => {
    const tierDelta = (TIER_RANK[b.medal.tier] ?? 0) - (TIER_RANK[a.medal.tier] ?? 0);
    if (tierDelta !== 0) return tierDelta;

    const aTime = a.unlockedAt ? Date.parse(a.unlockedAt) : 0;
    const bTime = b.unlockedAt ? Date.parse(b.unlockedAt) : 0;
    return bTime - aTime; // desc
  });

  return sorted[0] ?? null;
}

export interface UseAuthorFlairResult {
  /** All unlocked (and locked, for completeness) medals for the user. */
  unlockedMedals: UserMedal[];
  /** True while the first network fetch is in-flight for this userId. */
  isLoading: boolean;
}

/**
 * Subscribe to a single author's unlocked medals, with a module-level cache
 * so 20 forum cards on the same page only fire ONE /api/Medal/user/:id call
 * per author.
 *
 * @param userId - numeric user id, string id, or null/undefined to no-op
 */
export function useAuthorFlair(
  userId: number | string | undefined | null,
): UseAuthorFlairResult {
  const key = userId !== null && userId !== undefined ? String(userId) : '';
  const hasCached = key.length > 0 && Array.isArray(flairCache[key]);

  const [data, setData] = useState<UserMedal[]>(() => (hasCached ? flairCache[key] : []));
  const [isLoading, setIsLoading] = useState<boolean>(!hasCached && key.length > 0);

  useEffect(() => {
    if (!key) {
      // No id provided — nothing to fetch; clear local state.
      setData([]);
      setIsLoading(false);
      return;
    }

    if (flairCache[key]) {
      // Cache hit — synchronous hydration, no loading state.
      setData(flairCache[key]);
      setIsLoading(false);
      return;
    }

    // Cache miss — kick off the network call.
    let cancelled = false;
    setIsLoading(true);
    medalService
      .getUserMedals(userId as number | string)
      .then((list) => {
        if (cancelled) return;
        flairCache[key] = Array.isArray(list) ? list : [];
        setData(flairCache[key]);
      })
      .catch(() => {
        if (cancelled) return;
        flairCache[key] = [];
        setData([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // We key the effect on `key` (string) rather than `userId` directly so
    // that `42` and `"42"` collapse to the same cache slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { unlockedMedals: data, isLoading };
}
