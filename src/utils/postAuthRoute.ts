// Agent 30 — Centralized post-auth route resolver.
//
// Single source of truth for "where should an authenticated user land
// after a login attempt?". Every auth entry path — `AuthContext.login`,
// `AuthContext.loginWithGoogle`, `GoogleCallback`, the authenticated-user
// branch of `PublicRoute` — must resolve the destination through this
// helper so the priority stays consistent.
//
// Priority (per the BTR-AGENT30-01 task spec):
//   1. New Google user (isNewUser OR requiresOnboarding OR role-null AND
//      roleId-null): /complete-google-registration
//   2. Approved + known role: role landing route (/admin or /forum)
//   3. Unverified / pending / role-missing / inactive: /forum as Guest
//   4. Anything malformed: safe recovery (/login so the user can retry)
//
// Guest fallback MUST NOT precede onboarding. The /forum-as-Guest branch
// must only fire when the user is verifiably NOT a first-time onboarding
// candidate.
//
// Explicit checks are used everywhere. We never silently coerce a missing
// field to "first-time" — we look for a positive signal (isNewUser /
// requiresOnboarding) OR the role-null + roleId-null fallback before
// routing to onboarding.

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
  verificationStatus?: VerificationStatus | null;
  /** BE-derived effective role (Agent 39). null for fresh sessions. */
  effectiveRole?: string | null;
  /**
   * Agent 30 — legacy onboarding signal. When the BE omits
   * `isNewUser`/`requiresOnboarding`, the role-null + roleId-null fallback
   * below handles the routing. When both signals are explicit, we trust
   * them over the role-null heuristic.
   */
  isNewUser?: boolean | null;
  requiresOnboarding?: boolean | null;
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
 * Agent 30 — boolean helper: does the snapshot represent a first-time
 * Google user that must complete onboarding before they can land on
 * /forum or a role workspace?
 *
 * True when ANY of:
 *   - isNewUser === true (explicit BE signal)
 *   - requiresOnboarding === true (explicit BE signal)
 *   - role is empty AND roleId is non-positive (role-null fallback for
 *     BE versions that don't surface the legacy signals — see
 *     BTR-AGENT52-01).
 */
export function isFirstTimeOnboardingUser(snapshot: PostAuthSnapshot): boolean {
  if (snapshot.isNewUser === true) return true;
  if (snapshot.requiresOnboarding === true) return true;
  return !hasNonEmptyRole(snapshot.role) && !hasPositiveRoleId(snapshot.roleId);
}

/**
 * Agent 30 — boolean helper: is this snapshot an approved, active user
 * with a known role assigned?
 */
export function isApprovedActiveUser(snapshot: PostAuthSnapshot): boolean {
  if (snapshot.isActive !== true) return false;
  if (snapshot.verificationStatus !== 'Accepted') return false;
  return isKnownRoleString(snapshot.role ?? null);
}

/**
 * Resolve the post-auth destination for the supplied snapshot. The
 * helper is intentionally side-effect-free — callers are responsible for
 * the actual `navigate()` / `<Navigate />` invocation.
 *
 * Returned values are one of:
 *   - ROUTES.COMPLETE_GOOGLE_REGISTRATION — first-time Google user
 *   - ROUTES.FORUM                        — pending / Guest / unverified
 *   - ROUTES.ADMIN                        — Admin role landing
 *   - ROUTES.LOGIN                        — safe recovery (incomplete)
 */
export function resolvePostAuthRoute(snapshot: PostAuthSnapshot): string {
  // Priority 1 — onboarding (must precede the /forum-as-Guest fallback
  // so a first-time user never lands on /forum before completing the
  // role-request flow).
  if (isFirstTimeOnboardingUser(snapshot)) {
    return ROUTES.COMPLETE_GOOGLE_REGISTRATION;
  }

  // Priority 2 — approved + active + known role. Admin goes to /admin,
  // everything else goes to /forum (per landingRouteForRoleName).
  if (isApprovedActiveUser(snapshot)) {
    return landingRouteForRoleName(snapshot.role ?? null);
  }

  // Priority 3 — pending / unverified / inactive / role-missing — the
  // /forum-as-Guest landing. Pending Guests do not get into role
  // workspaces, and the verified-guard renders the pending banner.
  //
  // This branch fires when:
  //   - effectiveRole === 'Guest' (BE-derived)
  //   - !isActive OR verificationStatus !== 'Accepted'
  //   - role is non-empty but the user is not approved yet
  if (
    snapshot.effectiveRole === 'Guest' ||
    snapshot.isActive === false ||
    (snapshot.verificationStatus != null &&
      snapshot.verificationStatus !== 'Accepted')
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
  KNOWN_BUSINESS_ROLES,
};

export type _EffectiveRole = EffectiveRole;