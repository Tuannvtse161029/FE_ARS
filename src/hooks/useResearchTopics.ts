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

interface UseResearchTopicsOptions {
  /**
   * Authenticated numeric user id of the current Lecturer. When provided,
   * the hook applies a defense-in-depth ownership filter so a Lecturer
   * never sees another lecturer's topics in their workspace, even if the
   * upstream API call returns extras (a stale cache, a BE-side leak, or
   * a missing `lecturerId` on a row). Topics without a matching
   * `lecturerId` are dropped — fail-closed, never fail-open.
   *
   * The documented API contract
   * (`GET /api/ResearchTopic/my-topics`) is the primary ownership source.
   * This filter is purely the second wall.
   */
  ownerUserId?: number | null;
}

/**
 * Hook for the Lecturer Research Topics page.
 *
 * Bug C (multi-tenant leak): the previous implementation merged the
 *   scoped `getMyTopics()` result with the unscoped `getAll()` call,
 *   which surfaced every lecturer's topics in the workspace. We now
 *   call ONLY the scoped endpoint, and additionally filter by
 *   `ownerUserId` (defense in depth) so a missing or stale
 *   `lecturerId` cannot leak another lecturer's row.
 */
export const useResearchTopics = (
  options: UseResearchTopicsOptions = {},
): UseResearchTopicsResult => {
  const { ownerUserId } = options;
  const [topics, setTopics] = useState<ResearchTopic[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Scoped endpoint only — returns the topics the authenticated
      // lecturer actually owns. We intentionally do NOT merge a global
      // list here; merging was the source of the cross-tenant leak.
      const result = await researchTopicService.getMyTopics();

      const ownerId = typeof ownerUserId === 'number' ? ownerUserId : null;

      const mapped: ResearchTopic[] = [];
      for (const t of result) {
        const id = t.id ?? t.topicId ?? 0;
        if (id <= 0) continue;

        // Defense-in-depth ownership check. When the caller passes an
        // `ownerUserId`, a topic without a matching `lecturerId` MUST
        // NOT appear in this lecturer's workspace. Unknown lecturer
        // ownership is treated as "not mine" and filtered out so a
        // misbehaving BE cannot leak rows.
        if (ownerId !== null) {
          const topicLecturerId =
            typeof t.lecturerId === 'number' ? t.lecturerId : null;
          if (topicLecturerId === null || topicLecturerId !== ownerId) {
            continue;
          }
        }

        const status: ResearchTopicStatus = normalizeResearchTopicStatus(
          typeof t.status === 'string' ? t.status : null,
        );
        mapped.push({
          id,
          title: typeof t.title === 'string' ? t.title : `Topic #${id}`,
          description: typeof t.description === 'string' ? t.description : undefined,
          status,
          materialsUrl: typeof t.materialsUrl === 'string' ? t.materialsUrl : undefined,
          assignedGroupId: typeof t.assignedGroupIds?.[0] === 'number' ? t.assignedGroupIds[0] : undefined,
          // Forward createdAt / updatedAt so the table's default
          // "newest first" sort (useTableSort('createdAt','desc'))
          // actually works. Without them, every row has undefined
          // createdAt, and the sort comparator pins nulls to the
          // bottom regardless of direction — making new topics land
          // at the end of the table.
          createdAt: typeof t.createdAt === 'string' ? t.createdAt : undefined,
          updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : undefined,
          lecturerId: typeof t.lecturerId === 'number' ? t.lecturerId : null,
          lecturerName: typeof t.lecturerName === 'string' ? t.lecturerName : null,
        });
      }

      setTopics(mapped);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load research topics.'),
      );
      setTopics([]);
    } finally {
      setIsLoading(false);
    }
  }, [ownerUserId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { topics, isLoading, error, refetch };
};

export default useResearchTopics;
