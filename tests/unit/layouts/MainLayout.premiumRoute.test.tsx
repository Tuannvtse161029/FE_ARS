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
 * Sidebar nav regression: every non-Admin role hides the
 * `/premium-packages` link while the central `premiumPackagesEnabled`
 * feature flag is `false` (Agent admin-annual-fees — the BE-side
 * annual-fee CRUD endpoint is being finalized, so the surface is
 * temporarily unavailable to non-Admin roles). Admin does NOT expose
 * that link and still owns the legacy `/admin/packages` route plus the
 * new `/admin/annual-fees` tab.
 *
 * When the flag is restored to `true`, the link reappears for every
 * non-Admin role; the positive-path coverage is preserved by the
 * sibling tests/unit/layouts/MainLayout.premiumRoute.test.tsx file.
 *
 * Uses the shared `renderMainLayout` test harness so hook mocks and
 * helpers aren't duplicated from the other MainLayout tests.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { MainLayout } from '../../../src/layouts/MainLayout';
import { ROUTES } from '../../../src/routes/paths';

describe('MainLayout — Premium Package sidebar gating (Agent admin-annual-fees)', () => {
  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ])(
    '%s sidebar hides the /premium-packages link while premiumPackagesEnabled is false',
    (role) => {
      setMockAuth({ role });
      renderMainLayout('/forum');

      const link = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
      expect(link).toBeNull();

      const sidebar = document.querySelector('aside');
      expect(sidebar?.textContent ?? '').not.toMatch(/Premium Package/i);
    },
  );

  it('Admin sidebar still has /admin/packages and NOT /premium-packages', () => {
    setMockAuth({ role: 'Admin', roleId: 2 });
    renderMainLayout(ROUTES.ADMIN_PACKAGES);

    const adminLink = findSidebarLinkByHref(ROUTES.ADMIN_PACKAGES);
    expect(adminLink).not.toBeNull();
    expect(adminLink?.textContent ?? '').toMatch(/Packages/i);

    const userLink = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(userLink).toBeNull();
  });

  it('Guest sidebar hides the /premium-packages link', () => {
    setMockAuth({
      role: 'Researcher',
      isActive: false,
      verificationStatus: 'Pending',
    });
    renderMainLayout('/forum');

    const link = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(link).toBeNull();
  });
});

import { ROUTES } from '../../../src/routes/paths';
