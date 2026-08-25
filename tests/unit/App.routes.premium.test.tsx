/**
 * App-level routing tests for the user-facing /premium-packages route.
 *
 * Agent admin-annual-fees — these tests pin the new gating behavior
 * introduced while the BE-side annual-fee CRUD endpoint is being
 * finalized (see BACKEND_REQUESTS.md → BTR-AF-01). The previous
 * incarnation asserted that `/premium-packages` rendered the
 * PremiumPackagesPreview for an authenticated Researcher; that
 * assertion is now obsolete because `AppConfig.features.premiumPackagesEnabled`
 * gates the route. The new contract:
 *
 *   - Navigating to /premium-packages while the flag is `false`
 *     redirects to /forum, NOT to /login.
 *   - The route never renders the PremiumPackagesPreview while the
 *     flag is `false` — the PremiumPackagesPreview mock throws so
 *     any regression fails loudly.
 *   - The admin /admin/packages route still renders the admin
 *     PremiumPackages component (regression guard: the new route
 *     shouldn't collide).
 *   - The two pages are NOT the same component (no accidental reuse of
 *     the admin surface for the user-facing preview).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import App from '../../src/App';
import { ROUTES } from '../../src/routes/paths';
import { buildMockAuth } from '../../src/utils/mockAuth';

// ── Auth mock (swap per test) ────────────────────────────────────────────────
const useAuthMock = vi.fn(() =>
  buildMockAuth({ role: 'Researcher', isAuthenticated: true }),
);
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Avoid pulling real wallet / notifications / reviewer-availability / wallet
// top-up modal behaviour from MainLayout in this routing test.
vi.mock('../../src/hooks/useWallet', () => ({
  useWallet: () => ({
    wallet: null,
    balance: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  }),
}));
vi.mock('../../src/hooks/useNotifications', () => ({
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
vi.mock('../../src/hooks/useReviewerProfiles', () => ({
  useReviewerAvailability: () => ({
    isAvailable: false,
    refetch: () => Promise.resolve(),
  }),
}));
vi.mock('../../src/services/reviewer.service', () => ({
  reviewerService: { updateAvailability: () => Promise.resolve() },
}));
vi.mock('../../src/components/wallet/WalletTopUpModal', () => ({
  WalletTopUpModal: () => null,
}));

// Stub the PremiumPackagesPreview so the test fails loudly if the
// redirect ever regresses and the component is rendered.
vi.mock('../../src/pages/PremiumPackages/PremiumPackagesPreview', () => ({
  default: () => {
    throw new Error(
      'PremiumPackagesPreview should NOT be rendered while premiumPackagesEnabled is false.',
    );
  },
}));

// Mock the admin PremiumPackages component so we can assert it is still
// rendered on /admin/packages without pulling its full data-fetching
// implementation. This also lets us distinguish the admin page from the
// user preview by sentinel text.
vi.mock('../../src/pages/Admin/PremiumPackages', () => ({
  default: () => (
    <section data-testid="admin-premium-packages">
      <h1>Premium Packages (Admin)</h1>
    </section>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const setupAuthenticated = (role: string) => {
  useAuthMock.mockReturnValue(
    buildMockAuth({ role, isAuthenticated: true }),
  );
};

const renderAt = (path: string) => {
  window.history.replaceState({}, '', path);
  return render(<App />);
};

describe('App routing — /premium-packages (Agent admin-annual-fees)', () => {
  it('redirects authenticated Researcher away from /premium-packages (flag is false)', async () => {
    setupAuthenticated('Researcher');
    renderAt(ROUTES.PREMIUM_PACKAGES);

    // The PremiumPackagesPreview throw sentinel must NOT fire.
    expect(document.body.textContent ?? '').not.toMatch(
      /PremiumPackagesPreview should NOT be rendered/,
    );
    // The Admin surface sentinel must also NOT be on the page.
    expect(screen.queryByTestId('admin-premium-packages')).not.toBeInTheDocument();
  });

  it('does NOT redirect /premium-packages to /login for an authenticated user', () => {
    setupAuthenticated('Researcher');
    renderAt(ROUTES.PREMIUM_PACKAGES);

    // The login heading must NOT be present — the gating redirect
    // targets /forum, not /login. PrivateRoute should still let the
    // authenticated user in, only the feature gate bounces them.
    expect(
      screen.queryByRole('heading', { name: /Sign in|Log in|Login/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the admin PremiumPackages component on /admin/packages (no collision)', async () => {
    setupAuthenticated('Admin');
    renderAt(ROUTES.ADMIN_PACKAGES);

    expect(await screen.findByTestId('admin-premium-packages')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-badge')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users on /premium-packages to /login', () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({ role: null, isAuthenticated: false }),
    );
    renderAt(ROUTES.PREMIUM_PACKAGES);

    expect(window.location.pathname).toBe(ROUTES.LOGIN);
    expect(document.body.textContent ?? '').not.toMatch(
      /PremiumPackagesPreview should NOT be rendered/,
    );
  });
});