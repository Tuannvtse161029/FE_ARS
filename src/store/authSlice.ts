import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../utils/storage';
import { secureToken } from '../utils/secureToken';
import type { PersistedSessionUser, SessionUser } from '../utils/projectedUser';
import { projectUser, projectUserForStorage } from '../utils/projectedUser';
import { AUTH_PERSIST_VERSION } from '../utils/constants';
import type { User, AuthState, EffectiveRole } from '../types/auth';

/**
 * Session-3 hardening — the `ars-auth-storage` key no longer exists
 * in plaintext. Both the JWT and the PII-stripped user projection are
 * stored as AES-256-GCM envelopes under `secureToken`; the Zustand
 * persist adapter is a thin shim that delegates reads / writes to
 * `secureToken.readPersistedUser` / `secureToken.writePersistedUser`.
 * A DevTools viewer sees only opaque ciphertext blobs under
 * `ars_user_enc_v1` — no user id, no role, no verification status.
 * The runtime SessionUser with PII stays in the in-memory store and
 * is rehydrated from the BE on login.
 */


type PersistedAuth = Pick<
  AuthState,
  'user' | 'isAuthenticated' | 'effectiveRole'
>;

/**
 * Storage adapter for the slim auth slice. Reads / writes go through
 * the encrypted envelope path in `secureToken` — the cleartext
 * projection is NEVER written to either bucket. The `name` parameter
 * is ignored (Zustand passes the storage key name in) because we use
 * a single canonical key (`ars_user_enc_v1`) managed by
 * `secureToken.writePersistedUser` / `secureToken.readPersistedUser`.
 */
const slimAuthStorageAdapter = {
  getItem: (_name: string) => {
    if (typeof window === 'undefined') return null;
    // Synchronous cache read — `storage.getUser()` returns the
    // previously-decrypted projection; the envelope is decrypted
    // lazily on first access by `bootstrapUserCache` (see
    // `utils/storage.ts`). Guards reading from the auth store during
    // the first render of a session accept the brief "no user yet"
    // window — they re-run their effect once the store rehydrates.
    const stored = storage.getUser();
    if (!stored) return null;
    // Read the live effectiveRole from the cache if it was set after
    // `setUser` (login) but before the persist rehydrates.
    const effectiveRole =
      (stored as unknown as { effectiveRole?: EffectiveRole | null })
        .effectiveRole ?? null;
    return {
      state: {
        user: stored as unknown as User,
        isAuthenticated: true,
        effectiveRole,
      } as PersistedAuth,
      version: AUTH_PERSIST_VERSION,
    };
  },
  setItem: (_name: string, value: { state: PersistedAuth; version?: number }) => {
    if (typeof window === 'undefined') return;
    const projected = value.state.user
      ? projectUserForStorage(
          value.state.user as unknown as SessionUser,
        )
      : null;
    if (!projected) return;
    const envelopePayload = JSON.stringify({
      ...projected,
      // Stash effectiveRole in the envelope so the adapter's
      // `getItem` can restore it on rehydrate. The field is dropped
      // before any UI-side read; the PII strip happens on write.
      __er: value.state.effectiveRole ?? null,
    });
    void secureToken.writePersistedUser(envelopePayload);
  },
  removeItem: (_name: string) => {
    if (typeof window === 'undefined') return;
    storage.removeUser();
  },
};

interface AuthStore extends AuthState {
  /**
   * The token is passed in so the in-memory `secureToken` can hold the
   * raw value, but it is NEVER persisted by this slice. See
   * `secureToken.writeAfterLogin` for the encrypted write path.
   *
   * Returns a `Promise<void>` so callers can `await` the envelope
   * write before reading from storage. Older callers that ignore the
   * return value still work because the write is fire-and-forget
   * internally.
   */
  login: (user: User | SessionUser, token: string, effectiveRole?: EffectiveRole) => Promise<void>;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<SessionUser> | Partial<User>) => void;
  setEffectiveRole: (effectiveRole: EffectiveRole | null) => void;
}

