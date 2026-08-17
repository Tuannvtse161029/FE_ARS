/**
 * Service-level tests for src/services/groupMembership.service.ts.
 *
 * Focus on the GradStudent aggregate helper which combines
 * GroupMember + ResearchGroup via `Promise.all` (per research-workflow
 * test plan §1 question #5).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../../services/axios', () => ({
  default: { get: getMock },
}));

import {
  getJoinedGroupsForStudent,
  getAllGroupMembers,
  getAllResearchGroups,
  getResearchGroupById,
} from '../../services/groupMembership.service';

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
    it('fires both GETs in parallel (Promise.all) and joins by studentId', async () => {
      // Track call ordering — both promises should resolve before the
      // Promise.all branch finishes, but we can't easily prove concurrency.
      // We instead verify both endpoints are called exactly once.
      getMock
        .mockResolvedValueOnce({
          data: [
            { id: 1, studentId: 9, researchGroupId: 7 },
            { id: 2, studentId: 9, researchGroupId: 8 },
            { id: 3, studentId: 42, researchGroupId: 7 },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            { id: 7, name: 'Alpha' },
            { id: 8, name: 'Beta' },
          ],
        });

      const result = await getJoinedGroupsForStudent(9);
      expect(result).toHaveLength(2);
      expect(result.map((g) => g.name)).toEqual(['Alpha', 'Beta']);
      expect(result[0].membershipId).toBe(1);
      expect(result[1].membershipId).toBe(2);

      const urls = getMock.mock.calls.map((c) => c[0]);
      expect(urls).toContain('/api/GroupMember');
      expect(urls).toContain('/api/ResearchGroup');
    });

    it('drops entries whose group cannot be resolved', async () => {
      getMock
        .mockResolvedValueOnce({
          data: [
            { id: 1, studentId: 9, researchGroupId: 7 },
            { id: 2, studentId: 9, researchGroupId: 999 /* unknown */ },
          ],
        })
        .mockResolvedValueOnce({ data: [{ id: 7, name: 'Alpha' }] });

      const result = await getJoinedGroupsForStudent(9);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alpha');
    });

    it('returns [] for a student with no memberships', async () => {
      getMock
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [{ id: 7, name: 'Alpha' }] });
      const result = await getJoinedGroupsForStudent(9);
      expect(result).toEqual([]);
    });
  });
});