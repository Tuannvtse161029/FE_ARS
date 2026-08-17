import { useEffect, useState, useCallback } from 'react';
import {
  getAllResearchTopics,
  type ResearchTopic,
} from '../services/guidanceProject.service';

interface UseResearchTopicsResult {
  topics: ResearchTopic[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useResearchTopics = (): UseResearchTopicsResult => {
  const [topics, setTopics] = useState<ResearchTopic[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getAllResearchTopics();
      setTopics(list);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load research topics.'),
      );
      setTopics([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { topics, isLoading, error, refetch };
};

export default useResearchTopics;