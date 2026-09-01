/**
 * MainLayout — Theme toggle & sidebar collapse regression suite.
 *
 * Authored by Agent 38 (this worker) as part of the Collapse + Dark Mode
 * delivery. Each scenario below maps to one of the contract points in the
 * user request:
 *
 *  1. Sidebar collapse button toggles width class and persists to
 *     `ars.sidebar.collapsed` (and the legacy `ars_sidebar_collapsed`).
 *  2. Theme toggle flips the `data-theme` attribute on the MainLayout
 *     root and on `<html>`, persisting to `ars_theme`.
 *  3. First visit defaults to `paper-day` consistently; a stored explicit
 *     Archive Dusk choice still wins.
 *  4. Explicit user choice overrides the OS preference on the next mount.
 *  5. Both buttons expose proper `aria-label` and `aria-expanded` values.
 *
 * The mock surface mirrors the one used by
 * `MainLayout.graduateStudentNav.test.tsx` and
 * `MainLayout.reviewerAvailability.test.tsx` so the tests stay aligned
 * with the canonical hook contracts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const useAuthMock = vi.fn();

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: (selector: unknown) =>
    typeof selector === 'function'
      ? selector({ user: null, isAuthenticated: false })
      : { user: null, isAuthenticated: false },
}));

vi.mock('../../../src/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
    markRead: () => Promise.resolve(true),
    markAllRead: () => Promise.resolve([]),
    reset: () => undefined,
  }),
  useMarkNotificationRead: () => ({
    markRead: () => Promise.resolve(true),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../../src/hooks/useReviewerProfiles', () => ({
  useReviewerAvailability: () => ({
    isAvailable: false,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../../src/services/reviewer.service', () => ({
  reviewerService: { updateAvailability: () => Promise.resolve() },
}));

import { buildMockAuth } from '../../../src/utils/mockAuth';
import { MainLayout } from '../../../src/layouts/MainLayout';
import { ROUTES } from '../../../src/routes/paths';

beforeEach(() => {
  useAuthMock.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  // Reset the root theme attribute so cross-test bleed doesn't happen.
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  // Reset matchMedia to the default "no dark preference" between tests so
  // a single test that opts into dark mode does not leak into the next.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMatchMedia(false),
  });
});

/**
 * Build a `matchMedia` stub that reports the desired preference. jsdom
 * does not implement this API, so tests that depend on it must seed a
 * callable implementation on `window`.
 */
const createMatchMedia = (matchesDark: boolean) =>
  vi.fn((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? matchesDark : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

const setMockAuth = (opts: Parameters<typeof buildMockAuth>[0] = {}) => {
  useAuthMock.mockReturnValue(buildMockAuth(opts));
};

const renderMainLayout = (initialPath: string = ROUTES.HOME) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
    </MemoryRouter>,
  );

const getSidebar = (): HTMLElement | null =>
  document.querySelector('aside') as HTMLElement | null;

const getSidebarWidthClass = (sidebar: HTMLElement): boolean =>
  sidebar.className.includes('sidebarCollapsed');

const getCollapseToggle = () =>
  screen.getByTestId('sidebar-collapse-toggle') as HTMLButtonElement;

const getThemeToggle = () =>
  screen.getByTestId('theme-toggle') as HTMLButtonElement;

const getRootDataTheme = (): string | null =>
  document.querySelector('[data-theme]')?.getAttribute('data-theme') ?? null;

const getHtmlDataTheme = (): string | null =>
  document.documentElement.getAttribute('data-theme');

// ───────────────────────────────────────────────────────────────────
// Collapse behavior
// ───────────────────────────────────────────────────────────────────
describe('MainLayout — sidebar collapse button (Agent 38)', () => {
  it('renders the collapse button with aria-expanded=true and an "Collapse navigation" label on first mount', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    const btn = getCollapseToggle();
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Collapse navigation');
  });

  it('clicking the collapse button toggles sidebar width class and aria-expanded', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    const sidebar = getSidebar();
    expect(sidebar).not.toBeNull();
    if (!sidebar) return;

    // Default state: expanded.
    expect(getSidebarWidthClass(sidebar)).toBe(false);
    const btn = getCollapseToggle();
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    // Collapse
    act(() => {
      fireEvent.click(btn);
    });
    expect(getSidebarWidthClass(sidebar)).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('Expand navigation');

    // Expand again
    act(() => {
      fireEvent.click(btn);
    });
    expect(getSidebarWidthClass(sidebar)).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Collapse navigation');
  });

  it('persists the collapse state to localStorage under both the new and legacy keys', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    act(() => {
      fireEvent.click(getCollapseToggle());
    });

    expect(window.localStorage.getItem('ars.sidebar.collapsed')).toBe('true');
    // Legacy mirror key the user request specified.
    expect(window.localStorage.getItem('ars_sidebar_collapsed')).toBe('true');

    // Toggle back to expanded
    act(() => {
      fireEvent.click(getCollapseToggle());
    });

    expect(window.localStorage.getItem('ars.sidebar.collapsed')).toBe('false');
    expect(window.localStorage.getItem('ars_sidebar_collapsed')).toBe('false');
  });

  it('reads a pre-existing collapsed state from localStorage on mount', () => {
    window.localStorage.setItem('ars.sidebar.collapsed', 'true');
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    const sidebar = getSidebar();
    expect(sidebar).not.toBeNull();
    if (!sidebar) return;
    expect(getSidebarWidthClass(sidebar)).toBe(true);
    expect(getCollapseToggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('reads the legacy storage key when the new key is absent (back-compat)', () => {
    window.localStorage.setItem('ars_sidebar_collapsed', 'true');
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    const sidebar = getSidebar();
    expect(sidebar).not.toBeNull();
    if (!sidebar) return;
    expect(getSidebarWidthClass(sidebar)).toBe(true);
  });

  it('collapse button is reachable by keyboard (focusable)', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    const btn = getCollapseToggle();
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });
});

