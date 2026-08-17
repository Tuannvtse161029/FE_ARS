/**
 * Sidebar nav regression: every non-Admin role exposes a real
 * `/premium-packages` link (singular label), Admin does NOT expose that
 * link, and Admin still owns the legacy `/admin/packages` route.
 *
 * We don't mount the full MainLayout (it pulls wallet / notifications /
 * reviewer-availability hooks). Instead we drive MainLayout's nav via the
 * public `getNavItemsByRole`-shaped return. To stay close to the shipped
 * behavior we render the sidebar in isolation using the actual component:
 * to do that without a backend, we mock every hook MainLayout consumes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '../../layouts/MainLayout';
import { ROUTES } from '../../routes/paths';

// ── Hook mocks (avoid hitting wallet / notifications / reviewer BE) ─────────
vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    wallet: null,
    balance: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

vi.mock('../../hooks/useReviewerProfiles', () => ({
  useReviewerAvailability: () => ({
    isAvailable: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../services/reviewer.service', () => ({
  reviewerService: {
    updateAvailability: () => Promise.resolve(),
  },
}));

// ── Auth mock — swap role per test ──────────────────────────────────────────
const useAuthMock = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

// Stub the wallet top-up modal so we don't pull its real implementation.
vi.mock('../../components/wallet/WalletTopUpModal', () => ({
  WalletTopUpModal: () => null,
}));

// Authenticated active user helper.
const setupRole = (role: string) => {
  useAuthMock.mockReturnValue({
    user: {
      token: 'mock-token',
      username: 'tester',
      email: 'tester@example.com',
      role,
      userId: 99,
      isActive: true,
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: () => Promise.resolve(),
    logout: () => undefined,
    clearError: () => undefined,
    pendingRoleSelection: null,
    confirmRoleSelection: () => undefined,
    cancelRoleSelection: () => undefined,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  // Clear any persisted ars_user so the admin dual-signal check in
  // MainLayout can't accidentally flip the role to Admin.
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const renderMainLayout = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
    </MemoryRouter>,
  );

// Renders MainLayout and a sentinel route at /premium-packages so we can
// assert that the MemoryRouter actually advanced the URL after the click.
const renderMainLayoutWithSentinel = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
      <Routes>
        <Route
          path={ROUTES.PREMIUM_PACKAGES}
          element={<div data-testid="premium-page-reached" />}
        />
      </Routes>
    </MemoryRouter>,
  );

const findSidebarLinkByHref = (href: string): HTMLAnchorElement | null =>
  document.querySelector(`aside a[href="${href}"]`);

describe('MainLayout — Premium Package sidebar item', () => {
  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ])('%s sidebar contains a real-path /premium-packages link', (role) => {
    setupRole(role);
    renderMainLayout('/premium-packages');

    const link = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(link).not.toBeNull();
    expect(link).toBeInstanceOf(HTMLAnchorElement);
    expect(link?.getAttribute('href')).toBe('/premium-packages');
    // The legacy plural "Premium Packages" placeholder must not survive.
    expect(link?.textContent ?? '').toMatch(/Premium Package/);
    expect(link?.textContent ?? '').not.toMatch(/Premium Packages/);
  });

  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ])(
    '%s sidebar does NOT expose a #premium-packages hash placeholder',
    (role) => {
      setupRole(role);
      renderMainLayout('/forum');

      const hashLink = document.querySelector(
        'aside a[href="#premium-packages"]',
      );
      expect(hashLink).toBeNull();

      // The hash placeholder must also not leak as a disabled nav row.
      const sidebar = document.querySelector('aside');
      expect(sidebar?.textContent ?? '').not.toMatch(/#premium-packages/);
      // The real-path link is in the sidebar though.
      const realLink = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
      expect(realLink).not.toBeNull();
    },
  );

  it('Admin sidebar still has /admin/packages and NOT /premium-packages', () => {
    setupRole('Admin');
    renderMainLayout(ROUTES.ADMIN_PACKAGES);

    // Admin legacy packages link still present.
    const adminLink = findSidebarLinkByHref(ROUTES.ADMIN_PACKAGES);
    expect(adminLink).not.toBeNull();
    expect(adminLink?.textContent ?? '').toMatch(/Packages/i);

    // The new user-facing route must NOT appear in Admin's sidebar.
    const userLink = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(userLink).toBeNull();
  });

  it('clicking the sidebar link navigates to /premium-packages and applies the active class', async () => {
    const user = userEvent.setup();
    setupRole('Researcher');
    renderMainLayoutWithSentinel('/forum');

    const link = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(link).not.toBeNull();
    if (!link) return;

    await user.click(link);

    // The MemoryRouter advanced: the sentinel route is now mounted.
    expect(screen.getByTestId('premium-page-reached')).toBeInTheDocument();
    // The active class should be applied to the same link.
    const activeLink = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(activeLink?.className ?? '').toMatch(/navItemActive/);
  });

  it('renders an accessible label "Premium Package" on the sidebar link', () => {
    setupRole('Graduate Student');
    renderMainLayout(ROUTES.FORUM);

    const link = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(link).not.toBeNull();
    // The link's accessible name comes from its visible text.
    const labelEl = within(link as HTMLElement).getByText(/Premium Package/i);
    expect(labelEl).toBeInTheDocument();
  });
});
