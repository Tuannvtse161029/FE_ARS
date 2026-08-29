import { useEffect, useState, useCallback } from 'react';
import {
  researchTopicService,
} from '../services/researchTopic.service';
import { normalizeResearchTopicStatus } from '../utils/researchStatus';
import type { ResearchTopic, ResearchTopicStatus } from '../types/research';

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
      for (const t of [...allTopics, ...myTopics]) {
        const id = t.id ?? t.topicId ?? 0;
        if (id > 0) {
          const status: ResearchTopicStatus = normalizeResearchTopicStatus(
            typeof t.status === 'string' ? t.status : null,
          );
          map.set(id, {
            id,
            title: typeof t.title === 'string' ? t.title : `Topic #${id}`,
            description: typeof t.description === 'string' ? t.description : undefined,
            status,
            materialsUrl: typeof t.materialsUrl === 'string' ? t.materialsUrl : undefined,
            assignedGroupId: typeof t.assignedGroupIds?.[0] === 'number' ? t.assignedGroupIds[0] : undefined,
          });
        }
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