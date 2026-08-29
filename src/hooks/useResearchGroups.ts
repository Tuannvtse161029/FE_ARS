import { useEffect, useState, useCallback } from 'react';
import {
  researchGroupService,
  type ResearchGroup,
} from '../services/researchGroup.service';

interface UseResearchGroupsResult {
  groups: ResearchGroup[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Optional lecturer filter: when supplied, only groups whose `lecturerId`
// matches the given value are returned. The BE doesn't expose a server-side
// `?lecturerId=` filter on ResearchGroup, so we filter client-side.
interface UseResearchGroupsOptions {
  lecturerId?: number | null;
}

export const useResearchGroups = (
  options: UseResearchGroupsOptions = {},
): UseResearchGroupsResult => {
  const { lecturerId } = options;
  const [groups, setGroups] = useState<ResearchGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [myGroupsRes, allGroupsRes] = await Promise.allSettled([
        researchGroupService.getMyGroups(),
        researchGroupService.getAll(),
      ]);

      const myGroups = myGroupsRes.status === 'fulfilled' ? myGroupsRes.value : [];
      const allGroups = allGroupsRes.status === 'fulfilled' ? allGroupsRes.value : [];

      const map = new Map<number, ResearchGroup>();
      // Put all groups first
      for (const g of allGroups) {
        if (g.id) map.set(g.id, g);
      }
      // Overwrite/enrich with myGroups
      for (const g of myGroups) {
        if (g.id) map.set(g.id, g);
      }

      const merged = Array.from(map.values());
      const filtered = lecturerId
        ? merged.filter((g) => g.lecturerId === lecturerId)
        : merged;
      setGroups(filtered);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load research groups.'),
      );
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, [lecturerId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { groups, isLoading, error, refetch };
};

export default useResearchGroups;