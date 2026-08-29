// Agent 30 — Centralized post-auth route resolver.
//
// Single source of truth for "where should an authenticated user land
// after a login attempt?". Every auth entry path — `AuthContext.login`,
// `AuthContext.loginWithGoogle`, `GoogleCallback`, the authenticated-user
// branch of `PublicRoute` — resolves the destination through this
// helper so the priority stays consistent.

import type { EffectiveRole, UserRole, VerificationStatus } from '../types/auth';
import { ROUTES } from '../routes/paths';
import { landingRouteForRoleName } from './roleNormalizer';

export interface PostAuthSnapshot {
  /** BE-derived role name. null / empty / undefined ⇒ "no role assigned yet". */
  role?: string | null;
  /** BE-derived role id (ROLE_IDS). null / 0 ⇒ "no role assigned yet". */
  roleId?: number | null;
  /** Account active flag (mirrors `dbo.Users.isActive`). */
  isActive?: boolean | null;
  /** Verification lifecycle status. */
  verificationStatus?: VerificationStatus | string | null;
  /** BE-derived effective role. null for fresh sessions. */
  effectiveRole?: string | null;
  /**
   * First-time onboarding signals surfaced by the BE on `/api/Auth/google-login`
   */
  isNewUser?: boolean | null;
  requiresOnboarding?: boolean | null;
  /**
   * Approved role list — `AuthResponse.roles`.
   */
  approvedRoles?: ReadonlyArray<string | null | undefined> | null;
}

const KNOWN_BUSINESS_ROLES: readonly UserRole[] = [
  'Researcher',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
  'Admin',
];

const isKnownRoleString = (value: string | null | undefined): value is UserRole => {
  if (!value) return false;
  return (KNOWN_BUSINESS_ROLES as readonly string[]).includes(value);
};

const hasNonEmptyRole = (role: unknown): boolean =>
  typeof role === 'string' &&
  role.trim().length > 0 &&
  role.trim().toLowerCase() !== 'guest';

const hasPositiveRoleId = (roleId: unknown): boolean =>
  typeof roleId === 'number' && Number.isFinite(roleId) && roleId > 0;

/**
 * Agent 30 — boolean helper: does the snapshot represent a first-time
 * Google user that must complete onboarding before landing on /forum or a workspace?
 */
export function isFirstTimeOnboardingUser(snapshot: PostAuthSnapshot): boolean {
  if (isApprovedActiveUser(snapshot)) {
    return false;
  }

  // ── 1. Explicit Google onboarding spec branch ───────────────────────────
  // ONLY true when the backend explicitly returned isNewUser: true or requiresOnboarding: true
  // from the Google login endpoint (/api/Auth/google-login)
  if (
    (snapshot.isNewUser === true || snapshot.requiresOnboarding === true) &&
    isApprovedRoleListEmpty(snapshot.approvedRoles)
  ) {
    return true;
  }

  return false;
}

/**
 * True when the approved-role list is empty / missing / contains only Guest.
 */
function isApprovedRoleListEmpty(
  approvedRoles: ReadonlyArray<string | null | undefined> | null | undefined,
): boolean {
  if (!approvedRoles || approvedRoles.length === 0) return true;
  return approvedRoles.every(
    (r) => !r || !r.trim() || r.trim().toLowerCase() === 'guest',
  );
}

/**
 * Agent 30 — boolean helper: is this snapshot an approved, active user with a known role assigned?
 */
export function isApprovedActiveUser(snapshot: PostAuthSnapshot): boolean {
  if (snapshot.isActive !== true) return false;
  if (
    snapshot.verificationStatus !== 'Accepted' &&
    snapshot.verificationStatus !== 'Approved'
  ) {
    return false;
  }
  return isKnownRoleString(snapshot.role ?? null);
}

/**
 * Resolve the post-auth destination for the supplied snapshot.
 */
export function resolvePostAuthRoute(snapshot: PostAuthSnapshot): string {
  // Priority 1 — onboarding (must precede the /forum-as-Guest fallback)
  if (isFirstTimeOnboardingUser(snapshot)) {
    return ROUTES.COMPLETE_GOOGLE_REGISTRATION;
  }

  // Priority 2 — approved + active + known role.
  if (isApprovedActiveUser(snapshot)) {
    return landingRouteForRoleName(snapshot.role ?? null);
  }

  // Priority 3 — submitted pending user with no approved active role.
  if (
    snapshot.effectiveRole === 'Guest' ||
    snapshot.isActive === false ||
    (snapshot.verificationStatus != null &&
      snapshot.verificationStatus !== 'Accepted' &&
      snapshot.verificationStatus !== 'Approved')
  ) {
    return ROUTES.FORUM;
  }

  // Priority 4 — incomplete / malformed snapshot. Safe recovery.
  return ROUTES.LOGIN;
}

export const __testing = {
  hasNonEmptyRole,
  hasPositiveRoleId,
  isKnownRoleString,
  isApprovedRoleListEmpty,
  KNOWN_BUSINESS_ROLES,
};

export type _EffectiveRole = EffectiveRole;
