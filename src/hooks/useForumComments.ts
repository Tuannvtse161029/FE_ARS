import { useCallback, useEffect, useState } from 'react';
import { forumCommentService } from '../services/forumComment.service';
import type {
  ForumComment,
  ForumCommentCreateRequest,
  ForumCommentUpdateRequest,
} from '../types/forum.types';

export interface UseForumCommentsResult {
  comments: ForumComment[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Hook for the comments thread under a single forum post. Pulls every
// comment from the BE and filters by `forumPostId === postId` client-side
// because the current `GET /api/ForumComment` endpoint does not accept a
// post-id query parameter (see agent-32 BE gap report).
export function useForumComments(postId: number): UseForumCommentsResult {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!postId) {
      setComments([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await forumCommentService.getByPostId(postId);
      setComments(list);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load comments'),
      );
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { comments, isLoading, error, refetch };
}

// Companion hook exposing the three mutations. Each returns the BE's
// authoritative response (or null on failure). Callers should invoke
// `refetch()` on the list hook after a successful mutation so the UI
// stays in sync without a full page reload.
export interface UseForumCommentMutationsResult {
  create: (data: ForumCommentCreateRequest) => Promise<ForumComment | null>;
  update: (
    id: number,
    data: ForumCommentUpdateRequest,
  ) => Promise<ForumComment | null>;
  remove: (id: number) => Promise<boolean>;
  isLoading: boolean;
  error: Error | null;
}

export function useForumCommentMutations(): UseForumCommentMutationsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = async (
    data: ForumCommentCreateRequest,
  ): Promise<ForumComment | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await forumCommentService.create(data);
      setIsLoading(false);
      return result;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to create comment'),
      );
      setIsLoading(false);
      return null;
    }
  };

  const update = async (
    id: number,
    data: ForumCommentUpdateRequest,
  ): Promise<ForumComment | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await forumCommentService.update(id, data);
      setIsLoading(false);
      return result;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to update comment'),
      );
      setIsLoading(false);
      return null;
    }
  };

  const remove = async (id: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await forumCommentService.delete(id);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to delete comment'),
      );
      setIsLoading(false);
      return false;
    }
  };

  return { create, update, remove, isLoading, error };
}