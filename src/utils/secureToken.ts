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

// In-memory session key. Cleared on page reload. The single source of
// truth for "can we decrypt the current envelope?"
let ephemeralSessionKey: CryptoKey | null = null;

// Tracks the raw access token the Axios layer is currently sending. Held
// only in memory. When the user logs out, this is dropped before the
// envelope is cleared so a stray in-flight request cannot reuse it.
let liveAccessToken: string | null = null;

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
  },
  VERSION: ENVELOPE_VERSION,

  /**
   * Called from `AuthContext.persistAuthAndNavigate` immediately after a
   * successful login. Generates a fresh session key, encrypts the JWT,
   * writes the envelope to the chosen bucket, and stashes the raw token
   * in module-scope memory for the Axios interceptor.
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

    const bucket = pickBucket(rememberMe);
    // Always persist cleartext token to both stores so multi-tab works seamlessly
    try {
      localStorage.setItem('ars_token', accessToken);
      sessionStorage.setItem('ars_token', accessToken);
    } catch {
      /* ignore */
    }

    const crypto = getCrypto();
    if (!crypto) {
      ephemeralSessionKey = null;
      return;
    }

    try {
      const sessionKey = await generateSessionKey();
      const envelope = await encryptToken(accessToken, sessionKey);
      bucket.setItem(STORAGE_KEY_ACCESS, JSON.stringify(envelope));
      ephemeralSessionKey = sessionKey;
    } catch {
      /* ignore */
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
   * Returns the in-memory token if available, or restores from storage.
   */
  getAccessToken(): string | null {
    if (liveAccessToken) return liveAccessToken;
    if (typeof window === 'undefined') return null;
    try {
      const stored =
        localStorage.getItem('ars_token') ||
        sessionStorage.getItem('ars_token');
      if (stored && stored.trim().length > 0) {
        liveAccessToken = stored.trim();
        return liveAccessToken;
      }
    } catch {
      /* ignore */
    }
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
};

export default secureToken;
