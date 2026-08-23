/**
 * Unit tests for src/components/gradstudent/utils.ts.
 *
 * Verifies the G1 helper `getPrimaryMembershipId` picks the first valid
 * `membershipId` and skips rows with `null` / `undefined` / non-positive.
 */
import { describe, it, expect } from 'vitest';
import { getPrimaryMembershipId } from '../../../../src/components/gradstudent/utils';
import type { StudentGroupView } from '../../../../src/services/groupMembership.service';

const makeRow = (membershipId: number | null | undefined): StudentGroupView => ({
  id: 1,
  name: 'Alpha Lab',
  lecturerId: 4,
  topicId: 11,
  joinedAt: '2025-01-01T00:00:00Z',
  membershipId: membershipId as number | null,
});

describe('getPrimaryMembershipId', () => {
  it('returns null when the joinedGroups list is empty', () => {
    expect(getPrimaryMembershipId([])).toBeNull();
  });

  it('returns the membershipId of the first row when it is a positive number', () => {
    const rows: StudentGroupView[] = [
      makeRow(7),
      makeRow(9),
    ];
    expect(getPrimaryMembershipId(rows)).toBe(7);
  });

  it('skips rows whose membershipId is null', () => {
    const rows: StudentGroupView[] = [
      makeRow(null),
      makeRow(9),
    ];
    expect(getPrimaryMembershipId(rows)).toBe(9);
  });

  it('skips rows whose membershipId is undefined', () => {
    const rows: StudentGroupView[] = [
      // Strip the explicit membershipId so the property is literally absent.
      { id: 1, name: 'X', lecturerId: 4, topicId: 11, joinedAt: '2025-01-01T00:00:00Z' } as StudentGroupView,
      makeRow(7),
    ];
    expect(getPrimaryMembershipId(rows)).toBe(7);
  });
});