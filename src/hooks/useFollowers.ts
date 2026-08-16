import { useEffect, useState } from 'react';
import { followerService } from '../services/follower.service';
import type { Follower } from '../types/domain';

interface UseFollowersResult {
  followers: Follower[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useFollowers(): UseFollowersResult {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await followerService.getAll();
      setFollowers(list);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load followers'));
      setFollowers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, []);

  return { followers, isLoading, error, refetch };
}

interface UseFollowReviewerResult {
  isLoading: boolean;
  error: Error | null;
  follow: (followedId: number) => Promise<boolean>;
  unfollow: (id: number) => Promise<boolean>;
}

export function useFollowReviewer(): UseFollowReviewerResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const follow = async (followedId: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await followerService.follow({ followedId });
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to follow reviewer'));
      setIsLoading(false);
      return false;
    }
  };

  const unfollow = async (id: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await followerService.unfollow(id);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to unfollow reviewer'));
      setIsLoading(false);
      return false;
    }
  };

  return { isLoading, error, follow, unfollow };
}
