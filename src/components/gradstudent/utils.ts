// Grad-side utilities shared across the Graduate Student pages. These helpers
// are intentionally local to the gradstudent surface — they exist so that all
// three Grad pages (Dashboard, StudentResearchGroups, SubmitReport) read the
// same data shape and don't drift.
//
// Per docs/local-only/lead-phase-c-contract.md G1: the BE persists
// `PhasedReports.GroupMemberId` (FK → `GroupMembers.GroupMemberId`). The Grad
// student's userId is NOT a valid `groupMemberId`. This module exposes the
// single local helper that picks the first available `membershipId` from the
// already-resolved `joinedGroups` list, so no Grad call site ever passes
// `user.userId` to the BE.

import type { StudentGroupView } from '../../services/groupMembership.service';

/**
 * Return the first available `membershipId` from the Grad student's joined
 * groups list. Used by every page that submits or surfaces a PhasedReport.
 *
 * - Returns `null` when the input list is empty or every entry has a
 *   non-positive `membershipId`. Callers should treat `null` as "no group
 *   joined yet" and disable the submit / resubmit affordance.
 * - Order matters: pages use `joinedGroups[0]` as the "primary" group (see
 *   `useStudentGroups.primaryGroup`). We mirror that here so the dashboard,
 *   workspace and submit pages all pick the same membership row.
 */
export const getPrimaryMembershipId = (
  joinedGroups: ReadonlyArray<StudentGroupView>,
): number | null => {
  for (const group of joinedGroups) {
    if (typeof group.membershipId === 'number' && group.membershipId > 0) {
      return group.membershipId;
    }
  }
  return null;
};