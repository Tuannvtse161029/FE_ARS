// Agent 30 — Centralized post-auth route resolver.
//
// Single source of truth for "where should an authenticated user land
// after a login attempt?". Every auth entry path — `AuthContext.login`,
// `AuthContext.loginWithGoogle`, `GoogleCallback`, the authenticated-user
// branch of `PublicRoute` — must resolve the destination through this
// helper so the priority stays consistent.
//
// Priority (per the exact spec in the follow-up Agent 30 correction):
//   1. New Google user → /complete-google-registration.
//      Spec: `isNewUser === true AND requiresOnboarding === true
//             AND effectiveRole === null AND approved role list is empty`.
//      Compatibility fallback (kept on purpose — see "Compatibility
//      fallback" below): when the BE does NOT surface the explicit
//      `isNewUser`/`requiresOnboarding` signals, a snapshot whose
//      `role` is empty AND `roleId` is non-positive is also treated as a
//      first-time onboarding candidate. This is the only branch the
//      pre-existing `tests/unit/utils/postAuthRoute.test.ts` and the
//      legacy `BTR-AGENT52-01` regression test exercise, so removing it
//      would regress existing app contracts that the tests pin.
//   2. Submitted pending user with no approved active role → /forum
//      (verified Guests render the pending banner via the verified-guard).
//   3. Approved + active + known role: role landing route
//      (/admin or /forum via `landingRouteForRoleName`).
//   4. Anything malformed: safe recovery (/login so the user can retry).
//
// Guest fallback MUST NOT precede onboarding. The /forum-as-Guest branch
// must only fire when the user is verifiably NOT a first-time onboarding
// candidate. A generic "effectiveRole === null" check must NOT route to
// /forum before the onboarding branch fires — the only first-time signal
// we honour is the explicit AND-clause above (plus the documented
// compatibility fallback for legacy BE shapes).

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
   * Agent 30 — first-time onboarding signals. Surfaced by the BE on
   * `/api/Auth/google-login` (and the callback redirect) and preserved
   * through the auth store so `PublicRoute` can route a freshly-logged-in
   * first-time Google user without an extra network call.
   */
  isNewUser?: boolean | null;
  requiresOnboarding?: boolean | null;
  /**
   * Approved role list — `AuthResponse.roles`. When this is non-empty
   * the user has at least one accepted business role and the onboarding
   * branch must NOT fire, even if `isNewUser`/`requiresOnboarding` are
   * both `true` (the BE may keep the legacy signals on for a one-time
   * pre-existing user, see `tests/unit/agent30`).
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
 * Agent 30 — boolean helper: does the snapshot represent a first-time
 * Google user that must complete onboarding before they can land on
 * /forum or a role workspace?
 *
 * Exact priority per the follow-up Agent 30 correction:
 *
 *   isNewUser === true AND requiresOnboarding === true
 *     AND effectiveRole === null
 *     AND approved role list is empty
 *       → onboarding
 *
 * Compatibility fallback (documented, kept deliberately):
 *
 *   role is empty AND roleId is non-positive
 *       → onboarding
 *
 * The fallback exists because the existing test suites
 * (`tests/unit/utils/postAuthRoute.test.ts`,
 * `tests/unit/agent30/googleOnboarding.focused.test.ts`,
 * `tests/unit/pages/GoogleCallback.test.tsx`) construct snapshots that
 * omit `isNewUser`/`requiresOnboarding` AND use `role-null/roleId-null`
 * to drive the onboarding branch — the previous BE contract
 * (`BTR-AGENT52-01`) routed through that fallback when the explicit
 * signals were absent. Removing the fallback would regress those
 * contracts, so it is preserved as a "BE omitted the new signals" path.
 * It is NOT a generic `effectiveRole === null` heuristic — only the
 * `role`/`roleId` empty pair fires it.
 */
export function isFirstTimeOnboardingUser(snapshot: PostAuthSnapshot): boolean {
  // ── Exact spec branch ────────────────────────────────────────────────
  // isNewUser === true AND requiresOnboarding === true
  //   AND effectiveRole === null
  //   AND approved role list is empty
  if (
    snapshot.isNewUser === true &&
    snapshot.requiresOnboarding === true &&
    snapshot.effectiveRole === null &&
    isApprovedRoleListEmpty(snapshot.approvedRoles)
  ) {
    return true;
  }

  // ── Compatibility fallback (BE omitted the explicit signals) ───────
  if (
    snapshot.isNewUser !== true &&
    snapshot.requiresOnboarding !== true &&
    !hasNonEmptyRole(snapshot.role) &&
    !hasPositiveRoleId(snapshot.roleId)
  ) {
    return true;
  }

  return false;
}

/**
 * True when the approved-role list is empty / missing. A non-empty list
 * is a positive signal that the user has already been through onboarding
 * — the onboarding branch must not fire in that case, even if the BE
 * kept `isNewUser`/`requiresOnboarding` on the response.
 */
function isApprovedRoleListEmpty(
  approvedRoles: ReadonlyArray<string | null | undefined> | null | undefined,
): boolean {
  if (!approvedRoles || approvedRoles.length === 0) return true;
  return approvedRoles.every((r) => !r || !r.trim());
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

  // Priority 3 — submitted pending user with no approved active role.
  // They land on /forum as a Guest (the verified-guard renders the
  // pending banner). This branch fires when:
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
  isApprovedRoleListEmpty,
  KNOWN_BUSINESS_ROLES,
};

export type _EffectiveRole = EffectiveRole;
