import { useEffect, useState, useCallback } from 'react';
import {
  researchTopicService,
  type ResearchTopic,
} from '../services/researchTopic.service';

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
      const [myTopicsRes, allTopicsRes] = await Promise.allSettled([
        researchTopicService.getMyTopics(),
        researchTopicService.getAll(),
      ]);

      const myTopics = myTopicsRes.status === 'fulfilled' ? myTopicsRes.value : [];
      const allTopics = allTopicsRes.status === 'fulfilled' ? allTopicsRes.value : [];

      const map = new Map<number, ResearchTopic>();
      for (const t of allTopics) {
        if (t.id) map.set(t.id, t);
      }
      for (const t of myTopics) {
        if (t.id) map.set(t.id, t);
      }

      setTopics(Array.from(map.values()));
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