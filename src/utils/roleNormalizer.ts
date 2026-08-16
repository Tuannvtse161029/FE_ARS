// Centralized role-detection helpers.
//
// BE AuthController currently returns `roleId: 0, roleName: 'Researcher'` for
// actual Admin users (UserId = 18, where UserRole.RoleId = 2). Until that bug
// is fixed by BE, the FE has to accept either signal:
//
//   1. roleName === 'Admin'  (works after BE stops overwriting the field)
//   2. roleId === 2          (works once BE ships the 1-based index fix)
//
// Any new role-detection site should call the helpers in this file rather than
// duplicating the (roleName === 'admin' || roleId === 2) check. See the
// matching test file for the spec; see
// docs/local-only/admin-suite-be-gap-report.md for the BE ticket.

import { ROLE_IDS, type UserRole } from '../types/auth';

const ADMIN_NAMES: ReadonlySet<UserRole> = new Set(['Admin']);

export interface RoleSignals {
  roleName?: string | null;
  roleId?: number | null;
}

/**
 * Returns true if either signal identifies the user as an Admin. Case- and
 * whitespace-insensitive on the roleName side; numeric-exact on the roleId side
 * (per the BE's 1-based convention — roleId === 0 is reserved for the
 * "no role" sentinel and is treated as non-admin on purpose).
 */
export function isAdminUser(signals: RoleSignals): boolean {
  const name = (signals.roleName ?? '').trim().toLowerCase();
  if (name === 'admin') return true;
  if (signals.roleId === ROLE_IDS.Admin) return true;
  return false;
}

/**
 * Same shape as `isAdminUser`, but returns the matching UserRole when present.
 * Useful for building the `roles` array on AuthResponse when the BE supplies
 * `roleId` instead of `roleName`.
 */
export function resolveRoleName(signals: RoleSignals): UserRole | null {
  const name = (signals.roleName ?? '').trim();
  if (name && ADMIN_NAMES.has(name as UserRole)) return 'Admin';
  if (signals.roleId === ROLE_IDS.Admin) return 'Admin';
  if (signals.roleId === ROLE_IDS.Researcher) return 'Researcher';
  if (signals.roleId === ROLE_IDS.Reviewer) return 'Reviewer';
  if (signals.roleId === ROLE_IDS.Lecturer) return 'Lecturer';
  if (signals.roleId === ROLE_IDS.GraduateStudent) return 'Graduate Student';
  // Last-resort fallback — don't claim a role the BE didn't endorse.
  if (name) return null;
  return null;
}

/**
 * Landing route per the post-login routing rules. Admin → /admin, Researcher
 * → /forum, everyone else → /dashboard. This is the only place that decides
 * where to send a freshly-logged-in user; both `landingRouteForRole` in
 * AuthContext and `useAdminGuard` route through here.
 */
export function landingRouteForRoleName(
  role: string | null | undefined,
  options?: { isAdminOverride?: boolean },
): '/admin' | '/forum' | '/dashboard' {
  if (options?.isAdminOverride) return '/admin';
  const normalized = (role ?? '').trim().toLowerCase();
  if (normalized === 'admin') return '/admin';
  if (normalized === 'researcher') return '/forum';
  return '/dashboard';
}