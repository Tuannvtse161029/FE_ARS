/**
 * Tests for useSubscription — Researcher / Lecturer paid-access hook.
 *
 * Verifies:
 *   1. Researcher and Lecturer always get `isActive === true` when the
 *      `enableSubscriptionAccess` feature flag is `false`.
 *   2. Reviewer, Graduate Student, and Admin never trigger the
 *      subscription gate (`isApplicable === false`, `isActive === true`
 *      regardless of subscription data).
 *   3. When the BE call fails, the hook surfaces the error and never
 *      invents a subscription.
 *   4. The BE can return `purchase: null` when `ExpiresAt` was migrated to
 *      `UserSubscriptions` — the hook must not crash and must read
 *      `expiresAt` from the new location.
 *   5. The BE's `isExpired` flag is authoritative; client date math is a
 *      fallback only.
 *
 * Live network calls are avoided — every test mocks the annual fee
 * service and the AppConfig feature flag.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── AppConfig mock factory ────────────────────────────────────────────────────
//
// Every test explicitly opts into the disabled state. This makes `isActive`
// always `true` for all roles, which is the temporary configuration while
// the BE pricing is still being validated. When the flag is later re-enabled,
// the tests should be updated to cover the active-subscription scenarios.
const enableSubscriptionAccess = false;

vi.mock('../../../src/config/app', () => ({
  AppConfig: {
    features: {
      enableSubscriptionAccess,
    },
  },
}));

// ── AuthContext mock factory ────────────────────────────────────────────────
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

// ── AnnualFee service mock factory ──────────────────────────────────────────
let mockCurrentSubscription: unknown = null;
let mockGetMyCurrentSubscription = vi.fn();

vi.mock('../../../src/services/annualFee.service', () => ({
  annualFeeService: {
    listAnnualFeePlans: vi.fn(),
    listActiveAnnualFeePlans: vi.fn(),
    getAnnualFeePlan: vi.fn(),
    createAnnualFeePlan: vi.fn(),
    updateAnnualFeePlan: vi.fn(),
    deleteAnnualFeePlan: vi.fn(),
    toggleAnnualFeePlan: vi.fn(),
    purchaseAnnualFee: vi.fn(),
    getMyCurrentSubscription: (...args: unknown[]) =>
      mockGetMyCurrentSubscription(...args),
    getMyPurchaseHistory: vi.fn(),
  },
}));

const setAuth = (
  role: string | null,
  extras: Record<string, unknown> = {},
) => {
  mockAuth = {
    user: role
      ? {
          token: 'mock-token',
          username: 'Test User',
          email: 'test@example.com',
          role,
          ...extras,
        }
      : null,
    isAuthenticated: true,
    effectiveRole: role,
  };
};

const setSubscription = (value: unknown) => {
  mockCurrentSubscription = value;
  mockGetMyCurrentSubscription = vi
    .fn()
    .mockResolvedValue(mockCurrentSubscription);
};

const importFresh = async () => {
  vi.resetModules();
  const mod = await import('../../../src/hooks/useSubscription');
  return mod.useSubscription;
};

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentSubscription = null;
    setAuth(null);
  });

  it('always reports active when the enableSubscriptionAccess flag is off — Researcher with EXPIRED subscription', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    setAuth('Researcher');
    setSubscription({
      purchase: {
        transactionId: 'TX-001',
        userId: 7,
        annualFeeId: 2,
        amount: 990000,
        status: 'Paid',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        expiryDate: past,
      },
      annualFee: {
        id: 2,
        name: 'Researcher Yearly',
        userRole: 'Researcher',
        price: 990000,
        billingCycle: 'Year',
        status: true,
      },
      daysRemaining: 0,
      isExpired: true,
    });

    const useSubscription = await importFresh();
    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.isApplicable).toBe(true);
    // Feature flag is off → Researcher keeps full access.
    expect(result.current.isActive).toBe(true);
  });

  it('always reports active when the enableSubscriptionAccess flag is off — Lecturer with missing subscription', async () => {
    setAuth('Lecturer');
    setSubscription(null);

    const useSubscription = await importFresh();
    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.isApplicable).toBe(true);
    // Feature flag is off → Lecturer keeps full access.
    expect(result.current.isActive).toBe(true);
  });

  it('treats non-paid roles (Reviewer, Graduate Student, Admin) as not applicable', async () => {
    for (const role of ['Reviewer', 'Graduate Student', 'Admin']) {
      setAuth(role);
      setSubscription({
        purchase: {
          transactionId: 'TX-002',
          userId: 1,
          annualFeeId: 1,
          amount: 990000,
          status: 'Paid',
          createdAt: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        },
        annualFee: {
          id: 1,
          name: 'Researcher Yearly',
          userRole: 'Researcher',
          price: 990000,
          billingCycle: 'Year',
          status: true,
        },
        daysRemaining: 30,
        isExpired: false,
      });

      const useSubscription = await importFresh();
      const { result } = renderHook(() => useSubscription());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isApplicable).toBe(false);
      expect(result.current.isActive).toBe(true);
      expect(result.current.current).toBeNull();
    }
  });

  it('surfaces BE errors and never invents a subscription', async () => {
    setAuth('Researcher');
    mockGetMyCurrentSubscription = vi
      .fn()
      .mockRejectedValue(new Error('Backend exploded'));

    const useSubscription = await importFresh();
    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.current).toBeNull();
  });

  // ── BE migrated ExpiresAt onto UserSubscriptions ─────────────────────────────

  it('does NOT crash when purchase is null — reads expiresAt from UserSubscriptions', async () => {
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString();
    setAuth('Researcher');
    // BE now returns purchase: null with expiresAt sourced from UserSubscriptions.
    setSubscription({
      purchase: null,
      annualFee: {
        id: 3,
        name: 'Researcher Yearly',
        userRole: 'Researcher',
        price: 990000,
        billingCycle: 'Year',
        status: true,
      },
      daysRemaining: 15,
      isExpired: false,
      expiresAt: futureExpiry,
    });

    const useSubscription = await importFresh();
    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Must not crash — isExpired must be derived from expiresAt.
    expect(result.current.error).toBeNull();
    expect(result.current.current).not.toBeNull();
    expect(result.current.isExpired).toBe(false);
    expect(result.current.isActive).toBe(true); // flag is off
  });

  it('marks isExpired true when expiresAt is in the past and purchase is null', async () => {
    const pastExpiry = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    setAuth('Researcher');
    setSubscription({
      purchase: null,
      annualFee: {
        id: 3,
        name: 'Researcher Yearly',
        userRole: 'Researcher',
        price: 990000,
        billingCycle: 'Year',
        status: true,
      },
      daysRemaining: -1,
      isExpired: true,
      expiresAt: pastExpiry,
    });

    const useSubscription = await importFresh();
    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isExpired).toBe(true);
  });

  it('falls back to purchase.expiryDate when expiresAt is absent (backward compat)', async () => {
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString();
    setAuth('Researcher');
    // Old-shape BE response: purchase is not null, no expiresAt field.
    setSubscription({
      purchase: {
        transactionId: 'TX-003',
        userId: 9,
        annualFeeId: 2,
        amount: 990000,
        status: 'Paid',
        createdAt: new Date().toISOString(),
        expiryDate: futureExpiry,
      },
      annualFee: {
        id: 2,
        name: 'Researcher Yearly',
        userRole: 'Researcher',
        price: 990000,
        billingCycle: 'Year',
        status: true,
      },
      daysRemaining: 20,
      isExpired: false,
    });

    const useSubscription = await importFresh();
    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isExpired).toBe(false);
  });

  it('trusts BE isExpired flag over client date math when flag is true', async () => {
    // BE says expired; the date math says future — BE flag wins.
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    setAuth('Researcher');
    setSubscription({
      purchase: null,
      annualFee: {
        id: 4,
        name: 'Lecturer Yearly',
        userRole: 'Lecturer',
        price: 990000,
        billingCycle: 'Year',
        status: true,
      },
      daysRemaining: -5,
      isExpired: true, // BE authoritative
      expiresAt: futureExpiry, // date math would say NOT expired — ignored
    });

    const useSubscription = await importFresh();
    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.isExpired).toBe(true);
  });
});
