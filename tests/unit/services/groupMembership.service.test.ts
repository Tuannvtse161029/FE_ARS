/**
 * Service-level tests for src/services/groupMembership.service.ts.
 *
 * Focus on the GradStudent aggregate helper backed by the live
 * GET /api/ResearchGroup/my-groups response.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../../../src/services/axios', () => ({
  default: { get: getMock },
}));

import {
  getJoinedGroupsForStudent,
  getAllGroupMembers,
  getAllResearchGroups,
  getResearchGroupById,
} from '../../../src/services/groupMembership.service';

describe('groupMembershipService', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  describe('getAllGroupMembers', () => {
    it('normalizes groupMemberId → id and drops malformed rows', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          { id: 1, studentId: 9, researchGroupId: 7 },
          { groupMemberId: 2, studentId: 10, researchGroupId: 8 },
          { studentId: 10 /* missing id */, researchGroupId: 9 },
          null,
        ],
      });
      const list = await getAllGroupMembers();
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(1);
      expect(list[1].id).toBe(2);
    });
  });

  describe('getAllResearchGroups', () => {
    it('normalizes researchGroupId → id and uses fallback name', async () => {
      getMock.mockResolvedValueOnce({
        data: [{ researchGroupId: 5 /* no name */ }],
      });
      const list = await getAllResearchGroups();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Group #5');
    });
  });

  describe('getResearchGroupById', () => {
    it('throws when row has no id', async () => {
      getMock.mockResolvedValueOnce({ data: { name: 'No id' } });
      await expect(getResearchGroupById(1)).rejects.toThrow(/malformed/);
    });
  });

  describe('getJoinedGroupsForStudent', () => {
    it('reads scoped groups and resolves the signed-in student membership', async () => {
      getMock.mockResolvedValueOnce({ data: [
        { researchGroupId: 7, name: 'Alpha', members: [{ groupMemberId: 1, studentId: 9 }] },
        { researchGroupId: 8, name: 'Beta', members: [{ groupMemberId: 2, studentId: 9 }] },
        { researchGroupId: 10, name: 'Other', members: [{ groupMemberId: 3, studentId: 42 }] },
      ] });

      const result = await getJoinedGroupsForStudent(9);
      expect(result).toHaveLength(2);
      expect(result.map((g) => g.name)).toEqual(['Alpha', 'Beta']);
      expect(result[0].membershipId).toBe(1);
      expect(result[1].membershipId).toBe(2);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/api/ResearchGroup/my-groups');
    });

    it('drops scoped groups that do not contain the requested student', async () => {
      getMock.mockResolvedValueOnce({ data: [
        { researchGroupId: 7, name: 'Alpha', members: [{ groupMemberId: 1, studentId: 9 }] },
        { researchGroupId: 8, name: 'Other', members: [{ groupMemberId: 2, studentId: 11 }] },
      ] });

      const result = await getJoinedGroupsForStudent(9);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alpha');
    });

    it('returns [] for a student with no memberships', async () => {
      getMock.mockResolvedValueOnce({ data: [] });
      const result = await getJoinedGroupsForStudent(9);
      expect(result).toEqual([]);
    });
  });
});
