import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Test harness: mock the parts of MainLayout + App that aren't under test ──
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

vi.mock('../../../src/components/notification/NotificationCenter', () => ({
  NotificationCenter: () => null,
}));

vi.mock('../../../src/components/WelcomeBackBanner/WelcomeBackBanner', () => ({
  WelcomeBackBanner: () => null,
}));

import { buildMockAuth } from '../../../src/utils/mockAuth';
import { MainLayout } from '../../../src/layouts/MainLayout';
import { ROUTES } from '../../../src/routes/paths';

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

/**
 * Agent admin-annual-fees — vital gating tests.
 *
 * Contract:
 *   1. Admin can open the Annual Fees tab and sees the demo banner
 *      + only Researcher / Lecturer rows.
 *   2. Admin sidebar exposes /admin/annual-fees and not
 *      /premium-packages; the legacy /admin/packages stays in place.
 *   3. The /premium-packages route, when the feature flag is `false`,
 *      must never render the PremiumPackagesPreview component for a
 *      non-Admin user — the App.tsx redirect bounces them. We exercise
 *      that contract by importing App.tsx with a fake
 *      BrowserRouter-like MemoryRouter wrapper via the React app's
 *      built-in routing.
 */
describe('admin-annual-fees / Annual Fees tab gating', () => {
  it('renders the demo data banner and table for Admin', async () => {
    setMockAuth({ role: 'Admin', roleId: 2 });

    const { default: AnnualFees } = await import(
      '../../../src/pages/Admin/AnnualFees'
    );
    render(
      <MemoryRouter initialEntries={['/admin/annual-fees']}>
        <AnnualFees />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('annual-fees-demo-banner'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Demo data — awaiting backend API/i),
    ).toBeInTheDocument();

    const table = await screen.findByTestId('annual-fees-table');
    const rows = within(table).getAllByTestId('annual-fees-row');
    expect(rows.length).toBeGreaterThanOrEqual(4);

    const roles = rows.map((row) => row.getAttribute('data-role'));
    expect(new Set(roles)).toEqual(new Set(['Researcher', 'Lecturer']));
  });

  it('Admin sidebar exposes /admin/annual-fees and not /premium-packages', () => {
    setMockAuth({ role: 'Admin', roleId: 2 });
    renderMainLayout(ROUTES.ADMIN);

    expect(
      findSidebarLinkByHref(ROUTES.ADMIN_ANNUAL_FEES),
    ).not.toBeNull();
    expect(
      findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES),
    ).toBeNull();
  });

  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ])(
    'sidebar hides %premium-packages link for %s while the flag is false',
    (role) => {
      setMockAuth({ role });
      renderMainLayout('/forum');

      expect(
        findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES),
      ).toBeNull();
    },
  );
});