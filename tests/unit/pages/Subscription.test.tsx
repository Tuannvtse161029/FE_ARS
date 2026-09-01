/**
 * Tests for the Subscription page — Researcher / Lecturer paid-access UI.
 *
 * Verifies:
 *   1. While the `enableSubscriptionAccess` feature flag is off
 *      (the current temporary disabled state), the page renders the
 *      "feature disabled" banner, hides plan selection, and does NOT
 *      render the `Proceed to Pay` button.
 *   2. The page never shows a fake price or initiates a PayOS order
 *      while the feature is disabled.
 *   3. Wallet money flows remain absent — no top-up, no withdrawal,
 *      no reviewer fee controls anywhere on the page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// AuthContext mock
let mockAuth: {
  user: { username: string; email: string } | null;
  isAuthenticated: boolean;
  effectiveRole: string | null;
} = {
  user: { username: 'Test User', email: 'test@example.com' },
  isAuthenticated: true,
  effectiveRole: 'Researcher',
};

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Subscription hook mock — mirrors the disabled-state contract.
let mockSubscriptionHook: {
  current: unknown;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<void>;
  isApplicable: boolean;
  isActive: boolean;
  isExpired: boolean;
  isMissing: boolean;
} = {
  current: null,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  isApplicable: true,
  isActive: true,
  isExpired: false,
  isMissing: true,
};

vi.mock('../../../src/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscriptionHook,
}));

// Service mocks
const mockListPlans = vi.fn();
const mockCreateOrder = vi.fn();

vi.mock('../../../src/services/subscription.service', () => ({
  subscriptionService: {
    listPlans: (...args: unknown[]) => mockListPlans(...args),
    getCurrentSubscription: vi.fn(),
    createOrder: (...args: unknown[]) => mockCreateOrder(...args),
    getPaymentStatus: vi.fn(),
  },
}));

const setSubscription = (overrides: Partial<typeof mockSubscriptionHook>) => {
  mockSubscriptionHook = {
    current: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    isApplicable: true,
    isActive: true,
    isExpired: false,
    isMissing: true,
    ...overrides,
  };
};

describe('Subscription page — feature temporarily disabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = {
      user: { username: 'Test User', email: 'test@example.com' },
      isAuthenticated: true,
      effectiveRole: 'Researcher',
    };
    setSubscription({});
    mockListPlans.mockReset();
    mockCreateOrder.mockReset();
  });

  it('renders the "feature disabled" banner and no Proceed-to-Pay button', async () => {
    setSubscription({});
    mockListPlans.mockResolvedValue([]);

    const { Subscription } = await import('../../../src/pages/Subscription/Subscription');
    render(
      <MemoryRouter initialEntries={['/subscription']}>
        <Subscription />
      </MemoryRouter>,
    );

    // Banner appears.
    expect(
      await screen.findByTestId('subscription-feature-disabled'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Annual subscription is temporarily unavailable/i),
    ).toBeInTheDocument();

    // No plan cards, no Proceed-to-Pay button.
    expect(screen.queryByTestId('plan-card-6')).toBeNull();
    expect(screen.queryByTestId('plan-card-12')).toBeNull();
    expect(screen.queryByTestId('proceed-to-pay')).toBeNull();

    // Service is never called for orders while the feature is disabled.
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('never invokes the PayOS order endpoint when feature is disabled', async () => {
    setSubscription({});
    mockListPlans.mockResolvedValue([
      {
        id: 11,
        durationMonths: 6,
        priceVnd: 250000,
        currency: 'VND',
        isActive: true,
      },
    ]);

    const { Subscription } = await import('../../../src/pages/Subscription/Subscription');
    render(
      <MemoryRouter initialEntries={['/subscription']}>
        <Subscription />
      </MemoryRouter>,
    );

    // The button is not in the DOM at all.
    expect(screen.queryByTestId('proceed-to-pay')).toBeNull();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('does NOT render any wallet top-up, withdrawal, or reviewer fee controls', async () => {
    setSubscription({});
    mockListPlans.mockResolvedValue([]);

    const { Subscription } = await import('../../../src/pages/Subscription/Subscription');
    render(
      <MemoryRouter initialEntries={['/subscription']}>
        <Subscription />
      </MemoryRouter>,
    );

    expect(
      await screen.findByTestId('subscription-feature-disabled'),
    ).toBeInTheDocument();

    expect(screen.queryByText(/top[ -]?up/i)).toBeNull();
    expect(screen.queryByText(/withdraw/i)).toBeNull();
    expect(screen.queryByText(/reviewer fee/i)).toBeNull();
    expect(screen.queryByText(/cash[ -]?out/i)).toBeNull();
  });
});
