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
// Dev-only diagnostic helper. Logs the raw google-login response and the
// normalised result so the FE can verify what the BE actually returned
// when a first-time user is not being routed to the onboarding page.
// Stripped in production builds (`import.meta.env.DEV` is a build-time
// constant that Vite tree-shakes).
function diagGoogleLoginResponse(label: string, payload: unknown): void {
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return;
  // eslint-disable-next-line no-console
  console.info(`[google-login:diag] ${label}`, payload);
}

// Coerce a value into a strict boolean. Accepts:
//   - boolean        (true / false → verbatim)
//   - string "true"  / "false" / "1" / "0" (case-insensitive, trimmed) —
//                    covers .NET responses that serialise boolean flags as
//                    strings, URL query-string parsing, and explicit-string
//                    serializers
//   - number 1 / 0   (and any non-zero number)
//   - everything else → false (explicit-only routing — we never default to
//     the onboarding branch from a missing field)
//
// Rationale: the FE ↔ BE ticket
// (`tickets/backend/BE_GOOGLE_OAUTH_LOGIN_TICKET.md`) documents booleans
// but in practice the BE may echo them as strings (URL params, JSON
// serialisation quirks, or `JsonStringEnumConverter`-style wrappers). A
// newly-registered Google user who never sees the onboarding page is
// almost always caused by this normalisation silently dropping the
// explicit signal — we therefore accept the well-known string forms
// (`"true"` / `"1"` / `"false"` / `"0"`) but NOT free-form words like
// `"yes"`, which preserves the original "explicit-only routing" invariant.
function coerceBooleanish(value: unknown): boolean {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1') return true;
    if (trimmed === 'false' || trimmed === '0') return false;
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value !== 0;
  }
  return false;
}

