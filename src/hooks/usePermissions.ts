import { useAuth } from '../context/AuthContext';
import { isAdminUser, isGuestUser } from '../utils/roleNormalizer';
import { readStoredUser } from '../utils/storedUser';
import type { VerificationStatus } from '../types/auth';

// Centralised permission flags derived from the auth store.
//
// `usePermissions()` is the single source of truth for feature gating based
// on the unverified-user flow. The four flags cover everything the FE needs
// to know about a user before deciding whether to render a workspace, a CTA,
// or the pending-state banner.
//
// All flags default to `false` when there's no authenticated user. This
// keeps unverified / anonymous users on the same restrictive code path so
// the FE only branches on the positive case.

export interface Permissions {
  /** User has been activated by an Admin (mirrors `dbo.Users.isActive`). */
  isVerified: boolean;
  /** Verified user can author forum content. */
  canCreatePost: boolean;
  /** Admin-only flag for the route guard and admin nav menus. */
  canViewAdminPanel: boolean;
  /** Whether the user has a personal wallet row. Admins and Guests do not. */
  hasWallet: boolean;
  /**
   * Agent 39 — true when the effective role is 'Guest' (pending Admin
   * approval of a RoleRequest). Sourced from the auth store when present,
   * falling back to the derived `!isActive && !isAdmin` heuristic for
   * pre-migration persisted blobs.
   */
  isGuest: boolean;
}

export const usePermissions = (): Permissions => {
  const { user, effectiveRole } = useAuth();
  const stored = readStoredUser();

  const isActive = user?.isActive ?? stored?.isActive ?? false;
  // Agent 30 (regression) — `verificationStatus` is a tri-state
  // (`'Pending' | 'Accepted' | 'Rejected' | null`). A `null` value means
  // the BE has not yet produced a verification result (e.g. a brand-new
  // first-time Google user that has not been through the role-request
  // lifecycle). We preserve `null` so the downstream `isVerified`
  // derivation below sees `false` for both `isActive === false` and
  // `verificationStatus === null` without falsely implying a submitted
  // role request is awaiting Admin review.
  const verificationStatus: VerificationStatus | null =
    user?.verificationStatus === 'Accepted' ||
    user?.verificationStatus === 'Rejected'
      ? user.verificationStatus
      : user?.verificationStatus === 'Pending'
        ? 'Pending'
        : stored?.verificationStatus === 'Accepted' ||
            stored?.verificationStatus === 'Rejected'
          ? stored.verificationStatus
          : stored?.verificationStatus === 'Pending'
            ? 'Pending'
            : null;

  // User is fully approved only when all three conditions hold:
  //   isActive === true  AND  verificationStatus === 'Accepted'  AND  roleId !== 0
  // Defaults to false (lockout-safe) for any missing fields.
  const isVerified =
    Boolean(isActive) && verificationStatus === 'Accepted';

  // All verified users may post in the forum. (If a future ticket restricts
  // specific roles from posting, gate here on roleName/roleId.)
  const canCreatePost = isVerified;

  // Admin is a separate signal; we don't gate it on isActive because admins
  // are provisioned directly in the DB (per the schema reference) and
  // bypass the role-request flow entirely. We read `roleId` from the
  // persisted blob (not the auth store) because the BE's off-by-one mapping
  // bug means the auth response may carry `roleId: 0` for real admin users
  // — see docs/local-only/admin-suite-be-gap-report.md. This matches what
  // useAdminGuard / useVerifiedGuard do, so the three stay in lock-step.
  const canViewAdminPanel = isAdminUser({
    roleName: user?.role ?? stored?.roleName ?? null,
    roleId: stored?.roleId ?? null,
  });

  // Agent 39 — single source of truth for the Guest display. Prefers the
  // `effectiveRole` field from the auth store; falls back to the derived
  // `!isActive && !isAdmin` heuristic when the BE hasn't surfaced the field.
  const isGuest = isGuestUser({
    effectiveRole: effectiveRole ?? null,
    isActive,
    canViewAdminPanel,
  });

  // Wallet row exists for verified, non-Admin users. Admins do not hold a
  // personal wallet; Guests haven't been approved yet, so they have no
  // row. Single derivation collapses the old `!isAdmin && !isGuest` check
  // at every header / modal site.
  const hasWallet = isVerified && !canViewAdminPanel && !isGuest;

  return {
    isVerified,
    canCreatePost,
    canViewAdminPanel,
    hasWallet,
    isGuest,
  };
};

export default usePermissions;
