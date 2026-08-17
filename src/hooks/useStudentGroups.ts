// useStudentGroups — combined read-side hook for the Graduate Student
// workspace. Resolves:
//
//   1. The student's active Guidance Project (and thus the supervising
//      lecturer).
//   2. The ResearchGroups the student has joined (via the documented
//      client-side filter on GET /api/GroupMember).
//   3. The ResearchTopic assigned to the first joined group (best-effort).
//
// Returns loading / error / data / refetch.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getActiveGuidanceProjectForStudent,
} from '../services/guidanceProject.service';
import {
  getJoinedGroupsForStudent,
  type StudentGroupView,
} from '../services/groupMembership.service';
import { getResearchTopicById } from '../services/guidanceProject.service';
import type {
  GuidanceProject,
  ResearchTopic,
} from '../types/research';

export interface UseStudentGroupsState {
  studentId: number | null;
  guidanceProject: GuidanceProject | null;
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
  const [guidanceProject, setGuidanceProject] = useState<GuidanceProject | null>(
    null,
  );
  const [joinedGroups, setJoinedGroups] = useState<StudentGroupView[]>([]);
  const [primaryTopic, setPrimaryTopic] = useState<ResearchTopic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(studentId !== null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (studentId === null) {
      setGuidanceProject(null);
      setJoinedGroups([]);
      setPrimaryTopic(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [project, groups] = await Promise.all([
        getActiveGuidanceProjectForStudent(studentId).catch(() => null),
        getJoinedGroupsForStudent(studentId),
      ]);
      setGuidanceProject(project);
      setJoinedGroups(groups);
      const first = groups[0] ?? null;
      if (first && typeof first.topicId === 'number' && first.topicId > 0) {
        try {
          const topic = await getResearchTopicById(first.topicId);
          setPrimaryTopic(topic);
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
      setGuidanceProject(null);
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
    guidanceProject,
    joinedGroups,
    primaryGroup,
    primaryTopic,
    isLoading,
    error,
    refetch: load,
  };
}

export default useStudentGroups;