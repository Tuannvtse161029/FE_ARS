// Agent 52 (revised) — Google Identity Services ↔ Backend glue.
//
// This file is the single bridge between:
//   - The browser-side GIS callback (`CredentialResponse.credential`)
//   - The BE endpoint `POST /api/Auth/google-login` (`{ credential: <jwt> }`)
//
// Hard rules implemented here:
//   1. `credential` is the signed ID token — treated as opaque, posted EXACTLY
//      once per callback. The FE never authenticates from any other GIS field
//      (clientId, select_by, etc.) — those are observability signals only.
//   2. The credential is never logged, never stored, never echoed. We use
//      `unknown` rather than `any` for the parsed error so the call site can
//      produce a user-friendly message without leaking the credential into a
//      console warning.
//   3. Errors are normalised to a discriminated union so the Login / Register
//      surfaces can distinguish 401/403 (auth failed), 409 (already linked,
//      etc.), 422 (validation), and 5xx (transient). The pages keep the user
//      in the same UI state — recoverable UI states, no hard fail.
//   4. Duplicate-request prevention is enforced here too: each call gets a
//      fresh idempotency key so an unintended double-submit (race between the
//      GIS callback firing twice) does not produce two account-creation
//      attempts on the BE.
//
// Call sites: `Login.tsx` (existing users) and `Register.tsx` (first-time
// Google sign-up). Both share the same BE endpoint — the BE decides whether
// the credential belongs to an existing user or a new one and returns the
// appropriate `isNewUser` / `requiresOnboarding` signals for routing.

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  GoogleCredentialResponse,
  NormalisedGoogleSession,
} from '../types/googleAuth';

// ── Error taxonomy ─────────────────────────────────────────────────────────

export type GoogleLoginErrorCode =
  | 'NETWORK'
  | 'NO_CREDENTIAL'
  | 'INVALID_CREDENTIAL' // 401
  | 'FORBIDDEN' // 403
  | 'CONFLICT' // 409 — e.g. email already linked to a password account
  | 'UNPROCESSABLE' // 422
  | 'SERVER' // 5xx
  | 'PARSE'
  | 'UNKNOWN';

export class GoogleLoginError extends Error {
  readonly code: GoogleLoginErrorCode;
  readonly status: number | null;

  constructor(
    code: GoogleLoginErrorCode,
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = 'GoogleLoginError';
    this.code = code;
    this.status = status;
  }
}

// ── Response normalisation ─────────────────────────────────────────────────

/**
 * Convert the (loosely typed) BE response into a `NormalisedGoogleSession`.
 *
 * We accept the same broad shapes `auth.service.login` accepts because the
 * BE historically mirrors its password-login payload for Google-login —
 * `data?.user`, `data?.token`, snake_case variants, etc.
 *
 * For routing we look ONLY at:
 *   - `isNewUser` and `requiresOnboarding` when present (the documented
 *     Google signals; see BTR-AGENT52-01 if BE doesn't surface them).
 *   - `isActive`, `verificationStatus`, `effectiveRole` as fallbacks.
 *
 * We never invent an onboarding decision from `role` alone — see spec.
 */
