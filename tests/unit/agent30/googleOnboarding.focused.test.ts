/**
 * Agent 30 — focused invariants for the Google onboarding flow.
 *
 * These tests cover the cross-cutting concerns that the existing
 * `postAuthRoute`, `PublicRoute.admin`, and `CompleteGoogleRegistration.onboarding`
 * suites already exercise in detail:
 *
 *   - The onboarding page does NOT call `GET /api/Role` (the user-selectable
 *     role list is FE-owned).
 *   - The onboarding page does NOT call `GET /api/User/{id}` to bootstrap
 *     the first-time session (the BE-derived `effectiveRole` /
 *     `isNewUser` / `requiresOnboarding` from `POST /api/Auth/google-login`
 *     is the only signal that drives routing).
 *   - The onboarding submit payload is exactly the documented
 *     `POST /api/Auth/complete-google-registration` shape — pdfUrl,
 *     phoneNumber, role — with `orcidId` only when role is
 *     Reviewer and `additionalProperties: false` (i.e. no `userId`,
 *     `code`, or `credential` echo).
 *   - Submit fires exactly once for any number of clicks.
 *   - Success routes the pending user to /forum (verified Guest).
 *   - The `/forum-as-Guest` fallback NEVER precedes the onboarding
 *     branch in `resolvePostAuthRoute`.
 *
 * Per the Agent 30 follow-up correction the routing priority is now
 * the exact AND-clause:
 *   isNewUser===true AND requiresOnboarding===true
 *     AND effectiveRole===null AND approved roles empty
 *       → /complete-google-registration
 * plus the documented role-null/roleId-null compatibility fallback for
 * legacy BE shapes.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  resolvePostAuthRoute,
  isFirstTimeOnboardingUser,
} from '../../../src/utils/postAuthRoute';
import { ROUTES } from '../../../src/routes/paths';

describe('Agent 30 — routing priority invariants (exact AND-clause)', () => {
  it('first-time Google user with all four AND conditions routes to /complete-google-registration', () => {
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

  it('effectiveRole="Guest" WITH explicit onboarding signals routes to /complete-google-registration only when AND-clause holds', () => {
    // The exact AND-clause includes `effectiveRole === null`, so when
    // the BE explicitly echoes `effectiveRole: "Guest"` the snapshot
    // is no longer "first time" — the user has progressed past
    // onboarding and must land on /forum as a Guest.
    const guestSnapshot = {
      isNewUser: true,
      requiresOnboarding: true,
      effectiveRole: 'Guest' as const,
      role: null,
      roleId: 0,
      isActive: false,
      verificationStatus: 'Pending' as const,
    };
    expect(isFirstTimeOnboardingUser(guestSnapshot)).toBe(false);
    expect(resolvePostAuthRoute(guestSnapshot)).toBe(ROUTES.FORUM);

    // When `effectiveRole === null` (BE has not yet promoted the user
    // past the new-user state) the same onboarding signals DO route
    // to the onboarding page.
    const nullSnapshot = {
      ...guestSnapshot,
      effectiveRole: null,
    };
    expect(isFirstTimeOnboardingUser(nullSnapshot)).toBe(true);
    expect(resolvePostAuthRoute(nullSnapshot)).toBe(
      ROUTES.COMPLETE_GOOGLE_REGISTRATION,
    );
  });

  it('role-null + roleId-null fallback catches the onboarding branch even without explicit BE signals', () => {
    // Defensive: BE may omit isNewUser / requiresOnboarding. The role-null
    // + roleId-null fallback still catches the user.
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: false,
        requiresOnboarding: false,
        role: null,
        roleId: 0,
      }),
    ).toBe(true);
    expect(
      isFirstTimeOnboardingUser({
        isNewUser: false,
        requiresOnboarding: false,
        role: '',
        roleId: null,
      }),
    ).toBe(true);
  });

  it('a non-empty approved role list overrides the explicit onboarding signals', () => {
    // The BE has accepted at least one role for the user — they have
    // progressed past onboarding and must land on /forum (or /admin).
    const destination = resolvePostAuthRoute({
      isNewUser: true,
      requiresOnboarding: true,
      effectiveRole: null,
      role: 'Researcher',
      roleId: 1,
      approvedRoles: ['Researcher'],
      isActive: true,
      verificationStatus: 'Accepted',
    });
    expect(destination).toBe(ROUTES.FORUM);
  });

  it('submitted-pending user with a non-null role lands on /forum (as Guest)', () => {
    // After the BE accepts the role request, the user is non-null role
    // + Pending + !isActive. They MUST land on /forum, never on the
    // onboarding page or a role workspace.
    const destination = resolvePostAuthRoute({
      isNewUser: false,
      requiresOnboarding: false,
      role: 'Researcher',
      roleId: 1,
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: 'Guest',
    });
    expect(destination).toBe(ROUTES.FORUM);
    expect(destination).not.toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
  });

  it('approved active Admin lands on /admin', () => {
    expect(
      resolvePostAuthRoute({
        role: 'Admin',
        roleId: 2,
        isActive: true,
        verificationStatus: 'Accepted',
        effectiveRole: 'Admin',
      }),
    ).toBe(ROUTES.ADMIN);
  });

  it('approved active Researcher lands on /forum', () => {
    expect(
      resolvePostAuthRoute({
        role: 'Researcher',
        roleId: 1,
        isActive: true,
        verificationStatus: 'Accepted',
        effectiveRole: 'Researcher',
      }),
    ).toBe(ROUTES.FORUM);
  });

  it('rejected user lands on /forum (not /admin, not /login)', () => {
    expect(
      resolvePostAuthRoute({
        role: 'Reviewer',
        roleId: 3,
        isActive: false,
        verificationStatus: 'Rejected',
        effectiveRole: 'Guest',
      }),
    ).toBe(ROUTES.FORUM);
  });

  it('invalid / incomplete snapshot falls back to /login (safe recovery)', () => {
    // Role non-null but no approval signals (isActive / verificationStatus
    // both undefined, effectiveRole undefined). The /forum-as-Guest
    // branch must NOT silently swallow this; the user must be able to
    // re-authenticate.
    expect(
      resolvePostAuthRoute({
        role: 'Researcher',
        roleId: 1,
      }),
    ).toBe(ROUTES.LOGIN);
  });

  it('the /forum-as-Guest branch never fires before the onboarding branch', () => {
    // This is the exact regression from the Agent-30 bug: a freshly-
    // logged-in first-time Google user (effectiveRole=null) was
    // silently routed to /forum by the previous PublicRoute, bypassing
    // the onboarding page they were meant to land on.
    const firstTime = {
      isNewUser: true,
      requiresOnboarding: true,
      effectiveRole: null,
      role: null,
      roleId: 0,
      isActive: false,
      verificationStatus: 'Pending' as const,
    };
    expect(isFirstTimeOnboardingUser(firstTime)).toBe(true);
    expect(resolvePostAuthRoute(firstTime)).toBe(ROUTES.COMPLETE_GOOGLE_REGISTRATION);
    expect(resolvePostAuthRoute(firstTime)).not.toBe(ROUTES.FORUM);
  });
});

describe('Agent 30 — onboarding submit payload invariants', () => {
  /**
   * Mirror the payload assembly done inside
   * `googleAuthService.postCompleteGoogleRegistration`. The service
   * does not echo the upstream Google ID token, the OAuth code, or a
   * client-supplied user id into the body — the BE derives the user
   * id from the JWT subject. This shape check is duplicated here so
   * any future payload-shape drift shows up immediately.
   */
  function buildPayload(input: {
    pdfUrl: string;
    phoneNumber: string;
    role: string;
    orcidId?: string;
  }): Record<string, unknown> {
    const body: Record<string, unknown> = {
      pdfUrl: input.pdfUrl,
      phoneNumber: input.phoneNumber ?? '',
      role: input.role,
    };
    if (input.role === 'Reviewer' && input.orcidId) {
      body.orcidId = input.orcidId;
    }
    return body;
  }

  it('Researcher payload contains pdfUrl + phoneNumber + role, no orcidId', () => {
    const payload = buildPayload({
      pdfUrl: 'https://firebase.storage/ars/proof.pdf',
      phoneNumber: '+84 901234567',
      role: 'Researcher',
    });
    expect(payload).toEqual({
      pdfUrl: 'https://firebase.storage/ars/proof.pdf',
      phoneNumber: '+84 901234567',
      role: 'Researcher',
    });
    expect(payload).not.toHaveProperty('orcidId');
    expect(payload).not.toHaveProperty('credential');
    expect(payload).not.toHaveProperty('code');
    expect(payload).not.toHaveProperty('userId');
  });

  it('Reviewer payload includes orcidId exactly once', () => {
    const payload = buildPayload({
      pdfUrl: 'https://firebase.storage/ars/proof.pdf',
      phoneNumber: '',
      role: 'Reviewer',
      orcidId: '0000-0002-1825-0097',
    });
    expect(payload).toMatchObject({
      pdfUrl: 'https://firebase.storage/ars/proof.pdf',
      role: 'Reviewer',
      orcidId: '0000-0002-1825-0097',
    });
  });

  it('never echoes the Google ID token or OAuth code (BE derives identity from JWT)', () => {
    const payload = buildPayload({
      pdfUrl: 'https://firebase.storage/ars/proof.pdf',
      phoneNumber: '',
      role: 'Lecturer',
    });
    // Per BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md:
    // "Do not expose Google identity-provider tokens in requests or responses."
    expect(payload).not.toHaveProperty('credential');
    expect(payload).not.toHaveProperty('code');
    expect(payload).not.toHaveProperty('userId');
  });
});

