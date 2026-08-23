import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Standard MainLayout test mock surface (CORE_KEEP: sidebar/header/wallet) ──
const useAuthMockLocal = vi.fn();

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => useAuthMockLocal(),
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: (selector: unknown) =>
    typeof selector === 'function'
      ? selector({ user: null, isAuthenticated: false })
      : { user: null, isAuthenticated: false },
}));

vi.mock('../../../src/hooks/useWallet', () => ({
  useWallet: () => ({
    wallet: null,
    balance: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  }),
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

vi.mock('../../../src/components/wallet/WalletTopUpModal', () => ({
  WalletTopUpModal: () => null,
}));

import { buildMockAuth } from '../../../src/utils/mockAuth';
import { MainLayout } from '../../../src/layouts/MainLayout';

beforeEach(() => {
  useAuthMockLocal.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const setMockAuth = (opts: Parameters<typeof buildMockAuth>[0] = {}) => {
  useAuthMockLocal.mockReturnValue(buildMockAuth(opts));
};

const renderMainLayout = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
    </MemoryRouter>,
  );

const findSidebarLinkByHref = (href: string): HTMLAnchorElement | null => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const anchors = aside.querySelectorAll('a');
  for (const a of Array.from(anchors)) {
    if (a.getAttribute('href') === href) return a as HTMLAnchorElement;
  }
  return null;
};

const findSidebarLinkByText = (text: string): HTMLAnchorElement | null => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const lower = text.toLowerCase();
  const anchors = aside.querySelectorAll('a');
  for (const a of Array.from(anchors)) {
    const t = (a.textContent ?? '').toLowerCase();
    if (t.includes(lower)) return a as HTMLAnchorElement;
  }
  return null;
};
/**
 * Sidebar nav regression: every non-Admin role exposes a real
 * `/premium-packages` link (singular label), Admin does NOT expose that
 * link, and Admin still owns the legacy `/admin/packages` route.
 *
 * Uses the shared `renderMainLayout` test harness so hook mocks and helpers
 * aren't duplicated from the other MainLayout tests.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { MainLayout } from '../../../src/layouts/MainLayout';
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

describe('MainLayout — Premium Package sidebar item', () => {
  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ])('%s sidebar contains a real-path /premium-packages link', (role) => {
    setMockAuth({ role });
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
      setMockAuth({ role });
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
    setMockAuth({ role: 'Admin', roleId: 2 });
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
    setMockAuth({ role: 'Researcher' });
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
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    const link = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(link).not.toBeNull();
    // The link's accessible name comes from its visible text.
    const labelEl = within(link as HTMLElement).getByText(/Premium Package/i);
    expect(labelEl).toBeInTheDocument();
  });
});

import { ROUTES } from '../../../src/routes/paths';