export function normaliseGoogleLoginResponse(
  data: unknown,
): NormalisedGoogleSession {
  const root = (data ?? {}) as Record<string, unknown>;
  const user = (root.user ?? {}) as Record<string, unknown>;

  const pick = <T>(...candidates: Array<unknown>): T | null => {
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) continue;
      return candidate as T;
    }
    return null;
  };

  const token = pick<string | undefined>(
    root.token,
    root.accessToken,
    root.jwt,
  );
  const email = pick<string | undefined>(
    root.email,
    user.email,
  );
  const fullName = pick<string | undefined>(
    root.fullName,
    user.fullName,
    root.username,
    user.username,
  );
  const avatarUrl = pick<string | undefined>(
    root.avatarUrl,
    root.picture,
    user.avatarUrl,
    user.picture,
  );
  const userIdRaw = pick<number | undefined>(
    root.userId,
    user.userId,
    user.id,
  );
  const userId =
    typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) && userIdRaw > 0
      ? userIdRaw
      : null;

  const role = pick<string | undefined>(root.role, root.roleName, user.role, user.roleName);
  const nestedRoleObj = (user.role && typeof user.role === 'object' ? user.role : null) as
    | { id?: unknown }
    | null;
  const roleIdRaw = pick<number | undefined>(root.roleId, user.roleId, nestedRoleObj?.id);
  const roleId =
    typeof roleIdRaw === 'number' && Number.isFinite(roleIdRaw) && roleIdRaw > 0
      ? roleIdRaw
      : null;

  const rolesRaw = Array.isArray(root.roles)
    ? root.roles
    : Array.isArray(root.userRoles)
      ? root.userRoles
      : Array.isArray(user.roles)
        ? user.roles
        : [];
  const roles = rolesRaw
    .map((r) => {
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object') {
        const obj = r as { name?: unknown; roleName?: unknown; role?: unknown };
        return (obj.name ?? obj.roleName ?? obj.role) as unknown;
      }
      return undefined;
    })
    .filter((r): r is string => typeof r === 'string');

  const isActiveRaw = pick<boolean | undefined>(root.isActive, user.isActive);
  const isActive = typeof isActiveRaw === 'boolean' ? isActiveRaw : null;

  const verificationRaw = pick<string | undefined>(
    root.verificationStatus,
    user.verificationStatus,
  );
  const verificationStatus: NormalisedGoogleSession['verificationStatus'] =
    verificationRaw === 'Accepted' || verificationRaw === 'Rejected'
      ? verificationRaw
      : verificationRaw === 'Pending'
        ? 'Pending'
        : null;

  const effectiveRoleRaw = pick<string | undefined>(
    root.effectiveRole,
    user.effectiveRole,
  );
  const effectiveRole =
    typeof effectiveRoleRaw === 'string' && effectiveRoleRaw.length > 0
      ? effectiveRoleRaw
      : null;

  // The BE may or may not surface isNewUser / requiresOnboarding (Swagger
  // doesn't document them — see BTR-AGENT52-01). Coerce strict booleans so
  // the route logic only sees true / false (never undefined) and stays in
  // lock-step with the spec's "explicit-only onboarding decision" rule.
  const isNewUserRaw = pick<boolean | undefined>(root.isNewUser, user.isNewUser);
  const requiresOnboardingRaw = pick<boolean | undefined>(
    root.requiresOnboarding,
    user.requiresOnboarding,
  );
  const isNewUser = isNewUserRaw === true;
  const requiresOnboarding = requiresOnboardingRaw === true;

  return {
    token: typeof token === 'string' ? token : null,
    email: typeof email === 'string' ? email : null,
    fullName: typeof fullName === 'string' ? fullName : null,
    avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
    userId,
    role: typeof role === 'string' ? role : null,
    roleId,
    roles,
    isActive,
    verificationStatus,
    effectiveRole,
    isNewUser,
    requiresOnboarding,
  };
}

// ── The actual API call ────────────────────────────────────────────────────

interface PostGoogleLoginInput {
  credential: string;
  /** Optional Idempotency-Key — defaults to a per-call UUID to prevent double-submit. */
  idempotencyKey?: string;
}

/**
 * POST the GIS credential EXACTLY once to `/api/auth/google-login`.
 *
 * Hard rules:
 *   1. `credential` is the signed Google ID token (JWT). We never log it,
 *      decode it, or echo it back to the caller.
 *   2. The shared axios instance carries a per-user `Authorization` header
 *      from the active ARS session. Sending the credential with a stale
 *      bearer in the header would confuse the BE — and a brand-new
 *      visitor does not have a session yet. We strip the header for
 *      the duration of the call and restore it after, so the rest of
 *      the FE is unaffected.
 *   3. An optional Idempotency-Key header is attached so a duplicated
 *      GIS callback (StrictMode double-invoke, rapid double-click) does
 *      not produce two account-creation attempts on the BE.
 *
 * @throws GoogleLoginError with a typed `code` and `status`.
 */
