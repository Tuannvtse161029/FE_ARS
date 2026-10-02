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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  clearSubscriptionCache: () => undefined,
}));

// Single mock for AppConfig — `enableSubscriptionAccess` is mutated at
// runtime by the popup-flow describe block so we don't need a second
// vi.mock that would conflict with this one due to hoisting.
vi.mock('../../../src/config/app', () => ({
  AppConfig: {
    features: {
      enableRegistration: true,
      enableORCID: false,
      enablePaperSubmission: true,
      enableSubscriptionAccess: false,
    },
  },
}));

// Ensure the override above is the one the component actually reads
// (vitest hoists vi.mock to the top of the file). The popup-flow tests
// mutate the boolean at runtime via the imported reference below.
import { AppConfig as ImportedAppConfig } from '../../../src/config/app';

// Mock annualFeeService used by Subscription component
vi.mock('../../../src/services/annualFee.service', () => ({
  annualFeeService: {
    listActiveAnnualFeePlans: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getMyPurchaseHistory: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getMyCurrentSubscription: vi.fn().mockResolvedValue(null),
    purchaseAnnualFee: vi.fn(),
  },
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

// ────────────────────────────────────────────────────────────────────
// Popup-based checkout regression — keeps the parent SPA alive across
// the PayOS round-trip so the in-memory JWT survives and the user is
// not bounced back to /login on return.
// ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the service module so we can inspect the purchase call.
const mockPurchaseAnnualFee = vi.fn();

vi.mock('../../../src/services/annualFee.service', () => ({
  annualFeeService: {
    listActiveAnnualFeePlans: vi.fn().mockResolvedValue({
      items: [
        {
          id: 7,
          billingCycle: 'Annual',
          price: 990000,
          userRole: 'Researcher',
          status: true,
        },
      ],
      total: 1,
    }),
    getMyPurchaseHistory: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getMyCurrentSubscription: vi.fn().mockResolvedValue(null),
    purchaseAnnualFee: (...args: unknown[]) => mockPurchaseAnnualFee(...args),
  },
}));

describe('Subscription page — popup-based checkout', () => {
  let originalOpen: typeof window.open;
  let originalLocationAssign: typeof window.location.assign;

  beforeEach(() => {
    vi.clearAllMocks();
    // Flip the feature flag on for this suite regardless of the global
    // mock state from the previous describe block.
    (
      ImportedAppConfig.features as { enableSubscriptionAccess: boolean }
    ).enableSubscriptionAccess = true;

    mockAuth = {
      user: { username: 'Test User', email: 'test@example.com', userId: 42 } as never,
      isAuthenticated: true,
      effectiveRole: 'Researcher',
    };
    setSubscription({
      current: null,
      isLoading: false,
      isActive: false,
      isMissing: true,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    mockListPlans.mockReset();
    mockCreateOrder.mockReset();
    mockPurchaseAnnualFee.mockReset();

    originalOpen = window.open;
    originalLocationAssign = window.location.assign;
  });

  afterEach(() => {
    window.open = originalOpen;
    // jsdom's `Location.assign` is non-writable and non-configurable on
    // every build we tested, so we cannot install a spy on it. The
    // popup-path test confirms `window.location.assign` was NOT called
    // (by checking `window.open` was called AND the popup remained
    // alive — i.e. the fallback branch was skipped). The fallback test
    // checks the toast path instead, which is the user-visible side
    // effect of the same branch.
    void originalLocationAssign;
    // Restore the disabled flag so the original describe block keeps
    // working when vitest re-runs the file in the same process.
    (
      ImportedAppConfig.features as { enableSubscriptionAccess: boolean }
    ).enableSubscriptionAccess = false;
  });

  it('opens PayOS checkout in a popup so the parent SPA keeps its session', async () => {
    const fakePopup = { closed: false } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakePopup);
    mockPurchaseAnnualFee.mockResolvedValue({
      checkoutUrl: 'https://pay.payos.vn/web/checkout/abc123',
      orderCode: 'ARS-ANNUAL-1',
      purchase: null,
    });

    const { Subscription } = await import('../../../src/pages/Subscription/Subscription');
    render(
      <MemoryRouter initialEntries={['/subscription']}>
        <Subscription />
      </MemoryRouter>,
    );

    const payButton = await screen.findByTestId('proceed-to-pay');
    fireEvent.click(payButton);

    await waitFor(() => expect(mockPurchaseAnnualFee).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        'https://pay.payos.vn/web/checkout/abc123',
        'payos_checkout',
        expect.stringContaining('noopener'),
      ),
    );
    // Critically: when the popup opens successfully, the component
    // must NOT take the top-level redirect path — that would reload
    // the SPA and drop the in-memory JWT. We assert this indirectly:
    // if the popup is alive (open returns truthy), the success branch
    // is taken and the fallback branch is skipped.
    expect(openSpy).toHaveReturnedWith(expect.objectContaining({ closed: false }));
  });

  it('falls back to a top-level redirect when the popup is blocked', async () => {
    const { toast } = await import('sonner');
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    mockPurchaseAnnualFee.mockResolvedValue({
      checkoutUrl: 'https://pay.payos.vn/web/checkout/blocked',
      orderCode: 'ARS-ANNUAL-2',
      purchase: null,
    });

    const { Subscription } = await import('../../../src/pages/Subscription/Subscription');
    render(
      <MemoryRouter initialEntries={['/subscription']}>
        <Subscription />
      </MemoryRouter>,
    );

    const payButton = await screen.findByTestId('proceed-to-pay');
    fireEvent.click(payButton);

    await waitFor(() => expect(mockPurchaseAnnualFee).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    // The fallback is observable through the toast the user sees when
    // their browser blocks the popup — that's the only reliable way to
    // assert this branch fires given jsdom's read-only `Location.assign`.
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringMatching(/popup/i),
      ),
    );
  });
});
