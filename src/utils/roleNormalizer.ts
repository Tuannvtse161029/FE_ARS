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
 * Agent 39 — returns true when the auth snapshot represents a Guest user.
 * Prefers the BE-derived `effectiveRole` field; falls back to the derived
 * `!isActive && !isAdmin` heuristic for pre-migration persisted blobs (when
 * the FE hasn't yet received a fresh `effectiveRole` from the BE).
 *
 * Never coerces an unknown role string to 'Guest' — only `'Guest'` (the
 * documented literal), or the derived fallback, establishes a Guest session.
 */
export function isGuestUser(snapshot: {
  effectiveRole?: string | null;
  isActive?: boolean;
  verificationStatus?: string | null;
  requiresOnboarding?: boolean | null;
  isNewUser?: boolean | null;
  canViewAdminPanel?: boolean;
}): boolean {
  if (snapshot.requiresOnboarding === true || snapshot.isNewUser === true) {
    return false;
  }
  if (snapshot.effectiveRole === 'Guest') return true;
  if (snapshot.effectiveRole) return false;
  // Derived fallback: pre-migration persisted blobs lack effectiveRole.
  return (
    snapshot.verificationStatus === 'Pending' &&
    snapshot.isActive === false &&
    snapshot.canViewAdminPanel === false
  );
}

/**
 * Landing route per the post-login routing rules. Admin → `/admin`, every
 * other role → `/forum`. This is the only place that decides where to send a
 * freshly-logged-in user; `landingRouteForRole` in AuthContext, the
 * authenticated-user branch of `PublicRoute`, and the per-route
 * `RoleRouteGuard` fallback all route through here so the three surfaces
 * stay in lock-step.
 *
 * Admin detection is dual-signal: when an explicit `isAdminOverride` is passed
 * (the BE bug-state path where the response roleId is 0 but roleName is
 * 'Admin'), we honour it. Otherwise we delegate to `isAdminUser` so the
 * helper is internally consistent — i.e. callers don't have to remember to
 * pass `isAdminOverride` for the Admin case to be honoured. The single
 * `signals` parameter carries both roleName and roleId; pass `null` or
 * `undefined` when only a roleName is known.
 */
export function landingRouteForRoleName(
  role: string | null | undefined,
  options?: { isAdminOverride?: boolean },
): '/admin' | '/forum' {
  if (options?.isAdminOverride) return '/admin';
  if (isAdminUser({ roleName: role ?? null })) return '/admin';
  return '/forum';
}
