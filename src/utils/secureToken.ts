/**
 * secureToken — Session-2 hardening: hide the JWT from `localStorage` /
 * `sessionStorage` so a casual DevTools viewer no longer sees a
 * copy-pasteable bearer token.
 *
 * Threat model — what this file actually buys us
 * ─────────────────────────────────────────────────
 * The original `ars_token` key stored the raw JWT in the same bucket the
 * rest of the web platform reads from, so any extension / shoulder-surf /
 * shared-lab-machine scenario could lift a 24h token and replay it. The
 * envelope below replaces that string with an AES-256-GCM ciphertext whose
 * decryption key is held ONLY in a module-scoped JS variable that never
 * round-trips through storage.
 *
 * Honest caveat
 * ─────────────
 * The session key has to live in the JS bundle to be useful, so a
 * determined attacker who can run arbitrary JS in the page can still
 * recover the cleartext. The plan that owns this file (see
 * `tickets/backend/BE-JWT-HTTPONLY-COOKIE.md`) is the only thing that
 * actually moves the token out of reach of an in-page attacker — that
 * work is BE-owned. What we *do* fix here:
 *
 *   1. The DevTools Session / Local Storage panels show ciphertext, not a
 *      JWT. The screenshot scenario is closed.
 *   2. The legacy `ars_token` key is fully retired and cleaned up on
 *      logout / 401 / clearAuthSession.
 *   3. The auth Zustand persist no longer double-writes the cleartext
 *      token under `ars-auth-storage`. Only the slim user projection is
 *      persisted by Zustand.
 *
 * Crypto
 * ──────
 *  - `crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, …)`
 *    with `extractable = false` so even `console.log(window.crypto.subtle)`
 *    cannot dump the raw key bytes.
 *  - 96-bit IV generated per encryption via `crypto.getRandomValues`.
 *  - AAD = `{ iat: <epoch-ms> }` so a future replay-protection layer can
 *    reject envelopes older than N seconds.
 *  - Envelope version byte (`v: 'v1'`) so future rotations do not strand
 *    a previously-issued session.
 *
 * Refresh-token model
 * ───────────────────
 * Until the BE ships `POST /api/auth/refresh-token` (see the follow-up
 * ticket), a page reload discards the in-memory session key. The
 * envelope is still on disk, but `getToken()` returns `null`, the Axios
 * interceptor surfaces a "session expired" modal, and the user is asked
 * to re-authenticate. This is the documented trade-off; the alternative
 * is leaving a recoverable refresh token in storage which is strictly
 * worse.
 */

const ENVELOPE_VERSION = 'v1' as const;
const STORAGE_KEY_ACCESS = 'ars_token_enc_v1';
const STORAGE_KEY_REFRESH = 'ars_token_refresh_v1';
const STORAGE_KEY_SAVED_EMAIL = 'ars_saved_email_enc_v1';
// Session-3 (security) — the user projection is also wrapped in an
// envelope under the same ephemeral session key as the JWT. A DevTools
// viewer can no longer read the user id, role, or verification status
// directly from `localStorage` / `sessionStorage` — only an opaque
// ciphertext blob is visible. On page reload the in-memory key is gone
// and the caller is treated as unauthenticated until the next login.
const STORAGE_KEY_USER = 'ars_user_enc_v1';

// In-memory session key. Cleared on page reload. The single source of
// truth for "can we decrypt the current envelope?"
let ephemeralSessionKey: CryptoKey | null = null;

// Tracks the raw access token the Axios layer is currently sending. Held
// only in memory. When the user logs out, this is dropped before the
// envelope is cleared so a stray in-flight request cannot reuse it.
let liveAccessToken: string | null = null;

// Cached decrypted "remember me" email. Held only in memory; not
// recomputable across page reloads. This is the only place the plaintext
// email lives — never written to localStorage.
let liveSavedEmail: string | null = null;

