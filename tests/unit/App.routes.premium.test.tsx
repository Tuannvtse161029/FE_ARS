/**
 * App-level routing tests for the user-facing /premium-packages route.
 *
 * Mounts the real App.tsx with mocked auth + backend hooks so we can verify:
 *   - Navigating to /premium-packages renders the PremiumPackagesPreview page.
 *   - Refreshing (re-mounting) the same URL still renders the page — i.e. the
 *     route is not silently redirected back to /login.
 *   - The admin /admin/packages route still renders the admin PremiumPackages
 *     component (regression guard: the new route shouldn't collide).
 *   - The two pages are NOT the same component (no accidental reuse of the
 *     admin surface for the user-facing preview).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import App from '../App';
import { ROUTES } from '../routes/paths';
import { buildMockAuth } from './utils/mockAuth';

// ── Auth mock (swap per test) ────────────────────────────────────────────────
const useAuthMock = vi.fn();
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Avoid pulling real wallet / notifications / reviewer-availability / wallet
// top-up modal behaviour from MainLayout in this routing test.
vi.mock('../src/hooks/useWallet', () => ({
  useWallet: () => ({
    wallet: null,
    balance: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  }),
}));
vi.mock('../src/hooks/useNotifications', () => ({
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
vi.mock('../src/hooks/useReviewerProfiles', () => ({
  useReviewerAvailability: () => ({
    isAvailable: false,
    refetch: () => Promise.resolve(),
  }),
}));
vi.mock('../src/services/reviewer.service', () => ({
  reviewerService: { updateAvailability: () => Promise.resolve() },
}));
vi.mock('../src/components/wallet/WalletTopUpModal', () => ({
  WalletTopUpModal: () => null,
}));

// Mock the admin PremiumPackages component so we can assert it is still
// rendered on /admin/packages without pulling its full data-fetching
// implementation. This also lets us distinguish the admin page from the
// user preview by sentinel text.
vi.mock('../src/pages/Admin/PremiumPackages', () => ({
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
  // The real App uses BrowserRouter which reads window.location. We can't
  // redirect the test runner's window, so we drive the route via
  // MemoryRouter by reaching into a thin wrapper. Since App is hardcoded
  // to BrowserRouter, we instead just assert based on window.location.
  window.history.replaceState({}, '', path);
  return render(<App />);
};

describe('App routing — /premium-packages (user-facing)', () => {
  it('renders the PremiumPackagesPreview page when navigating to /premium-packages', () => {
    setupAuthenticated('Researcher');
    renderAt(ROUTES.PREMIUM_PACKAGES);

    // The user-facing preview shows a single <h1> with text "Premium Package".
    expect(
      screen.getByRole('heading', { name: /Premium Package/i, level: 1 }),
    ).toBeInTheDocument();
    // And the preview badge ("Coming soon") is present.
    expect(screen.getByTestId('preview-badge')).toHaveTextContent(
      /coming soon/i,
    );
    // The admin surface sentinel must NOT be on the page.
    expect(screen.queryByTestId('admin-premium-packages')).not.toBeInTheDocument();
  });

  it('keeps the PremiumPackagesPreview page mounted on refresh (no /login redirect)', () => {
    setupAuthenticated('Researcher');
    // First mount
    const firstRender = renderAt(ROUTES.PREMIUM_PACKAGES);
    expect(
      screen.getByRole('heading', { name: /Premium Package/i, level: 1 }),
    ).toBeInTheDocument();

    // Simulate a "refresh" by unmounting and re-rendering at the same URL.
    firstRender.unmount();
    cleanup();
    renderAt(ROUTES.PREMIUM_PACKAGES);

    // Still rendered — no silent redirect to /login.
    expect(
      screen.getByRole('heading', { name: /Premium Package/i, level: 1 }),
    ).toBeInTheDocument();
    // The login page heading must NOT be present.
    expect(
      screen.queryByRole('heading', { name: /Sign in|Log in|Login/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the admin PremiumPackages component on /admin/packages (no collision)', () => {
    setupAuthenticated('Admin');
    renderAt(ROUTES.ADMIN_PACKAGES);

    // The admin sentinel shows.
    expect(screen.getByTestId('admin-premium-packages')).toBeInTheDocument();
    // The user preview sentinel does not.
    expect(screen.queryByTestId('preview-badge')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users on /premium-packages to /login', () => {
    useAuthMock.mockReturnValue(
      buildMockAuth({ role: null, isAuthenticated: false }),
    );
    renderAt(ROUTES.PREMIUM_PACKAGES);

    // PrivateRoute should bounce the unauthenticated user to /login.
    expect(window.location.pathname).toBe(ROUTES.LOGIN);
    // The preview page should NOT be on screen.
    expect(screen.queryByTestId('preview-badge')).not.toBeInTheDocument();
  });
});
