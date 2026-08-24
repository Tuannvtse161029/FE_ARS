/**
 * Unit tests for the centralized post-auth route resolver
 * (`src/utils/postAuthRoute.ts`). Agent 30 — single source of truth for
 * the post-login routing priority that AuthContext.loginWithGoogle,
 * GoogleCallback, and the authenticated-user branch of PublicRoute must
 * all honour.
 *
 * Priority (per the Agent 30 follow-up correction — exact spec):
 *   1. New Google user → /complete-google-registration.
 *      Spec: `isNewUser === true AND requiresOnboarding === true
 *             AND effectiveRole === null AND approved role list is empty`.
 *      Compatibility fallback (deliberately preserved): when the BE does
 *      NOT surface the explicit signals, a snapshot whose `role` is
 *      empty AND `roleId` is non-positive is also a first-time user.
 *      This is the only branch the legacy `BTR-AGENT52-01` regression
 *      exercises; removing it would regress existing app contracts.
 *   2. Submitted pending user with no approved active role → /forum
 *      (verified Guests render the pending banner).
 *   3. Approved + active + known role → /admin or /forum.
 *   4. Anything malformed: safe recovery (/login).
 *
 * Guest fallback MUST NOT precede onboarding. A generic
 * `effectiveRole === null` heuristic MUST NOT route to /forum before
 * the onboarding branch fires — only the AND-clause above (plus the
 * role-null/roleId-null compat fallback) does.
 */
import { describe, it, expect } from 'vitest';
import {
  isFirstTimeOnboardingUser,
  resolvePostAuthRoute,
} from '../../../src/utils/postAuthRoute';
import { ROUTES } from '../../../src/routes/paths';

describe('isFirstTimeOnboardingUser — exact spec branch (Agent 30 follow-up)', () => {
  it('returns true when ALL four conditions are met (AND semantics)', () => {
    // isNewUser===true AND requiresOnboarding===true
    //   AND effectiveRole===null
    //   AND approved role list is empty
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: true,
        requiresOnboarding: true,
        effectiveRole: null,
        role: null,
        roleId: 0,
      }),
    ).toBe(true);
  });

  it('returns false when isNewUser===true but requiresOnboarding is NOT true (AND — single signal is not enough)', () => {
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: true,
        requiresOnboarding: false,
        effectiveRole: null,
        role: null,
        roleId: 0,
      }),
    ).toBe(false);
  });

  it('returns false when requiresOnboarding===true but isNewUser is NOT true', () => {
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: false,
        requiresOnboarding: true,
        effectiveRole: null,
        role: null,
        roleId: 0,
      }),
    ).toBe(false);
  });

  it('returns false when effectiveRole is non-null (BE already promoted the user — even to Guest)', () => {
    // The BE has explicitly written `effectiveRole: 'Guest'`, which means
    // the account has progressed past the new-user onboarding state. The
    // user should land on /forum as a Guest, NOT on the onboarding page.
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: true,
        requiresOnboarding: true,
        effectiveRole: 'Guest',
        role: null,
        roleId: 0,
      }),
    ).toBe(false);
  });

  it('returns false when the approved role list is non-empty (BE has at least one accepted role)', () => {
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: true,
        requiresOnboarding: true,
        effectiveRole: null,
        role: null,
        roleId: 0,
        approvedRoles: ['Researcher'],
      }),
    ).toBe(false);
  });

  it('does NOT route on effectiveRole===null alone (no generic effectiveRole-null heuristic)', () => {
    // A bare `effectiveRole: null` without any positive onboarding
    // signal is the legacy Agent 39 derived-Guest sentinel — it must
    // NOT trigger onboarding. Routing is driven only by isNewUser /
    // requiresOnboarding (with the documented compat fallback).
    expect(
      isFirstTimeOnboardingUser({
        effectiveRole: null,
        role: 'Researcher',
        roleId: 1,
        isActive: true,
        verificationStatus: 'Accepted',
      }),
    ).toBe(false);
  });
});

describe('isFirstTimeOnboardingUser — compatibility fallback (BE omitted the explicit signals)', () => {
  it('returns true when role AND roleId are both empty AND no explicit onboarding signals are set', () => {
    // The legacy BTR-AGENT52-01 fallback path: the BE did not surface
    // `isNewUser` / `requiresOnboarding` AND the user has no role yet.
    // We still classify them as a first-time onboarding candidate so a
    // legacy BE doesn't drop them on /forum.
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: false,
        requiresOnboarding: false,
        role: null,
        roleId: 0,
      }),
    ).toBe(true);
  });

  it('returns false when only role is empty but roleId is positive', () => {
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: false,
        requiresOnboarding: false,
        role: null,
        roleId: 1,
      }),
    ).toBe(false);
  });

  it('returns false when only roleId is zero but role is non-empty', () => {
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: false,
        requiresOnboarding: false,
        role: 'Researcher',
        roleId: 0,
      }),
    ).toBe(false);
  });

  it('returns false for an approved active Researcher with role and roleId', () => {
    expect(
      isFirstTimeOnboardingUser({
        role: 'Researcher',
        roleId: 1,
        isActive: true,
        verificationStatus: 'Accepted',
      }),
    ).toBe(false);
  });
});

