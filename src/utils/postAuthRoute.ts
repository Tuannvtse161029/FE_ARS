// Agent 30 — Centralized post-auth route resolver.
//
// Single source of truth for "where should an authenticated user land
// after a login attempt?". Every auth entry path — `AuthContext.login`,
// `AuthContext.loginWithGoogle`, `GoogleCallback`, the authenticated-user
// branch of `PublicRoute` — resolves the destination through this
// helper so the priority stays consistent.
//
// Priority (per exact Backend Investigation Report):
//   1. New Google user / Onboarding Required → /complete-google-registration.
//      `isNewUser === true OR requiresOnboarding === true
//       OR (role is null AND effectiveRole is null AND verificationStatus is null)`
//   2. Approved + active + known role: role landing route
//      (/admin or /forum or /dashboard via `landingRouteForRoleName`).
//   3. Submitted pending user with no approved active role → /forum
//      (Guest view + pending banner).
//   4. Anything malformed: safe recovery (/login).

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
  typeof role === 'string' && role.trim().length > 0;

const hasPositiveRoleId = (roleId: unknown): boolean =>
  typeof roleId === 'number' && Number.isFinite(roleId) && roleId > 0;

/**
 * Boolean helper: does the snapshot represent a first-time Google user or
 * unassigned user that must complete onboarding?
 */
export function isFirstTimeOnboardingUser(snapshot: PostAuthSnapshot): boolean {
  // ── 1. Explicit Onboarding Signals from Backend ─────────────────────
  if (
    (snapshot.isNewUser === true || snapshot.requiresOnboarding === true) &&
    isApprovedRoleListEmpty(snapshot.approvedRoles)
  ) {
    return true;
  }

  // ── 2. Fallback for unassigned / missing role session ───────────────
  if (
    !hasNonEmptyRole(snapshot.role) &&
    !hasPositiveRoleId(snapshot.roleId) &&
    (snapshot.effectiveRole === null || snapshot.effectiveRole === undefined) &&
    (snapshot.verificationStatus === null || snapshot.verificationStatus === undefined) &&
    isApprovedRoleListEmpty(snapshot.approvedRoles)
  ) {
    return true;
  }

  return false;
}

/**
 * True when the approved-role list is empty / missing.
 */
function isApprovedRoleListEmpty(
  approvedRoles: ReadonlyArray<string | null | undefined> | null | undefined,
): boolean {
  if (!approvedRoles || approvedRoles.length === 0) return true;
  return approvedRoles.every((r) => !r || !r.trim());
}

/**
 * Boolean helper: is this snapshot an approved, active user with a known role assigned?
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
  // Priority 1 — ONBOARDING_REQUIRED:
  // (requiresOnboarding === true OR isNewUser === true OR unassigned role)
  // → /complete-google-registration
  if (isFirstTimeOnboardingUser(snapshot)) {
    return ROUTES.COMPLETE_GOOGLE_REGISTRATION;
  }

  // Priority 2 — APPROVED & ACTIVE:
  // (isActive === true AND verificationStatus === 'Accepted'/'Approved')
  if (isApprovedActiveUser(snapshot)) {
    return landingRouteForRoleName(snapshot.role ?? null);
  }

  // Priority 3 — PENDING_ADMIN_REVIEW / GUEST:
  // (verificationStatus === 'Pending' OR effectiveRole === 'Guest')
  // → /forum
  if (
    snapshot.effectiveRole === 'Guest' ||
    snapshot.isActive === false ||
    (snapshot.verificationStatus != null &&
      snapshot.verificationStatus !== 'Accepted' &&
      snapshot.verificationStatus !== 'Approved')
  ) {
    return ROUTES.FORUM;
  }

  // Priority 4 — Safe recovery
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