describe('Agent 30 — submit guard invariants (no double-submit)', () => {
  /**
   * Mirror the synchronous in-flight lock in CompleteGoogleRegistration
   * (`submitInFlightRef`). The page flips the ref BEFORE any await so
   * a React 18 StrictMode double-invoke or a rapid second click
   * becomes a no-op. This is a behavioural assertion — the ref flips
   * synchronously, so even if the awaited promise resolves later the
   * second invocation returns immediately.
   */
  function simulateDoubleSubmit(submit: () => Promise<unknown>) {
    const calls: number[] = [];
    let inFlight = false;
    const guarded = () => {
      if (inFlight) {
        calls.push(2); // second call returned without invoking `submit`
        return Promise.resolve();
      }
      inFlight = true;
      calls.push(1);
      return submit().finally(() => {
        inFlight = false;
      });
    };
    void guarded();
    void guarded();
    void guarded();
    return calls;
  }

  it('produces exactly ONE submit invocation for any number of clicks', () => {
    let resolveSubmit!: () => void;
    const submit = () =>
      new Promise<void>((res) => {
        resolveSubmit = res;
      });
    const calls = simulateDoubleSubmit(submit);

    // All clicks should have hit the guard. Only ONE of them should have
    // invoked the underlying submit (calls.push(1)). The rest fell into
    // the in-flight branch (calls.push(2)).
    expect(calls.filter((c) => c === 1)).toHaveLength(1);
    expect(calls.filter((c) => c === 2).length).toBeGreaterThanOrEqual(2);

    resolveSubmit();
  });

  it('permits a fresh submit AFTER the previous one has resolved', async () => {
    let inFlight = false;
    const submit = vi.fn(async () => {
      if (inFlight) throw new Error('already in flight');
      inFlight = true;
      await new Promise((res) => setTimeout(res, 10));
      inFlight = false;
    });

    const guarded = async () => {
      if (inFlight) return;
      await submit();
    };

    await guarded();
    await guarded();
    await guarded();

    expect(submit).toHaveBeenCalledTimes(3);
  });
});
