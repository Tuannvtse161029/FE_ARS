import { useCallback, useEffect, useState } from 'react';

/**
 * Theme toggle — shared by every page that needs the dark/light flip
 * (MainLayout, Login, Register, etc.).
 *
 * The hook centralises three responsibilities:
 *
 *   1. **Persistence** — read/write the user's choice in `localStorage`
 *      under `ars_theme`. The legacy values `night` / `light` are
 *      normalised to the current vocabulary on read so old sessions
 *      don't bounce back to the default.
 *   2. **Apply** — set `data-theme="..."` on `<html>` so the semantic
 *      token cascade in `src/styles/ars-tokens.css` flips immediately.
 *   3. **Cross-tab sync** — listen for `storage` events so a flip in
 *      one tab is mirrored in another without forcing a reload.
 *
 * ── IMPORTANT: shared module-level state ──────────────────────────
 * This hook is consumed by many components simultaneously
 * (`ThemeToggle` in the header, `HeroAct` for the lamp gate, and
 * the layout itself). If each call to `useThemeToggle()` owned its
 * own `useState`, a toggle in one component would update only that
 * instance's state — every other instance would keep its stale
 * initial value, and conditional renders gated on `theme === …`
 * would silently fail to re-render until the user refreshed.
 *
 * To prevent that, we keep a single `currentTheme` value at module
 * scope, with a small subscriber set. Every hook instance subscribes
 * on mount, receives updates whenever `toggleTheme()` / `setTheme()`
 * fires anywhere, and unsubscribes on unmount. Initial state for
 * every instance comes from the same module-level read of
 * `localStorage`, so the first render is always consistent across
 * the tree.
 *
 * The hook is SSR-safe: `currentTheme` initialises to `'paper-day'`
 * when `window` is not defined, and the `useEffect` listeners
 * short-circuit on the server. The pre-paint script in `index.html`
 * independently sets `<html data-theme>` from `localStorage`, so the
 * CSS cascade matches the React state on first paint.
 */
export type ArchiveThemeName = 'archive-dusk' | 'paper-day';

export const THEME_STORAGE_KEY = 'ars_theme';
const THEME_VALUES: readonly ArchiveThemeName[] = ['archive-dusk', 'paper-day'] as const;

const isThemeName = (value: unknown): value is ArchiveThemeName =>
  typeof value === 'string' &&
  (THEME_VALUES as readonly string[]).includes(value);

/**
 * Read the persisted theme preference. Returns `null` when nothing is
 * stored so callers can decide whether to apply an OS preference
 * (`prefers-color-scheme`) — we deliberately do NOT auto-follow the
 * OS once the user has made an explicit choice.
 *
 * Legacy aliases (`night`, `light`) are mapped to the current
 * vocabulary so a stored value from an earlier version of the app
 * doesn't drop back to the default.
 */
export const getStoredTheme = (): ArchiveThemeName | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeName(raw)) return raw;
    if (raw === 'night') return 'archive-dusk';
    if (raw === 'light') return 'paper-day';
    return null;
  } catch {
    // Storage unavailable (private mode, quota exceeded, etc.) — fall
    // back to the default. The hook stays usable; the toggle simply
    // won't persist across reloads.
    return null;
  }
};

/**
 * Persist a theme choice to `localStorage`. Errors are swallowed
 * silently — the UI stays usable even when storage is blocked.
 */
export const setStoredTheme = (theme: ArchiveThemeName): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The layout remains usable when browser storage is unavailable.
  }
};

/**
 * Apply the theme to the root `<html>` element. The matching semantic
 * token cascade lives in `src/styles/ars-tokens.css`.
 *
 * Why `<html>` rather than a per-layout container?
 *   - Single source of truth shared by every route (publication home,
 *     profile, dashboard, login, register, etc).
 *   - Avoids race conditions where descendant pages render before the
 *     attribute is on a layout wrapper.
 *   - Public auth pages sit above MainLayout and use the default token
 *     values when no preference has been applied — this hook lets
 *     them flip too.
 */
export const applyThemeToRoot = (theme: ArchiveThemeName): void => {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute('data-theme', theme);
};

/**
 * Pick the initial theme synchronously. The cascade order is:
 *   1. `localStorage` explicit choice (user wins).
 *   2. `paper-day` for a consistent bright, welcoming first visit —
 *      we intentionally ignore `prefers-color-scheme` so a user who
 *      hasn't toggled the theme isn't silently flipped when their OS
 *      switches between light and dark.
 */
export const resolveInitialTheme = (): ArchiveThemeName => {
  const stored = getStoredTheme();
  if (stored !== null) {
    return stored;
  }
  return 'paper-day';
};

