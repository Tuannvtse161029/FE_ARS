import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { isAdminUser } from '../utils/roleNormalizer';

// Centralised permission flags derived from the auth store.
//
// `usePermissions()` is the single source of truth for feature gating based
// on the unverified-user flow:
//   - `isVerified`        — the user has been activated by an Admin
//                            (mirrors `dbo.Users.isActive`).
//   - `canCreatePost`     — verified user can author forum content.
//   - `canAccessWorkspace`— verified user with a non-zero roleId (i.e. an
//                            Admin-approved role) can use researcher /
//                            reviewer / lecturer / graduate-student tools.
//   - `canViewAdminPanel` — admin-only escape hatch for the route guard
//                            (useAdminGuard uses its own isAdminUser, this
//                            helper is for non-route UI like nav menus).
//
// All flags default to `false` when there's no authenticated user. This
// keeps unverified / anonymous users on the same restrictive code path so
// the FE only needs to branch on the positive case.

export interface Permissions {
  isVerified: boolean;
  canCreatePost: boolean;
  canAccessWorkspace: boolean;
  canViewAdminPanel: boolean;
  landingRoute: string;
}

export const usePermissions = (): Permissions => {
  const { user } = useAuth();

  // New users start `isActive: false` until an Admin approves their role
  // request. Until that happens they only get read-only access to /forum.
  const isVerified = Boolean(user?.isActive);

  // Workspace access additionally requires the user to actually have a role
  // assigned (roleId > 0). A user with `isActive: true` but `roleId: 0`
  // would be a stale account in some other state — refuse by default.
  const canAccessWorkspace = isVerified && Boolean(user?.roleId && user.roleId > 0);

  // All verified users may post in the forum. (If a future ticket restricts
  // specific roles from posting, gate here on roleName/roleId.)
  const canCreatePost = isVerified;

  // Admin is a separate signal; we don't gate it on isActive because admins
  // are provisioned directly in the DB (per the schema reference) and
  // bypass the role-request flow entirely. We delegate to the same helper
  // useAdminGuard uses so the two stay in lock-step.
  const canViewAdminPanel = isAdminUser({
    roleName: user?.role ?? null,
    roleId: user?.roleId ?? null,
  });

  // Default landing target — unverified users always bounce to /forum.
  // (After verification, the route is left to the existing post-login
  // routing logic in AuthContext; usePermissions just guards the redirect.)
  const landingRoute = ROUTES.FORUM;

  return {
    isVerified,
    canCreatePost,
    canAccessWorkspace,
    canViewAdminPanel,
    landingRoute,
  };
};

export default usePermissions;
