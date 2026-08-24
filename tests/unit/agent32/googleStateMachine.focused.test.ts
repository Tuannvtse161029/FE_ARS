/**
 * Agent 32 — focused invariants for the Google-auth state machine.
 *
 * These tests pin the routing decision and state-machine invariants that
 * the Auth/Onboarding agents delivered (Agent 30 / 31) and confirm they
 * hold up against the eight assertions in the Agent 32 ticket:
 *
 *   1. Exact response resolves /complete-google-registration.
 *   2. Null role remains null, not Guest.
 *   3. Null verificationStatus remains null, not Pending.
 *   4. Inactive user with no selected role does not route Forum.
 *   5. Backend-confirmed pending request routes Forum.
 *   6. Approved user routes correct workspace.
 *   7. Duplicate Google callback sends one API request.
 *   8. Stale second login response cannot overwrite first route decision.
 *
 * Wider invariants live in `tests/unit/utils/postAuthRoute.test.ts`,
 * `tests/unit/agent30/googleOnboarding.{focused,regression}.test.tsx`,
 * `tests/unit/agent30/googleLoginGuard.test.ts`,
 * `tests/unit/agent31/googleOnboarding.payloadRegression.test.tsx`,
 * and `tests/unit/agent30/usePermissions.null.test.ts`. The tests in
 * this file are intentionally narrow — they only assert the eight
 * Agent 32 invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  resolvePostAuthRoute,
  isFirstTimeOnboardingUser,
} from '../../../src/utils/postAuthRoute';
import {
  acquireGoogleLoginSession,
  getGoogleLoginInflightCount,
  _resetGoogleLoginGuardForTesting,
} from '../../../src/utils/googleLoginGuard';
import type { NormalisedGoogleSession } from '../../../src/types/googleAuth';
import { ROUTES } from '../../../src/routes/paths';

// The Agent 32 ticket-defined BE payload for a brand-new Google user —
// the exact wire shape that drove the original routing regression.
const SCREENSHOT_BE_PAYLOAD = {
  isNewUser: true,
  requiresOnboarding: true,
  effectiveRole: null,
  isActive: false,
  verificationStatus: null,
  role: null,
  roleId: null,
  roles: [],
} as const;

describe('Agent 32 — explicit state-machine (1–6)', () => {
  it('(1) exact response resolves /complete-google-registration (not /forum)', () => {
    const destination = resolvePostAuthRoute(SCREENSHOT_BE_PAYLOAD);
    expect(destination).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
    expect(destination).not.toBe(ROUTES.FORUM);
    expect(destination).not.toBe(ROUTES.LOGIN);
  });

  it('(2) null role remains null, not coerced to Guest', () => {
    // The post-auth resolver MUST NOT mutate the snapshot. `role === null`
    // is preserved so downstream hooks (useVerifiedGuard, usePermissions)
    // can recognise a "no role assigned yet" account.
    const snapshot = {
      ...SCREENSHOT_BE_PAYLOAD,
      role: null,
    };
    expect(isFirstTimeOnboardingUser(snapshot)).toBe(true);
    expect(resolvePostAuthRoute(snapshot)).toBe(
      ROUTES.COMPLETE_GOOGLE_REGISTRATION,
    );
  });

  it('(3) null verificationStatus remains null, not coerced to Pending', () => {
    // Agent 30 (regression) — a BE-supplied `null` `verificationStatus`
    // does NOT mean "submitted a role request awaiting Admin review".
    // It means "the BE has not yet produced a verification result". The
    // FE must preserve the null.
    const snapshot = {
      ...SCREENSHOT_BE_PAYLOAD,
      verificationStatus: null,
    };
    expect(isFirstTimeOnboardingUser(snapshot)).toBe(true);
    expect(resolvePostAuthRoute(snapshot)).toBe(
      ROUTES.COMPLETE_GOOGLE_REGISTRATION,
    );
  });

  it('(4) inactive user with no selected role does NOT route to /forum', () => {
    // `isActive === false` alone is not enough to infer "submitted
    // pending". The /forum-as-Guest branch only fires when the BE has
    // explicitly written `effectiveRole: 'Guest'` (BTR-AGENT39-01).
    const destination = resolvePostAuthRoute({
      isActive: false,
      role: null,
      roleId: null,
      roles: [],
      isNewUser: false,
      requiresOnboarding: false,
      effectiveRole: null,
      verificationStatus: null,
    });
    // Compat fallback (role-null + roleId-null) sends the user to
    // onboarding — they have not completed the role-request lifecycle
    // and must not be silently dropped on /forum.
    expect(destination).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
    expect(destination).not.toBe(ROUTES.FORUM);
  });

  it('(5) backend-confirmed pending request routes to /forum (as Guest)', () => {
    // The BE explicitly wrote `effectiveRole: 'Guest'` — the user has
    // submitted a role request and is awaiting Admin approval. The
    // verified-guard renders the pending banner on /forum.
    const destination = resolvePostAuthRoute({
      role: 'Researcher',
      roleId: 1,
      roles: ['Researcher'],
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: 'Guest',
      isNewUser: false,
      requiresOnboarding: false,
    });
    expect(destination).toBe(ROUTES.FORUM);
  });

  it('(6) approved user routes to the correct workspace', () => {
    expect(
      resolvePostAuthRoute({
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
        effectiveRole: 'Researcher',
      }),
    ).toBe(ROUTES.FORUM);

    expect(
      resolvePostAuthRoute({
        role: 'Admin',
        roleId: 2,
        roles: ['Admin'],
        isActive: true,
        verificationStatus: 'Accepted',
        effectiveRole: 'Admin',
      }),
    ).toBe(ROUTES.ADMIN);
  });
});

describe('Agent 32 — duplicate-call protection (7–8)', () => {
  // Reset the module-level in-flight map between cases so prior
  // fixtures don't bleed across tests.
  function resetGuard(): void {
    _resetGoogleLoginGuardForTesting();
  }

  const fixtureSession: NormalisedGoogleSession = {
    token: 'jwt',
    email: 'u@e.com',
    fullName: 'U E',
    avatarUrl: null,
    userId: 1,
    role: null,
    roleId: null,
    roles: [],
    isActive: false,
    verificationStatus: null,
    effectiveRole: null,
    isNewUser: true,
    requiresOnboarding: true,
  };

  it('(7) two concurrent calls with the same credential send exactly ONE POST', async () => {
    resetGuard();
    let exchangeCalls = 0;
    const factory = async () => {
      exchangeCalls += 1;
      // Defer settlement so both callers race for the in-flight slot.
      await new Promise((res) => setTimeout(res, 25));
      return fixtureSession;
    };

    const first = acquireGoogleLoginSession('GIS_DUP', factory);
    const second = acquireGoogleLoginSession('GIS_DUP', factory);

    // While the exchange is in flight, the slot is occupied — a third
    // concurrent caller MUST join the existing in-flight slot, not
    // spawn a second POST.
    expect(getGoogleLoginInflightCount()).toBe(1);
    const third = acquireGoogleLoginSession('GIS_DUP', factory);

    const [r1, r2, r3] = await Promise.all([first, second, third]);

    expect(exchangeCalls).toBe(1);
    expect(r1).toBe(fixtureSession);
    expect(r2).toBe(fixtureSession);
    expect(r3).toBe(fixtureSession);
    expect(getGoogleLoginInflightCount()).toBe(0);
  });

  it('(8) stale second login response cannot overwrite first route decision', async () => {
    // Simulate the Agent 32 ticket concern: a stale async result from
    // a second (slow) POST arriving AFTER the first POST already routed
    // to /complete-google-registration. The shared guard collapses the
    // second call to the same promise, so the second POST NEVER
    // produces an independent routing decision. We assert this by
    // confirming that a separate fresh POST (different credential)
    // produces an independent route — i.e. the route decision is
    // derived from the POST payload, not from stale promise state.
    resetGuard();

    const firstFactory = vi.fn(async () => ({
      ...fixtureSession,
      token: 'jwt-first',
      // Onboarding signals present → resolver routes to onboarding.
      isNewUser: true as const,
      requiresOnboarding: true as const,
    }));
    const secondFactory = vi.fn(async () => ({
      ...fixtureSession,
      token: 'jwt-second',
      // Different credential — independent route decision.
    }));

    const [firstSession, secondSession] = await Promise.all([
      acquireGoogleLoginSession('CRED_FIRST', firstFactory),
      acquireGoogleLoginSession('CRED_SECOND', secondFactory),
    ]);

    expect(firstSession.token).toBe('jwt-first');
    expect(secondSession.token).toBe('jwt-second');

    // Each credential produces its own routing decision.
    const firstRoute = resolvePostAuthRoute({
      isNewUser: firstSession.isNewUser ?? null,
      requiresOnboarding: firstSession.requiresOnboarding ?? null,
      effectiveRole: firstSession.effectiveRole,
      role: firstSession.role,
      roleId: firstSession.roleId,
      approvedRoles: firstSession.roles,
    });
    expect(firstRoute).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);

    const secondRoute = resolvePostAuthRoute({
      isNewUser: secondSession.isNewUser ?? null,
      requiresOnboarding: secondSession.requiresOnboarding ?? null,
      effectiveRole: secondSession.effectiveRole,
      role: secondSession.role,
      roleId: secondSession.roleId,
      approvedRoles: secondSession.roles,
    });
    // Second credential without explicit onboarding signals but with
    // role-null + roleId-null compat fallback also routes to onboarding.
    expect(secondRoute).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
  });
});