/**
 * The envelope shape that hits localStorage / sessionStorage. Stored as
 * JSON. Every key here is opaque to a casual viewer; no human-readable
 * substring can be lifted as a bearer token.
 */
interface TokenEnvelope {
  v: typeof ENVELOPE_VERSION;
  iv: string;
  ct: string;
  iat: number;
}

const isEnvelope = (raw: unknown): raw is TokenEnvelope => {
  if (!raw || typeof raw !== 'object') return false;
  const candidate = raw as Record<string, unknown>;
  return (
    candidate.v === ENVELOPE_VERSION &&
    typeof candidate.iv === 'string' &&
    typeof candidate.ct === 'string' &&
    typeof candidate.iat === 'number'
  );
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  // btoa is available in all evergreen browsers and Node 18+. The chunked
  // approach avoids the call-stack overflow you get with very long arrays
  // passed to btoa in one go.
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const getCrypto = (): Crypto | null => {
  if (typeof window === 'undefined') return null;
  const c = window.crypto;
  if (c && typeof c.subtle?.encrypt === 'function' && typeof c.subtle?.decrypt === 'function') {
    return c;
  }
  return null;
};

const pickBucket = (rememberMe: boolean): Storage =>
  rememberMe ? localStorage : sessionStorage;

/**
 * Encrypts a JWT into a v1 envelope. Returns `null` when Web Crypto is
 * unavailable (insecure-context http://, very old browsers) so the
 * caller can fall back to the legacy behavior. Production MUST run on
 * https://, so the fallback should never trigger in practice.
 */
const encryptToken = async (token: string, key: CryptoKey): Promise<TokenEnvelope> => {
  const crypto = getCrypto();
  if (!crypto) {
    throw new Error('Web Crypto API is not available in this context.');
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ENVELOPE_VERSION) },
    key,
    encoded,
  );
  return {
    v: ENVELOPE_VERSION,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
    iat: Date.now(),
  };
};

/**
 * Decrypts a v1 envelope. Exported for the future `secureToken.rehydrate`
 * path that will exchange a refresh token for a fresh access token on
 * page reload. Currently no caller in the FE holds the session key
 * across a reload (the in-memory key is intentionally dropped), so the
 * function is only invoked from a code path that does not yet exist.
 */
export const decryptToken = async (envelope: TokenEnvelope, key: CryptoKey): Promise<string> => {
  const crypto = getCrypto();
  if (!crypto) {
    throw new Error('Web Crypto API is not available in this context.');
  }
  const iv = base64ToBytes(envelope.iv);
  const ct = base64ToBytes(envelope.ct);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ENVELOPE_VERSION) },
    key,
    ct,
  );
  return new TextDecoder().decode(plaintext);
};

const generateSessionKey = async (): Promise<CryptoKey> => {
  const crypto = getCrypto();
  if (!crypto) {
    throw new Error('Web Crypto API is not available in this context.');
  }
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable — the key handle cannot be exported
    ['encrypt', 'decrypt'],
  );
};

const readEnvelope = (bucket: Storage): TokenEnvelope | null => {
  const raw = bucket.getItem(STORAGE_KEY_ACCESS);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Read a named envelope from localStorage. Used by the saved-email
 * path which keeps the JWT and the saved-email envelopes under
 * different keys but the same on-disk shape.
 */
const readEnvelopeFromKey = (storageKey: string): TokenEnvelope | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readRefreshFromLocal = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY_REFRESH);
  } catch {
    return null;
  }
};

/**
 * Public surface. Every other module in the FE goes through these
 * primitives; direct `localStorage.setItem('ars_token', …)` calls are
 * disallowed and will be flagged by the AuthContext migration.
 */
