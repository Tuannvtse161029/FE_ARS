import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState, EffectiveRole } from '../types/auth';

/**
 * sessionStorage-backed storage adapter for the auth store.
 *
 * Mirrors the Zustand persist API but always reads/writes sessionStorage so
 * auth state is cleared when the tab/window closes — matching the default
 * (Remember Me OFF) behaviour of the legacy storage.ts utility.
 *
 * NOTE: This adapter intentionally ignores the "Remember Me" flag so that the
 * auth store NEVER survives across browser restarts or Vite dev-server restarts
 * during development.  Users who want persistence can rely on the legacy
 * storage.ts `ars_token` / `ars_user` keys (which are gated on the checkbox).
 *
 * Zustand's PersistMiddleware requires the storage adapter to store/retrieve
 * the full PersistState structure (`{ state: S; version?: number }`) — not raw
 * strings.  We handle the JSON encoding/decoding ourselves here.
 *
 * `effectiveRole` is the Agent 39 BE-derived role (added alongside `user` /
 * `token` / `isAuthenticated`). It is persisted so the next session can
 * apply the same access rules without re-deriving from `isActive` after a
 * Vite dev-server restart — but the verified-guard still falls back to the
 * derived `!isActive && !isAdmin` heuristic when the field is absent (e.g.
 * for users with pre-migration persisted blobs).
 */
type PersistedAuth = Pick<
  AuthState,
  'user' | 'token' | 'isAuthenticated' | 'effectiveRole'
>;

/**
 * Smart storage adapter that respects "Remember Me":
 * - When Remember Me is ON (`ars_remember === 'true'`): reads/writes `localStorage` so the
 *   authenticated session survives browser and tab restarts.
 * - When Remember Me is OFF: reads/writes `sessionStorage` so the session expires upon tab close.
 */
const smartAuthStorageAdapter = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    const isRemember =
      localStorage.getItem('ars_remember') === 'true' ||
      localStorage.getItem('ars_remember_me') === 'true';

    const raw = isRemember
      ? (localStorage.getItem(name) || sessionStorage.getItem(name))
      : (sessionStorage.getItem(name) || localStorage.getItem(name));

    if (raw === null) return null;
    try {
      return { state: JSON.parse(raw) as PersistedAuth, version: 0 };
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: { state: PersistedAuth; version?: number }) => {
    if (typeof window === 'undefined') return;
    const isRemember =
      localStorage.getItem('ars_remember') === 'true' ||
      localStorage.getItem('ars_remember_me') === 'true';

    const payload = JSON.stringify(value.state);
    if (isRemember) {
      localStorage.setItem(name, payload);
      sessionStorage.removeItem(name);
    } else {
      sessionStorage.setItem(name, payload);
      localStorage.removeItem(name);
    }
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(name);
    localStorage.removeItem(name);
  },
};

interface AuthStore extends AuthState {
  login: (user: User, token: string, effectiveRole?: EffectiveRole) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  /**
   * Explicitly overwrite the effective role. Used by `AuthContext` when the
   * BE returns a fresh `effectiveRole` on login (or when the syncUserFromBE
   * effect picks up a new value from `GET /api/user/{id}` after Admin
   * approval). Replaces the previous value completely — never merges.
   */
  setEffectiveRole: (effectiveRole: EffectiveRole | null) => void;
}

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true, // true until persisted state is rehydrated
      // null = no logged-in user, or pre-migration persisted blob. The
      // verified-guard / MainLayout derives Guest from `!isActive && !isAdmin`
      // in this window — see `isGuestUser` in `src/hooks/usePermissions.ts`.
      effectiveRole: null,

      login: (user: User, token: string, effectiveRole?: EffectiveRole) => {
        const isRemember =
          typeof window !== 'undefined' &&
          (localStorage.getItem('ars_remember') === 'true' ||
            localStorage.getItem('ars_remember_me') === 'true');

        const resolvedEffectiveRole =
          effectiveRole ??
          (user.isActive
            ? (user.effectiveRole ?? (user.roleName as EffectiveRole))
            : 'Guest');

        const nextState = {
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          effectiveRole: resolvedEffectiveRole,
        };

        set(nextState);

        if (typeof window !== 'undefined') {
          const payload = JSON.stringify({ state: nextState, version: 0 });
          if (isRemember) {
            localStorage.setItem('ars-auth-storage', payload);
          } else {
            sessionStorage.setItem('ars-auth-storage', payload);
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
          sessionStorage.removeItem('ars-auth-storage');
          localStorage.removeItem('ars-auth-storage');
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      updateUser: (userData: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },

      setEffectiveRole: (effectiveRole: EffectiveRole | null) => {
        set({ effectiveRole });
      },
    }),
    {
      name: 'ars-auth-storage',
      storage: smartAuthStorageAdapter,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        effectiveRole: state.effectiveRole,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
        }
      },
    }
  )
);

export { useAuthStore };
export type { AuthStore };
