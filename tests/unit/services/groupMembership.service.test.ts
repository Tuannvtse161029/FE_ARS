/**
 * Service-level tests for src/services/groupMembership.service.ts.
 *
 * Focus on the GradStudent aggregate helper backed by the live
 * GET /api/ResearchGroup/my-groups response.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getMock, getMyGroupsMock } = vi.hoisted(() => {
  return {
    getMock: vi.fn(),
    getMyGroupsMock: vi.fn(),
  };
});

vi.mock('../../../src/services/axios', () => ({
  default: { get: getMock },
}));

vi.mock('../../../src/services/researchGroup.service', () => ({
  researchGroupService: {
    getMyGroups: getMyGroupsMock,
    getAll: vi.fn(),
    getById: vi.fn(),
  },
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
    getMyGroupsMock.mockReset();
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
      // Mock all three endpoints that getJoinedGroupsForStudent calls
      getMyGroupsMock.mockResolvedValueOnce([
        { id: 7, name: 'Alpha', members: [] },
        { id: 8, name: 'Beta', members: [] },
      ]);
      getMock.mockResolvedValueOnce({
        data: [
          { groupMemberId: 1, studentId: 9, researchGroupId: 7 },
          { groupMemberId: 2, studentId: 9, researchGroupId: 8 },
          { groupMemberId: 3, studentId: 42, researchGroupId: 10 },
        ],
      });
      // getAllResearchGroups - used for group details
      getMock.mockResolvedValueOnce({
        data: [
          { id: 7, name: 'Alpha' },
          { id: 8, name: 'Beta' },
          { id: 10, name: 'Other' },
        ],
      });

      const result = await getJoinedGroupsForStudent(9);
      // Result includes groups from myGroups AND memberships for the student
      expect(result.length).toBeGreaterThanOrEqual(2);
      const alphaGroup = result.find(g => g.name === 'Alpha');
      const betaGroup = result.find(g => g.name === 'Beta');
      expect(alphaGroup).toBeDefined();
      expect(betaGroup).toBeDefined();

      expect(getMyGroupsMock).toHaveBeenCalled();
    });

    it('returns student memberships correctly', async () => {
      // Mock all three endpoints
      getMyGroupsMock.mockResolvedValueOnce([]);
      getMock.mockResolvedValueOnce({
        data: [
          { groupMemberId: 1, studentId: 9, researchGroupId: 7 },
          { groupMemberId: 2, studentId: 11, researchGroupId: 8 },
        ],
      });
      getMock.mockResolvedValueOnce({
        data: [
          { id: 7, name: 'Alpha' },
          { id: 8, name: 'Other' },
        ],
      });

      const result = await getJoinedGroupsForStudent(9);
      // Only returns groups that student 9 is a member of
      const alphaGroup = result.find(g => g.name === 'Alpha');
      expect(alphaGroup).toBeDefined();
      expect(alphaGroup?.membershipId).toBe(1);
    });

    it('returns [] for a student with no memberships', async () => {
      // Mock all three endpoints
      getMyGroupsMock.mockResolvedValueOnce([]);
      getMock.mockResolvedValueOnce({ data: [] });
      getMock.mockResolvedValueOnce({ data: [] });

      const result = await getJoinedGroupsForStudent(9);
      expect(result).toEqual([]);
    });
  });
});
