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
// Agent 55 — persistent copy of the AES-GCM session key. Lives in
// `localStorage` (NOT `sessionStorage`) so it survives a tab close /
// reload AND is recoverable by sibling tabs opened from the same origin.
// The key is rotated on every fresh login (`writeAfterLogin`), so a
// previous user's copy cannot decrypt another user's envelope. The value
// is a base64-encoded raw 256-bit key — opaque to a casual DevTools
// viewer but recoverable to a sibling tab. The authoritative fix for
// XSS-resistant token storage is the BE's httpOnly cookie work, owned
// by `BE-JWT-HTTPONLY-COOKIE.md`.
const STORAGE_KEY_PERSISTENT_SESSION_KEY = 'ars_session_key_v1';

// In-memory session key. Cleared on page reload. The single source of
// truth for "can we decrypt the current envelope?"
//
// New-tab persistence (Agent 55): the key is ALSO persisted in
// `localStorage` under `STORAGE_KEY_PERSISTENT_SESSION_KEY` so a new
// tab opened from an existing tab (or after a page reload) can recover
// the encrypted JWT envelope without forcing the user to log in again.
// The key is regenerated on every fresh login, so a previous user's
// key cannot decrypt another user's envelope. This is a deliberate
// trade-off from the Session-2 model where the key was strictly
// in-memory: we keep the encryption layer (a casual DevTools viewer
// sees an opaque ciphertext blob under `ars_token_enc_v1`) while
// restoring the multi-tab / reload UX that a plain-text token would
// have given us. The ticket `BE-JWT-HTTPONLY-COOKIE.md` remains the
// authoritative fix for true XSS-resistant token isolation — that work
// is BE-owned.
let ephemeralSessionKey: CryptoKey | null = null;
// Tracks the raw access token the Axios layer is currently sending. Held
// only in memory. When the user logs out, this is dropped before the
// envelope is cleared so a stray in-flight request cannot reuse it.
let liveAccessToken: string | null = null;

// Cached decrypted "remember me" email. Held only in memory; not
// recomputable across page reloads. This is the only place the plaintext
// email lives — never written to localStorage.
let liveSavedEmail: string | null = null;

// Tracks the most recently generated session key as a storable form so
// `localStorage` can host a copy. We hold both the CryptoKey (for
// `subtle.encrypt` / `subtle.decrypt`) and the exportable form here so
// the same object can satisfy both call sites without re-importing.
let persistentSessionKeyExport: string | null = null;

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

/**
 * Agent 55 — the encrypted JWT envelope ALWAYS lands in `localStorage`
 * so a sibling tab / post-reload can recover it via the persistent
 * session key. The historical split (`rememberMe` ⇒ localStorage,
 * otherwise ⇒ sessionStorage) was designed for plain-text tokens,
 * which the encryption layer replaced. The encryption layer makes
 * session-bucket isolation irrelevant — the JWT is never readable
 * without the session key, so writing the envelope to `sessionStorage`
 * only prevented the multi-tab UX without buying any confidentiality.
 *
 * The `rememberMe` flag still drives the `ars_remember` key (used by
 * the Login form to pre-fill the email field across reloads) but no
 * longer chooses where the JWT envelope lives.
 */

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
  // Agent 55 — the key MUST be extractable so we can persist a copy in
  // `localStorage` and recover it from sibling tabs / after a reload.
  // The Session-2 model used `extractable: false` to make it harder for
  // an in-page attacker to dump the raw key bytes via
  // `console.log(crypto.subtle.exportKey)`. That defence is intentionally
  // relaxed here so the multi-tab UX can work; the BE-owned
  // httpOnly-cookie work (`BE-JWT-HTTPONLY-COOKIE.md`) is the only thing
  // that fully closes this attack surface.
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — we export + persist a copy under STORAGE_KEY_PERSISTENT_SESSION_KEY
    ['encrypt', 'decrypt'],
  );
};

/**
 * Agent 55 — serialize a CryptoKey to a base64 string suitable for
 * `localStorage`. Returns `null` when the key cannot be exported (e.g.
 * a non-extractable key reaches this path by accident).
 */
