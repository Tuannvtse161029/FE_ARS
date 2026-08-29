// Agent 54 — Backend-driven Google OAuth (Authorization Code flow).
//
// The new BE contract exposes two GET endpoints instead of the old GIS
// credential swap (POST /api/Auth/google-login):
//
//   - GET /api/Auth/google-oauth-login
//       Browser navigation. The BE initiates the Google OAuth handshake
//       and responds with `302 Location: https://accounts.google.com/...`.
//       No request body, no query params, no auth header.
//
//   - GET /api/Auth/google-callback?code=...&error=...
//       Browser navigation. Google redirects the user here after consent.
//       `code` carries the authorization code (single-use, BE-swaps it for
//       an ARS JWT). `error=access_denied` (or similar) on cancellation.
//
// Hard rules implemented here:
//   1. The OAuth `code` is treated as opaque. We never log it, never store
//      it after dispatch, and never echo it back into the address bar
//      after the callback page has consumed it. Refreshing the callback
//      URL a second time therefore re-issues a clean OAuth flow rather
//      than replaying the same `code` (which Google would reject anyway).
//   2. We never PUT the ARS bearer token, the BE JWT, or the Google
//      `code` into localStorage / sessionStorage. The callback page
//      reads the `code` from the URL, hands it to this service, and the
//      service is responsible for NOT stashing it.
//   3. In-flight dedup: the Login page holds a ref + state lock around
//      `beginGoogleOAuth`. We ALSO refuse to dispatch a second redirect
//      while one is in flight — the FE `<a>` would otherwise race against
//      itself on rapid double-clicks.
//   4. We do NOT call the old `POST /api/auth/google-login` any more.
//      The legacy GIS credential flow (idToken swap) is no longer the
//      primary path because the BE has moved to a server-issued redirect.
//   5. We do NOT invent response shapes. The BE's callback URL may end
//      up returning JSON OR a redirect; the callback page decides which
//      shape it got by checking for `{ error }` vs `{ token, userId, ... }`
//      and never assumes a single contract.

import { API_BASE_URL, API_ENDPOINTS } from '../utils/constants';

export type GoogleOAuthErrorCode =
  | 'NETWORK'
  | 'NO_CLIENT_ID' // App URL not configured for OAuth redirect target
  | 'BAD_REDIRECT_TARGET' // Computed callback URL was unparseable
  | 'DUPLICATE_REQUEST'
  | 'UNKNOWN';

export class GoogleOAuthError extends Error {
  readonly code: GoogleOAuthErrorCode;
  constructor(code: GoogleOAuthErrorCode, message: string) {
    super(message);
    this.name = 'GoogleOAuthError';
    this.code = code;
  }
}

/**
 * Shape of the parsed BE callback payload.
 *
 * The new BE endpoint only documents `200 OK` (no schema) in Swagger.
 * To remain defensive we accept either an inline JSON body OR a relative
 * redirect path containing the same fields. The `token` is the ARS JWT;
 * `userId`, `email`, `fullName`, `role`, `roleId`, `isActive`,
 * `verificationStatus`, `effectiveRole`, `isNewUser`, `requiresOnboarding`
 * mirror the same fields the password-login payload uses.
 *
 * Any field we did not see is null — we never invent.
 */
export interface GoogleOAuthCallbackPayload {
  token: string | null;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  userId: number | null;
  role: string | null;
  roleId: number | null;
  roles: string[];
  isActive: boolean | null;
  verificationStatus: 'Pending' | 'Accepted' | 'Rejected' | null;
  effectiveRole: string | null;
  /** First-time-user signals surfaced by the BE (may be absent on older payloads). */
  isNewUser: boolean;
  requiresOnboarding: boolean;
  /** Optional rejection reason surfaced by the callback URL itself. */
  errorCode?: string | null;
  errorReason?: string | null;
}

function pickString(...candidates: Array<unknown>): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate;
  }
  return null;
}

function pickNumber(...candidates: Array<unknown>): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return null;
}

function pickBoolean(...candidates: Array<unknown>): boolean {
  for (const candidate of candidates) {
    if (candidate === true) return true;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim().toLowerCase();
      if (trimmed === 'true' || trimmed === '1') return true;
    }
  }
  return false;
}

/**
 * Normalise a Google OAuth callback payload (could be JSON, could be a
 * flat object from query-string parsing) into the canonical shape that
 * the rest of the FE consumes (same shape as
 * `NormalisedGoogleSession` from `googleAuth.service.ts`).
 */
