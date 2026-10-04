import { STORAGE_KEYS } from './constants';
import { secureToken } from './secureToken';
import type { SessionUser, PersistedSessionUser } from './projectedUser';
import { projectUser, serializePersistedSessionUser } from './projectedUser';
import type { User } from '../types/auth';

// The session token is no longer round-tripped through plain storage. The
// `ars_token` key is delegated to `secureToken.ts` which encrypts the
// JWT before it ever hits `localStorage` / `sessionStorage`. This module
// only owns the *user* blob and the remember-me flag; the token side is
// exclusively `secureToken.getAccessToken()`.
//
// Session-3 (security) — the `ars_user` blob is no longer readable
// from DevTools at all. Every write goes through
// `secureToken.writePersistedUser` which wraps the PII-stripped
// `PersistedSessionUser` projection in an AES-256-GCM envelope under
// the same ephemeral session key as the JWT. A DevTools viewer sees
// only the opaque ciphertext under `ars_user_enc_v1`; without the
// in-memory key the user id, role, and verification status are
// unrecoverable. The runtime SessionUser (with PII) stays in the
// in-memory auth store for the duration of the session and is
// refetched from the BE on every login.

// Cached decrypted user projection. The Zustand persist layer calls
// `getUser()` synchronously from its rehydrate callback, but
// `secureToken.readPersistedUser()` is async (Web Crypto). We resolve
// the envelope once on first call and stash the plaintext projection
// here. The cache is invalidated by `setUser` / `removeUser` and on
// logout so a stale blob cannot leak across users.
let cachedUserProjection: PersistedSessionUser | null = null;
let userEnvelopeBootstrapped = false;

/**
 * One-time bootstrap: decrypts the on-disk `ars_user_enc_v1` envelope
 * and caches the plaintext projection. Subsequent synchronous calls
 * to `getUser()` return the cache without round-tripping Web Crypto.
 * Called from `getUser` on first invocation in a session; idempotent
 * so it's safe to call multiple times.
 *
 * Agent 55 — the in-memory session key is wiped on every page reload
 * / new tab, so the bootstrap must rehydrate the key BEFORE it can
 * decrypt the user envelope. Without this step the cache stays null
 * on a freshly-opened sibling tab and the auth store initializes
 * with `user: null`, which causes `usePermissions` / `useVerifiedGuard`
 * to render the Guest / pending state for an already-authenticated
 * user. The rehydrate is idempotent: subsequent calls return the
 * cached projection without touching the key.
 */
const bootstrapUserCache = async (): Promise<PersistedSessionUser | null> => {
  if (userEnvelopeBootstrapped) return cachedUserProjection;
  userEnvelopeBootstrapped = true;
  if (typeof window === 'undefined') return null;
  // Step 1: recover the in-memory session key from `localStorage` so
  // the user envelope below is decryptable. The same key recovers
  // the JWT envelope inside `secureToken.rehydrate()` — by the time
  // the Zustand `onRehydrateStorage` callback awaits
  // `secureToken.rehydrate()` the user envelope is already in the
  // cache and the store's first render sees the correct user blob.
  try {
    await secureToken.rehydrate();
  } catch {
    /* ignore — the user envelope read below will just return null */
  }
  // Step 2: decrypt the user envelope with the now-available key.
  const json = await secureToken.readPersistedUser();
  if (!json) {
    cachedUserProjection = null;
    return null;
  }
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const projected = projectUser(parsed as unknown as User) as
      | PersistedSessionUser
      | null;
    cachedUserProjection = projected;
    return projected;
  } catch {
    cachedUserProjection = null;
    return null;
  }
};