export function normaliseGoogleLoginResponse(
  data: unknown,
): NormalisedGoogleSession {
  const root = (data ?? {}) as Record<string, unknown>;
  // .NET convention — the BE may wrap the session payload under
  // `{ success, data }` / `{ result }` / `{ payload }`. Unwrap one level so
  // a wrapped response is normalised identically to a flat one. We only
  // descend when the wrapper object itself doesn't carry the routing
  // signals directly.
  let payloadRoot = root;
  for (const wrapperKey of ['data', 'result', 'payload'] as const) {
    const wrapped = root[wrapperKey];
    if (
      wrapped &&
      typeof wrapped === 'object' &&
      (wrapped as Record<string, unknown>).token !== undefined
    ) {
      payloadRoot = wrapped as Record<string, unknown>;
      break;
    }
  }
  const user = (payloadRoot.user ?? {}) as Record<string, unknown>;

  const pick = <T>(...candidates: Array<unknown>): T | null => {
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) continue;
      return candidate as T;
    }
    return null;
  };

  const token = pick<string | undefined>(
    payloadRoot.token,
    payloadRoot.accessToken,
    payloadRoot.jwt,
  );
  const email = pick<string | undefined>(
    payloadRoot.email,
    user.email,
  );
  const fullName = pick<string | undefined>(
    payloadRoot.fullName,
    user.fullName,
    payloadRoot.username,
    user.username,
  );
  const avatarUrl = pick<string | undefined>(
    payloadRoot.avatarUrl,
    payloadRoot.picture,
    user.avatarUrl,
    user.picture,
  );
  const userIdRaw = pick<number | undefined>(
    payloadRoot.userId,
    user.userId,
    user.id,
  );
  const userId =
    typeof userIdRaw === 'number' && Number.isFinite(userIdRaw) && userIdRaw > 0
      ? userIdRaw
      : null;

  const role = pick<string | undefined>(payloadRoot.role, payloadRoot.roleName, user.role, user.roleName);
  const nestedRoleObj = (user.role && typeof user.role === 'object' ? user.role : null) as
    | { id?: unknown }
    | null;
  const roleIdRaw = pick<number | undefined>(payloadRoot.roleId, user.roleId, nestedRoleObj?.id);
  const roleId =
    typeof roleIdRaw === 'number' && Number.isFinite(roleIdRaw) && roleIdRaw > 0
      ? roleIdRaw
      : null;

  const rolesRaw = Array.isArray(payloadRoot.roles)
    ? payloadRoot.roles
    : Array.isArray(payloadRoot.userRoles)
      ? payloadRoot.userRoles
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

  const isActiveRaw = pick<unknown>(payloadRoot.isActive, user.isActive);
  const isActive = typeof isActiveRaw === 'boolean' ? isActiveRaw : null;

  const verificationRaw = pick<string | undefined>(
    payloadRoot.verificationStatus,
    user.verificationStatus,
  );
  const verificationStatus: NormalisedGoogleSession['verificationStatus'] =
    verificationRaw === 'Accepted' || verificationRaw === 'Rejected'
      ? verificationRaw
      : verificationRaw === 'Pending'
        ? 'Pending'
        : null;

  const effectiveRoleRaw = pick<string | undefined>(
    payloadRoot.effectiveRole,
    user.effectiveRole,
  );
  const effectiveRole =
    typeof effectiveRoleRaw === 'string' && effectiveRoleRaw.length > 0
      ? effectiveRoleRaw
      : null;

  // The BE may or may not surface isNewUser / requiresOnboarding (Swagger
  // doesn't document them — see BTR-AGENT52-01). Coerce via the
  // truthy-string helper so the route logic sees a real boolean and a
  // first-time user whose flag was stringified by the BE (e.g. URL query
  // parsing or `JsonStringEnumConverter`) still routes to onboarding.
  // The wrapper-unwrap above means the field may live at the root, under
  // `data` / `result` / `payload`, or inside `user` — every position is
  // checked.
  const isNewUserRaw = pick<unknown>(payloadRoot.isNewUser, user.isNewUser);
  const requiresOnboardingRaw = pick<unknown>(
    payloadRoot.requiresOnboarding,
    user.requiresOnboarding,
  );
  const isNewUser = coerceBooleanish(isNewUserRaw);
  const requiresOnboarding = coerceBooleanish(requiresOnboardingRaw);

  // Dev-only: surface the raw + normalised routing signals so we can
  // diagnose "new user was not routed to onboarding" without rebuilding.
  // No token / email / credential is included — the signal of interest
  // is `isNewUser` / `requiresOnboarding` only.
  diagGoogleLoginResponse('normaliseGoogleLoginResponse', {
    rawSignals: {
      rootIsNewUser: root.isNewUser,
      rootRequiresOnboarding: root.requiresOnboarding,
      userIsNewUser: user.isNewUser,
      userRequiresOnboarding: user.requiresOnboarding,
    },
    normalised: {
      isNewUser,
      requiresOnboarding,
      isActive,
      verificationStatus,
      effectiveRole,
      userId,
      role: role ?? null,
      roleId,
    },
  });

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
    // Dev-only: surface the raw BE response BEFORE normalisation so a
    // missing / mis-shaped `isNewUser` signal is visible in the browser
    // console. We log only the routing-relevant keys (never the token /
    // email / credential). This pairs with the post-normalisation log
    // emitted by `normaliseGoogleLoginResponse` so we can see the exact
    // drop-off point when a first-time user is not routed to onboarding.
    diagGoogleLoginResponse('postGoogleLogin:rawResponse.data', {
      hasToken: typeof response?.data?.token === 'string',
      hasUserId: typeof response?.data?.userId === 'number',
      hasEmail: typeof response?.data?.email === 'string',
      rootIsNewUser: (response?.data as Record<string, unknown> | undefined)?.isNewUser,
      rootRequiresOnboarding: (response?.data as Record<string, unknown> | undefined)?.requiresOnboarding,
      userIsNewUser: ((response?.data as Record<string, unknown> | undefined)?.user as Record<string, unknown> | undefined)?.isNewUser,
      userRequiresOnboarding: ((response?.data as Record<string, unknown> | undefined)?.user as Record<string, unknown> | undefined)?.requiresOnboarding,
      verificationStatus: (response?.data as Record<string, unknown> | undefined)?.verificationStatus,
      isActive: (response?.data as Record<string, unknown> | undefined)?.isActive,
      role: (response?.data as Record<string, unknown> | undefined)?.role,
    });
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