export function normaliseGoogleOAuthCallback(
  data: Record<string, unknown> | null | undefined,
): GoogleOAuthCallbackPayload {
  const root = (data ?? {}) as Record<string, unknown>;
  const user = (root.user ?? {}) as Record<string, unknown>;

  const roles: string[] = [];
  const candidates = [
    root.roles,
    root.userRoles,
    user.roles,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (typeof item === 'string') {
          roles.push(item);
        } else if (item && typeof item === 'object') {
          const obj = item as { name?: unknown; roleName?: unknown; role?: unknown };
          const value = obj.name ?? obj.roleName ?? obj.role;
          if (typeof value === 'string') roles.push(value);
        }
      }
    }
  }

  const verificationRaw = pickString(root.verificationStatus, user.verificationStatus);
  const verificationStatus: GoogleOAuthCallbackPayload['verificationStatus'] =
    verificationRaw === 'Accepted' || verificationRaw === 'Rejected'
      ? verificationRaw
      : verificationRaw === 'Pending'
        ? 'Pending'
        : null;

  const isActiveRaw = root.isActive ?? user.isActive;
  const isActive: GoogleOAuthCallbackPayload['isActive'] =
    typeof isActiveRaw === 'boolean'
      ? isActiveRaw
      : typeof isActiveRaw === 'string' && /^(true|1)$/i.test(isActiveRaw.trim())
        ? true
        : typeof isActiveRaw === 'string' && /^(false|0)$/i.test(isActiveRaw.trim())
          ? false
          : null;

  return {
    token: pickString(root.token, root.accessToken, root.jwt),
    email: pickString(root.email, user.email),
    fullName: pickString(root.fullName, root.username, user.fullName, user.username),
    avatarUrl: pickString(root.avatarUrl, root.picture, user.avatarUrl, user.picture),
    userId: pickNumber(root.userId, user.userId, user.id),
    role: pickString(root.role, root.roleName, user.role, user.roleName),
    roleId: pickNumber(root.roleId, user.roleId),
    roles: Array.from(new Set(roles)),
    isActive,
    verificationStatus,
    effectiveRole: pickString(root.effectiveRole, user.effectiveRole),
    isNewUser: pickBoolean(root.isNewUser, user.isNewUser),
    requiresOnboarding: pickBoolean(root.requiresOnboarding, user.requiresOnboarding),
    errorCode: pickString(root.errorCode, root.error, user.errorCode),
    errorReason: pickString(
      root.errorReason,
      root.errorDescription,
      root.error_description,
      user.errorReason,
    ),
  };
}

/**
 * Compute the absolute URL the FE should hand to `window.location.assign`
 * to begin the BE OAuth handshake.
 *
 * The BE endpoint takes no parameters. We append `?redirect_uri=...` as
 * a courtesy so the BE can match against its configured allow-list of
 * client origins — the BE is free to ignore it, in which case the
 * Google OAuth flow will simply use whatever URI the BE has hard-coded.
 *
 * The `redirect_uri` is the FE callback page (`/auth/google/callback`).
 * It must be an absolute URL because Google's authorization endpoint
 * requires it (and because the BE may forward it on to Google).
 */
export function buildGoogleOAuthLoginUrl(redirectUri?: string | null): string {
  // `API_BASE_URL` already provides the BE base.
  let base = API_BASE_URL.replace(/\/+$/, '');
  const path = API_ENDPOINTS.AUTH.GOOGLE_OAUTH_LOGIN;
  let url = `${base}${path}`;
  if (redirectUri && typeof redirectUri === 'string' && redirectUri.trim() !== '') {
    const trimmed = redirectUri.trim();
    // The BE callback URL on Render was reporting `redirect_uri_mismatch`
    // for the live deploy; we use the FE's APP_URL as the registered
    // callback origin and let the FE callback page handle the absolute
    // sub-path. APP_URL falls back to localhost:3000 if VITE_APP_URL is
    // unset — the dev backend already approves that.
    url = `${url}?redirect_uri=${encodeURIComponent(trimmed)}`;
  }
  return url;
}

/**
 * Parse a relative path or absolute URL that the callback returned into a
 * canonical payload.
 *
 * Accepts three shapes:
 *   - `/auth/google/callback?code=...`          (relative, in-page navigation)
 *   - `https://.../auth/google/callback?code=...` (absolute)
 *   - `window.location.search`-style flat params (code/error)
 */
