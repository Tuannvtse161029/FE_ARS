// useCanInteractInForum — combined permission flag for forum interactions.
//
// A user can interact (create / reply / react / comment / report / like)
// in the Forum only when:
//
//   1. They have been approved by an Admin (canCreatePost = true), AND
//   2. They are not a Researcher / Lecturer whose subscription is missing,
//      inactive, or expired (useSubscription().isActive).
//
// Admin, Reviewer, Graduate Student, and Guest are unaffected:
//   - Guest    → still read-only (canCreatePost = false).
//   - Admin    → never has the subscription gate applied.
//   - Reviewer → never has the subscription gate applied.
//   - Graduate Student → never has the subscription gate applied.

import { useMemo } from 'react';
import { usePermissions } from './usePermissions';
import { useSubscription } from './useSubscription';

export interface ForumInteractionPermission {
  /** Whether the current user can interact (post / reply / react / etc.). */
  canInteract: boolean;
  /**
   * Short reason string explaining why interaction is disabled, when
   * applicable. Use it as a `title` / `aria-label` on disabled controls.
   */
  reason: string | null;
}

export const useCanInteractInForum = (): ForumInteractionPermission => {
  const { canCreatePost } = usePermissions();
  const { isApplicable: subscriptionApplicable, isActive: subscriptionActive } =
    useSubscription();

  return useMemo<ForumInteractionPermission>(() => {
    if (!canCreatePost) {
      return {
        canInteract: false,
        reason:
          'Posting is disabled until your account is approved by an Administrator.',
      };
    }
    if (subscriptionApplicable && !subscriptionActive) {
      return {
        canInteract: false,
        reason:
          'Posting is disabled because your ARS subscription is inactive or has expired. Renew your subscription to continue.',
      };
    }
    return { canInteract: true, reason: null };
  }, [canCreatePost, subscriptionApplicable, subscriptionActive]);
};

export default useCanInteractInForum;