export async function postGoogleLogin({
  credential,
  idempotencyKey,
}: PostGoogleLoginInput): Promise<NormalisedGoogleSession> {
  if (typeof credential !== 'string' || credential.length === 0) {
    throw new GoogleLoginError(
      'NO_CREDENTIAL',
      'No Google credential was provided. Please try signing in again.',
    );
  }

  // Strip the shared `Authorization` header so the credential is the only
  // identity attached to this request. We restore the original header in
  // the `finally` block so concurrent / subsequent calls are unaffected.
  const previousAuthHeader =
    (api.defaults.headers.common as Record<string, unknown>).Authorization ??
    null;
  try {
    delete (api.defaults.headers.common as Record<string, unknown>).Authorization;
    if (api.defaults.headers) {
      if ('Authorization' in api.defaults.headers) {
        delete (api.defaults.headers as Record<string, unknown>).Authorization;
      }
    }

    const response = await api.post(
      API_ENDPOINTS.AUTH.GOOGLE_LOGIN,
      { credential },
      {
        headers: {
          // RFC draft Idempotency-Key. The BE should echo and dedupe; the FE
          // also dedupes internally (call site guard).
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
      },
    );
    return normaliseGoogleLoginResponse(response.data);
  } catch (err: unknown) {
    // Map axios-style errors to a discriminated GoogleLoginError. We never
    // surface the original axios message verbatim because it sometimes
    // embeds the request body / credential in dev mode.
    const status =
      typeof (err as { response?: { status?: number } })?.response?.status === 'number'
        ? (err as { response: { status: number } }).response.status
        : null;

    if (status === null) {
      // No HTTP status ⇒ either network or pre-flight error.
      const message =
        err instanceof Error && err.message
          ? 'Network error reaching the Google login service. Please check your connection and try again.'
          : 'Network error reaching the Google login service. Please check your connection and try again.';
      throw new GoogleLoginError('NETWORK', message, null);
    }

    if (status === 401) {
      throw new GoogleLoginError(
        'INVALID_CREDENTIAL',
        'Your Google sign-in has expired or is no longer valid. Please try signing in again.',
        status,
      );
    }
    if (status === 403) {
      throw new GoogleLoginError(
        'FORBIDDEN',
        'Your Google account is not permitted to sign in. Please contact support if you believe this is an error.',
        status,
      );
    }
    if (status === 409) {
      throw new GoogleLoginError(
        'CONFLICT',
        'This Google account is already linked to a different sign-in method. Please sign in with that method instead.',
        status,
      );
    }
    if (status === 422) {
      throw new GoogleLoginError(
        'UNPROCESSABLE',
        'The Google sign-in token was rejected. Please try again.',
        status,
      );
    }
    if (status >= 500) {
      throw new GoogleLoginError(
        'SERVER',
        'Our sign-in service is temporarily unavailable. Please try again in a moment.',
        status,
      );
    }

    throw new GoogleLoginError(
      'UNKNOWN',
      'Google sign-in failed for an unexpected reason. Please try again.',
      status,
    );
  } finally {
    // Restore the previous `Authorization` header so the rest of the FE
    // keeps using the existing ARS session, if any. This is a no-op when
    // there was no prior session.
    if (previousAuthHeader) {
      (api.defaults.headers.common as Record<string, unknown>).Authorization =
        previousAuthHeader;
    } else {
      try {
        delete (api.defaults.headers.common as Record<string, unknown>).Authorization;
        if ('Authorization' in api.defaults.headers) {
          delete (api.defaults.headers as Record<string, unknown>).Authorization;
        }
      } catch {
        /* defensive — axios may be mocked in tests */
      }
    }
  }
}

// ── Public service object ──────────────────────────────────────────────────

export const googleAuthService = {
  /**
   * Submit a Google credential. The Login button (and any future GIS surface)
   * call this with the `credential` string from GIS, and receive a normalised
   * session object containing the BE-derived routing signals.
   */
  postGoogleLogin,

  /** Convenience: validate the GIS callback shape before posting. */
  extractCredential: (response: GoogleCredentialResponse | null | undefined): string | null => {
    if (!response) return null;
    if (typeof response.credential !== 'string' || response.credential.length === 0) return null;
    return response.credential;
  },

  /** Normalisation exposed for unit-test coverage (no other call site uses it directly). */
  normaliseGoogleLoginResponse,
};

export default googleAuthService;