// Agent 30 — payload for `POST /api/Auth/complete-google-registration`.
//
// Per `tickets/backend/BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md`
// (BE-GOOGLE-ONBOARDING-03) the BE contract is:
//
// The live schema requires the GIS credential, together with pdfUrl,
// phoneNumber, and role. The ARS JWT is also attached by the shared axios
// interceptor and the backend derives the account subject from it; no user ID
// is accepted from the frontend.
//
// Fields:
//   • required by the BE: credential, pdfUrl, phoneNumber, role
//   • not currently accepted by Swagger: orcidId and consents
//
// `additionalProperties: false` on the BE schema means any extra property
// returns 400. We omit `credential` / `code` / `redirect_uri` from the
// body — the BE either accepts the ARS session or rejects the request.
export interface CompleteGoogleRegistrationRequest {
  /** Google ID token (JWT) required by backend Swagger schema. */
  credential?: string;
  /** Verification PDF URL (Firebase Storage getDownloadURL). */
  pdfUrl: string;
  /** E.164-ish phone number (`+XX XXXXXXX`), required by the live schema. */
  phoneNumber: string;
  /** Requested business role name. */
  role: string;
  /** Required when role === 'Reviewer'. ISO 7064 MOD 11-2 checksum-validated. */
  orcidId?: string;
  /** Versioned legal-consent receipts (acceptedAt is server-stamped). */
  consents?: Array<{
    documentType: string;
    version: string;
    acceptedAt?: string;
  }>;
}

// Agent 30 — response shape. Swagger documents only the request body;
// the response is BE-defined. We accept a permissive shape but never
// fabricate fields the BE didn't echo.
export interface CompleteGoogleRegistrationResponse {
  userId?: number;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  roleId?: number | null;
  token?: string | null;
  isActive?: boolean | null;
  verificationStatus?: 'Pending' | 'Accepted' | 'Rejected' | null;
  effectiveRole?: string | null;
  requestStatus?: string | null;
  onboardingStatus?: string | null;
}

export class CompleteGoogleRegistrationError extends Error {
  readonly code:
    | 'NETWORK'
    | 'CONFLICT'
    | 'UNPROCESSABLE'
    | 'UNAUTHORIZED'
    | 'SERVER'
    | 'UNKNOWN';
  readonly status: number | null;
  constructor(
    code: CompleteGoogleRegistrationError['code'],
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = 'CompleteGoogleRegistrationError';
    this.code = code;
    this.status = status;
  }
}

/**
 * POST the verified PDF URL + role + (Reviewer) ORCID + credential to the documented
 * onboarding-completion endpoint.
 */
