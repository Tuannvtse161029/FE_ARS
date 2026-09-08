/**
 * Login — Theme toggle regression suite.
 *
 * Contract:
 *   1. The Login page renders a theme toggle in the top-right corner
 *      with the same accessibility pattern as the MainLayout header
 *      toggle (sun icon for the dark→light action, moon icon for the
 *      light→dark action; aria-pressed reflects current state).
 *   2. Clicking the toggle flips `data-theme` on `<html>` and
 *      persists the choice to `localStorage` under `ars_theme` —
 *      the SAME key the MainLayout uses, so a flip on either page
 *      stays in sync for the next mount.
 *   3. On first paint the toggle reads the persisted choice from
 *      `localStorage`. Without this, reloading `/login` while the
 *      workspace is in Archive Dusk falls back to Paper Day because
 *      the AuthLayout sits outside MainLayout and never re-applies
 *      the theme attribute.
 *   4. A stored legacy `night` / `light` value migrates to the
 *      current vocabulary so old sessions don't bounce back to the
 *      default.
 *   5. First visit with no stored value and no dark preference
 *      defaults to Paper Day, matching the MainLayout contract.
 *
 * The mock surface mirrors the one used by `tests/unit/pages/Login.test.tsx`
 * so this stays aligned with the canonical Login page tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const loginWithGoogleMock = vi.fn();
const authLogoutMock = vi.fn();

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    setAuthData: vi.fn(),
    logout: (...args: unknown[]) => authLogoutMock(...args),
  },
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithGoogle: (...args: unknown[]) => loginWithGoogleMock(...args),
    isLoading: false,
    error: null,
    user: null,
    pendingRoleSelection: null,
    confirmRoleSelection: vi.fn(),
    cancelRoleSelection: vi.fn(),
  }),
}));

vi.mock('../../../src/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => null,
}));

vi.mock('../../../src/services/role.service', () => ({
  roleService: {
    fetchRoles: vi.fn().mockResolvedValue([
      { roleId: 1, name: 'Researcher' },
      { roleId: 2, name: 'Reviewer' },
      { roleId: 3, name: 'Lecturer' },
      { roleId: 4, name: 'Graduate Student' },
    ]),
  },
}));

vi.mock('../../../src/components/Button', () => ({
  Button: ({ children, type, disabled, isLoading }: {
    children: React.ReactNode;
    type?: 'button' | 'submit';
    disabled?: boolean;
    isLoading?: boolean;
  }) => (
    <button type={type ?? 'button'} disabled={disabled || isLoading}>
      {children}
    </button>
  ),
}));

vi.mock('../../../src/components/Input', () => ({
  Input: () => null,
}));

import { I18nProvider } from '../../../src/i18n/I18nContext';
import { Login } from '../../../src/pages/Login';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

const renderLogin = () =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );

const getThemeToggle = () =>
  screen.getByTestId('theme-toggle') as HTMLButtonElement;

const getHtmlDataTheme = (): string | null =>
  document.documentElement.getAttribute('data-theme');

// ───────────────────────────────────────────────────────────────────
// Theme toggle presence
// ───────────────────────────────────────────────────────────────────
describe('Login — theme toggle presence (this worker)', () => {
  it('renders a theme toggle in the top-right anchor', () => {
    renderLogin();

    const btn = getThemeToggle();
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('starts in the Paper Day state on first visit (aria-pressed=false, moon icon = invite to dark)', () => {
    renderLogin();

    const btn = getThemeToggle();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    // "Switch to Archive Dusk theme" is the action label when light
    // is active — matches the same i18n key the MainLayout uses.
    expect(btn.getAttribute('aria-label')).toBe('Switch to Archive Dusk theme');
  });

  it('reflects a stored archive-dusk choice in aria-pressed on first paint', () => {
    window.localStorage.setItem('ars_theme', 'archive-dusk');

    renderLogin();

    const btn = getThemeToggle();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    // When dark is active the toggle invites the user back to light.
    expect(btn.getAttribute('aria-label')).toBe('Switch to Paper Day theme');
  });
});

// ───────────────────────────────────────────────────────────────────
// Theme toggle behaviour
// ───────────────────────────────────────────────────────────────────
describe('Login — theme toggle behaviour (this worker)', () => {
  it('clicking the toggle flips <html data-theme> from paper-day to archive-dusk', () => {
    renderLogin();

    expect(getHtmlDataTheme()).toBe('paper-day');

    act(() => {
      fireEvent.click(getThemeToggle());
    });

    expect(getHtmlDataTheme()).toBe('archive-dusk');
  });

  it('clicking twice returns <html data-theme> to paper-day', () => {
    renderLogin();

    act(() => {
      fireEvent.click(getThemeToggle());
    });
    expect(getHtmlDataTheme()).toBe('archive-dusk');

    act(() => {
      fireEvent.click(getThemeToggle());
    });
    expect(getHtmlDataTheme()).toBe('paper-day');
  });

  it('persists the choice to localStorage under ars_theme so MainLayout sees it on next mount', () => {
    renderLogin();

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
});

// ───────────────────────────────────────────────────────────────────
// Initial-value / migration scenarios
// ───────────────────────────────────────────────────────────────────
describe('Login — theme initial value (this worker)', () => {
  it('applies a stored archive-dusk choice to <html> on mount (regression for the "reload → light mode" bug)', () => {
    window.localStorage.setItem('ars_theme', 'archive-dusk');

    renderLogin();

    // Without this apply, a reload on /login while the workspace is in
    // archive-dusk would flash back to paper-day because the AuthLayout
    // sits outside MainLayout and never re-applies the theme attribute.
    expect(getHtmlDataTheme()).toBe('archive-dusk');
  });

  it('migrates a stored legacy night choice to archive-dusk', () => {
    window.localStorage.setItem('ars_theme', 'night');

    renderLogin();

    expect(getHtmlDataTheme()).toBe('archive-dusk');
    expect(window.localStorage.getItem('ars_theme')).toBe('archive-dusk');
  });

  it('migrates a stored legacy light choice to paper-day', () => {
    window.localStorage.setItem('ars_theme', 'light');

    renderLogin();

    expect(getHtmlDataTheme()).toBe('paper-day');
    expect(window.localStorage.getItem('ars_theme')).toBe('paper-day');
  });

  it('ignores an invalid stored value and falls back to Paper Day', () => {
    window.localStorage.setItem('ars_theme', 'high-contrast');

    renderLogin();

    expect(getHtmlDataTheme()).toBe('paper-day');
  });
});

// ───────────────────────────────────────────────────────────────────
// Shared storage contract with MainLayout
// ───────────────────────────────────────────────────────────────────
describe('Login — shared storage contract with MainLayout (this worker)', () => {
  it('reads the same ars_theme key as MainLayout (single source of truth)', () => {
    // Simulate the user toggling to dark mode in the workspace, then
    // logging out and landing on /login. The Login page must pick up
    // the same value the MainLayout wrote.
    window.localStorage.setItem('ars_theme', 'archive-dusk');

    renderLogin();

    expect(getHtmlDataTheme()).toBe('archive-dusk');
    expect(window.localStorage.getItem('ars_theme')).toBe('archive-dusk');
  });
});
