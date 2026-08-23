/**
 * Unit tests for the centralized post-auth route resolver
 * (`src/utils/postAuthRoute.ts`). Agent 30 — single source of truth for
 * the post-login routing priority that AuthContext.loginWithGoogle,
 * GoogleCallback, and the authenticated-user branch of PublicRoute must
 * all honour.
 *
 * The priority (per BTR-AGENT30-01):
 *   1. New Google user (isNewUser || requiresOnboarding || role-null
 *      AND roleId-null): /complete-google-registration
 *   2. Approved + active + known role: /admin or /forum
 *   3. Pending / unverified / role-missing / inactive: /forum as Guest
 *   4. Anything malformed: safe recovery (/login)
 *
 * Guest fallback MUST NOT precede onboarding.
 */
import { describe, it, expect } from 'vitest';
import {
  isFirstTimeOnboardingUser,
  resolvePostAuthRoute,
} from '../../../src/utils/postAuthRoute';
import { ROUTES } from '../../../src/routes/paths';

describe('isFirstTimeOnboardingUser', () => {
  it('returns true when isNewUser is true (explicit BE signal)', () => {
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: true,
        role: 'Researcher',
        roleId: 1,
      }),
    ).toBe(true);
  });

  it('returns true when requiresOnboarding is true (explicit BE signal)', () => {
    expect(
      isFirstTimeOnboardingUser({
        requiresOnboarding: true,
        role: 'Researcher',
        roleId: 1,
      }),
    ).toBe(true);
  });

  it('returns true when role AND roleId are both empty (role-null fallback)', () => {
    expect(
      isFirstTimeOnboardingUser({
        role: null,
        roleId: 0,
      }),
    ).toBe(true);
  });

  it('returns false when only role is empty but roleId is positive', () => {
    expect(
      isFirstTimeOnboardingUser({
        role: null,
        roleId: 1,
      }),
    ).toBe(false);
  });

  it('returns false when only roleId is zero but role is non-empty', () => {
    expect(
      isFirstTimeOnboardingUser({
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

describe('resolvePostAuthRoute', () => {
  it('routes a confirmed first-time Google user to /complete-google-registration', () => {
    // Mirrors the BE response shape for duyphuong2000.dpp@gmail.com's
    // first Google sign-in (per the agent-30 task spec).
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

  it('routes a role-null authenticated user (no legacy signal) to /complete-google-registration', () => {
    // BE did not surface isNewUser / requiresOnboarding. The role-null +
    // roleId-null fallback still catches them.
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

  it('does NOT route a first-time user to /forum (priority enforcement)', () => {
    // The /forum-as-Guest fallback must NEVER precede the onboarding
    // branch. This test asserts the strict priority ordering.
    const destination = resolvePostAuthRoute({
      isNewUser: true,
      role: null,
      roleId: 0,
      effectiveRole: 'Guest',
    });
    expect(destination).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
  });
});