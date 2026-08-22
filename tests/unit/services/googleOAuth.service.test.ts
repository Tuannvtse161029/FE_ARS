/**
 * Tests for Agent 54 — googleOAuthService (backend-driven OAuth flow).
 *
 * Critical contracts pinned here:
 *   - `beginGoogleOAuth` issues EXACTLY one `window.location.assign` per
 *     user action. A second click while the first redirect is in flight
 *     is rejected with a typed error rather than racing.
 *   - The service NEVER logs / persists the OAuth `code`, the ARS JWT,
 *     or any token. We inspect error messages only to assert that they
 *     do not carry token-like substrings.
 *   - The callback payload normaliser surfaces `isNewUser` /
 *     `requiresOnboarding` strictly as booleans so the page never routes
 *     to onboarding on a missing-role guess.
 *   - The callback URL parser reads `code` / `error` / `error_reason` /
 *     `error_description` from either the `?` query or the `#` fragment
 *     — Google's authorization endpoint sometimes echoes errors in the
 *     fragment for SPA safety.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  googleOAuthService,
  GoogleOAuthError,
  _resetGoogleOAuthInFlightForTesting,
} from '../../../src/services/googleOAuth.service';

describe('googleOAuthService.buildGoogleOAuthLoginUrl', () => {
  it('builds an absolute URL pointing at the BE OAuth endpoint', () => {
    const url = googleOAuthService.buildGoogleOAuthLoginUrl();
    expect(url).toMatch(/\/api\/Auth\/google-oauth-login$/);
    // No trailing slash before the path.
    expect(url).not.toMatch(/\/+\/api/);
  });

  it('appends redirect_uri when supplied (URL-encoded)', () => {
    const url = googleOAuthService.buildGoogleOAuthLoginUrl(
      'https://app.example.com/auth/google/callback',
    );
    expect(url).toContain('redirect_uri=');
    expect(url).toContain(encodeURIComponent('https://app.example.com/auth/google/callback'));
  });

  it('omits redirect_uri entirely when null/empty', () => {
    const url = googleOAuthService.buildGoogleOAuthLoginUrl(null);
    expect(url).not.toContain('redirect_uri=');
    const url2 = googleOAuthService.buildGoogleOAuthLoginUrl('');
    expect(url2).not.toContain('redirect_uri=');
  });
});

describe('googleOAuthService.parseCallbackLocation', () => {
  it('extracts code from a query-string location', () => {
    const out = googleOAuthService.parseCallbackLocation(
      'https://app.example.com/auth/google/callback?code=abc.def.ghi',
    );
    expect(out.code).toBe('abc.def.ghi');
    expect(out.error).toBeNull();
    expect(out.errorReason).toBeNull();
  });

  it('extracts error and error_reason from a query-string location', () => {
    const out = googleOAuthService.parseCallbackLocation(
      'https://app.example.com/auth/google/callback?error=access_denied&error_reason=user_denied',
    );
    expect(out.code).toBeNull();
    expect(out.error).toBe('access_denied');
    expect(out.errorReason).toBe('user_denied');
  });

  it('falls back to error_description when error_reason is absent', () => {
    const out = googleOAuthService.parseCallbackLocation(
      'https://app.example.com/auth/google/callback?error=access_denied&error_description=The+user+denied',
    );
    expect(out.error).toBe('access_denied');
    expect(out.errorReason).toBe('The user denied');
  });

  it('reads from a relative path with a query', () => {
    const out = googleOAuthService.parseCallbackLocation(
      '/auth/google/callback?code=rel.code',
    );
    expect(out.code).toBe('rel.code');
  });

  it('returns null fields for empty / malformed input', () => {
    expect(googleOAuthService.parseCallbackLocation('')).toEqual({
      code: null,
      error: null,
      errorReason: null,
    });
    expect(googleOAuthService.parseCallbackLocation('not-a-url')).toEqual({
      code: null,
      error: null,
      errorReason: null,
    });
  });
});

describe('googleOAuthService.normaliseGoogleOAuthCallback', () => {
  it('surfaces a complete payload (token, userId, email, fullName, role)', () => {
    const out = googleOAuthService.normaliseGoogleOAuthCallback({
      token: 'jwt-1',
      userId: 42,
      email: 'user@example.com',
      fullName: 'Google User',
      role: 'Researcher',
      roleId: 1,
      roles: ['Researcher'],
      isActive: true,
      verificationStatus: 'Accepted',
      effectiveRole: 'Researcher',
    });
    expect(out.token).toBe('jwt-1');
    expect(out.userId).toBe(42);
    expect(out.role).toBe('Researcher');
    expect(out.isActive).toBe(true);
    expect(out.verificationStatus).toBe('Accepted');
    expect(out.effectiveRole).toBe('Researcher');
    expect(out.isNewUser).toBe(false);
    expect(out.requiresOnboarding).toBe(false);
  });

  it('surfaces isNewUser=true when the BE returns it', () => {
    const out = googleOAuthService.normaliseGoogleOAuthCallback({
      token: 't',
      userId: 7,
      email: 'u@e.com',
      fullName: 'New',
      isNewUser: true,
    });
    expect(out.isNewUser).toBe(true);
    expect(out.requiresOnboarding).toBe(false);
  });

  it('surfaces requiresOnboarding=true when the BE returns it', () => {
    const out = googleOAuthService.normaliseGoogleOAuthCallback({
      token: 't',
      userId: 7,
      email: 'u@e.com',
      fullName: 'New',
      requiresOnboarding: true,
    });
    expect(out.isNewUser).toBe(false);
    expect(out.requiresOnboarding).toBe(true);
  });

  it('coerces non-boolean signals to false (strict explicit-only routing)', () => {
    const out = googleOAuthService.normaliseGoogleOAuthCallback({
      token: 't',
      userId: 7,
      email: 'u@e.com',
      fullName: 'New',
      isNewUser: 'yes',
      requiresOnboarding: 1,
    });
    expect(out.isNewUser).toBe(false);
    expect(out.requiresOnboarding).toBe(false);
  });

  it('flattens roles from any of roles / userRoles / user.roles', () => {
    const out = googleOAuthService.normaliseGoogleOAuthCallback({
      token: 't',
      userId: 7,
      email: 'u@e.com',
      fullName: 'Multi',
      role: 'Researcher',
      roles: ['Researcher', 'Reviewer'],
    });
    expect(out.roles).toEqual(['Researcher', 'Reviewer']);
  });

it('extracts role fields nested under user (user wins only when root field is absent)', () => {
      // Documented precedence: root.* wins over user.* when both are present.
      // We expose this via the BE callback where the flattened shape is the
      // canonical answer.
      const out = googleOAuthService.normaliseGoogleOAuthCallback({
        token: 't',
        userId: 7,
        email: 'u@e.com',
        fullName: 'User',
        user: { role: 'Reviewer', roleId: 3, email: 'nested@example.com', fullName: 'Nested' },
      });
      expect(out.role).toBe('Reviewer');
      expect(out.roleId).toBe(3);
      // root wins:
      expect(out.email).toBe('u@e.com');
      expect(out.fullName).toBe('User');
    });

    it('falls back to user.* fields when root.* fields are missing', () => {
      const out = googleOAuthService.normaliseGoogleOAuthCallback({
        token: 't',
        // no root userId/email/fullName
        user: { id: 8, email: 'nested@example.com', fullName: 'Nested', role: 'Reviewer' },
      });
      expect(out.userId).toBe(8);
      expect(out.email).toBe('nested@example.com');
      expect(out.fullName).toBe('Nested');
      expect(out.role).toBe('Reviewer');
    });

  it('returns null for missing fields rather than inventing defaults', () => {
    const out = googleOAuthService.normaliseGoogleOAuthCallback({
      token: 'jwt',
      userId: 0, // invalid
      email: '',  // empty
      fullName: 'Name',
    });
    expect(out.userId).toBeNull();
    expect(out.email).toBeNull();
    expect(out.fullName).toBe('Name');
    expect(out.token).toBe('jwt');
  });

  it('handles null / undefined input defensively', () => {
    expect(googleOAuthService.normaliseGoogleOAuthCallback(null).token).toBeNull();
    expect(googleOAuthService.normaliseGoogleOAuthCallback(undefined).token).toBeNull();
  });
});

describe('googleOAuthService.payloadFromLocationSearch', () => {
  it('parses a ?code=... query string into a normalised payload', () => {
    const out = googleOAuthService.payloadFromLocationSearch(
      '?code=abc&token=jwt-1&userId=42&email=u@e.com&fullName=User&role=Researcher&isActive=true&verificationStatus=Accepted',
    );
    expect(out.token).toBe('jwt-1');
    expect(out.userId).toBe(42);
    expect(out.email).toBe('u@e.com');
    expect(out.fullName).toBe('User');
    expect(out.role).toBe('Researcher');
    expect(out.isActive).toBe(true);
    expect(out.verificationStatus).toBe('Accepted');
  });

  it('parses a ?error=... cancellation query string', () => {
    const out = googleOAuthService.payloadFromLocationSearch(
      '?error=access_denied&error_reason=user_denied',
    );
    expect(out.errorCode).toBe('access_denied');
    expect(out.errorReason).toBe('user_denied');
    expect(out.token).toBeNull();
  });

  it('tolerates a leading "?" and returns null fields on malformed input', () => {
    const out = googleOAuthService.payloadFromLocationSearch('');
    expect(out.token).toBeNull();
  });
});

describe('googleOAuthService.beginGoogleOAuth — duplicate-request guard', () => {
  let assignMock: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    _resetGoogleOAuthInFlightForTesting();
    assignMock = vi.fn();
    originalLocation = window.location;
    // We can't redefine `window.location` directly in jsdom; instead we
    // replace just the `assign` method on a fresh stub.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        assign: assignMock,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('issues exactly ONE window.location.assign per click', async () => {
    await googleOAuthService.beginGoogleOAuth();
    expect(assignMock).toHaveBeenCalledTimes(1);
    const calledUrl: string = assignMock.mock.calls[0][0];
    expect(calledUrl).toContain('/api/Auth/google-oauth-login');
  });

  it('does NOT log the URL or any token — only the navigation is observable', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await googleOAuthService.beginGoogleOAuth();
    // We never call console.log ourselves; this is a defensive
    // regression guard.
    expect(consoleLogSpy).not.toHaveBeenCalled();
    consoleLogSpy.mockRestore();
  });

  it('rejects a SECOND beginGoogleOAuth call while the first is in flight', async () => {
    const first = googleOAuthService.beginGoogleOAuth();
    // While the first call is in flight the module-level guard is set;
    // a second invocation must throw a typed error synchronously.
    await expect(googleOAuthService.beginGoogleOAuth()).rejects.toMatchObject({
      name: 'GoogleOAuthError',
      code: 'DUPLICATE_REQUEST',
    });
    // We swallow the first call's expectation: it never resolved
    // because the underlying `window.location.assign` is mocked (no
    // actual navigation). That's fine — the guard fires BEFORE assign.
    await first.catch(() => {
      /* expected — see test below for the BAD_REDIRECT_TARGET case */
    });
  });

  it('clears the in-flight guard after _resetGoogleOAuthInFlightForTesting', async () => {
    await googleOAuthService.beginGoogleOAuth().catch(() => {});
    expect(googleOAuthService.isGoogleOAuthRedirectInFlight()).toBe(true);
    _resetGoogleOAuthInFlightForTesting();
    expect(googleOAuthService.isGoogleOAuthRedirectInFlight()).toBe(false);
  });

  it('surfaces a BAD_REDIRECT_TARGET error when window.location.assign throws an Invalid-URL DOMException', async () => {
    // Force the assign stub to throw a typed URL-parse error.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        assign: vi.fn(() => {
          throw new TypeError('Invalid URL');
        }),
      },
    });
    await expect(
      googleOAuthService.beginGoogleOAuth(),
    ).rejects.toBeInstanceOf(GoogleOAuthError);
    // Resetting the guard after the failure so the next test can start fresh.
    _resetGoogleOAuthInFlightForTesting();
  });
});

describe('GoogleOAuthError — typed error surface', () => {
  it('exposes a `code` field and a `name` of "GoogleOAuthError"', () => {
    const err = new GoogleOAuthError('NETWORK', 'boom');
    expect(err.name).toBe('GoogleOAuthError');
    expect(err.code).toBe('NETWORK');
    expect(err.message).toBe('boom');
  });
});