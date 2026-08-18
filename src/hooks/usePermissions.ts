import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../utils/roleNormalizer';
import { readStoredUser } from '../utils/storedUser';

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
}

export const usePermissions = (): Permissions => {
  const { user } = useAuth();

  // New users start `isActive: false` until an Admin approves their role
  // request. Until that happens they only get read-only access to /forum.
  const isVerified = Boolean(user?.isActive);

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
  const stored = readStoredUser();
  const canViewAdminPanel = isAdminUser({
    roleName: user?.role ?? stored?.roleName ?? null,
    roleId: stored?.roleId ?? null,
  });

  // Wallet row exists for verified, non-Admin users. Admins do not hold a
  // personal wallet; Guests haven't been approved yet, so they have no
  // row. This collapses what used to be a `!isAdmin && !isGuest` check at
  // every header / modal site into a single derivation.
  const hasWallet = isVerified && !canViewAdminPanel;

  return {
    isVerified,
    canCreatePost,
    canViewAdminPanel,
    hasWallet,
  };
};

export default usePermissions;
