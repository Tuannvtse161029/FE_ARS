// useLecturerProfile — Agent 1's opt-in real-name lookup hook for Lecturer
// detail panels (lead-phase-c-contract.md §2.1 / S-8).
//
// Internally calls `userService.getById(lecturerId)` once per `lecturerId`
// (cached in a module-scoped promise map) and exposes a stable
// `{ displayName, isLoading, error }` surface. Falls back to
// `Lecturer #<id>` when `lecturerId === null` or the fetch fails, so the
// caller never has to deal with an empty/null name.
//
// Silent failure: 4xx and 5xx responses do NOT toast. They populate `error`
// for the consumer to log/handle. Detail panels that already render a
// "Lecturer #N" placeholder rely on this behaviour to avoid noisy toasts on
// offline / missing-user cases (per agent-1-phase-b §2.4).

import { useEffect, useState } from 'react';
import { userService } from '../services/user.service';
import type { User } from '../types/auth';

interface UseLecturerProfileResult {
  displayName: string;
  isLoading: boolean;
  error: Error | null;
}

// Module-scoped promise cache (per lead-phase-c-contract.md L4.d). Two
// concurrent renders for the same `lecturerId` share one in-flight GET — no
// duplicate network calls, no race between useEffect runs.
const profileCache = new Map<number, Promise<User>>();

const fetchCached = (lecturerId: number): Promise<User> => {
  const cached = profileCache.get(lecturerId);
  if (cached) return cached;
  const promise = userService
    .getById(lecturerId)
    .catch((err: unknown) => {
      // Eject from the cache so a later re-render with the same id can
      // retry (e.g. after the BE recovers from a transient 503). The
      // contract guarantees silent failure on 4xx/5xx — we don't toast.
      profileCache.delete(lecturerId);
      throw err instanceof Error ? err : new Error('Failed to load user.');
    });
  profileCache.set(lecturerId, promise);
  return promise;
};

const fallbackName = (lecturerId: number | null): string => {
  if (lecturerId === null || !Number.isFinite(lecturerId)) return 'Lecturer';
  return `Lecturer #${lecturerId}`;
};

export const useLecturerProfile = (
  lecturerId: number | null,
): UseLecturerProfileResult => {
  const [displayName, setDisplayName] = useState<string>(
    fallbackName(lecturerId),
  );
  const [isLoading, setIsLoading] = useState<boolean>(lecturerId !== null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Null id → render the placeholder, no fetch, no loading.
    if (lecturerId === null || !Number.isFinite(lecturerId)) {
      setDisplayName(fallbackName(null));
      setIsLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setDisplayName(fallbackName(lecturerId));
    fetchCached(lecturerId)
      .then((user) => {
        if (cancelled) return;
        // Prefer the typed `fullName`; fall back to `username` then email
        // before finally returning the placeholder.
        const resolved =
          (typeof user.fullName === 'string' && user.fullName.trim().length > 0
            ? user.fullName.trim()
            : null) ??
          (typeof user.username === 'string' && user.username.trim().length > 0
            ? user.username.trim()
            : null) ??
          (typeof user.email === 'string' && user.email.trim().length > 0
            ? user.email.trim()
            : null) ??
          fallbackName(lecturerId);
        setDisplayName(resolved);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load user.'));
        // Silent failure — keep the placeholder name.
        setDisplayName(fallbackName(lecturerId));
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lecturerId]);

  return { displayName, isLoading, error };
};

export default useLecturerProfile;
