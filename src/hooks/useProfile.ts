// useProfile — owns the GET/POST/PATCH contract for the authenticated
// user's profile page.
//
// Hard rules enforced by this hook:
//   1. The hook refuses to fetch until `authenticatedUserId` is a positive
//      integer. There is no "anonymous profile" surface — if the auth store
//      hasn't rehydrated yet, the hook stays in a `isUnauthenticated` state
//      so the page can render an honest "Sign in to view your profile"
//      guard instead of calling /api/Profile with a junk id.
//   2. The hook NEVER reads a profile id from a route param, query string,
//      localStorage key, or any client-controlled source. The fetch target
//      is hard-coded to `GET /api/Profile` (current-user endpoint) and the
//      write target is hard-coded to the authenticated user's id.
//   3. Save actions route the payload through `profileService.update()` so
//      the wire shape stays strict — no client-controlled field can sneak
//      past `pickProfileUpdateFields`.
//   4. The hook distinguishes four states so the page can render the
//      correct affordance without rebuilding the state machine:
//        - `isUnauthenticated`: no positive authenticated id (initial render)
//        - `isLoading`        : fetch in flight
//        - `error`            : fetch or save failed (with message)
//        - `profile`          : resolved (or null on a 404 "no profile yet")
//      Plus `isSaving` / `saveError` for the mutation lifecycle.

import { useCallback, useEffect, useRef, useState } from 'react';
import { profileService } from '../services/profile.service';
import type { Profile, ProfileUpdateRequest } from '../types/profile';

export interface UseProfileResult {
  profile: Profile | null;
  isUnauthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;

  isSaving: boolean;
  saveError: Error | null;
  save: (candidate: Partial<ProfileUpdateRequest>) => Promise<Profile | null>;
  clearSaveError: () => void;
}

/**
 * Internal helper — turn the BE's axios error shape into a stable Error so
 * the page can render `error.message` without special-casing AxiosError.
 * Mirrors the pattern used by `useReviewerProfiles`.
 */
function toError(err: unknown, fallbackMessage: string): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object') {
    const obj = err as { message?: unknown };
    if (typeof obj.message === 'string' && obj.message.trim() !== '') {
      return new Error(obj.message);
    }
  }
  return new Error(fallbackMessage);
}

export function useProfile(authenticatedUserId: number | null | undefined): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(authenticatedUserId != null);
  const [error, setError] = useState<Error | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  // Guard against double-fetch races when the auth id changes between
  // renders (e.g. login → rehydrate). Each fetch run captures a token;
  // only the latest token's result is allowed to update state.
  const fetchTokenRef = useRef(0);

  const idIsValid =
    typeof authenticatedUserId === 'number' &&
    Number.isFinite(authenticatedUserId) &&
    authenticatedUserId > 0;

  const refetch = useCallback(async () => {
    if (!idIsValid) {
      setIsLoading(false);
      setError(null);
      setProfile(null);
      return;
    }
    const token = ++fetchTokenRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const next = await profileService.getByUserId(authenticatedUserId as number);
      if (token !== fetchTokenRef.current) return;
      setProfile(next);
    } catch (err) {
      if (token !== fetchTokenRef.current) return;
      setError(toError(err, 'We could not load this profile. Please try again.'));
      setProfile(null);
    } finally {
      if (token === fetchTokenRef.current) {
        setIsLoading(false);
      }
    }
  }, [authenticatedUserId, idIsValid]);

  useEffect(() => {
    void refetch();
    // We intentionally only re-fetch when the authenticated id changes —
    // not on every render — to avoid thrash.
  }, [refetch]);

  const save = useCallback(
    async (candidate: Partial<ProfileUpdateRequest>): Promise<Profile | null> => {
      if (!idIsValid) {
        const err = new Error('You must be signed in to update your profile.');
        setSaveError(err);
        return null;
      }
      const token = ++fetchTokenRef.current;
      setIsSaving(true);
      setSaveError(null);
      try {
        const updated = await profileService.update(
          authenticatedUserId as number,
          candidate,
        );
        if (token !== fetchTokenRef.current) return updated;
        setProfile(updated);
        return updated;
      } catch (err) {
        if (token !== fetchTokenRef.current) return null;
        setSaveError(toError(err, 'We could not save your profile. Please try again.'));
        return null;
      } finally {
        if (token === fetchTokenRef.current) {
          setIsSaving(false);
        }
      }
    },
    [authenticatedUserId, idIsValid],
  );

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    profile,
    isUnauthenticated: !idIsValid,
    isLoading: idIsValid ? isLoading : false,
    error,
    refetch,
    isSaving,
    saveError,
    save,
    clearSaveError,
  };
}

export default useProfile;
