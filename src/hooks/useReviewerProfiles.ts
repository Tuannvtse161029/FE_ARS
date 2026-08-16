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

interface UseReviewerAvailabilityResult {
  isAvailable: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Reads the current user's reviewer availability from their ProfessionalProfile.
 * Returns `isAvailable: false` (and null profile) until the profile loads, so
 * callers never show a hardcoded "true" during first paint.
 */
export function useReviewerAvailability(userId?: number): UseReviewerAvailabilityResult {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    if (userId === undefined) {
      setIsLoading(false);
      setIsAvailable(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const profile = await reviewerService
        .getAll()
        .then((list) => list.find((p) => p.userId === userId) ?? null);
      setIsAvailable(Boolean(profile?.isAvailable));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load availability'));
      setIsAvailable(false);
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