describe('resolvePostAuthRoute — exact priority', () => {
  it('routes a confirmed first-time Google user (all four conditions) to /complete-google-registration', () => {
    const destination = resolvePostAuthRoute({
      isNewUser: true,
      requiresOnboarding: true,
      effectiveRole: null,
      role: null,
      roleId: 0,
      isActive: false,
      verificationStatus: 'Pending',
    });
    expect(destination).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
  });

  it('does NOT route to onboarding when only isNewUser===true (other conditions missing) — falls through to /forum', () => {
    // The user already has an effective role / role assigned (BE
    // promoted them past onboarding); the explicit AND-clause is not
    // satisfied. The /forum-as-Guest branch is the correct destination.
    const destination = resolvePostAuthRoute({
      isNewUser: true,
      requiresOnboarding: false,
      effectiveRole: 'Guest',
      role: 'Researcher',
      roleId: 1,
      isActive: false,
      verificationStatus: 'Pending',
    });
    expect(destination).toBe(ROUTES.FORUM);
  });

  it('routes the legacy role-null authenticated user (no legacy signal) to /complete-google-registration', () => {
    // BE did not surface isNewUser / requiresOnboarding. The role-null +
    // roleId-null compat fallback still catches them.
    const destination = resolvePostAuthRoute({
      isNewUser: false,
      requiresOnboarding: false,
      role: null,
      roleId: 0,
      isActive: false,
      verificationStatus: 'Pending',
    });
    expect(destination).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
  });

  it('routes a non-null role + Pending user to /forum (as Guest)', () => {
    const destination = resolvePostAuthRoute({
      role: 'Researcher',
      roleId: 1,
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: 'Guest',
    });
    expect(destination).toBe(ROUTES.FORUM);
  });

  it('routes an approved active Admin user to /admin', () => {
    const destination = resolvePostAuthRoute({
      role: 'Admin',
      roleId: 2,
      isActive: true,
      verificationStatus: 'Accepted',
      effectiveRole: 'Admin',
    });
    expect(destination).toBe(ROUTES.ADMIN);
  });

  it('routes an approved active Researcher to /forum (workspace landing)', () => {
    const destination = resolvePostAuthRoute({
      role: 'Researcher',
      roleId: 1,
      isActive: true,
      verificationStatus: 'Accepted',
      effectiveRole: 'Researcher',
    });
    expect(destination).toBe(ROUTES.FORUM);
  });

  it('routes a user with role but isActive=false (no effectiveRole echo) to /forum as Guest', () => {
    const destination = resolvePostAuthRoute({
      role: 'Reviewer',
      roleId: 3,
      isActive: false,
      verificationStatus: 'Pending',
    });
    expect(destination).toBe(ROUTES.FORUM);
  });

  it('routes a user with non-Accepted verificationStatus to /forum as Guest', () => {
    const destination = resolvePostAuthRoute({
      role: 'Lecturer',
      roleId: 4,
      isActive: true,
      verificationStatus: 'Rejected',
    });
    expect(destination).toBe(ROUTES.FORUM);
  });

  it('falls back to /login for a snapshot that has a non-null role but no approval signals', () => {
    // Role assigned but the approval state machine is fully unknown
    // (isActive and verificationStatus both undefined, effectiveRole
    // also undefined). Priority 1 doesn't fire (role is non-null),
    // Priority 2 doesn't fire (isActive is not strictly true,
    // verificationStatus is not strictly 'Accepted'). Priority 3
    // doesn't fire because none of the derived-Guest signals are set.
    // The safe-recovery /login branch is the only path left — the
    // caller (PublicRoute / AuthContext / GoogleCallback) is expected
    // to surface this as a recoverable error rather than a hard
    // navigation to /forum.
    const destination = resolvePostAuthRoute({
      role: 'Researcher',
      roleId: 1,
    });
    expect(destination).toBe(ROUTES.LOGIN);
  });

  it('does NOT route a freshly-onboarded user to /forum when the BE keeps the explicit signals', () => {
    // The AND-clause: isNewUser===true AND requiresOnboarding===true
    // AND effectiveRole===null AND approved roles empty. All four must
    // hold — the /forum-as-Guest fallback must NEVER precede the
    // onboarding branch.
    const destination = resolvePostAuthRoute({
      isNewUser: true,
      requiresOnboarding: true,
      effectiveRole: null,
      role: null,
      roleId: 0,
    });
    expect(destination).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
  });

  it('does NOT route via the generic effectiveRole=null fallback before the onboarding branch', () => {
    // A bare `effectiveRole: null` without explicit onboarding signals
    // is NOT enough to trigger /complete-google-registration. With a
    // valid role the snapshot routes through the approved branch
    // (or, when approval is missing, the safe-recovery /login branch).
    // It must NEVER go to /complete-google-registration on a bare
    // effectiveRole-null heuristic.
    const destination = resolvePostAuthRoute({
      effectiveRole: null,
      role: 'Researcher',
      roleId: 1,
      isActive: true,
      verificationStatus: 'Accepted',
    });
    expect(destination).toBe(ROUTES.FORUM);
  });
});
