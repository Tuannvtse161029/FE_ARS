import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '../types/auth';

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
 */
type PersistedAuth = Pick<AuthState, 'user' | 'token' | 'isAuthenticated'>;

const sessionStorageAdapter = {
  getItem: (name: string) => {
    const raw = sessionStorage.getItem(name);
    if (raw === null) return null;
    try {
      // Zustand persist expects PersistState<Pick<AuthState,...>> shape.
      return { state: JSON.parse(raw) as PersistedAuth, version: 0 };
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: { state: PersistedAuth; version?: number }) => {
    sessionStorage.setItem(name, JSON.stringify(value.state));
  },
  removeItem: (name: string) => {
    sessionStorage.removeItem(name);
  },
};

interface AuthStore extends AuthState {
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
}

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true, // true until persisted state is rehydrated

      login: (user: User, token: string) => {
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      updateUser: (userData: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },
    }),
    {
      name: 'ars-auth-storage',
      storage: sessionStorageAdapter,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
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
