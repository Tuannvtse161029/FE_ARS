// Additive email-verification service — Agent email-verification.
//
// Background:
//   The ARS backend exposes exactly two Auth-tagged email endpoints in the
//   live OpenAPI spec:
//     • POST /api/Auth/verify-email?token=...
//     • POST /api/Auth/send-approval-email?email=...
//   The FE has to land users on a `verify-email` deep link (the link in
//   the registration email) and forward the opaque `token` query param
//   to the BE. This module is the single surface that owns that flow —
//   it does NOT generate, predict, or store OTPs, it does NOT hardcode
//   recipients, and it does NOT call /api/Email/send-test. It ONLY uses
//   the supported `verifyEmail` query endpoint, plus the (auth-protected)
//   admin-side `sendApprovalEmail`.
//
// Public surface (kept intentionally tiny):
//   - `verifyEmailToken(token)`                POST /api/Auth/verify-email
//   - `requestApprovalEmail(payload)`          POST /api/Auth/send-approval-email
//   - `isVerifyEmailToken(value)`              local format guard
//
// Conventions match `auth.service.ts`:
//   - Shared axios instance from './axios'.
//   - Endpoints read from `API_ENDPOINTS.AUTH.VERIFY_EMAIL` and
//     `API_ENDPOINTS.AUTH.SEND_APPROVAL_EMAIL` so the constant change
//     propagates here automatically.
//   - Errors propagate unchanged so the calling surface can map them
//     through the existing `extractServerMessage` helper.

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

export interface VerifyEmailResult {
  /** True when the BE accepted the token (HTTP 200/204). */
  success: boolean;
}

export interface RequestApprovalEmailPayload {
  email: string;
}

export interface RequestApprovalEmailResult {
  success: boolean;
}

/**
 * Local-only format guard for the verification token extracted from the
 * query string. The BE accepts any opaque token, but the FE should still
 * reject obvious garbage (empty, whitespace, excessively long) before
 * spending a round-trip.
 *
 * The token format is intentionally permissive — the BE is the source of
 * truth. We only reject clearly malformed input (empty / oversize / control
 * chars) so a malformed URL never reaches the network.
 */
export function isVerifyEmailToken(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  // The longest token we have seen in the wild is ~256 chars (HMAC-signed
  // base64url). Allow some headroom for future format changes.
  if (trimmed.length > 1024) return false;
  // Reject control chars / whitespace — query strings should never carry them.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\s]/.test(trimmed)) return false;
  return true;
}

/**
 * Forward the opaque verification token from the registration-email deep
 * link to `POST /api/Auth/verify-email?token=...`.
 *
 * The BE returns 200 on success and 400 on a malformed/expired token. We
 * wrap that into a `{ success }` shape so callers can branch cleanly
 * without inspecting the HTTP status.
 *
 * Anti-patterns explicitly avoided:
 *   - NEVER call `/api/Email/send-test`. This method does NOT send any
 *     email itself; it only consumes a token that was already issued by
 *     the BE.
 *   - NEVER store the OTP/token in `localStorage` or `sessionStorage`.
 *     The deep-link page passes the token directly to this call and then
 *     drops it.
 *   - NEVER predict or rotate the token client-side.
 */
export async function verifyEmailToken(
  token: string,
): Promise<VerifyEmailResult> {
  if (!isVerifyEmailToken(token)) {
    throw new Error('Invalid verification token');
  }
  // Auth headers ARE attached automatically by the axios interceptor in
  // `services/axios.ts` when a session token is present. The endpoint
  // also accepts anonymous calls (the email-link recipient may not be
  // logged in yet), so we do not require a token here.
  await api.post(
    API_ENDPOINTS.AUTH.VERIFY_EMAIL,
    null,
    { params: { token } },
  );
  return { success: true };
}

/**
 * Re-trigger the admin approval email for the supplied recipient. The
 * endpoint lives at `POST /api/Auth/send-approval-email?email=...` and
 * requires authentication — the shared axios interceptor will pick up
 * the Bearer token automatically.
 *
 * This is an additive wrapper around the existing
 * `authService.sendApprovalEmail` so future modules can import a single
 * email-verification surface without re-wiring the axios instance.
 *
 * Anti-patterns explicitly avoided:
 *   - NEVER hardcode a development recipient — the caller MUST supply the
 *     email explicitly.
 *   - NEVER call `/api/Email/send-test`.
 */
export async function requestApprovalEmail(
  payload: RequestApprovalEmailPayload,
): Promise<RequestApprovalEmailResult> {
  const email = (payload?.email ?? '').trim();
  if (email.length === 0) {
    throw new Error('Email is required');
  }
  await api.post(
    API_ENDPOINTS.AUTH.SEND_APPROVAL_EMAIL,
    null,
    { params: { email } },
  );
  return { success: true };
}

export const emailVerificationService = {
  verifyEmailToken,
  requestApprovalEmail,
  isVerifyEmailToken,
};

export default emailVerificationService;
