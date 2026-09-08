/**
 * useThemeToggle — hook regression suite.
 *
 * Covers the contract that's awkward to exercise through the Login or
 * MainLayout page-level tests:
 *
 *   1. Initial value resolves from `localStorage` (or Paper Day).
 *   2. `setTheme` / `toggleTheme` apply to `<html>` AND persist.
 *   3. The `storage` event listener mirrors changes made in OTHER
 *      tabs — e.g. user toggles dark mode in a workspace tab, then
 *      this tab reflects it without a reload.
 *   4. Clearing `ars_theme` in another tab resets this tab to Paper
 *      Day so the cascade stays consistent.
 *   5. Cleanup removes the storage listener on unmount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import {
  useThemeToggle,
  THEME_STORAGE_KEY,
} from '../../../src/hooks/useThemeToggle';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  // Reset the no-media <meta name="theme-color"> tag the hook
  // overwrites, so each test starts from a known baseline.
  document
    .querySelectorAll('meta[name="theme-color"]:not([media])')
    .forEach((el) => el.parentNode?.removeChild(el));
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  vi.restoreAllMocks();
});

const fireStorage = (newValue: string | null) => {
  // jsdom dispatches `storage` only across REAL windows, so we fire
  // the event manually with the same shape the browser would produce.
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: THEME_STORAGE_KEY,
      newValue,
      oldValue: null,
      storageArea: window.localStorage,
    }),
  );
};

describe('useThemeToggle — initial value', () => {
  it('defaults to Paper Day when nothing is stored', () => {
    const { result } = renderHook(() => useThemeToggle());
    expect(result.current.theme).toBe('paper-day');
  });

  it('reads a stored archive-dusk choice on mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'archive-dusk');
    const { result } = renderHook(() => useThemeToggle());
    expect(result.current.theme).toBe('archive-dusk');
  });

  it('migrates a legacy stored night value to archive-dusk', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'night');
    const { result } = renderHook(() => useThemeToggle());
    expect(result.current.theme).toBe('archive-dusk');
  });

  it('ignores an invalid stored value and falls back to Paper Day', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'high-contrast');
    const { result } = renderHook(() => useThemeToggle());
    expect(result.current.theme).toBe('paper-day');
  });
});

describe('useThemeToggle — setTheme / toggleTheme', () => {
  it('toggleTheme flips the value and applies to <html>', () => {
    const { result } = renderHook(() => useThemeToggle());
    expect(result.current.theme).toBe('paper-day');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('archive-dusk');
    expect(document.documentElement.getAttribute('data-theme')).toBe('archive-dusk');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('paper-day');
    expect(document.documentElement.getAttribute('data-theme')).toBe('paper-day');
  });

  it('setTheme applies the explicit value and persists to localStorage', () => {
    const { result } = renderHook(() => useThemeToggle());

    act(() => {
      result.current.setTheme('archive-dusk');
    });
    expect(result.current.theme).toBe('archive-dusk');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('archive-dusk');
    expect(document.documentElement.getAttribute('data-theme')).toBe('archive-dusk');

    act(() => {
      result.current.setTheme('paper-day');
    });
    expect(result.current.theme).toBe('paper-day');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('paper-day');
  });
});

describe('useThemeToggle — cross-tab sync', () => {
  it('mirrors a storage event from another tab', () => {
    const { result } = renderHook(() => useThemeToggle());
    expect(result.current.theme).toBe('paper-day');

    act(() => {
      fireStorage('archive-dusk');
    });

    expect(result.current.theme).toBe('archive-dusk');
    expect(document.documentElement.getAttribute('data-theme')).toBe('archive-dusk');
  });

  it('falls back to Paper Day when another tab clears the storage key', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'archive-dusk');
    const { result } = renderHook(() => useThemeToggle());
    expect(result.current.theme).toBe('archive-dusk');

    act(() => {
      fireStorage(null);
    });

    expect(result.current.theme).toBe('paper-day');
    expect(document.documentElement.getAttribute('data-theme')).toBe('paper-day');
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => useThemeToggle());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'some-other-key',
          newValue: 'archive-dusk',
          oldValue: null,
          storageArea: window.localStorage,
        }),
      );
    });

    expect(result.current.theme).toBe('paper-day');
  });

  it('removes the storage listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useThemeToggle());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});

describe('useThemeToggle — meta theme-color sync', () => {
  /**
   * Helper to set up the no-media `<meta name="theme-color">` tag
   * the hook overwrites, mimicking what `index.html` ships.
   */
  const installMetaTag = (initial: string) => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', initial);
    document.head.appendChild(meta);
    return meta;
  };

  const getMetaContent = () =>
    document
      .querySelector('meta[name="theme-color"]:not([media])')
      ?.getAttribute('content') ?? null;

  it('updates the no-media theme-color meta to match the initial theme', () => {
    // jsdom returns an empty string for getPropertyValue('--app-canvas'),
    // so the helper skips the assignment. We mock getComputedStyle so
    // the helper sees a real value and writes the meta attribute.
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = vi.fn(() =>
      ({
        getPropertyValue: (prop: string) =>
          prop === '--app-canvas' ? '#fffdf8' : '',
      }) as unknown as CSSStyleDeclaration,
    );

    try {
      installMetaTag('#000000');
      renderHook(() => useThemeToggle());

      // The hook runs its effect synchronously after mount, so the
      // meta tag should reflect --app-canvas (#fffdf8 in paper-day).
      expect(getMetaContent()).toBe('#fffdf8');
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  it('updates the no-media theme-color meta when the theme flips', () => {
    const values: Record<string, string> = {
      'paper-day': '#fffdf8',
      'archive-dusk': '#090d16',
    };
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = vi.fn(
      () =>
        ({
          getPropertyValue: (prop: string) =>
            prop === '--app-canvas' ? values['paper-day'] : '',
        }) as unknown as CSSStyleDeclaration,
    );

    try {
      installMetaTag('#000000');
      const { result } = renderHook(() => useThemeToggle());

      // After flipping, getComputedStyle is re-mocked to read
      // archive-dusk's --app-canvas value.
      window.getComputedStyle = vi.fn(
        () =>
          ({
            getPropertyValue: (prop: string) =>
              prop === '--app-canvas' ? values['archive-dusk'] : '',
          }) as unknown as CSSStyleDeclaration,
      );

      act(() => {
        result.current.toggleTheme();
      });

      expect(getMetaContent()).toBe('#090d16');
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  it('is a no-op when the no-media theme-color meta is absent', () => {
    // No meta tag installed — the helper should bail out without
    // throwing, so the toggle continues to work normally.
    const { result } = renderHook(() => useThemeToggle());

    expect(() => {
      act(() => {
        result.current.toggleTheme();
      });
    }).not.toThrow();

    expect(result.current.theme).toBe('archive-dusk');
  });
});