/**
 * Sync the mobile browser chrome (`<meta name="theme-color">`) to the
 * active theme. The two `<meta>` tags in `index.html` are gated by
 * `prefers-color-scheme` so an OS-level light/dark flip matches the
 * browser chrome out of the box — this helper overrides that with the
 * user's explicit theme choice once the React app has mounted.
 *
 * We read `--app-canvas` (which both themes define in
 * `ars-tokens.css`) because the browser address bar / status bar
 * should match the canvas the user actually sees. No-op on the server.
 */
const syncMetaThemeColor = (): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]:not([media])',
  );
  if (!meta) {
    return;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-canvas')
    .trim();
  if (value) {
    meta.setAttribute('content', value);
  }
};

// ── Shared module-level state ────────────────────────────────────
// All `useThemeToggle()` instances read from and write to this single
// object. That way toggling in `ThemeToggle` updates `HeroAct`'s
// `theme` value synchronously, and any other consumer in the tree.
// See the IMPORTANT block at the top of this file for why this exists.

/** The single theme value shared across every hook instance. */
let currentTheme: ArchiveThemeName =
  typeof window === 'undefined' ? 'paper-day' : resolveInitialTheme();

/** Subscribers are notified on every theme change. */
const subscribers = new Set<(theme: ArchiveThemeName) => void>();

/** Read the current shared theme value (used outside React). */
export const getCurrentTheme = (): ArchiveThemeName => currentTheme;

/**
 * Set the shared theme and notify every subscriber. Side effects:
 *  - apply `<html data-theme>`
 *  - persist to `localStorage`
 *  - sync the mobile browser chrome
 *  - notify subscribers so React components re-render
 */
const setSharedTheme = (next: ArchiveThemeName): void => {
  if (next === currentTheme) {
    // Still run apply/persist so the DOM and storage match the
    // declared value even when called from a storage event in another
    // tab (where the value is already what the other tab wrote).
    applyThemeToRoot(next);
    setStoredTheme(next);
    syncMetaThemeColor();
    return;
  }
  currentTheme = next;
  applyThemeToRoot(next);
  setStoredTheme(next);
  syncMetaThemeColor();
  // Notify AFTER state + DOM updates so subscribers that read the DOM
  // (e.g. for analytics) see the new attribute.
  subscribers.forEach((cb) => cb(next));
};

// First-paint sync: the inline script in `index.html` already set
// `<html data-theme>` from `localStorage`, but if this module is the
// first to read the theme (e.g. the hook is invoked before the
// pre-paint script has run for any reason), re-apply to guarantee the
// DOM matches `currentTheme`.
if (typeof document !== 'undefined') {
  applyThemeToRoot(currentTheme);
  // Cross-tab sync: when another tab flips the theme, mirror it here.
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const incoming = event.newValue;
    if (incoming === null) {
      // Another tab cleared storage — fall back to the default.
      setSharedTheme('paper-day');
      return;
    }
    if (isThemeName(incoming)) {
      setSharedTheme(incoming);
    } else if (incoming === 'night') {
      setSharedTheme('archive-dusk');
    } else if (incoming === 'light') {
      setSharedTheme('paper-day');
    } else {
      setSharedTheme('paper-day');
    }
  });
}

export interface UseThemeToggleReturn {
  /** Current theme (`'archive-dusk'` = dark, `'paper-day'` = light). */
  theme: ArchiveThemeName;
  /** Set the theme explicitly. Persists + applies side-effects. */
  setTheme: (next: ArchiveThemeName) => void;
  /** Flip between the two themes. Persists + applies side-effects. */
  toggleTheme: () => void;
}

/**
 * Subscribe to the shared theme and expose `{ theme, setTheme,
 * toggleTheme }`. Every change persists to `localStorage` AND applies
 * to `<html data-theme>`. A `storage` listener keeps multiple tabs
 * in sync without a reload.
 */
export function useThemeToggle(): UseThemeToggleReturn {
  // `useState` initialiser reads the module-level value that the
  // pre-paint script in `index.html` already synchronised to the DOM.
  const [theme, setThemeState] = useState<ArchiveThemeName>(() => currentTheme);

  useEffect(() => {
    const cb = (next: ArchiveThemeName): void => {
      setThemeState(next);
    };
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }, []);

  const setTheme = useCallback((next: ArchiveThemeName): void => {
    setSharedTheme(next);
  }, []);

  const toggleTheme = useCallback((): void => {
    setSharedTheme(currentTheme === 'archive-dusk' ? 'paper-day' : 'archive-dusk');
  }, []);

  return { theme, setTheme, toggleTheme };
}
