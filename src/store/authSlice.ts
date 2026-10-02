import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../utils/storage';
import { secureToken } from '../utils/secureToken';
import type { SessionUser } from '../utils/projectedUser';
import { projectUser } from '../utils/projectedUser';
import { AUTH_PERSIST_VERSION } from '../utils/constants';
import type { User, AuthState, EffectiveRole } from '../types/auth';

/**
 * Session-2 hardening — the persisted Zustand slice no longer carries
 * the JWT. The cleartext token lives only in the secureToken module's
 * module-scoped variable; the persist contains just the slim user
 * projection so guards can re-hydrate before the in-memory store is
 * restored. Any new auth-related field that must survive a page reload
 * goes through `SessionUser` (see `projectedUser.ts`); do not add new
 * PII fields to this persist.
 */

type PersistedAuth = Pick<
  AuthState,
  'user' | 'isAuthenticated' | 'effectiveRole'
>;

/**
 * Storage adapter for the slim auth slice. Uses the secureToken module's
 * helper to pick the bucket (Remember Me ON → localStorage, OFF →
 * sessionStorage) so the legacy `ars-auth-storage` key follows the same
 * rule the rest of the auth flow does.
 *
 * Critically this adapter does NOT touch the JWT envelope — the token
 * write path is owned by `secureToken.writeAfterLogin` exclusively.
 */
const slimAuthStorageAdapter = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    const isRemember = storage.getRememberMe();

    const raw = isRemember
      ? (localStorage.getItem(name) || sessionStorage.getItem(name))
      : (sessionStorage.getItem(name) || localStorage.getItem(name));

    if (raw === null) return null;
    try {
      return { state: JSON.parse(raw) as PersistedAuth, version: AUTH_PERSIST_VERSION };
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: { state: PersistedAuth; version?: number }) => {
    if (typeof window === 'undefined') return;
    const isRemember = storage.getRememberMe();

    const payload = JSON.stringify({ ...value, version: AUTH_PERSIST_VERSION });
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
  /**
   * The token is passed in so the in-memory `secureToken` can hold the
   * raw value, but it is NEVER persisted by this slice. See
   * `secureToken.writeAfterLogin` for the encrypted write path.
   */
  login: (user: User | SessionUser, token: string, effectiveRole?: EffectiveRole) => void;
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
  const initialUser = storage.getUser();
  const initialToken = storage.getToken();
  const isAuth = Boolean(initialUser && initialToken);
  return {
    user: (initialUser as unknown as User) ?? null,
    token: initialToken,
    isAuthenticated: isAuth,
    isLoading: false,
    effectiveRole: (initialUser?.effectiveRole as EffectiveRole) ?? null,
  };
};

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...getInitialAuthState(),

      login: (user: User | SessionUser, token: string, effectiveRole?: EffectiveRole) => {
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
      // Persist the slim user projection only — no token. The
      // authSlice's `user` field is typed as `User | null` for
      // back-compat with the rest of the FE; the projected shape is a
      // strict subset so the structural assignment is sound.
      const persistedUser = projected as unknown as User;
      const payload = JSON.stringify({
        state: {
          user: persistedUser,
          isAuthenticated: true,
          effectiveRole: resolvedEffectiveRole,
        },
        version: AUTH_PERSIST_VERSION,
      });
      if (isRemember) {
        localStorage.setItem('ars-auth-storage', payload);
      } else {
        sessionStorage.setItem('ars-auth-storage', payload);
      }
      // Make sure the live token is in the secureToken module's
      // module-scope. (The AuthContext normally writes the envelope
      // before calling `login`; this is a defensive back-stop for
      // any test fixture that drives `login` directly.)
      if (token) {
        void secureToken.writeAfterLogin(token, null, isRemember);
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
      onRehydrateStorage: () => (state) => {
        if (state) {
          const liveToken = storage.getToken();
          if (liveToken) {
            state.token = liveToken;
            state.isAuthenticated = true;
          }
          state.isLoading = false;
        } else {
          useAuthStore.setState({ isLoading: false });
        }
      },
    }
  )
);

export { useAuthStore };
export type { AuthStore };