const getInitialAuthState = () => {
  if (typeof window === 'undefined') {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      effectiveRole: null,
    };
  }
  // Agent 55 — start in the loading state so route guards and
  // permission hooks wait for the encrypted envelope rehydrate to
  // complete before reading the auth state. The previous
  // implementation set `isLoading: false` synchronously and then
  // fired-and-forgot the rehydrate, which caused a brief
  // `isAuthenticated=false` window on a freshly-opened sibling tab.
  // During that window the user is authenticated on disk (the
  // envelope + key are both present) but the in-memory `liveAccessToken`
  // is null, so the synchronous `getToken()` returns null and the
  // `useAuth().user` reads as `null` — the page renders the
  // Guest/pending state for a user who is actually already
  // authenticated. The `onRehydrateStorage` callback below sets
  // `isLoading: false` once the envelope has been decrypted and the
  // user projection has been pushed into the store.
  //
  // We still fire `secureToken.rehydrate()` here so the first
  // protected Axios call from the freshly-mounted app can carry the
  // recovered JWT without waiting for the awaited rehydrate in the
  // callback. The two paths converge on the same `liveAccessToken`
  // write at the end of `secureToken.rehydrate()`.
  void secureToken.rehydrate().catch(() => undefined);
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true, // wait for `onRehydrateStorage` to flip this off
    effectiveRole: null,
  };
};

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...getInitialAuthState(),

      login: async (user: User | SessionUser, token: string, effectiveRole?: EffectiveRole): Promise<void> => {
        const isRemember = storage.getRememberMe();
        const projected = projectUser(user);
        if (!projected) return;

        const resolvedEffectiveRole =
          effectiveRole ??
          (projected.isActive
            ? (projected.effectiveRole ?? (projected.roleName as EffectiveRole))
            : 'Guest');

        const nextState = {
          user: projected as unknown as User,
          token,
          isAuthenticated: true,
          isLoading: false,
          effectiveRole: resolvedEffectiveRole,
        };

    set(nextState);

    if (typeof window !== 'undefined') {
      // Persist the storage-safe projection (no PII) as an encrypted
      // envelope under `ars_user_enc_v1`. The cleartext projection
      // is NEVER written to either storage bucket — a DevTools viewer
      // sees only the opaque ciphertext. The `effectiveRole` is
      // stashed inside the envelope so the adapter's `getItem` can
      // restore it on rehydrate.
      const persistedUser = projectUserForStorage(projected) as
        | PersistedSessionUser
        | null;
      if (persistedUser) {
        const envelopePayload = JSON.stringify({
          ...persistedUser,
          __er: resolvedEffectiveRole ?? null,
        });
        await secureToken.writePersistedUser(envelopePayload);
      }
      // Make sure the live token is in the secureToken module's
      // module-scope. (The AuthContext normally writes the envelope
      // before calling `login`; this is a defensive back-stop for
      // any test fixture that drives `login` directly.)
      if (token) {
        await secureToken.writeAfterLogin(token, null, isRemember);
      }
    }
  },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          effectiveRole: null,
        });
        if (typeof window !== 'undefined') {
          // Delegate to the secure path so the encrypted envelope and
          // its cache are both cleared.
          storage.removeUser();
        }
        secureToken.clear();
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      updateUser: (userData: Partial<SessionUser> | Partial<User>) => {
        set((state) => {
          if (!state.user) return state;
          // `SessionUser` is a strict structural subset of `User`, so
          // the merged record satisfies the back-compat `User` type
          // used elsewhere in the FE.
          return {
            user: { ...state.user, ...userData } as unknown as User,
          };
        });
      },

      setEffectiveRole: (effectiveRole: EffectiveRole | null) => {
        set({ effectiveRole });
      },
    }),
    {
      name: 'ars-auth-storage',
      storage: slimAuthStorageAdapter,
      // Persist the slim projection only. The token is intentionally
      // excluded so a stolen `ars-auth-storage` blob is not enough to
      // replay a session.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        effectiveRole: state.effectiveRole,
      }),
      onRehydrateStorage: () => async (_state, error) => {
        // Agent 55 — drive the persistent-key rehydrate path so the
        // in-memory session key + envelope decrypt happen BEFORE the
        // auth store finishes its initial rehydrate. Without this, a
        // freshly-opened sibling tab sees `isAuthenticated=false` and
        // the route guards bounce the user to /login. The rehydrate is
        // idempotent when the in-memory key is already set, so it is
        // safe to call from every mount.
        //
        // Direct state mutation is unreliable across Zustand versions;
        // use `useAuthStore.setState` (or `set`) for every change so
        // subscribers actually receive the update.
        if (error) {
          useAuthStore.setState({ isLoading: false });
          return;
        }
        try {
          await secureToken.rehydrate();
        } catch {
          /* ignore — fall through to the legacy sync getter */
        }
        const liveToken = storage.getToken();
        // Agent 55 (regression) — the user envelope needs the same
        // session key, but the `slimAuthStorageAdapter.getItem` call
        // above ran BEFORE the key was available (it was null in the
        // fresh JS context of a sibling tab). Now that the key is
        // back in memory, re-read the user projection from the
        // freshly-populated cache. The Zustand `partialize` above
        // mirrors the user blob under `ars-auth-storage`, but a
        // user persisted BEFORE this Agent 55 fix may not be there
        // — falling back to the encrypted envelope is the
        // canonical path.
        const rehydratedUser = storage.getUser();
        const patch: Partial<{
          user: User | null;
          token: string | null;
          isAuthenticated: boolean;
          effectiveRole: EffectiveRole | null;
          isLoading: boolean;
        }> = {
          isLoading: false,
        };
        if (liveToken) {
          patch.token = liveToken;
          patch.isAuthenticated = true;
        }
        if (rehydratedUser) {
          patch.user = rehydratedUser as unknown as User;
          patch.effectiveRole =
            (rehydratedUser.effectiveRole as EffectiveRole) ?? null;
        }
        useAuthStore.setState(patch);
      },
    }
  )
);

export { useAuthStore };
export type { AuthStore };
