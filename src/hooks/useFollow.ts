import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { followerService } from '../services/follower.service';
import type { Follower } from '../types/domain';
import { useAuth } from '../context/AuthContext';
import { storage } from '../utils/storage';

export interface UseFollowResult {
  /** Set of userIds the current viewer is following. */
  followingIds: Set<number>;
  /** Convenience predicate: is `userId` in `followingIds`? */
  isFollowing: (userId: number) => boolean;
  /** True while the initial fetch (or a mutation) is in flight. */
  isLoading: boolean;
  /** True while a follow / unfollow mutation is in flight. */
  isMutating: boolean;
  /** Human-readable error message from the last failed call, or null. */
  error: string | null;
  /** Toggle a follow / unfollow for `userId`. No-ops on self / unauth / dup. */
  toggleFollow: (userId: number) => Promise<void>;
  /** Manually re-fetch the follow list from the BE. */
  refetch: () => Promise<void>;
}

// useFollow — single-source-of-truth hook for follow / unfollow state on
// the forum page. Owns:
//
//   1. The set of userIds the current viewer is following (initially
//      derived from GET /api/Follower; filtered to rows where the
//      viewer's id matches `followerId`).
//   2. The follow / unfollow mutations, with optimistic local updates so
//      the FollowButton flips state instantly without a refetch round-trip.
//   3. The guard rails:
//        - self-follow is silently rejected (UI also disables the button)
//        - duplicate follow (already following) is silently rejected
//        - unauthenticated viewers cannot follow
//
// On logout the hook resets its state to an empty Set so the next viewer
// (or a re-login) starts fresh.
export function useFollow(): UseFollowResult {
  const { user, isAuthenticated } = useAuth();
  const currentUserId = user?.userId ?? storage.getUser()?.id ?? null;

  const [followingIds, setFollowingIds] = useState<Set<number>>(() => new Set());
  const [followersRaw, setFollowersRaw] = useState<Follower[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks in-flight mutation keys so we don't double-submit while the
  // previous call is still pending. A Set<number> keyed by followedId.
  const pendingMutationsRef = useRef<Set<number>>(new Set());

  // Refs that let effect-driven resets know "what was the previous auth
  // state?" so we only re-fetch on actual transitions, not on every render.
  const prevAuthRef = useRef<boolean>(isAuthenticated);
  const prevUserIdRef = useRef<number | null>(currentUserId);

  // Tracks whether the initial fetch has already been kicked off. The
  // auth-transition effect below re-fetches on every isAuthenticated /
  // currentUserId flip; this guard makes sure the very first mount
  // counts as a "flip" too.
  const hasFetchedOnceRef = useRef<boolean>(false);

  // Derive the followingIds Set from the raw follower list whenever the
  // list or the current user changes. Filtering happens here (rather than
  // in refetch) so a future `userId` change automatically re-derives the
  // set without a network call.
  useEffect(() => {
    if (currentUserId == null) {
      setFollowingIds(new Set());
      return;
    }
    const next = new Set<number>();
    for (const f of followersRaw) {
      if (f.followerId === currentUserId) {
        next.add(f.followedId);
      }
    }
    setFollowingIds(next);
  }, [followersRaw, currentUserId]);

  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      setFollowersRaw([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await followerService.getAll();
      setFollowersRaw(Array.isArray(list) ? list : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load following list';
      setError(message);
      setFollowersRaw([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Refetch on auth / userId transitions. The first mount is treated as
  // a transition so we don't sit on a stale (empty) followingIds Set
  // while the user is actually authenticated.
  useEffect(() => {
    const authFlipped = prevAuthRef.current !== isAuthenticated;
    const userFlipped = prevUserIdRef.current !== currentUserId;
    prevAuthRef.current = isAuthenticated;
    prevUserIdRef.current = currentUserId;

    if (!isAuthenticated) {
      // Always wipe on logout so the Set doesn't leak across sessions.
      setFollowersRaw([]);
      setFollowingIds(new Set());
      setError(null);
      hasFetchedOnceRef.current = false;
      return;
    }
    if (authFlipped || userFlipped || !hasFetchedOnceRef.current) {
      hasFetchedOnceRef.current = true;
      void refetch();
    }
  }, [isAuthenticated, currentUserId, refetch]);

  const isFollowing = useCallback(
    (userId: number) => followingIds.has(userId),
    [followingIds],
  );

  const toggleFollow = useCallback(
    async (userId: number): Promise<void> => {
      // ── Guard rails ──
      if (!isAuthenticated) {
        setError('You must be signed in to follow another user.');
        return;
      }
      if (currentUserId == null) {
        setError('Unable to determine your user id; please sign in again.');
        return;
      }
      if (userId === currentUserId) {
        // Self-follow is a no-op. UI should also disable, but guard again here.
        return;
      }
      if (pendingMutationsRef.current.has(userId)) {
        // Avoid double-submit on rapid clicks.
        return;
      }

      const wasFollowing = followingIds.has(userId);
      // Optimistic local flip so the button state updates instantly.
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.delete(userId);
        else next.add(userId);
        return next;
      });
      pendingMutationsRef.current.add(userId);
      setIsMutating(true);
      setError(null);

      try {
        if (wasFollowing) {
          // Find the follower row id that represents this (follower, followed)
          // pair so we can DELETE /api/Follower/{id}. We may not have it in
          // the local cache (e.g. someone else's session left the row in the
          // BE); fall back to a refetch which surfaces the canonical list.
          const row = followersRaw.find(
            (f) => f.followerId === currentUserId && f.followedId === userId,
          );
          if (row) {
            await followerService.unfollow(row.id);
          } else {
            await refetch();
            // After refetch, look up the id again.
            const refreshed = await followerService.getAll();
            const fresh = refreshed.find(
              (f) => f.followerId === currentUserId && f.followedId === userId,
            );
            if (fresh) {
              await followerService.unfollow(fresh.id);
            } else {
              // Row not present anymore — treat as success (idempotent).
            }
          }
        } else {
          await followerService.follow({ followedId: userId });
        }
        // Pull the authoritative list so any rows added by other clients
        // (e.g. someone followed us back) are reflected.
        await refetch();
      } catch (err) {
        // Roll back optimistic flip on failure.
        setFollowingIds((prev) => {
          const next = new Set(prev);
          if (wasFollowing) next.add(userId);
          else next.delete(userId);
          return next;
        });
        const message =
          err instanceof Error ? err.message : 'Failed to update follow state';
        setError(message);
      } finally {
        pendingMutationsRef.current.delete(userId);
        setIsMutating(false);
      }
    },
    [isAuthenticated, currentUserId, followingIds, followersRaw, refetch],
  );

  return useMemo(
    () => ({
      followingIds,
      isFollowing,
      isLoading,
      isMutating,
      error,
      toggleFollow,
      refetch,
    }),
    [followingIds, isFollowing, isLoading, isMutating, error, toggleFollow, refetch],
  );
}

export default useFollow;