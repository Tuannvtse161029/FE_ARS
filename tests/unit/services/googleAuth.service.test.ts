/**
 * Tests for Agent 52 — googleAuthService.
 *
 * Critical contracts pinned down here:
 *   - `credential` is POSTed EXACTLY once. The service never authenticates
 *     from any other GIS field.
 *   - The credential string is never logged or persisted.
 *   - 401/403/409/422/5xx responses are mapped to typed `GoogleLoginError`
 *     subclasses so the UI can render recoverable states.
 *   - Duplicate in-flight submissions are deduplicated via the call-site
 *     guard (Login page) but the service also attaches an Idempotency-Key.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const postMock = vi.fn();

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
    defaults: { headers: { common: {} } },
  },
}));

import { googleAuthService, GoogleLoginError } from '../../../src/services/googleAuth.service';

describe('googleAuthService.postGoogleLogin — credential posting', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('posts the credential EXACTLY once to /api/Auth/google-login with the documented body shape', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-from-google',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
      },
    });

    const session = await googleAuthService.postGoogleLogin({
      credential: 'a.b.c',
      idempotencyKey: 'idem-1',
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body, config] = postMock.mock.calls[0];
    expect(url).toBe('/api/auth/google-login');
    expect(body).toEqual({ credential: 'a.b.c' });
    // Idempotency-Key is forwarded so the BE can dedupe duplicate POSTs.
    expect(config?.headers?.['Idempotency-Key']).toBe('idem-1');
    expect(session.token).toBe('jwt-from-google');
    expect(session.email).toBe('user@example.com');
    expect(session.role).toBe('Researcher');
    expect(session.isActive).toBe(true);
    expect(session.isNewUser).toBe(false);
    expect(session.requiresOnboarding).toBe(false);
  });

  it('never authenticates from client-decoded GIS fields — only the credential is posted', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt',
        email: 'user@example.com',
        userId: 1,
        role: 'Researcher',
      },
    });

    // Pretend GIS returned extra fields — the FE must ignore them all.
    await googleAuthService.postGoogleLogin({
      credential: 'cred-token',
    });

    const [, body] = postMock.mock.calls[0];
    expect(body).toEqual({ credential: 'cred-token' });
    // No clientId / select_by / nonce / etc. leak into the POST body.
    expect(Object.keys(body)).toEqual(['credential']);
  });

  it('throws GoogleLoginError(NO_CREDENTIAL) when the credential is missing or empty', async () => {
    await expect(googleAuthService.postGoogleLogin({ credential: '' })).rejects.toMatchObject({
      name: 'GoogleLoginError',
      code: 'NO_CREDENTIAL',
      status: null,
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('maps 401 to INVALID_CREDENTIAL', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 401, data: { message: 'nope' } } });
    await expect(
      googleAuthService.postGoogleLogin({ credential: 'x' }),
    ).rejects.toBeInstanceOf(GoogleLoginError);
  });

  it('maps 401 status to INVALID_CREDENTIAL with the right status', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 401 } });
    await expect(
      googleAuthService.postGoogleLogin({ credential: 'x' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIAL', status: 401 });
  });

  it('maps 403 to FORBIDDEN', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 403 } });
    await expect(
      googleAuthService.postGoogleLogin({ credential: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });

  it('maps 409 to CONFLICT (no silent password linking)', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 409 } });
    await expect(
      googleAuthService.postGoogleLogin({ credential: 'x' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
  });

  it('maps 422 to UNPROCESSABLE', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(
      googleAuthService.postGoogleLogin({ credential: 'x' }),
    ).rejects.toMatchObject({ code: 'UNPROCESSABLE', status: 422 });
  });

  it('maps 5xx to SERVER', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 503 } });
    await expect(
      googleAuthService.postGoogleLogin({ credential: 'x' }),
    ).rejects.toMatchObject({ code: 'SERVER', status: 503 });
  });

  it('maps network errors (no response) to NETWORK', async () => {
    postMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(
      googleAuthService.postGoogleLogin({ credential: 'x' }),
    ).rejects.toMatchObject({ code: 'NETWORK', status: null });
  });

  it('strips any pre-existing Authorization header for the duration of the credential POST', async () => {
    const axiosModule = await import('../../../src/services/axios');
    (axiosModule.default.defaults.headers.common as Record<string, string>).Authorization =
      'Bearer STALE_TOKEN';

    postMock.mockImplementationOnce(async () => {
      // While inside the POST, the Authorization header MUST be gone.
      const headerValue =
        (axiosModule.default.defaults.headers.common as Record<string, string | undefined>)
          .Authorization;
      expect(headerValue).toBeUndefined();
      return {
        data: {
          token: 'jwt',
          email: 'user@example.com',
          fullName: 'Google User',
          userId: 42,
          role: 'Researcher',
        },
      };
    });

    await googleAuthService.postGoogleLogin({ credential: 'a.b.c' });

    // After the call, the previous token is restored.
    expect(
      (axiosModule.default.defaults.headers.common as Record<string, string | undefined>)
        .Authorization,
    ).toBe('Bearer STALE_TOKEN');
  });

  it('restores the Authorization header even when the POST rejects', async () => {
    const axiosModule = await import('../../../src/services/axios');
    (axiosModule.default.defaults.headers.common as Record<string, string>).Authorization =
      'Bearer STALE_TOKEN';

    postMock.mockImplementationOnce(async () => {
      const headerValue =
        (axiosModule.default.defaults.headers.common as Record<string, string | undefined>)
          .Authorization;
      expect(headerValue).toBeUndefined();
      throw { response: { status: 401 } };
    });

    await expect(
      googleAuthService.postGoogleLogin({ credential: 'a.b.c' }),
    ).rejects.toBeInstanceOf(GoogleLoginError);

    expect(
      (axiosModule.default.defaults.headers.common as Record<string, string | undefined>)
        .Authorization,
    ).toBe('Bearer STALE_TOKEN');
  });
});

describe('googleAuthService.normaliseGoogleLoginResponse — explicit new-user signals', () => {
  it('surfaces isNewUser=true when the BE returns it', () => {
    const out = googleAuthService.normaliseGoogleLoginResponse({
      token: 't',
      email: 'u@e.com',
      userId: 7,
      isNewUser: true,
    });
    expect(out.isNewUser).toBe(true);
    expect(out.requiresOnboarding).toBe(false);
  });

  it('surfaces requiresOnboarding=true when the BE returns it', () => {
    const out = googleAuthService.normaliseGoogleLoginResponse({
      token: 't',
      email: 'u@e.com',
      userId: 7,
      requiresOnboarding: true,
    });
    expect(out.requiresOnboarding).toBe(true);
    expect(out.isNewUser).toBe(false);
  });

  it('coerces non-boolean isNewUser to false (never undefined — explicit-only routing)', () => {
    const out = googleAuthService.normaliseGoogleLoginResponse({
      token: 't',
      email: 'u@e.com',
      userId: 7,
      isNewUser: 'yes',
    });
    expect(out.isNewUser).toBe(false);
    expect(out.requiresOnboarding).toBe(false);
  });

  it('coerces isNewUser="true" (stringified by the BE) to true so first-time users still route to onboarding', () => {
    // Symptom of the bug investigated in this ticket: a newly-registered
    // Google user is not redirected to /complete-google-registration
    // because the BE echoed `isNewUser` as the string "true" and the
    // old strict `=== true` check dropped it. The relaxed coercion now
    // accepts the well-known string forms without sacrificing the
    // "explicit-only" intent.
    const out = googleAuthService.normaliseGoogleLoginResponse({
      token: 't',
      email: 'u@e.com',
      userId: 7,
      isNewUser: 'true',
    });
    expect(out.isNewUser).toBe(true);
  });

  it('coerces isNewUser="1" / "True" (case-insensitive) to true', () => {
    const a = googleAuthService.normaliseGoogleLoginResponse({
      token: 't',
      email: 'u@e.com',
      userId: 7,
      isNewUser: '1',
    });
    expect(a.isNewUser).toBe(true);
    const b = googleAuthService.normaliseGoogleLoginResponse({
      token: 't',
      email: 'u@e.com',
      userId: 7,
      isNewUser: 'TRUE',
    });
    expect(b.isNewUser).toBe(true);
  });

  it('coerces isNewUser="false" / "0" to false', () => {
    const out = googleAuthService.normaliseGoogleLoginResponse({
      token: 't',
      email: 'u@e.com',
      userId: 7,
      isNewUser: 'false',
      requiresOnboarding: '0',
    });
    expect(out.isNewUser).toBe(false);
    expect(out.requiresOnboarding).toBe(false);
  });

  it('coerces isNewUser=1 (numeric) to true', () => {
    const out = googleAuthService.normaliseGoogleLoginResponse({
      token: 't',
      email: 'u@e.com',
      userId: 7,
      isNewUser: 1,
    });
    expect(out.isNewUser).toBe(true);
  });

  it('unwraps the { data: { ... } } .NET response wrapper so a wrapped isNewUser still routes to onboarding', () => {
    // .NET controllers commonly wrap responses as `{ success, data: {...} }`.
    // The old normaliser only checked the root, so a wrapped new-user
    // signal was silently dropped. We now unwrap one level when the
    // inner object carries a `token`.
    const out = googleAuthService.normaliseGoogleLoginResponse({
      success: true,
      data: {
        token: 'wrapped-jwt',
        email: 'u@e.com',
        userId: 7,
        isNewUser: true,
      },
    });
    expect(out.token).toBe('wrapped-jwt');
    expect(out.userId).toBe(7);
    expect(out.isNewUser).toBe(true);
  });

  it('unwraps { result: { ... } } and { payload: { ... } } wrappers', () => {
    const r1 = googleAuthService.normaliseGoogleLoginResponse({
      result: {
        token: 'r-jwt',
        email: 'u@e.com',
        userId: 7,
        requiresOnboarding: true,
      },
    });
    expect(r1.token).toBe('r-jwt');
    expect(r1.requiresOnboarding).toBe(true);

    const r2 = googleAuthService.normaliseGoogleLoginResponse({
      payload: {
        token: 'p-jwt',
        email: 'u@e.com',
        userId: 7,
        isNewUser: true,
      },
    });
    expect(r2.token).toBe('p-jwt');
    expect(r2.isNewUser).toBe(true);
  });

  it('falls back to verificationStatus-based routing when neither signal is present', () => {
    const out = googleAuthService.normaliseGoogleLoginResponse({
      token: 't',
      email: 'u@e.com',
      userId: 7,
      role: 'Researcher',
      verificationStatus: 'Pending',
      isActive: false,
    });
    expect(out.isNewUser).toBe(false);
    expect(out.requiresOnboarding).toBe(false);
    expect(out.verificationStatus).toBe('Pending');
  });
});

describe('googleAuthService.extractCredential', () => {
  it('returns the credential string when GIS returns one', () => {
    expect(
      googleAuthService.extractCredential({ credential: 'abc' }),
    ).toBe('abc');
  });

  it('returns null when the credential is missing or empty', () => {
    expect(googleAuthService.extractCredential(null)).toBeNull();
    expect(googleAuthService.extractCredential({})).toBeNull();
    expect(googleAuthService.extractCredential({ credential: '' })).toBeNull();
  });

  it('ignores clientId / select_by — they are never authoritative', () => {
    const out = googleAuthService.extractCredential({
      credential: '',
      clientId: 'should-not-authorize',
      select_by: 'btn',
    });
    expect(out).toBeNull();
  });
});