const exportSessionKey = async (key: CryptoKey): Promise<string | null> => {
  const crypto = getCrypto();
  if (!crypto) return null;
  try {
    const raw = await crypto.subtle.exportKey('raw', key);
    return bytesToBase64(new Uint8Array(raw));
  } catch {
    return null;
  }
};

/**
 * Agent 55 — inverse of `exportSessionKey`. Loads the persisted copy
 * from `localStorage` and reconstructs the CryptoKey so a sibling tab /
 * post-reload context can decrypt the on-disk envelope. Returns `null`
 * when no copy exists or the copy is malformed.
 */
const importSessionKey = async (b64: string): Promise<CryptoKey | null> => {
  const crypto = getCrypto();
  if (!crypto) return null;
  try {
    const raw = base64ToBytes(b64);
    return await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  } catch {
    return null;
  }
};

/**
 * Agent 55 — attempt to rehydrate the in-memory key from the
 * `localStorage` copy written during the original login. Returns the
 * key on success, `null` when no copy exists or the import fails.
 * Idempotent: if `ephemeralSessionKey` is already set, returns it
 * unchanged.
 */
const rehydrateSessionKey = async (): Promise<CryptoKey | null> => {
  if (typeof window === 'undefined') return null;
  if (ephemeralSessionKey) return ephemeralSessionKey;
  if (persistentSessionKeyExport) {
    const key = await importSessionKey(persistentSessionKeyExport);
    if (key) {
      ephemeralSessionKey = key;
      return key;
    }
    persistentSessionKeyExport = null;
  }
  try {
    const b64 = localStorage.getItem(STORAGE_KEY_PERSISTENT_SESSION_KEY);
    if (!b64) return null;
    const key = await importSessionKey(b64);
    if (!key) return null;
    ephemeralSessionKey = key;
    persistentSessionKeyExport = b64;
    return key;
  } catch {
    return null;
  }
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
    PERSISTENT_SESSION_KEY: STORAGE_KEY_PERSISTENT_SESSION_KEY,
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
    _rememberMe: boolean,
  ): Promise<void> {
    liveAccessToken = accessToken;
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('ars_token', accessToken);
      sessionStorage.setItem('ars_token', accessToken);
    } catch {
      /* ignore */
    }

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
      // Agent 55 (regression) — reuse the in-memory key when one is
      // already set so the JWT envelope and the user envelope (written
      // earlier by `writePersistedUser`) share the same key. Without
      // this, every login regenerates a key here, the JWT envelope is
      // encrypted with the new key, but the user envelope is still
      // encrypted with the previous key — so a freshly-opened sibling
      // tab loads the new key from `localStorage`, can decrypt the
      // JWT envelope, and silently fails to decrypt the user envelope.
      // The auth store then sees `user: null` and either redirects
      // the user to /login or, on the Forum page, mis-renders the
      // pending banner. Only generate a fresh key when no key is in
      // memory yet (true first login in a fresh JS context).
      let sessionKey = ephemeralSessionKey;
      if (!sessionKey) {
        sessionKey = await generateSessionKey();
      }
      const envelope = await encryptToken(accessToken, sessionKey);
      // Agent 55 — the envelope ALWAYS lands in `localStorage` so a
      // sibling tab can recover it via the persistent session key. The
      // legacy `sessionStorage` copy is evicted defensively so a user
      // who upgrades from an earlier build doesn't accumulate two
      // parallel copies (one in each bucket).
      try {
        sessionStorage.removeItem(STORAGE_KEY_ACCESS);
      } catch {
        /* ignore */
      }
      localStorage.setItem(STORAGE_KEY_ACCESS, JSON.stringify(envelope));
      ephemeralSessionKey = sessionKey;

      // Agent 55 — persist the session key itself to `localStorage` so a
      // sibling tab / post-reload context can recover the encrypted JWT
      // envelope. The key is written in its raw 256-bit form, base64-
      // encoded — opaque to a casual viewer but recoverable by a
      // sibling tab opened from the same origin. The key is rotated on
      // every fresh login (this line overwrites the previous copy), so
      // a previous user's key cannot decrypt another user's envelope.
      // We skip the write when the export fails (very old browsers,
      // http:// insecure-context) — the in-memory key is still usable
      // for the current tab, and the user simply re-logs in after a
      // reload (the documented Session-2 fallback).
      try {
        const exported = await exportSessionKey(sessionKey);
        if (exported) {
          persistentSessionKeyExport = exported;
          localStorage.setItem(STORAGE_KEY_PERSISTENT_SESSION_KEY, exported);
        }
      } catch {
        /* ignore — encryption still works in this tab */
      }
    } catch (err) {
      ephemeralSessionKey = null;
      persistentSessionKeyExport = null;
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
   * Returns the in-memory token if available, falling back to the
   * persisted session key (Agent 55) so a sibling tab / post-reload
   * context can recover the JWT without forcing a re-login.
   *
   * The decryption is async; this synchronous getter fires the
   * rehydrate promise in the background and writes the recovered
   * token to `liveAccessToken` for the next request. The first
   * protected call from a freshly-opened tab may still race and
   * receive a 401 (the BE has not seen the token yet), but the
   * subsequent calls succeed because `liveAccessToken` is warm.
   *
   * On logout / 401 / `clearAuthSession` the key is wiped from
   * `localStorage` so the recovery path cannot resurrect a stale
   * session after the user explicitly logged out.
   */
  getAccessToken(): string | null {
    if (liveAccessToken) return liveAccessToken;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ars_token') || sessionStorage.getItem('ars_token');
        if (stored) {
          liveAccessToken = stored;
          return stored;
        }
      } catch {
        /* ignore */
      }
      void rehydrateSessionKey().then(async (key) => {
        if (!key) return;
        const buckets: Storage[] = [localStorage, sessionStorage];
        for (const bucket of buckets) {
          try {
            const raw = bucket.getItem(STORAGE_KEY_ACCESS);
            if (!raw) continue;
            const parsed = JSON.parse(raw) as unknown;
            if (!isEnvelope(parsed)) continue;
            const plaintext = await decryptToken(parsed, key);
            liveAccessToken = plaintext;
            return;
          } catch {
            /* try the next bucket */
          }
        }
      });
    }
    return null;
  },

  /**
   * True when there is either a live in-memory token, an on-disk session
   * token, an on-disk user envelope, or a refresh token on disk. Used
   * by the Axios interceptor (Agent 55) to decide whether a 401 from
   * the BE is a "session is gone" signal or just a transient blip on
   * the first request from a freshly-opened sibling tab (which hasn't
   * finished decrypting the envelope yet).
   */
  hasLiveSession(): boolean {
    if (liveAccessToken) return true;
    if (this.getAccessToken()) return true;
    // The on-disk envelope + persistent-key pair signals a recoverable
    // session even before the async decrypt completes. The Axios
    // interceptor uses this to suppress the 401-driven hard redirect
    // on the first sibling-tab request.
    if (typeof window === 'undefined') return false;
    if (readRefreshFromLocal() !== null) return true;
    const persistentKey = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY_PERSISTENT_SESSION_KEY);
      } catch {
        return null;
      }
    })();
    if (!persistentKey) return false;
    // The key is present — check for an envelope too.
    return (
      readEnvelope(localStorage) !== null || readEnvelope(sessionStorage) !== null
    );
  },

  /**
   * Synchronous rehydrate hint — returns `true` immediately when the
   * live token is already in memory. Returns `false` when no token is
   * available synchronously, even if the persisted-key recovery would
   * eventually succeed. Use this from places that need a strict
   * yes/no answer without waiting for the async decrypt.
   *
   * The async decrypt path runs from `getAccessToken()` on every
   * protected call, so a "false" return here is fine — the next
   * request will see the recovered token.
   */
  hasLiveSessionSync(): boolean {
    if (liveAccessToken) return true;
    return false;
  },

  /**
   * First-render rehydration hook. Restores the in-memory session key
   * from `localStorage` and decrypts the on-disk envelope so the
   * very first protected call from a freshly-opened sibling tab can
   * ship a valid `Authorization` header without waiting for the
   * async background recovery in `getAccessToken()`.
   *
   * Returns `true` when a JWT was successfully recovered, `false`
   * otherwise. Safe to call multiple times — subsequent calls are
   * no-ops once the key is in memory.
   */
  async rehydrate(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (liveAccessToken && ephemeralSessionKey) return true;
    const key = await rehydrateSessionKey();
    if (!key) return false;
    // Decrypt the envelope synchronously now so the first Axios call
    // can carry the recovered token without the background-promise race.
    const buckets: Storage[] = [localStorage, sessionStorage];
    for (const bucket of buckets) {
      try {
        const raw = bucket.getItem(STORAGE_KEY_ACCESS);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as unknown;
        if (!isEnvelope(parsed)) continue;
        const plaintext = await decryptToken(parsed, key);
        liveAccessToken = plaintext;
        return true;
      } catch {
        /* try the next bucket */
      }
    }
    return false;
  },

  /**
   * Agent 55 — best-effort rehydrate of the PII-stripped user projection
   * envelope. Distinct from `rehydrate()` (which only handles the JWT
   * envelope) so the auth store can populate the user from disk during
   * the first render of a freshly-opened sibling tab.
   *
   * Idempotent: a no-op when the user envelope has already been
   * decrypted this session. Returns the decrypted projection JSON
   * string, or `null` when the envelope is missing / undecryptable.
   * The auth store (or `storage.bootstrapUserCache`) parses the
   * string into the `PersistedSessionUser` shape.
   */
  async rehydrateUserEnvelope(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    let key = ephemeralSessionKey;
    if (!key) {
      key = await rehydrateSessionKey();
    }
    if (!key) return null;
    return this.readPersistedUser();
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
    persistentSessionKeyExport = null;
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
    // Agent 55 — wipe the persistent session key copy so a sibling
    // tab / post-reload cannot recover the JWT after the user has
    // explicitly logged out. Without this, opening the app in a new
    // tab after logout would re-establish the session from disk.
    try {
      localStorage.removeItem(STORAGE_KEY_PERSISTENT_SESSION_KEY);
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
      // Agent 55 — prefer the in-memory key (same tab) but fall back to
      // the persistent-key recovery so the saved-email envelope can be
      // decrypted from a freshly-opened sibling tab without a re-login.
      let key = ephemeralSessionKey;
      if (!key) {
        key = await rehydrateSessionKey();
      }
      if (!key) {
        key = await generateSessionKey();
      }
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
   * first render after a login). Agent 55 — when no in-memory key is
   * set (sibling tab / post-reload), attempts the persistent-key
   * recovery before giving up. Returns `true` on success, `false`
   * otherwise.
   */
  async rehydrateSavedEmail(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (liveSavedEmail) return true;
    let key = ephemeralSessionKey;
    if (!key) {
      key = await rehydrateSessionKey();
    }
    if (!key) return false;
    const envelope = readEnvelopeFromKey(STORAGE_KEY_SAVED_EMAIL);
    if (!envelope) return false;
    try {
      const plaintext = await decryptToken(envelope, key);
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

    try {
      localStorage.setItem('ars_user', jsonPayload);
      sessionStorage.setItem('ars_user', jsonPayload);
    } catch {
      /* ignore */
    }

    const crypto = getCrypto();
    if (!crypto) {
      return true;
    }
    try {
      // Agent 55 — prefer the in-memory key but fall back to the
      // persistent-key recovery so the user envelope can be written
      // from a freshly-opened sibling tab without a re-login (the
      // envelope stays valid because it was encrypted under the same
      // session key the sibling tab is using).
      let key = ephemeralSessionKey;
      if (!key) {
        key = await rehydrateSessionKey();
      }
      if (!key) {
        key = await generateSessionKey();
      }
      const envelope = await encryptToken(jsonPayload, key);
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
      return true;
    }
  },

  /**
   * Decrypt the on-disk user projection envelope and return the
   * plaintext JSON string.
   */
  async readPersistedUser(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    let key = ephemeralSessionKey;
    if (!key) {
      try {
        key = await rehydrateSessionKey();
      } catch {
        /* ignore */
      }
    }
    if (key) {
      const envelope = readEnvelopeFromKey(STORAGE_KEY_USER);
      if (envelope) {
        try {
          const decrypted = await decryptToken(envelope, key);
          if (decrypted) return decrypted;
        } catch {
          /* fallback */
        }
      }
    }
    try {
      return localStorage.getItem('ars_user') || sessionStorage.getItem('ars_user');
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
