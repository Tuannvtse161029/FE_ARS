/**
 * Service-level tests for src/services/groupMember.service.ts.
 *
 * Focus on the client-side filter helper (documented BE gap: no
 * `?studentId=` query parameter) and the group-id indexer used by
 * both the Lecturer and Graduate Student workspaces.
 */
import { describe, it, expect } from 'vitest';
import {
  filterGroupMembersByStudentId,
  indexGroupMembersByGroupId,
} from '../../services/groupMember.service';

describe('groupMemberService helpers', () => {
  describe('filterGroupMembersByStudentId', () => {
    it('keeps only rows whose studentId matches', () => {
      const out = filterGroupMembersByStudentId(
        [
          { id: 1, studentId: 9, researchGroupId: 7 },
          { id: 2, studentId: 9, researchGroupId: 8 },
          { id: 3, studentId: 42, researchGroupId: 9 },
        ],
        9,
      );
      expect(out).toHaveLength(2);
      out.forEach((m) => expect(m.studentId).toBe(9));
    });

    it('returns [] when no rows match', () => {
      const out = filterGroupMembersByStudentId(
        [{ id: 1, studentId: 9, researchGroupId: 7 }],
        100,
      );
      expect(out).toEqual([]);
    });

    it('returns [] for empty input', () => {
      expect(filterGroupMembersByStudentId([], 9)).toEqual([]);
    });
  });

  describe('indexGroupMembersByGroupId', () => {
    it('groups members by researchGroupId', () => {
      const out = indexGroupMembersByGroupId([
        { id: 1, studentId: 9, researchGroupId: 7 },
        { id: 2, studentId: 10, researchGroupId: 7 },
        { id: 3, studentId: 11, researchGroupId: 8 },
      ]);
      expect(out[7]).toHaveLength(2);
      expect(out[8]).toHaveLength(1);
    });

    it('skips rows with null / undefined group id', () => {
      const out = indexGroupMembersByGroupId([
        { id: 1, studentId: 9, researchGroupId: null as unknown as number },
        { id: 2, studentId: 10, researchGroupId: 7 },
      ]);
      expect(out[7]).toHaveLength(1);
      expect(Object.keys(out)).toEqual(['7']);
    });
  });
});