// ───────────────────────────────────────────────────────────────────
// Theme toggle behavior
// ───────────────────────────────────────────────────────────────────
describe('MainLayout — theme toggle button (Agent 38)', () => {
  it('renders the theme toggle with proper aria-label and aria-pressed', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    const btn = getThemeToggle();
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    // Light is the default on first visit with no dark preference.
    expect(btn.getAttribute('aria-label')).toBe('Switch to Archive Dusk theme');
  });

  it('clicking the theme toggle flips data-theme on the MainLayout root and <html>', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    expect(getRootDataTheme()).toBe('paper-day');
    expect(getHtmlDataTheme()).toBe('paper-day');

    act(() => {
      fireEvent.click(getThemeToggle());
    });

    expect(getRootDataTheme()).toBe('archive-dusk');
    expect(getHtmlDataTheme()).toBe('archive-dusk');

    act(() => {
      fireEvent.click(getThemeToggle());
    });

    expect(getRootDataTheme()).toBe('paper-day');
    expect(getHtmlDataTheme()).toBe('paper-day');
  });

  it('persists the theme choice to localStorage under ars_theme', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    expect(window.localStorage.getItem('ars_theme')).toBe('paper-day');

    act(() => {
      fireEvent.click(getThemeToggle());
    });
    expect(window.localStorage.getItem('ars_theme')).toBe('archive-dusk');

    act(() => {
      fireEvent.click(getThemeToggle());
    });
    expect(window.localStorage.getItem('ars_theme')).toBe('paper-day');
  });

  it('first visit with prefers-color-scheme: dark still defaults to Paper Day', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(true),
    });
    // No localStorage value set in beforeEach.

    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    expect(getRootDataTheme()).toBe('paper-day');
    expect(getHtmlDataTheme()).toBe('paper-day');
    expect(getThemeToggle().getAttribute('aria-pressed')).toBe('false');
    expect(getThemeToggle().getAttribute('aria-label')).toBe(
      'Switch to Archive Dusk theme',
    );
  });

  it('first visit with prefers-color-scheme: light defaults to Paper Day', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(false),
    });

    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    expect(getRootDataTheme()).toBe('paper-day');
    expect(getHtmlDataTheme()).toBe('paper-day');
  });

  it('explicit user choice overrides prefers-color-scheme on the next mount', () => {
    // First session: dark preference still opens in Paper Day; user toggles
    // to Archive Dusk explicitly.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(true),
    });
    setMockAuth({ role: 'Researcher' });
    const { unmount } = renderMainLayout();
    expect(getRootDataTheme()).toBe('paper-day');

    act(() => {
      fireEvent.click(getThemeToggle());
    });
    expect(getRootDataTheme()).toBe('archive-dusk');
    expect(window.localStorage.getItem('ars_theme')).toBe('archive-dusk');
    unmount();

    // Second session: OS still reports dark, but the stored explicit choice
    // so the explicit user choice must win.
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();
    expect(getRootDataTheme()).toBe('archive-dusk');
    expect(getHtmlDataTheme()).toBe('archive-dusk');
  });

  it('migrates a stored legacy night choice to Archive Dusk', () => {
    // OS reports light but user already picked the legacy night theme.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(false),
    });
    window.localStorage.setItem('ars_theme', 'night');

    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    expect(getRootDataTheme()).toBe('archive-dusk');
    expect(getHtmlDataTheme()).toBe('archive-dusk');
  });

  it('ignores an invalid stored theme value and falls back to Paper Day', () => {
    window.localStorage.setItem('ars_theme', 'high-contrast');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMedia(true),
    });

    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    expect(getRootDataTheme()).toBe('paper-day');
  });

  it('theme toggle button is reachable by keyboard', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout();

    const btn = getThemeToggle();
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });
});
