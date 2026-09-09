// useStudentGroups — combined read-side hook for the Graduate Student
// workspace. Resolves:
//
//   1. The ResearchGroups the student has joined (via the documented
//      client-side filter on GET /api/GroupMember).
//   2. The ResearchTopic assigned to the first joined group (best-effort).
//
// Returns loading / error / data / refetch.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getJoinedGroupsForStudent,
  type StudentGroupView,
} from '../services/groupMembership.service';
import { researchTopicService } from '../services/researchTopic.service';
import type { ResearchTopic } from '../types/research';

// The researchTopicService returns a ResearchTopic with `id?: number`
// (since the BE Swagger schema marks it optional). The shared domain
// type in `types/research` requires `id: number`. Guard + cast before
// propagating into the hook state to avoid the type mismatch.
const asRequiredTopic = (
  topic: Awaited<ReturnType<typeof researchTopicService.getById>>,
): ResearchTopic | null => {
  if (!topic || typeof topic.id !== 'number') return null;
  return topic as ResearchTopic;
};

export interface UseStudentGroupsState {
  studentId: number | null;
  joinedGroups: StudentGroupView[];
  primaryGroup: StudentGroupView | null;
  primaryTopic: ResearchTopic | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useStudentGroups(
  studentId: number | null,
): UseStudentGroupsState {
  const [joinedGroups, setJoinedGroups] = useState<StudentGroupView[]>([]);
  const [primaryTopic, setPrimaryTopic] = useState<ResearchTopic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(studentId !== null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (studentId === null) {
      setJoinedGroups([]);
      setPrimaryTopic(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const groups = await getJoinedGroupsForStudent(studentId);
      setJoinedGroups(groups);
      const first = groups[0] ?? null;
      if (first && typeof first.topicId === 'number' && first.topicId > 0) {
        try {
          const topic = await researchTopicService.getById(first.topicId);
          setPrimaryTopic(asRequiredTopic(topic));
        } catch {
          setPrimaryTopic(null);
        }
      } else {
        setPrimaryTopic(null);
      }
    } catch (err) {
      const e =
        err instanceof Error ? err : new Error('Failed to load student groups');
      setError(e);
      setJoinedGroups([]);
      setPrimaryTopic(null);
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const primaryGroup = useMemo(() => joinedGroups[0] ?? null, [joinedGroups]);

  return {
    studentId,
    joinedGroups,
    primaryGroup,
    primaryTopic,
    isLoading,
    error,
    refetch: load,
  };
}

export default useStudentGroups;
