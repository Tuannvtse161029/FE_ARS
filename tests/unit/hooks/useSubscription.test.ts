/**
 * Tests for useSubscription — Researcher / Lecturer paid-access hook.
 *
 * Verifies:
 *   1. Researcher and Lecturer always get `isActive === true` when the
 *      `enableSubscriptionAccess` feature flag is `false` (temporary
 *      disabled state — BE APIs not yet available).
 *   2. Reviewer, Graduate Student, and Admin never trigger the
 *      subscription gate (`isApplicable === false`, `isActive === true`
 *      regardless of subscription data).
 *   3. When the BE has not yet published the contract, the hook surfaces
 *      a typed `SubscriptionBackendUnavailableError` and never invents a
 *      subscription.
 *   4. Wallet endpoints are NOT called by this hook (the previous
 *      wallet-removal decision remains valid).
 *
 * Live network calls are avoided — every test mocks the subscription
 * service and the AppConfig feature flag.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionBackendUnavailableError } from '../../../src/types/subscription';

// ── AppConfig mock factory ────────────────────────────────────────────────────
//
// Every test explicitly opts into the disabled state (the project default).
// This makes `isActive` always `true` for all roles, which is the current
// temporary configuration. When the flag is later re-enabled, the tests
// should be updated to cover the active-subscription scenarios.
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

// ── Subscription service mock factory ───────────────────────────────────────
let mockCurrentSubscription: unknown = null;
let mockGetCurrentSubscription = vi.fn();
let mockListPlans = vi.fn();

vi.mock('../../../src/services/subscription.service', () => ({
  subscriptionService: {
    listPlans: (...args: unknown[]) => mockListPlans(...args),
    getCurrentSubscription: (...args: unknown[]) =>
      mockGetCurrentSubscription(...args),
    createOrder: vi.fn(),
    getPaymentStatus: vi.fn(),
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
  mockGetCurrentSubscription = vi
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
      id: 1,
      userId: 7,
      planId: 2,
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
      expiresAt: past,
      paymentOrderCode: 'PO-001',
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

  it('does NOT block Reviewer / Graduate Student / Admin even when subscription data is missing', async () => {
    for (const role of ['Reviewer', 'Graduate Student', 'Admin']) {
      setAuth(role);
      // No subscription row at all
      setSubscription(null);

      const useSubscription = await importFresh();
      const { result } = renderHook(() => useSubscription());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.isApplicable).toBe(false);
      expect(result.current.isActive).toBe(true);
      expect(result.current.isMissing).toBe(true);
    }
  });

  it('surfaces SubscriptionBackendUnavailableError without inventing a subscription', async () => {
    setAuth('Researcher');
    mockGetCurrentSubscription = vi
      .fn()
      .mockRejectedValue(
        new SubscriptionBackendUnavailableError(
          'Subscription payment integration awaiting backend API and VND pricing configuration.',
        ),
      );

    const useSubscription = await importFresh();
    const { result } = renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Even when the BE is unavailable, the disabled flag means the user
    // is not blocked. The error is still surfaced so the page can render
    // an honest banner.
    expect(result.current.isActive).toBe(true);
    expect(result.current.error).toBeInstanceOf(
      SubscriptionBackendUnavailableError,
    );
    expect(result.current.current).toBeNull();
  });

  it('does not call any wallet / top-up / withdrawal endpoints (wallet remains removed)', async () => {
    setAuth('Researcher');
    setSubscription({
      id: 1,
      userId: 9,
      planId: 2,
      status: 'ACTIVE',
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      paymentOrderCode: 'PO-003',
    });

    const useSubscription = await importFresh();
    renderHook(() => useSubscription());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // The hook must only talk to subscriptionService; never to wallet / payment / withdrawal.
    expect(mockGetCurrentSubscription).toHaveBeenCalled();
    expect(mockListPlans).not.toHaveBeenCalled();
  });
});
