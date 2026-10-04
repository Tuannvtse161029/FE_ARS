import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { forumPostService } from '../services/forumPost.service';
import { signalrService } from '../services/signalr.service';
import { inferNotificationKind } from '../utils/notificationRouteMap';
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
// validation, etc.) and we preserve their original messages — including
// the BE's `message` field, ASP.NET ProblemDetails `title`, and ModelState
// `errors[firstKey][0]` patterns.
const sanitizeForumError = (err: unknown): Error => {
  const baseError =
    err instanceof Error ? err : new Error('Failed to load forum posts');

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as
      | {
          message?: string;
          title?: string;
          error?: string;
          errors?: Record<string, string[] | string>;
          detail?: string;
        }
      | undefined;

    if (status && status >= 400 && status < 500 && data) {
      // ASP.NET Core ProblemDetails / model state pattern
      if (data.errors && typeof data.errors === 'object') {
        const firstErrorKey = Object.keys(data.errors)[0];
        if (firstErrorKey) {
          const firstError = data.errors[firstErrorKey];
          const msg = Array.isArray(firstError) ? firstError[0] : String(firstError);
          if (msg) return new Error(msg);
        }
      }
      // Common envelope shape returned by the ARS BE controllers.
      if (typeof data.message === 'string' && data.message.trim()) {
        return new Error(data.message);
      }
      if (typeof data.title === 'string' && data.title.trim()) {
        return new Error(data.title);
      }
      if (typeof data.error === 'string' && data.error.trim()) {
        return new Error(data.error);
      }
      if (typeof data.detail === 'string' && data.detail.trim()) {
        return new Error(data.detail);
      }
      // Role-specific fallbacks for codes the BE may return without a body.
      if (status === 401) {
        return new Error('You need to sign in again to publish a post.');
      }
      if (status === 403) {
        return new Error('Forum posts are restricted for your account role.');
      }
    }

    if (status === 403) {
      return new Error('Forum posts are restricted for your account role.');
    }
    if (status === undefined || status >= 500) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[forum] service unavailable — original error:', baseError);
      }
      const sanitized = new Error(FORUM_SERVICE_UNAVAILABLE_MESSAGE);
      sanitized.name = baseError.name;
      return sanitized;
    }
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

  // Real-time forum posts / likes sync via SignalR
  useEffect(() => {
    const unsubNotif = signalrService.onReceiveNotification((raw) => {
      let msg = '';
      if (typeof raw === 'string') msg = raw;
      else if (raw && typeof raw === 'object' && 'message' in raw) msg = String((raw as { message?: unknown }).message ?? '');

      const kind = inferNotificationKind(msg);
      if (
        kind === 'forum-post-liked' ||
        kind === 'forum-post-commented' ||
        kind === 'forum-comment-upvoted' ||
        kind === 'forum-comment-replied' ||
        kind === 'forum-reply'
      ) {
        void refetch();
      }
    });

    const unsubPostLiked = signalrService.on('ForumPostLiked', () => {
      void refetch();
    });

    const unsubCommentAdded = signalrService.on('ForumCommentAdded', () => {
      void refetch();
    });

    return () => {
      unsubNotif();
      unsubPostLiked();
      unsubCommentAdded();
    };
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