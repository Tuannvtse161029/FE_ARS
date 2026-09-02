/**
 * useProfileExtras — hook wrapper for profileExtrasService.
 *
 * Loads the user's published papers + forum posts on mount and exposes
 * loading / error / empty states consistent with the rest of the profile
 * page. Re-fetches when the userId changes (so navigating between
 * /profile (self) and /profile/:id works).
 */

import { useEffect, useState, useCallback } from 'react';
import {
  profileExtrasService,
  type ProfileExtrasResult,
} from '../services/profileExtras.service';

export interface UseProfileExtrasReturn {
  publications: ProfileExtrasResult['publications'];
  forumPosts: ProfileExtrasResult['forumPosts'];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProfileExtras(userId: number | null): UseProfileExtrasReturn {
  const [publications, setPublications] = useState<UseProfileExtrasReturn['publications']>([]);
  const [forumPosts, setForumPosts] = useState<UseProfileExtrasReturn['forumPosts']>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const refetch = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    if (userId == null) {
      setPublications([]);
      setForumPosts([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    profileExtrasService
      .getByUserId(userId)
      .then((result) => {
        if (!active) return;
        setPublications(result.publications);
        setForumPosts(result.forumPosts);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setPublications([]);
        setForumPosts([]);
        setError(err instanceof Error ? err.message : 'Failed to load profile activity.');
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  return { publications, forumPosts, isLoading, error, refetch };
}

export default useProfileExtras;