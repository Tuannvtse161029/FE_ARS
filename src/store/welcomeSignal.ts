/**
 * Welcome-back signal store.
 *
 * Holds an ephemeral "did we just complete a successful login?" flag for the
 * current authenticated session. Cleared automatically on logout and never
 * persisted across reloads / new sessions — the banner must ONLY appear
 * after a *genuine* successful login, never on a normal refresh or route
 * change.
 *
 * Why a separate store (not part of `useAuthStore`):
 *   - We never want this signal to be rehydrated from sessionStorage /
 *     zustand persist — that would re-show the banner on every refresh.
 *     `useAuthStore` rehydrates, but the welcome signal must NOT.
 *   - AuthContext, GoogleCallback, and the banner component all need
 *     access. Putting it in its own microstore keeps the wiring small.
 *
 * The store DOES NOT carry the user's full name itself — that's read from
 * trusted authenticated state inside the banner component. The signal only
 * records that a login just happened.
 */
import { create } from 'zustand';

interface WelcomeState {
  /**
   * True for the lifetime of a single mount of the banner after a successful
   * login. Becomes false the moment the user dismisses the banner, after
   * the auto-dismiss timer fires, or on logout / new login.
   */
  visible: boolean;
  /**
   * Monotonically-incrementing counter that ticks on every fresh successful
   * login. Components that don't subscribe to `visible` (or that render
   * before the banner mounts) can use this to detect a fresh login event.
   * Not used in the current banner but kept here for future hooks/tests
   * that need to know "did a login just happen on this mount?".
   */
  revision: number;
  show: () => void;
  hide: () => void;
  /** Hard reset — wipes the signal entirely (used by tests + logout). */
  reset: () => void;
}

export const useWelcomeSignal = create<WelcomeState>((set) => ({
  visible: false,
  revision: 0,
  show: () => set((s) => ({ visible: true, revision: s.revision + 1 })),
  hide: () => set({ visible: false }),
  reset: () => set({ visible: false, revision: 0 }),
}));