export async function postCompleteGoogleRegistration({
  payload,
  idempotencyKey,
}: {
  payload: CompleteGoogleRegistrationRequest;
  idempotencyKey?: string;
}): Promise<CompleteGoogleRegistrationResponse> {
  if (!payload || typeof payload !== 'object') {
    throw new CompleteGoogleRegistrationError(
      'UNPROCESSABLE',
      'Onboarding payload is missing. Please retry from the registration page.',
      null,
    );
  }
  if (!payload.pdfUrl || !payload.pdfUrl.startsWith('http')) {
    throw new CompleteGoogleRegistrationError(
      'UNPROCESSABLE',
      'A verification PDF must be uploaded before submitting.',
      null,
    );
  }
  if (!payload.role) {
    throw new CompleteGoogleRegistrationError(
      'UNPROCESSABLE',
      'Please choose a platform role before submitting.',
      null,
    );
  }
  if (payload.role === 'Reviewer' && !payload.orcidId) {
    throw new CompleteGoogleRegistrationError(
      'UNPROCESSABLE',
      'Reviewer onboarding requires a valid ORCID iD.',
      null,
    );
  }

  const credential =
    payload.credential ||
    (typeof window !== 'undefined'
      ? sessionStorage.getItem('ars_google_credential') || ''
      : '');

  const body: Record<string, unknown> = {
    credential,
    pdfUrl: payload.pdfUrl,
    phoneNumber: payload.phoneNumber ?? '',
    role: payload.role,
  };
  // The live CompleteGoogleRegistrationRequest has additionalProperties:false
  // and currently accepts only credential, pdfUrl, phoneNumber, and role.
  // ORCID and consent persistence remains tracked in
  // tickets/backend/BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md; sending those
  // fields today would make the production request fail validation.

  try {
    const response = await api.post(
      API_ENDPOINTS.AUTH.COMPLETE_GOOGLE_REGISTRATION,
      body,
      {
        headers: {
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
      },
    );
    const data = (response.data ?? {}) as Record<string, unknown>;
    const userIdValue =
      typeof data.userId === 'number'
        ? data.userId
        : typeof data.id === 'number'
          ? data.id
          : undefined;
    return {
      userId: userIdValue,
      email: typeof data.email === 'string' ? data.email : null,
      fullName:
        typeof data.fullName === 'string'
          ? data.fullName
          : typeof data.username === 'string'
            ? data.username
            : null,
      role: typeof data.role === 'string' ? data.role : null,
      roleId:
        typeof data.roleId === 'number'
          ? data.roleId
          : null,
      token: typeof data.token === 'string' ? data.token : null,
      isActive:
        typeof data.isActive === 'boolean' ? data.isActive : null,
      verificationStatus:
        data.verificationStatus === 'Accepted' ||
        data.verificationStatus === 'Rejected' ||
        data.verificationStatus === 'Pending'
          ? data.verificationStatus
          : null,
      effectiveRole:
        typeof data.effectiveRole === 'string' ? data.effectiveRole : null,
      requestStatus:
        typeof data.requestStatus === 'string' ? data.requestStatus : null,
      onboardingStatus:
        typeof data.onboardingStatus === 'string'
          ? data.onboardingStatus
          : null,
    };
  } catch (err: unknown) {
    const status =
      typeof (err as { response?: { status?: number } })?.response?.status ===
      'number'
        ? (err as { response: { status: number } }).response.status
        : null;

    if (status === null) {
      throw new CompleteGoogleRegistrationError(
        'NETWORK',
        'Network error reaching the platform. Please check your connection and try again.',
        null,
      );
    }
    if (status === 401 || status === 403) {
      throw new CompleteGoogleRegistrationError(
        'UNAUTHORIZED',
        'Your Google session is no longer valid. Please sign in again.',
        status,
      );
    }
    if (status === 409) {
      throw new CompleteGoogleRegistrationError(
        'CONFLICT',
        'You already have a pending or completed onboarding request. The platform will not accept a duplicate.',
        status,
      );
    }
    if (status === 422 || status === 400) {
      throw new CompleteGoogleRegistrationError(
        'UNPROCESSABLE',
        'Some fields could not be processed. Please review your input and try again.',
        status,
      );
    }
    if (status >= 500) {
      throw new CompleteGoogleRegistrationError(
        'SERVER',
        'Our onboarding service is temporarily unavailable. Please try again in a moment.',
        status,
      );
    }
    throw new CompleteGoogleRegistrationError(
      'UNKNOWN',
      'Onboarding submission failed for an unexpected reason. Please try again.',
      status,
    );
  }
}

export const googleAuthService = {
  /**
   * Submit a Google credential. The Login button (and any future GIS surface)
   * call this with the `credential` string from GIS, and receive a normalised
   * session object containing the BE-derived routing signals.
   */
  postGoogleLogin,

  /**
   * Agent 30 — submit the first-time Google onboarding completion payload
   * to the documented BE endpoint.
   */
  postCompleteGoogleRegistration,

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
