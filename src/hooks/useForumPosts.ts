import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { forumPostService } from '../services/forumPost.service';
import type {
  ForumPost,
  ForumPostCreateRequest,
  ForumPostFilters,
} from '../types/forum.types';

// Static message rendered when the forum API is unreachable / returning 5xx.
// Matches the BE-R13 FE work-around contract: never leak the BE stack trace
// to the end user.
export const FORUM_SERVICE_UNAVAILABLE_MESSAGE =
  'The forum is temporarily unavailable. Please try again.';

// Inspect an axios error and return a user-safe message. We sanitize
// `5xx` and `undefined status` (network / CORS / etc.) failures by mapping
// them to the static "service unavailable" string so a BE SQL stack trace
// never surfaces in the UI. 4xx responses are user-controlled (bad auth,
// validation, etc.) and we preserve their original messages.
const sanitizeForumError = (err: unknown): Error => {
  const baseError =
    err instanceof Error ? err : new Error('Failed to load forum posts');

  let isServerSideFailure = false;
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 403) {
      return new Error('Forum posts are restricted for unapproved guest accounts.');
    }
    if (status === undefined || status >= 500) {
      isServerSideFailure = true;
    }
  }

  if (isServerSideFailure) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[forum] service unavailable — original error:', baseError);
    }
    const sanitized = new Error(FORUM_SERVICE_UNAVAILABLE_MESSAGE);
    sanitized.name = baseError.name;
    return sanitized;
  }

  return baseError;
};

export interface UseForumPostsResult {
  posts: ForumPost[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Hook for the forum list page. Accepts the same filter object that the
// Swagger `GET /api/ForumPost` endpoint accepts (category / sort / search)
// and refetches whenever any of those change. Empty / undefined values
// are sent through as-is — Axios skips them, so the BE only sees the
// filters the user actually toggled.
export function useForumPosts(filters?: ForumPostFilters): UseForumPostsResult {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await forumPostService.getAll(filters);
      setPosts(list);
    } catch (err) {
      setError(sanitizeForumError(err));
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters?.category, filters?.sort, filters?.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { posts, isLoading, error, refetch };
}

// Companion hook for the create-post mutation. Exposes a `create()` that
// returns the freshly created post on success and `null` on failure.
// Callers should invoke `refetch()` on the list hook after a successful
// create so the new post shows up without a full page reload.
export interface UseCreateForumPostResult {
  create: (data: ForumPostCreateRequest) => Promise<ForumPost | null>;
  isLoading: boolean;
  error: Error | null;
}

export function useCreateForumPost(): UseCreateForumPostResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = async (
    data: ForumPostCreateRequest,
  ): Promise<ForumPost | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await forumPostService.create(data);
      setIsLoading(false);
      return result;
    } catch (err) {
      setError(sanitizeForumError(err));
      setIsLoading(false);
      return null;
    }
  };

  return { create, isLoading, error };
}