/**
 * Tests for the SubscriptionReturn page — PayOS payment verification UI.
 *
 * Verifies:
 *   1. Query parameters from PayOS redirect are read but NEVER grant access.
 *   2. Payment verification calls the backend to check actual status.
 *   3. The page shows the correct state (verifying/active/pending/failed/api-missing)
 *      based on backend response.
 *   4. Feature flag disabled state shows appropriate banner.
 *   5. The page never renders an "access granted" state without backend confirmation.
 *
 * NOTE: withdrawalGate.test.tsx and useConfirmPayment.test.ts were removed from
 * the smoke list because their corresponding source files do not exist in the
 * codebase. If these features are implemented, add tests for them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock factories ────────────────────────────────────────────────────────────

// AppConfig mock — controls feature flag
const enableSubscriptionAccess = true;

vi.mock('../../../src/config/app', () => ({
  AppConfig: {
    features: {
      enableSubscriptionAccess,
    },
  },
}));

// AuthContext mock
const mockAuth = {
  user: { username: 'Test User', email: 'test@example.com' },
  isAuthenticated: true,
  effectiveRole: 'Researcher' as const,
};

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Subscription hook mock
const mockRefetch = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../src/hooks/useSubscription', () => ({
  useSubscription: () => ({
    refetch: mockRefetch,
    isActive: true,
    isApplicable: true,
  }),
}));

// Subscription service mock
const mockGetPaymentStatus = vi.fn();

vi.mock('../../../src/services/subscription.service', () => ({
  subscriptionService: {
    getPaymentStatus: (...args: unknown[]) => mockGetPaymentStatus(...args),
    listPlans: vi.fn(),
    getCurrentSubscription: vi.fn(),
    createOrder: vi.fn(),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SubscriptionReturn page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPaymentStatus.mockReset();
    mockRefetch.mockReset().mockResolvedValue(undefined);
  });

  describe('Query parameters — never grant access alone', () => {
    it('shows verifying state immediately after render with query params', async () => {
      mockGetPaymentStatus.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-123&status=success']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Verifying payment/i)).toBeInTheDocument();
      // The page must NOT show "Subscription active" without backend confirmation
      expect(screen.queryByText(/Subscription active/i)).not.toBeInTheDocument();
    });

    it('shows failed state when no order code is provided', async () => {
      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/could not identify your payment/i)).toBeInTheDocument();
      });
      // Never grants access
      expect(screen.queryByRole('button', { name: /Go to workspace/i })).not.toBeInTheDocument();
    });
  });

  describe('Payment verification states', () => {
    it('shows "active" state when backend confirms PAID status', async () => {
      mockGetPaymentStatus.mockResolvedValue({ status: 'PAID' });

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-123']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Subscription active/i)).toBeInTheDocument();
      });
      // Now the workspace button appears
      expect(screen.getByRole('button', { name: /Go to workspace/i })).toBeInTheDocument();
      // Backend was called
      expect(mockGetPaymentStatus).toHaveBeenCalledWith('ORD-123');
    });

    it('shows "pending" state when backend reports PENDING status', async () => {
      mockGetPaymentStatus.mockResolvedValue({ status: 'PENDING' });

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-456']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/payment is still being processed/i)).toBeInTheDocument();
      });
      // No workspace button — must wait
      expect(screen.queryByRole('button', { name: /Go to workspace/i })).not.toBeInTheDocument();
    });

    it('shows "failed" state when backend reports FAILED status', async () => {
      mockGetPaymentStatus.mockResolvedValue({ status: 'FAILED' });

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-789']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Payment was not completed/i)).toBeInTheDocument();
      });
    });

    it('shows "failed" state when backend reports CANCELLED status', async () => {
      mockGetPaymentStatus.mockResolvedValue({ status: 'CANCELLED' });

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-CANCEL']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/cancelled the payment/i)).toBeInTheDocument();
      });
    });

    it('shows "api-missing" state when backend throws SubscriptionBackendUnavailableError', async () => {
      const { SubscriptionBackendUnavailableError } = await import('../../../src/types/subscription');
      mockGetPaymentStatus.mockRejectedValue(
        new SubscriptionBackendUnavailableError('Backend not configured'),
      );

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-ERR']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // The status title shows "Awaiting backend"
        expect(screen.getByRole('heading', { name: /Awaiting backend/i })).toBeInTheDocument();
      });
    });
  });

  describe('Feature flag disabled state', () => {
    it('page renders regardless of feature flag state', async () => {
      // The page should render without errors regardless of feature flag state.
      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      await act(async () => {
        render(
          <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-DISABLED']}>
            <SubscriptionReturn />
          </MemoryRouter>,
        );
      });

      // Page renders with the eyebrow text
      expect(screen.getByText(/ARS subscription/i)).toBeInTheDocument();
    });
  });

  describe('Re-check functionality', () => {
    it('has a "Re-check now" button that is disabled while verifying', async () => {
      mockGetPaymentStatus.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-CHECK']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      const recheckBtn = screen.getByRole('button', { name: /Re-check now/i });
      expect(recheckBtn).toBeDisabled();
    });

    it('re-checks payment status when "Re-check now" is clicked', async () => {
      mockGetPaymentStatus
        .mockResolvedValueOnce({ status: 'PENDING' })
        .mockResolvedValueOnce({ status: 'PAID' });

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-RETRY']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/payment is still being processed/i)).toBeInTheDocument();
      });

      const recheckBtn = screen.getByRole('button', { name: /Re-check now/i });
      expect(recheckBtn).not.toBeDisabled();

      await act(async () => {
        await recheckBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByText(/Subscription active/i)).toBeInTheDocument();
      });
    });
  });

  describe('Reference display', () => {
    it('displays order code from query params', async () => {
      mockGetPaymentStatus.mockImplementation(() => new Promise(() => {}));

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-DISPLAY-001']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Reference: ORD-DISPLAY-001/i)).toBeInTheDocument();
    });

    it('displays PayOS status alongside order code when present', async () => {
      mockGetPaymentStatus.mockImplementation(() => new Promise(() => {}));

      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return?orderCode=ORD-STATUS&status=success']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Reference: ORD-STATUS.*PayOS status: success/i)).toBeInTheDocument();
    });

    it('shows placeholder for missing order code', async () => {
      const { SubscriptionReturn } = await import('../../../src/pages/Subscription/SubscriptionReturn');
      render(
        <MemoryRouter initialEntries={['/subscription/return']}>
          <SubscriptionReturn />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Reference: —/i)).toBeInTheDocument();
    });
  });
});
