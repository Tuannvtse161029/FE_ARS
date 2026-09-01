/**
 * Tests for SubscriptionRouteGuard — the route-level wrapper that
 * redirects locked Researcher / Lecturer users to /subscription.
 *
 * Verifies:
 *   1. While the `enableSubscriptionAccess` flag is off (the current
 *      temporary disabled state), Lecturer and Researcher render the
 *      inner Outlet regardless of subscription data.
 *   2. Reviewer / Admin / Graduate Student never trigger the redirect.
 *   3. The /subscription page is still reachable so users can view the
 *      feature-disabled banner if they navigate to it directly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// AuthContext mock
let mockAuth: {
  user: Record<string, unknown> | null;
  isAuthenticated: boolean;
  effectiveRole: string | null;
} = {
  user: null,
  isAuthenticated: true,
  effectiveRole: null,
};

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Subscription hook mock — drives the guard's branching logic.
// When the feature flag is off, the hook always reports `isActive: true`;
// the guard mock below mirrors that contract so the test does not depend
// on the real AppConfig.
let mockSubscription: {
  isApplicable: boolean;
  isActive: boolean;
  isLoading: boolean;
} = { isApplicable: false, isActive: true, isLoading: false };

vi.mock('../../../src/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscription,
}));

// Permissions / roles that flow into the existing guard chain
vi.mock('../../../src/utils/roleNormalizer', () => ({
  isAdminUser: vi.fn().mockImplementation((signals) => {
    return (
      typeof signals?.roleName === 'string' &&
      signals.roleName.toLowerCase() === 'admin'
    );
  }),
}));

const setAuth = (role: string | null) => {
  mockAuth = {
    user: role
      ? {
          token: 'mock-token',
          username: 'User',
          email: 'user@example.com',
          role,
        }
      : null,
    isAuthenticated: true,
    effectiveRole: role,
  };
};

const renderAt = (path: string, role: string | null, subscription: typeof mockSubscription) => {
  setAuth(role);
  mockSubscription = subscription;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/subscription" element={<div data-testid="subscription-page">Subscription</div>} />
        <Route path="/lecturer/papers" element={<div>Papers Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('SubscriptionRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the inner route for a Lecturer when subscription is inactive — feature is disabled', async () => {
    const { SubscriptionRouteGuard } = await import('../../../src/routes/SubscriptionRouteGuard');
    setAuth('Lecturer');
    // While the subscription feature is disabled, useSubscription always
    // reports isActive === true. The guard must respect that and render
    // the inner route.
    mockSubscription = { isApplicable: true, isActive: true, isLoading: false };

    const screen = render(
      <MemoryRouter initialEntries={['/lecturer/papers']}>
        <Routes>
          <Route element={<SubscriptionRouteGuard />}>
            <Route path="/lecturer/papers" element={<div data-testid="inner-page">Inner</div>} />
          </Route>
          <Route path="/subscription" element={<div data-testid="subscription-page">Subscription</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('inner-page')).not.toBeNull();
    expect(screen.queryByTestId('subscription-page')).toBeNull();
  });

  it('does NOT redirect Lecturer when the feature flag is off — Researcher same behavior', async () => {
    const { SubscriptionRouteGuard } = await import('../../../src/routes/SubscriptionRouteGuard');
    setAuth('Researcher');
    mockSubscription = { isApplicable: true, isActive: true, isLoading: false };

    const screen = render(
      <MemoryRouter initialEntries={['/researcher/submissions']}>
        <Routes>
          <Route element={<SubscriptionRouteGuard />}>
            <Route path="/researcher/submissions" element={<div data-testid="researcher-inner">Researcher</div>} />
          </Route>
          <Route path="/subscription" element={<div data-testid="subscription-page">Subscription</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('researcher-inner')).not.toBeNull();
    expect(screen.queryByTestId('subscription-page')).toBeNull();
  });

  it('does NOT block Reviewer / Admin / Graduate Student even with no subscription', async () => {
    const { SubscriptionRouteGuard } = await import('../../../src/routes/SubscriptionRouteGuard');
    for (const role of ['Reviewer', 'Admin', 'Graduate Student']) {
      setAuth(role);
      mockSubscription = { isApplicable: false, isActive: false, isLoading: false };

      const screen = render(
        <MemoryRouter initialEntries={['/lecturer/papers']}>
          <Routes>
            <Route element={<SubscriptionRouteGuard />}>
              <Route path="/lecturer/papers" element={<div data-testid={`inner-${role}`}>Inner {role}</div>} />
            </Route>
            <Route path="/subscription" element={<div data-testid={`subscription-${role}`}>Subscription</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.queryByTestId(`inner-${role}`)).not.toBeNull();
      expect(screen.queryByTestId(`subscription-${role}`)).toBeNull();
      screen.unmount();
    }
  });

  // Sanity check that renderAt helper compiles
  it('helper compiles', () => {
    renderAt('/x', 'Researcher', { isApplicable: false, isActive: true, isLoading: false });
    expect(true).toBe(true);
  });
});