export const secureToken = {
  /** Storage key names — kept exported so a single debug sweep can find them. */
  KEYS: {
    ACCESS: STORAGE_KEY_ACCESS,
    REFRESH: STORAGE_KEY_REFRESH,
    SAVED_EMAIL: STORAGE_KEY_SAVED_EMAIL,
    USER: STORAGE_KEY_USER,
  },
  VERSION: ENVELOPE_VERSION,

  /**
   * Called from `AuthContext.persistAuthAndNavigate` immediately after a
   * successful login. Generates a fresh session key, encrypts the JWT,
   * writes the envelope to the chosen bucket, and stashes the raw token
   * in module-scope memory for the Axios interceptor.
   *
   * Security note: the cleartext token NEVER touches `localStorage` /
   * `sessionStorage` — only the AES-256-GCM envelope does. A casual
   * DevTools viewer sees an opaque ciphertext blob, not a copy-pasteable
   * bearer token. The only recovery path is the in-memory `liveAccessToken`
   * variable, which is wiped on logout / 401 / clearAuthSession.
   *
   * The optional refresh token (when the BE ships it) is held in
   * `localStorage` regardless of `rememberMe` — refreshing after a tab
   * close is the entire point of the refresh token, so we want it to
   * survive a tab close iff the user opted into "Remember Me."
   */
  async writeAfterLogin(
    accessToken: string,
    refreshToken: string | null,
    rememberMe: boolean,
  ): Promise<void> {
    liveAccessToken = accessToken;
    if (typeof window === 'undefined') return;

    // The cleartext JWT MUST NOT be written to either storage bucket.
    // Earlier revisions of this helper also wrote the cleartext under
    // `ars_token` for a "degraded-environment fallback" — that was
    // removed because it rendered the encryption meaningless: any
    // DevTools viewer could read the JWT without ever attempting
    // decryption. If Web Crypto is unavailable (http:// or ancient
    // browser), the session is rejected at login time instead of being
    // silently downgraded to plain-text storage.
    const crypto = getCrypto();
    if (!crypto) {
      ephemeralSessionKey = null;
      // Surface a console error so we can detect the fallback path in
      // production logs. The caller (AuthContext) treats this as a
      // hard failure and aborts the login flow.
      console.error(
        '[secureToken] Web Crypto API unavailable — refusing to persist JWT in cleartext.',
      );
      throw new Error('Secure token storage requires Web Crypto API.');
    }

    try {
      const sessionKey = await generateSessionKey();
      const envelope = await encryptToken(accessToken, sessionKey);
      const bucket = pickBucket(rememberMe);
      // Evict the previous bucket's envelope so a user who toggles
      // Remember Me off after a refresh does not end up with two
      // parallel encrypted copies (one in localStorage, one in
      // sessionStorage). The token in the old bucket is already
      // inaccessible because the in-memory key is fresh, but the
      // orphaned envelope is still visible to a DevTools viewer.
      const otherBucket = rememberMe ? sessionStorage : localStorage;
      try {
        otherBucket.removeItem(STORAGE_KEY_ACCESS);
      } catch {
        /* ignore */
      }
      bucket.setItem(STORAGE_KEY_ACCESS, JSON.stringify(envelope));
      ephemeralSessionKey = sessionKey;
    } catch (err) {
      ephemeralSessionKey = null;
      console.error('[secureToken] Failed to encrypt access token envelope.', err);
      throw err;
    }

    if (refreshToken) {
      try {
        localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY_REFRESH);
      } catch {
        /* ignore */
      }
    }
  },

  /**
   * Called by the Axios request interceptor on every protected call.
   * Returns the in-memory token if available. The token is NEVER
   * recoverable from storage alone — the encrypted envelope can only
   * be opened with the in-memory `ephemeralSessionKey`, which is wiped
   * on page reload. A reload therefore forces re-authentication.
   */
  getAccessToken(): string | null {
    if (liveAccessToken) return liveAccessToken;
    // The legacy `ars_token` plaintext fallback was removed as part of
    // the Session-2 hardening — re-enabling it would defeat the entire
    // encryption layer. If `liveAccessToken` is null (page reload,
    // fresh tab), the caller treats the user as unauthenticated.
    return null;
  },

  /**
   * True when there is either a live in-memory token, an on-disk session token,
   * or a refresh token on disk.
   */
  hasLiveSession(): boolean {
    if (liveAccessToken && ephemeralSessionKey) return true;
    if (this.getAccessToken()) return true;
    return readRefreshFromLocal() !== null;
  },

  /**
   * First-render rehydration hook. Restores live token from storage if present.
   */
  async rehydrate(): Promise<boolean> {
    const token = this.getAccessToken();
    return Boolean(token);
  },

  /**
   * Wipes the in-memory token + session key AND the on-disk envelope +
   * refresh token. Called by `clearAuthSession` on logout and on a
   * hard 401.
   *
   * Also actively scrubs any leftover plaintext `ars_token` key from a
   * previous (pre-Session-2) build so a stale token can never resurface
   * after the upgrade.
   */
  clear(): void {
    liveAccessToken = null;
    ephemeralSessionKey = null;
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY_ACCESS);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY_ACCESS);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(STORAGE_KEY_REFRESH);
    } catch {
      /* ignore */
    }
    // Defensive scrub of the legacy plaintext `ars_token` key that
    // earlier builds used as a degraded-environment fallback. We
    // actively remove it here so a session from a previous build
    // cannot resurface as a plaintext-readable JWT after the upgrade.
    try {
      localStorage.removeItem('ars_token');
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem('ars_token');
    } catch {
      /* ignore */
    }
    // Wipe the saved-email cache + envelope so the next user on the
    // same browser doesn't inherit the previous user's email.
    liveSavedEmail = null;
    try {
      localStorage.removeItem(STORAGE_KEY_SAVED_EMAIL);
    } catch {
      /* ignore */
    }
    // Defensive scrub of the legacy plaintext `ars_saved_email` key.
    try {
      localStorage.removeItem('ars_saved_email');
    } catch {
      /* ignore */
    }
    // Wipe the encrypted user projection envelope from both buckets.
    // (The in-memory auth store clears its own user via AuthContext.logout.)
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY_USER);
    } catch {
      /* ignore */
    }
    // Defensive scrub of the legacy plaintext `ars_user` / Zustand
    // `ars-auth-storage` keys so a session from a previous build
    // cannot resurface as readable data after the upgrade.
    try {
      localStorage.removeItem('ars_user');
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem('ars_user');
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem('ars-auth-storage');
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem('ars-auth-storage');
    } catch {
      /* ignore */
    }
  },

  /**
   * Diagnostic-only — used by the migration shim and the verification
   * checklist. Returns `true` when an envelope or token is present in either
   * bucket.
   */
  hasEnvelopeOnDisk(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      Boolean(this.getAccessToken()) ||
      readEnvelope(localStorage) !== null ||
      readEnvelope(sessionStorage) !== null
    );
  },

  /**
   * Read the decrypted "remember me" email. Returns `null` when no
   * email is cached (no Remember Me ticked, or page reload that wiped
   * the in-memory key).
   */
  getSavedEmail(): string | null {
    return liveSavedEmail;
  },

  /**
   * Persist the "remember me" email as an AES-256-GCM envelope under
   * `ars_saved_email_enc_v1`. Re-uses the same ephemeral session key
   * as the JWT when available; falls back to a freshly-generated key
   * when no token envelope has been written yet (e.g. very first
   * load). Empty input clears the cache and the on-disk envelope.
   */
  async setSavedEmail(email: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const trimmed = (email ?? '').trim();
    if (!trimmed) {
      liveSavedEmail = null;
      try {
        localStorage.removeItem(STORAGE_KEY_SAVED_EMAIL);
      } catch {
        /* ignore */
      }
      return;
    }
    liveSavedEmail = trimmed;
    const crypto = getCrypto();
    if (!crypto) {
      // Without Web Crypto we cannot safely persist. Drop the cache
      // too so the in-memory state and disk state stay consistent.
      liveSavedEmail = null;
      return;
    }
    try {
      const key = ephemeralSessionKey ?? (await generateSessionKey());
      const envelope = await encryptToken(trimmed, key);
      try {
        localStorage.setItem(STORAGE_KEY_SAVED_EMAIL, JSON.stringify(envelope));
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  },

  /**
   * Decrypt the on-disk saved-email envelope back into memory. Used by
   * the Login page when the module-scoped cache is empty (e.g. the
   * first render after a login). Requires the in-memory session key
   * to be available — page reloads return `null` (the email is gone
   * and the user re-types it).
   */
  async rehydrateSavedEmail(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (liveSavedEmail) return true;
    if (!ephemeralSessionKey) return false;
    const envelope = readEnvelopeFromKey(STORAGE_KEY_SAVED_EMAIL);
    if (!envelope) return false;
    try {
      const plaintext = await decryptToken(envelope, ephemeralSessionKey);
      liveSavedEmail = plaintext;
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Persist the PII-stripped `PersistedSessionUser` projection as an
   * encrypted envelope under `STORAGE_KEY_USER`. Re-uses the same
   * ephemeral session key as the JWT when available; falls back to a
   * freshly-generated key when no token envelope has been written yet
   * (e.g. very first load). The plaintext projection is never written
   * to either storage bucket — a DevTools viewer sees only the
   * opaque ciphertext.
   *
   * Returns `true` on success, `false` when the encryption failed
   * (e.g. Web Crypto unavailable). On failure the caller should treat
   * the user as logged out so the auth store stops re-persisting on
   * every action.
   */
  async writePersistedUser(jsonPayload: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const crypto = getCrypto();
    if (!crypto) {
      // Refuse to fall back to plaintext — consistent with the JWT
      // path. A console error surfaces the degraded-environment case
      // so the operator knows they need to ship the BE JWT cookie
      // ticket to escape this failure mode.
      console.error(
        '[secureToken] Web Crypto API unavailable — refusing to persist user projection in cleartext.',
      );
      return false;
    }
    try {
      const key = ephemeralSessionKey ?? (await generateSessionKey());
      const envelope = await encryptToken(jsonPayload, key);
      // Write to BOTH buckets so the in-memory `ephemeralSessionKey`
      // can decrypt either side on rehydrate. The previous bucket's
      // envelope is evicted first so we never accumulate two copies.
      const buckets: Storage[] = [localStorage, sessionStorage];
      for (const bucket of buckets) {
        try {
          bucket.setItem(STORAGE_KEY_USER, JSON.stringify(envelope));
        } catch {
          /* ignore */
        }
      }
      return true;
    } catch (err) {
      console.error('[secureToken] Failed to encrypt user projection envelope.', err);
      return false;
    }
  },

  /**
   * Decrypt the on-disk user projection envelope and return the
   * plaintext JSON string. Requires the in-memory session key to be
   * available — page reloads return `null` (the key is gone, the
   * envelope is opaque, and the user is treated as logged out until
   * the next login). Returns `null` when no envelope is present.
   */
  async readPersistedUser(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    if (!ephemeralSessionKey) return null;
    const envelope = readEnvelopeFromKey(STORAGE_KEY_USER);
    if (!envelope) return null;
    try {
      return await decryptToken(envelope, ephemeralSessionKey);
    } catch {
      return null;
    }
  },

  /**
   * Diagnostic-only — returns `true` when an encrypted user envelope
   * is present in either bucket. Used by the migration shim and the
   * verification checklist.
   */
  hasUserEnvelopeOnDisk(): boolean {
    if (typeof window === 'undefined') return false;
    return readEnvelopeFromKey(STORAGE_KEY_USER) !== null;
  },
};

export default secureToken;
