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

// Hook for the comments thread under a single forum post.
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
      const [listRes, myVotesRes] = await Promise.allSettled([
        forumCommentService.getByPostId(postId),
        forumCommentService.getMyVotes(),
      ]);

      const list = listRes.status === 'fulfilled' ? listRes.value : [];
      const myVotes = new Set<number>(
        myVotesRes.status === 'fulfilled' && Array.isArray(myVotesRes.value)
          ? myVotesRes.value
          : []
      );

      const enriched = list.map((c) => ({
        ...c,
        isUpvoted: myVotes.has(c.id),
      }));

      setComments(enriched);
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

// Companion hook exposing the mutations.
export interface UseForumCommentMutationsResult {
  create: (data: ForumCommentCreateRequest) => Promise<ForumComment | null>;
  update: (
    id: number,
    data: ForumCommentUpdateRequest,
  ) => Promise<ForumComment | null>;
  remove: (id: number) => Promise<boolean>;
  toggleVote: (commentId: number) => Promise<{ forumCommentId: number; upvoteCount: number; isUpvoted: boolean } | null>;
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

  const toggleVote = async (
    commentId: number,
  ): Promise<{ forumCommentId: number; upvoteCount: number; isUpvoted: boolean } | null> => {
    try {
      return await forumCommentService.toggleVote(commentId);
    } catch (err) {
      console.error('[useForumCommentMutations] toggleVote failed:', err);
      return null;
    }
  };

  return { create, update, remove, toggleVote, isLoading, error };
}