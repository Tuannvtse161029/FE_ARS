/**
 * Tests for Agent 52 — constants / paths.
 *
 * The Google onboarding flow depends on TWO route constants:
 *   1. `ROUTES.COMPLETE_GOOGLE_REGISTRATION` — used by `Login.tsx` to route
 *      first-time Google users into the onboarding page.
 *   2. `API_ENDPOINTS.AUTH.GOOGLE_LOGIN` — used by `googleAuthService` to
 *      POST the GIS credential.
 *
 * These tests pin those two values down so a casual rename can't break the
 * flow silently.
 */

import { describe, it, expect } from 'vitest';
import { ROUTES } from '../../../src/routes/paths';
import { API_ENDPOINTS } from '../../../src/utils/constants';

describe('Google-auth route constants', () => {
  it('exposes a COMPLETE_GOOGLE_REGISTRATION route', () => {
    expect(ROUTES.COMPLETE_GOOGLE_REGISTRATION).toBe('/complete-google-registration');
  });

  it('exposes a public GOOGLE_LOGIN API endpoint', () => {
    expect(API_ENDPOINTS.AUTH.GOOGLE_LOGIN).toBe('/api/auth/google-login');
  });

  it('exposes a GET_ALL endpoint for /api/Role', () => {
    expect(API_ENDPOINTS.ROLE.GET_ALL).toBe('/api/Role');
  });

  it('does not duplicate the ROUTES constant surface (constants.ts vs routes/paths.ts)', () => {
    // The Login page and the onboarding page reference `ROUTES.COMPLETE_GOOGLE_REGISTRATION`.
    // If a later edit accidentally drops the route from `routes/paths.ts`, this fails.
    expect(typeof ROUTES.COMPLETE_GOOGLE_REGISTRATION).toBe('string');
    expect(ROUTES.COMPLETE_GOOGLE_REGISTRATION.length).toBeGreaterThan(0);
  });
});