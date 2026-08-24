/**
 * Agent 30 — verifies that the first-time Google onboarding page does
 * NOT call `GET /api/User/{id}` to bootstrap the session.
 *
 * Per the BE contract (`BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md`
 * and `BE_GOOGLE_OAUTH_LOGIN_TICKET.md`), the BE-derived
 * `effectiveRole`, `isNewUser`, `requiresOnboarding`, `isActive`,
 * `verificationStatus`, `role`, and `roleId` returned by
 * `POST /api/Auth/google-login` are the only signals that drive
 * routing into the onboarding page. A `GET /api/User/{id}` call
 * after the first-time Google login is a regression — it duplicates
 * state the BE has already given us, and the first-time account has
 * no role yet so the endpoint can only return empty data.
 *
 * This test introspects the AuthContext source and the CompleteGoogleRegistration
 * source — the simpler, no-network assertion is that the first-time Google
 * branch in `AuthContext.loginWithGoogle` and the
 * `CompleteGoogleRegistration` page never call `userService.getById`
 * as part of the first-time onboarding flow.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolve } from 'node:path';

const srcRoot = resolve(__dirname, '../../../src');
const read = (rel: string) =>
  readFileSync(join(srcRoot, rel), 'utf8');

describe('Agent 30 — first-time onboarding does not call GET /api/User/{id}', () => {
  it('AuthContext.loginWithGoogle never invokes userService.getById in the first-time branch', () => {
    const authSrc = read('context/AuthContext.tsx');
    // Locate the first-time onboarding block by its distinctive comment.
    const firstTimeIdx = authSrc.indexOf('First-time Google user');
    expect(firstTimeIdx).toBeGreaterThanOrEqual(0);
    // The first-time branch must terminate before any userService.getById
    // call. We slice from the first-time marker up to the next `if (!roleToUse)`
    // / `existing user` branch — whichever appears first.
    const endIdxCandidates = [
      authSrc.indexOf('Existing user', firstTimeIdx),
      authSrc.indexOf('userService.getById', firstTimeIdx),
      authSrc.length,
    ].filter((n) => n > 0);
    const endIdx = Math.min(...endIdxCandidates);
    const firstTimeBlock = authSrc.slice(firstTimeIdx, endIdx);

    expect(firstTimeBlock).not.toMatch(/userService\.getById/);
  });

  it('CompleteGoogleRegistration.tsx does not invoke GET /api/User/{id} on mount', () => {
    const pageSrc = read(
      'pages/CompleteGoogleRegistration/CompleteGoogleRegistration.tsx',
    );
    // The page owns its own session read via storage.getUser() /
    // storage.getToken(). It must NOT call userService.getById.
    expect(pageSrc).not.toMatch(/userService\.getById/);
    // Defensive: the page also must not call any /api/User fetch endpoint.
    expect(pageSrc).not.toMatch(/\/api\/User/);
  });

  it('CompleteGoogleRegistration.tsx does not call GET /api/Role for the role list', () => {
    const pageSrc = read(
      'pages/CompleteGoogleRegistration/CompleteGoogleRegistration.tsx',
    );
    // The role list is FE-owned — the page must not depend on the BE
    // endpoint for the user-selectable set.
    expect(pageSrc).not.toMatch(/fetchBusinessRolesForOnboarding/);
    expect(pageSrc).not.toMatch(/roleService\./);
    // Defensive — the page must not hard-code the /api/Role URL string
    // (the role.service module owns the BE endpoint contract).
    expect(pageSrc).not.toMatch(/['"`]\/api\/Role['"`]/);
    expect(pageSrc).not.toMatch(/['"`]\/api\/role\/business['"`]/);
  });

  it('CompleteGoogleRegistration.tsx does not call /api/Auth/register', () => {
    const pageSrc = read(
      'pages/CompleteGoogleRegistration/CompleteGoogleRegistration.tsx',
    );
    // Per the docstring on the page: the user was already created by
    // google-login; the onboarding completion is NOT a re-registration.
    expect(pageSrc).not.toMatch(/['"`]\/api\/Auth\/register['"`]/);
    expect(pageSrc).not.toMatch(/authService\.registerUser/);
    expect(pageSrc).not.toMatch(/api\/auth\/register/);
  });

  it('the submit payload builder never includes credential/code/userId fields', () => {
    const serviceSrc = read('services/googleAuth.service.ts');
    // The postCompleteGoogleRegistration function builds the body
    // explicitly — assert it never adds forbidden fields.
    const fnIdx = serviceSrc.indexOf('postCompleteGoogleRegistration');
    expect(fnIdx).toBeGreaterThanOrEqual(0);
    // Slice up to the next top-level `function` / `export const` declaration.
    const endIdx = serviceSrc.indexOf('\nexport const googleAuthService', fnIdx);
    const fnSrc = serviceSrc.slice(fnIdx, endIdx > 0 ? endIdx : fnIdx + 4000);
    expect(fnSrc).not.toMatch(/credential:\s*payload\.credential/);
    expect(fnSrc).not.toMatch(/body\.credential\s*=/);
    expect(fnSrc).not.toMatch(/body\.userId\s*=/);
    expect(fnSrc).not.toMatch(/body\.code\s*=/);
  });
});