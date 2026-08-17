/**
 * Per-test mock for researchGroup.service + groupMember.service.
 *
 * Returns a typed shape that mirrors the production surface so tests
 * can configure seed data and inspect call args without re-implementing
 * the service bodies.
 */
import { vi } from 'vitest';
import type {
  ResearchGroup,
  GroupAssignOutcome,
} from '../../services/researchGroup.service';
import type { GroupMember } from '../../services/groupMember.service';

export interface ResearchGroupSeed {
  groups?: ResearchGroup[];
  assignOutcomes?: GroupAssignOutcome[];
}

export interface GroupMemberSeed {
  members?: GroupMember[];
}

export const buildResearchGroupServiceMock = (
  seed: ResearchGroupSeed & GroupMemberSeed = {},
): Record<string, unknown> => {
  const getAllGroupsMock = vi.fn(async () => seed.groups ?? []);
  const getGroupByIdMock = vi.fn(async (id: number) => {
    return (
      (seed.groups ?? []).find((g) => g.id === id) ?? { id, name: `Group ${id}` }
    );
  });
  const updateGroupMock = vi.fn(
    async (id: number, payload: Partial<ResearchGroup>) => ({
      id,
      ...payload,
    } as ResearchGroup),
  );
  const assignTopicToGroupsMock = vi.fn(async () => seed.assignOutcomes ?? []);

  const getAllMembersMock = vi.fn(async () => seed.members ?? []);

  return {
    getAllGroupsMock,
    getGroupByIdMock,
    updateGroupMock,
    assignTopicToGroupsMock,
    getAllMembersMock,
    // service surface
    researchGroupService: {
      getAll: getAllGroupsMock,
      getById: getGroupByIdMock,
      create: vi.fn(),
      update: updateGroupMock,
      delete: vi.fn(),
    },
    assignTopicToGroups: assignTopicToGroupsMock,
    deriveGroupStatus: (
      group: ResearchGroup | null | undefined,
      relatedTopicStatus: string | null | undefined,
    ): 'OPEN' | 'ASSIGNED' | 'COMPLETED' => {
      if (!group) return 'OPEN';
      if (!group.topicId) return 'OPEN';
      const normalised = (relatedTopicStatus ?? '').toLowerCase().trim();
      if (normalised === 'completed') return 'COMPLETED';
      return 'ASSIGNED';
    },
    groupMemberService: {
      getAll: getAllMembersMock,
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    filterGroupMembersByStudentId: (
      members: readonly GroupMember[],
      studentId: number,
    ): GroupMember[] => members.filter((m) => m.studentId === studentId),
    indexGroupMembersByGroupId: (
      members: readonly GroupMember[],
    ): Record<number, GroupMember[]> => {
      const acc: Record<number, GroupMember[]> = {};
      for (const m of members) {
        const gid = m.researchGroupId;
        if (gid === null || gid === undefined) continue;
        const bucket = acc[gid] ?? [];
        bucket.push(m);
        acc[gid] = bucket;
      }
      return acc;
    },
  };
};