export const storage = {
  /**
   * Returns the raw access token from in-memory storage only. The
   * legacy `ars_token` plaintext fallback was removed — there is no
   * environment in which we knowingly store the JWT in cleartext. If
   * `secureToken.getAccessToken()` returns null (page reload, fresh
   * tab, before login completes) the caller treats the user as
   * unauthenticated and routes to the login page.
   */
  getToken: (): string | null => {
    return secureToken.getAccessToken();
  },

  /**
   * Plain-text token writes are not allowed. This shim forwards through
   * the secure path so legacy test fixtures that pre-date the migration
   * keep working. New callers should use `secureToken.writeAfterLogin`
   * directly.
   */
  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    const rememberMe = storage.getRememberMe();
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      sessionStorage.setItem(STORAGE_KEYS.TOKEN, token);
    } catch {
      /* ignore */
    }
    void secureToken.writeAfterLogin(token, null, rememberMe);
  },

  removeToken: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch {
      /* ignore */
    }
    secureToken.clear();
  },

  /**
   * Read the persisted user projection. Returns `null` when no
   * envelope is on disk, the in-memory session key is gone (page
   * reload), or the envelope cannot be decrypted. The first call in
   * a session asynchronously bootstraps the cache; subsequent calls
   * return the cached value synchronously. Call `refreshUserFromDisk`
   * if you need a forced re-read.
   */
  getUser: (): PersistedSessionUser | null => {
    if (typeof window === 'undefined') return null;
    if (cachedUserProjection) return cachedUserProjection;

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER) || sessionStorage.getItem(STORAGE_KEYS.USER);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSessionUser;
        cachedUserProjection = parsed;
        userEnvelopeBootstrapped = true;
        return parsed;
      }
    } catch {
      /* ignore */
    }

    if (!userEnvelopeBootstrapped) {
      void bootstrapUserCache();
    }
    return cachedUserProjection;
  },

  /**
   * Force a re-read of the encrypted user envelope from disk. Useful
   * after a logout that ran on a different tab and we want to pick up
   * the cleared state. Resets the bootstrap flag and triggers a fresh
   * decrypt.
   */
  async refreshUserFromDisk(): Promise<PersistedSessionUser | null> {
    userEnvelopeBootstrapped = false;
    cachedUserProjection = null;
    return bootstrapUserCache();
  },

  setUser: (user: User | SessionUser): void => {
    if (typeof window === 'undefined') return;
    const persisted = serializePersistedSessionUser(user);
    if (!persisted) return;
    try {
      const parsed = JSON.parse(persisted) as PersistedSessionUser;
      cachedUserProjection = parsed;
      userEnvelopeBootstrapped = true;
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(STORAGE_KEYS.USER, persisted);
      sessionStorage.setItem(STORAGE_KEYS.USER, persisted);
    } catch {
      /* ignore */
    }
    void secureToken.writePersistedUser(persisted);
  },

  removeUser: (): void => {
    cachedUserProjection = null;
    userEnvelopeBootstrapped = false;
    try {
      localStorage.removeItem(secureToken.KEYS.USER);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(secureToken.KEYS.USER);
    } catch {
      /* ignore */
    }
    // Defensive scrub of any legacy plaintext `ars_user` / Zustand
    // `ars-auth-storage` blobs that may still be on disk from a
    // pre-Session-3 build.
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(STORAGE_KEYS.USER);
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

  getRememberMe: (): boolean => {
    return localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
  },

  setRememberMe: (remember: boolean): void => {
    if (remember) {
      localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    }
  },

  /**
   * Saved email — used by the Login page to pre-fill the email field
   * after a successful "Remember Me" login. We do NOT persist this
   * in plaintext because the email is direct PII; instead we encrypt
   * it under a session-anchored key that lives only in this module's
   * scope. The ciphertext lands under `ars_saved_email_enc_v1`.
   *
   * The trade-off: a page reload discards the in-memory key, so the
   * email field will be blank on next load. The user simply re-types
   * their email — same UX as before Session-2 if they didn't tick
   * "Remember Me" across tab close. We consider the privacy win worth
   * it: a DevTools viewer can no longer learn the victim's email
   * just by inspecting `localStorage`.
   */
  getSavedEmail: (): string => {
    if (typeof window === 'undefined') return '';
    // The decrypted email is held only in module-scope memory of
    // secureToken; if the page reloads, the key is gone and we return
    // an empty string. The caller (Login page) treats this as "no
    // saved email" — they fall back to typing their email again.
    return secureToken.getSavedEmail() ?? '';
  },

  setSavedEmail: (email: string): void => {
    if (typeof window === 'undefined') return;
    if (email && email.trim()) {
      void secureToken.setSavedEmail(email.trim());
    } else {
      void secureToken.setSavedEmail('');
    }
  },

  removeSavedEmail: (): void => {
    void secureToken.setSavedEmail('');
  },

  /**
   * Clear auth data from BOTH storages. The token side is delegated to
   * `secureToken.clear()` which wipes the envelope, the in-memory key,
   * and the legacy fallback key.
   */
  clearAuth: (): void => {
    storage.removeToken();
    storage.removeUser();
    storage.removeRememberMe();
  },

  removeRememberMe: (): void => {
    localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
  },

  clearAll: (): void => {
    storage.removeToken();
    storage.removeUser();
    storage.removeRememberMe();
  },
};

export default storage;