// Agent 30 (regression) — shared remount-safe in-flight Google-login
// promise guard, keyed by the Google `credential` token.
//
// Why this exists:
//   GIS can fire the credential callback more than once for the same
//   session (StrictMode double-invoke, button re-renders, race between
//   the Login and Register pages, browser back/forward, network jitter
//   on the GSI render). Each fire would otherwise POST
//   `/api/Auth/google-login` again with the same credential, producing
//   duplicate BE exchanges and a race between two navigations.
//
// The contract enforced here:
//   1. Exactly ONE POST per credential. Concurrent callers for the same
//      credential receive the SAME resolved `NormalisedGoogleSession`
//      and the same downstream routing decision.
//   2. The guard is keyed by `credential` (the opaque Google ID token),
//      so a fresh sign-in from the same user (different credential after
//      consent) produces a fresh exchange.
//   3. The guard is module-scoped — React remounts, StrictMode
//      double-invokes, and parallel component trees all share the same
//      inflight map. It survives across mount cycles within the page
//      lifetime; we clear entries when they settle (success OR error) so
//      a retry after a failure re-enters the BE.
//   4. We never log the credential. Keys are hashed before they appear
//      in any diagnostic log so a network trace or `console.info` cannot
//      leak the token.
//
// Call sites:
//   - `AuthContext.loginWithGoogle` (the central GIS entry point used
//     by both Login and Register pages) wraps `googleAuthService.postGoogleLogin`
//     with `acquireGoogleLoginSession` so two concurrent callers share
//     one POST and one routing decision.
//   - The Login / Register page handlers also keep their own per-component
//     ref guard so the GIS button cannot queue a second submit; this
//     utility is the second line of defence.

import type { NormalisedGoogleSession } from '../types/googleAuth';

type Pending = {
  promise: Promise<NormalisedGoogleSession>;
  // We do NOT store the credential itself anywhere; we store a short
  // fingerprint that is safe to log if a future diagnostic needs it.
  credentialFingerprint: string;
  // Number of callers waiting on the same exchange — useful for the
  // "one request, two callbacks" regression test.
  waiters: number;
};

const inflight = new Map<string, Pending>();

// Cheap, non-cryptographic fingerprint used for diagnostic logs only.
// We never log the credential itself; only this short fingerprint.
function fingerprintCredential(credential: string): string {
  // 6-char hash of the credential length + first 8 chars + last 4 chars
  // — enough to distinguish two credentials in logs while never leaking
  // enough to reconstruct the token.
  const head = credential.slice(0, 8);
  const tail = credential.slice(-4);
  return `len${credential.length}-${head}...${tail}`;
}

/**
 * Execute (or join) the in-flight Google-login POST for the supplied
 * credential.
 *
 *   - The first caller for a given credential triggers the POST.
 *   - Subsequent callers within the same window receive the same
 *     `NormalisedGoogleSession` and the same settlement (success OR
 *     error). The POST runs exactly once.
 *   - After the POST settles (success or error) the slot is removed so
 *     a retry after a transient failure re-enters the BE.
 *
 * @param credential   the opaque Google ID token (GIS
 *                     `CredentialResponse.credential`).
 * @param initExchange factory that performs the actual
 *                     `POST /api/Auth/google-login` call. The factory
 *                     is invoked EXACTLY once per credential.
 */
export async function acquireGoogleLoginSession(
  credential: string,
  initExchange: () => Promise<NormalisedGoogleSession>,
): Promise<NormalisedGoogleSession> {
  if (typeof credential !== 'string' || credential.length === 0) {
    // Defensive — call sites already validate the credential, but a
    // future re-entry path could miss this. Surface the error loudly
    // rather than silently swallowing it.
    throw new Error(
      'acquireGoogleLoginSession called without a credential. The GIS callback should never reach here.',
    );
  }

  const existing = inflight.get(credential);
  if (existing) {
    existing.waiters += 1;
    return existing.promise;
  }

  const pending: Pending = {
    promise: Promise.resolve()
      .then(() => initExchange())
      .finally(() => {
        // Remove the slot on settlement (success OR failure) so a retry
        // — e.g. after the BE returns 5xx — re-enters the BE cleanly.
        inflight.delete(credential);
      }),
    credentialFingerprint: fingerprintCredential(credential),
    waiters: 1,
  };
  inflight.set(credential, pending);
  return pending.promise;
}

/**
 * Test-only diagnostic — returns the current count of in-flight
 * Google-login exchanges. Tests use this to assert "exactly one POST"
 * after firing the GIS callback twice for the same credential.
 */
export function getGoogleLoginInflightCount(): number {
  return inflight.size;
}

/**
 * Read-only flag: returns `true` while at least one Google-login
 * exchange is in flight. UI surfaces use this to disable their
 * buttons / show a spinner so the user cannot queue a second GIS
 * click during the in-flight window.
 *
 * This is intentionally read-only — production code must NOT mutate
 * the in-flight map directly. The slot lifecycle is owned by
 * `acquireGoogleLoginSession`.
 */
export function isGoogleLoginInFlight(): boolean {
  return inflight.size > 0;
}

/**
 * Test-only — returns the total number of concurrent waiters for the
 * given credential fingerprint. The fingerprint is the same opaque
 * digest used in `acquireGoogleLoginSession`'s diagnostic logs.
 */
export function _getGoogleLoginWaiters(
  credentialFingerprint: string,
): number {
  for (const pending of inflight.values()) {
    if (pending.credentialFingerprint === credentialFingerprint) {
      return pending.waiters;
    }
  }
  return 0;
}

/**
 * Test-only — clears the in-flight map. Production code MUST NOT call
 * this. We expose it so unit tests can reset state between cases
 * without leaking slots across runs.
 */
export function _resetGoogleLoginGuardForTesting(): void {
  inflight.clear();
}

export default acquireGoogleLoginSession;