import { useCallback, useEffect, useState } from 'react';

/**
 * Theme toggle — shared by every page that needs the dark/light flip
 * (MainLayout, Login, Register, etc.).
 *
 * The hook centralises three responsibilities that were previously
 * inlined in `MainLayout.tsx`:
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
 * Important: this hook is intentionally SSR-safe. `resolveInitialTheme`
 * returns `'paper-day'` when `window` / `document` aren't defined, and
 * the `useEffect` calls are no-ops on the server. Both `setStoredTheme`
 * and `applyThemeToRoot` early-return when the corresponding globals
 * aren't present.
 *
 * The single source of truth lives in `localStorage`. The `data-theme`
 * attribute on `<html>` is a render-side projection of that value, not
 * a separate state. If you ever need to seed the theme from another
 * place (e.g. a backend profile preference), call `setTheme(next)` —
 * the persistence + apply side-effects run automatically.
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

export interface UseThemeToggleReturn {
  /** Current theme (`'archive-dusk'` = dark, `'paper-day'` = light). */
  theme: ArchiveThemeName;
  /** Set the theme explicitly. Persists + applies side-effects. */
  setTheme: (next: ArchiveThemeName) => void;
  /** Flip between the two themes. Persists + applies side-effects. */
  toggleTheme: () => void;
}

/**
 * Subscribe to the persisted theme and expose `{ theme, setTheme,
 * toggleTheme }`. Every change persists to `localStorage` AND applies
 * to `<html data-theme>`. A `storage` listener keeps multiple tabs
 * in sync without a reload.
 */
export function useThemeToggle(): UseThemeToggleReturn {
  const [theme, setThemeState] = useState<ArchiveThemeName>(() => resolveInitialTheme());

  // Apply + persist on every change. The initial render already reads
  // the correct value from `localStorage`, so this effect runs once
  // with the resolved value (no-op) and again on each toggle.
  useEffect(() => {
    applyThemeToRoot(theme);
    setStoredTheme(theme);
    syncMetaThemeColor();
  }, [theme]);

  // Cross-tab sync: when another tab flips the theme, mirror it here
  // so the user's preference stays consistent across the app.
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }
      if (isThemeName(event.newValue)) {
        setThemeState(event.newValue);
        applyThemeToRoot(event.newValue);
      } else {
        // Another tab cleared storage — fall back to the default.
        setThemeState('paper-day');
        applyThemeToRoot('paper-day');
      }
      // Browser chrome needs to follow along too.
      syncMetaThemeColor();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: ArchiveThemeName): void => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback((): void => {
    setThemeState((current) => (current === 'archive-dusk' ? 'paper-day' : 'archive-dusk'));
  }, []);

  return { theme, setTheme, toggleTheme };
}