export function parseCallbackLocation(href: string): {
  code: string | null;
  error: string | null;
  errorReason: string | null;
} {
  if (!href || typeof href !== 'string') {
    return { code: null, error: null, errorReason: null };
  }
  let search = '';
  const qIndex = href.indexOf('?');
  const hIndex = href.indexOf('#');
  if (qIndex !== -1) {
    // Take the query portion that comes BEFORE the hash so we ignore
    // fragment-only redirects (hash carries nothing actionable here).
    search = href.slice(qIndex + 1, hIndex === -1 ? undefined : hIndex);
  } else if (hIndex !== -1) {
    search = href.slice(hIndex + 1);
  }
  // The BE may also redirect with the payload in a hash for SPA safety;
  // we accept both.
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return { code: null, error: null, errorReason: null };
  }
  return {
    code: params.get('code'),
    error: params.get('error'),
    errorReason: params.get('error_reason') ?? params.get('error_description'),
  };
}

/**
 * Force-build the callback payload the rest of the FE consumes from the
 * raw query-string portion of `window.location.search`.
 *
 * Used by the callback page when the BE does not echo any JSON body (most
 * likely case — Swagger documents only a 200 OK without schema).
 *
 * Per the spec: never invent fields we did not see. We only mark a token
 * present if the query-string contains one. If the BE encoded the session
 * another way (e.g. set a cookie), we surface `null` tokens so the page
 * can fall back to a `GET /api/user/{id}` lookup or show a clear error.
 */
export function payloadFromLocationSearch(search: string): GoogleOAuthCallbackPayload {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  } catch {
    params = new URLSearchParams();
  }
  const obj: Record<string, unknown> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  // Google's OAuth spec uses snake_case keys for the auth-code response
  // (`error_reason`, `error_description`). Normalise the two most common
  // ones into the camelCase fields the rest of the FE consumes so the
  // page surfaces a useful error message even if the BE doesn't translate
  // them upstream.
  if (typeof obj.error_reason === 'string' && !obj.errorReason) {
    obj.errorReason = obj.error_reason;
  }
  if (typeof obj.error_description === 'string' && !obj.errorDescription) {
    obj.errorDescription = obj.error_description;
  }
  return normaliseGoogleOAuthCallback(obj);
}

/**
 * Module-level guard so two concurrent callers cannot both navigate the
 * browser away. The Login page's ref + state still back this up, but a
 * second source-of-truth helps tests assert the contract and prevents a
 * misconfigured product surface from double-firing the redirect.
 */
let inFlightRef = false;

export function isGoogleOAuthRedirectInFlight(): boolean {
  return inFlightRef;
}

/**
 * Reset the in-flight flag. Used by the callback page after it consumes
 * the redirect (success or failure). Tests also call this to clean up.
 */
export function _resetGoogleOAuthInFlightForTesting(): void {
  inFlightRef = false;
}

/**
 * Begin the BE OAuth flow.
 *
 * Implementation note: the BE contract is `GET /api/Auth/google-oauth-login`
 * which returns a 302 redirect to Google's authorization endpoint. The
 * simplest cross-browser way to follow that redirect is `window.location.assign`
 * (NOT `window.open`, because OAuth callbacks need the same browsing
 * context to land on the callback page and seed cookies / state).
 *
 * Passing `redirectUri` overrides the FE's APP_URL fallback. The Login
 * page builds the callback URL using `window.location.origin + GoogleOAuthCallbackRoute`.
 */
export async function beginGoogleOAuth(opts?: {
  redirectUri?: string | null;
}): Promise<void> {
  if (inFlightRef) {
    throw new GoogleOAuthError(
      'DUPLICATE_REQUEST',
      'Google sign-in is already in progress. Please wait for it to complete.',
    );
  }
  inFlightRef = true;
  try {
    const url = buildGoogleOAuthLoginUrl(opts?.redirectUri);
    // `window.location.assign` is synchronous in intent but the call may
    // throw if the URL is invalid (e.g. parse error). We wrap it so the
    // caller sees a typed error rather than a generic DOMException.
    window.location.assign(url);
  } catch (err: unknown) {
    inFlightRef = false;
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Could not start the Google sign-in flow. Please try again.';
    // Differentiate NETWORK vs BAD_REDIRECT_TARGET vs UNKNOWN by sniffing
    // the underlying exception type. We deliberately do NOT log the URL
    // (it carries only FE origin + pathname + the BE pathname — no
    // secrets).
    if (err instanceof Error && /Invalid URL|URL constructor/i.test(err.message)) {
      throw new GoogleOAuthError('BAD_REDIRECT_TARGET', message);
    }
    throw new GoogleOAuthError('UNKNOWN', message);
  }
}

export const googleOAuthService = {
  beginGoogleOAuth,
  buildGoogleOAuthLoginUrl,
  parseCallbackLocation,
  payloadFromLocationSearch,
  normaliseGoogleOAuthCallback,
  isGoogleOAuthRedirectInFlight,
  _resetGoogleOAuthInFlightForTesting,
};

export default googleOAuthService;
