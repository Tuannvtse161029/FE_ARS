import { useEffect, useState } from 'react';
import { commentVoteService } from '../services/commentVote.service';
import type { CommentVote, CommentVoteCreateRequest } from '../types/domain';

interface UseCommentVotesResult {
  votes: CommentVote[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCommentVotes(forumCommentId?: number): UseCommentVotesResult {
  const [votes, setVotes] = useState<CommentVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await commentVoteService.getAll(forumCommentId);
      setVotes(list);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load comment votes'));
      setVotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forumCommentId]);

  return { votes, isLoading, error, refetch };
}

interface UseVoteOnCommentResult {
  vote: (data: CommentVoteCreateRequest) => Promise<CommentVote | null>;
  isLoading: boolean;
  error: Error | null;
}

export function useVoteOnComment(): UseVoteOnCommentResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const vote = async (data: CommentVoteCreateRequest): Promise<CommentVote | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await commentVoteService.vote(data);
      setIsLoading(false);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to record vote'));
      setIsLoading(false);
      return null;
    }
  };

  return { vote, isLoading, error };
}
