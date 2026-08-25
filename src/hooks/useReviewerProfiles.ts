import { useEffect, useState } from 'react';
import { reviewerService, ReviewerProfile } from '../services/reviewer.service';

interface UseReviewerProfilesResult {
  profiles: ReviewerProfile[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useReviewerProfiles(): UseReviewerProfilesResult {
  const [profiles, setProfiles] = useState<ReviewerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await reviewerService.getAll();
      setProfiles(list);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load reviewer profiles'));
      setProfiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, []);

  return { profiles, isLoading, error, refetch };
}

export interface UseReviewerAvailabilityResult {
  isAvailable: boolean | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Reads the current user's reviewer availability from their ProfessionalProfile.
 *
 * Distinguishes the four cases the addendum requires:
 *   - Explicit `false` → return `false` (Reviewer intentionally disabled).
 *   - Explicit `true`  → return `true`.
 *   - Field genuinely missing on a valid profile → default `true` so a brand
 *     new Reviewer is discoverable. We use `?? true` (NOT `|| true`) so an
 *     explicit `false` is never clobbered.
 *   - Loading / no profile / API failure → leave `isAvailable` null so the
 *     caller can render an indeterminate / error state instead of falsely
 *     confirming a value.
 */
export function useReviewerAvailability(userId?: number): UseReviewerAvailabilityResult {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    if (!userId || userId <= 0) {
      setIsLoading(false);
      setIsAvailable(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const profile = await reviewerService
        .getAll()
        .then((list) => list.find((p) => p.userId === userId) ?? null);
      if (profile === null) {
        // No profile row at all — treat as unknown so the UI can show
        // "loading" / an indeterminate state. Never silently claim available.
        setIsAvailable(null);
      } else if (typeof profile.isAvailable === 'boolean') {
        setIsAvailable(profile.isAvailable);
      } else {
        // Field genuinely missing on a valid profile → default available.
        // Narrow fallback per addendum §C — does NOT overwrite explicit false.
        setIsAvailable(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load availability'));
      setIsAvailable(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { isAvailable, isLoading, error, refetch };
}
