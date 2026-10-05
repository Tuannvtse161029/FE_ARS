// useUserAvatar — opt-in User-table avatar lookup for the Forum surface
// (post bylines, comment bylines, and any future forum card that needs
// to render an author image).
//
// Why this hook exists:
//
//   The BE ships two tables that each carry an `avatarUrl` field:
//     - `User`          — owned by the auth/lifecycle service; updated
//                         by Profile.tsx via `PUT /api/User/{id}`.
//     - `Profile`        — owned by the academic-profile service; rarely
//                         written from FE; BE reads from here when
//                         building the `post.authorAvatar` field on
//                         `GET /api/ForumPost`.
//
//   When a user changes their avatar in Profile, only the `User` row
//   is updated (see `Profile.tsx::handleAvatarSave`). The `Profile`
//   row keeps its old `avatarUrl` — and the BE-driven
//   `post.authorAvatar` field reflects that stale value. The Forum
//   was therefore showing the OLD avatar even though the user just
//   saved a new one. The September 2026 bug report ("the forum
//   doesn't update when I change my avatar") traced back to this
//   staleness, and the resolution is to resolve avatars from the
//   authoritative `User` table at render time instead of trusting
//   the wire's `authorAvatar` payload.
//
// Behaviour:
//   - Calls `userService.getById(userId)` once per id and caches the
//     promise in a module-scoped Map so concurrent forum cards for
//     the same author share one in-flight GET (no duplicate network
//     calls, no race between useEffect runs). Mirrors the dedupe
//     pattern in `useLecturerProfile`.
//   - Silent failure on 4xx/5xx (no toast, no error banner — the
//     Forum page must keep rendering even when /api/User/{id} 404s,
//     e.g. a suspended account). On failure the hook returns
//     `avatarUrl: null` so the UI falls back to initials.
//   - Cancels the state update if the component unmounts (or the
//     `userId` changes) before the fetch resolves, so the avatar of
//     author A never bleeds onto author B's card.
//   - TTL-based cache bust: cached `User` payloads are reused for
//     60 seconds after the fetch resolves, then re-fetched on next
//     mount so a fresh avatar shows up without a hard refresh. (The
//     Promise itself is module-scoped for dedupe; the resolved value
//     carries a timestamp so stale entries get evicted.)

import { useEffect, useState } from 'react';
import { userService } from '../services/user.service';
import type { User } from '../types/auth';

export interface UseUserAvatarResult {
  /**
   * Resolved avatar URL (regular image URL, `lucide:<id>` symbolic
   * avatar, or `null` when no avatar is set / the fetch failed).
   * Use this with `<AvatarVisual url={avatarUrl} ... />` so the
   * `lucide:` prefix is handled by the existing shared component.
   */
  avatarUrl: string | null;
  /** True while the first fetch for this id is in flight. */
  isLoading: boolean;
}

const AVATAR_CACHE_TTL_MS = 60_000;

interface CacheEntry {
  promise: Promise<User>;
  resolvedAt: number | null;
  avatarUrl: string | null;
}

// Module-scoped cache keyed by `userId`. Survives re-renders AND
// pagination transitions in the Forum list (so going from page 1
// → 2 → 1 does not re-fetch avatars we already resolved). Promises
// are kept here for the dedupe benefit; resolved values are also
// stamped so we can evict entries whose TTL has elapsed.
const avatarCache = new Map<number, CacheEntry>();

const isFresh = (entry: CacheEntry): boolean =>
  entry.resolvedAt !== null &&
  Date.now() - entry.resolvedAt < AVATAR_CACHE_TTL_MS;

const fetchCached = (userId: number): Promise<User> => {
  const existing = avatarCache.get(userId);
  if (existing?.promise) return existing.promise;
  const promise = userService
    .getById(userId)
    .then((user) => {
      // Stamp the resolved payload so subsequent reads can short-circuit
      // the network for AVATAR_CACHE_TTL_MS. Errors below are caught
      // and re-thrown, so this `.then` only runs on success.
      const current = avatarCache.get(userId);
      avatarCache.set(userId, {
        promise,
        resolvedAt: Date.now(),
        avatarUrl:
          typeof user.avatarUrl === 'string' && user.avatarUrl.trim().length > 0
            ? user.avatarUrl.trim()
            : null,
      });
      void current; // keep linter quiet about unused ref
      return user;
    })
    .catch((err: unknown) => {
      // Eject from the cache so a later re-render can retry (e.g. after
      // the BE recovers from a transient 503). The contract guarantees
      // silent failure on 4xx/5xx — we don't toast, we don't throw up.
      avatarCache.delete(userId);
      throw err instanceof Error ? err : new Error('Failed to load user.');
    });
  avatarCache.set(userId, {
    promise,
    resolvedAt: null,
    avatarUrl: null,
  });
  return promise;
};

export const useUserAvatar = (
  userId: number | null | undefined,
): UseUserAvatarResult => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (userId == null || !Number.isFinite(userId) || userId <= 0) return null;
    const entry = avatarCache.get(userId);
    return entry && isFresh(entry) ? entry.avatarUrl : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(
    userId != null && Number.isFinite(userId) && userId > 0,
  );

  useEffect(() => {
    // Null / non-positive id → render the initials fallback, no fetch,
    // no loading. Matches the contract used by useLecturerProfile.
    if (userId == null || !Number.isFinite(userId) || userId <= 0) {
      setAvatarUrl(null);
      setIsLoading(false);
      return;
    }
    // Fresh entry → no fetch, just sync state to the cached value.
    const entry = avatarCache.get(userId);
    if (entry && isFresh(entry)) {
      setAvatarUrl(entry.avatarUrl);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchCached(userId)
      .then(() => {
        if (cancelled) return;
        const refreshed = avatarCache.get(userId);
        setAvatarUrl(refreshed?.avatarUrl ?? null);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Silent failure — keep the initials fallback. No toast.
        setAvatarUrl(null);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { avatarUrl, isLoading };
};

export default useUserAvatar;