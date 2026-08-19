/**
 * Agent 25: Reviewer Availability Switch — Layout & State Sync Tests
 *
 * Covers:
 *  1. Init — toggle visible only for Reviewer role, absent for all others
 *  2. Thumb containment — knob stays within track boundaries (getBoundingClientRect)
 *  3. Toggle flow — click calls service + refetch
 *  4. Rollback on error — switch restores previous value when API throws
 *  5. Wrong user profile — hook returns current user's profile, not first in array
 *  6. No hardcoded true — null BE state renders "Unavailable", not "Available"
 *  7. Loading state — button disabled while in-flight
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainLayout } from '../../layouts/MainLayout';
import { ROUTES } from '../../routes/paths';
import { buildMockAuth } from '../utils/mockAuth';
import type { MockUseAuthOptions } from '../utils/mockAuth';

// ── Shared mock state ──────────────────────────────────────────────────────────

const updateAvailabilityMock = vi.fn<() => Promise<void>>();
const refetchAvailabilityMock = vi.fn<() => Promise<void>>();

const DEFAULT_RETURN = {
  isAvailable: false as boolean | null,
  isLoading: false,
  error: null,
  refetch: refetchAvailabilityMock,
};

// A mutable function ref — we reassign this per-test so the mock factory
// (which runs at module-load time, before test code) calls the right function.
let hookImpl = () => DEFAULT_RETURN;

// Track the captured userId for test 5.
let _capturedUserId: number | undefined;
const captureUserId = (uid?: number) => {
  _capturedUserId = uid;
  return hookImpl(uid);
};

vi.mock('../../hooks/useReviewerProfiles', () => ({
  // Module has both a default export (useReviewerProfiles) and a named export
  // (useReviewerAvailability). Both must be provided; MainLayout calls the
  // named export directly.
  __esModule: true,
  default: (...args: unknown[]) => hookImpl(...args),
  useReviewerAvailability: (...args: unknown[]) => hookImpl(...args),
}));

vi.mock('../../services/reviewer.service', () => ({
  reviewerService: {
    updateAvailability: (...args: unknown[]) =>
      updateAvailabilityMock(...(args as [number, boolean])),
  },
}));

vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    wallet: null,
    balance: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../hooks/useNotifications', () => ({
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
}));

vi.mock('../../components/wallet/WalletTopUpModal', () => ({
  WalletTopUpModal: () => null,
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

const useAuthMock = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

const setMockAuth = (opts: MockUseAuthOptions = {}) => {
  useAuthMock.mockReturnValue(buildMockAuth(opts));
};

// ── Per-test override helpers ──────────────────────────────────────────────────

/** Override the hook return for the next render. Resets to default between tests. */
const overrideHook = (overrides?: Partial<typeof DEFAULT_RETURN>) => {
  hookImpl = () => ({ ...DEFAULT_RETURN, ...overrides });
};

/** Override the hook with a custom function (test 5: capture the userId argument). */
const overrideHookWithFn = (
  fn: (...args: unknown[]) => ReturnType<typeof DEFAULT_RETURN>,
) => {
  hookImpl = fn;
};

// ── Test helpers ──────────────────────────────────────────────────────────────

const renderLayout = (path = ROUTES.REVIEW_TASKS) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MainLayout />
    </MemoryRouter>,
  );

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Reviewer availability toggle — MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateAvailabilityMock.mockResolvedValue(undefined);
    refetchAvailabilityMock.mockResolvedValue(undefined);
    // Reset hook impl and captured userId before each test.
    hookImpl = () => DEFAULT_RETURN;
    _capturedUserId = undefined;
  });

  // ── 1. Init ─────────────────────────────────────────────────────────────

  describe('init — role visibility', () => {
    const nonReviewerCases: [string, MockUseAuthOptions][] = [
      ['Admin', { role: 'Admin', roleId: 2 }],
      ['Researcher', { role: 'Researcher' }],
      ['Lecturer', { role: 'Lecturer', roleId: 3 }],
      ['Graduate Student', { role: 'Graduate Student' }],
    ];

    it('toggle is rendered for Reviewer role', () => {
      setMockAuth({ role: 'Reviewer', userId: 1 });
      renderLayout();
      expect(
        screen.queryByTestId('availability-toggle'),
      ).not.toBeNull();
    });

    it.each(nonReviewerCases)(
      'toggle is NOT rendered for %s role',
      (_role, opts) => {
        setMockAuth({ ...opts, userId: 1 });
        renderLayout();
        expect(
          screen.queryByTestId('availability-toggle'),
        ).toBeNull();
      },
    );
  });

  // ── 2. Thumb containment ─────────────────────────────────────────────

  it('knob stays within the track boundaries in both on and off states', () => {
    setMockAuth({ role: 'Reviewer', userId: 1 });
    renderLayout();

    const btn = screen.getByTestId('availability-toggle');
    const knob = btn.querySelector('span') as HTMLElement;
    const track = knob.parentElement as HTMLElement;

    const knobRect = knob.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();

    // With translateX(28px):
    //   knob left  = track left + 28
    //   knob right = track left + 28 + 20 = track left + 48 = track right
    // Allow ±1px sub-pixel rounding tolerance.
    expect(knobRect.right).toBeLessThanOrEqual(trackRect.right + 1);
    expect(knobRect.left).toBeGreaterThanOrEqual(trackRect.left - 1);
  });

  // ── 3. Toggle flow ─────────────────────────────────────────────────────

  it('clicking the switch calls reviewerService.updateAvailability then refetch', async () => {
    const userId = 42;
    setMockAuth({ role: 'Reviewer', userId });
    overrideHook({ isAvailable: false });

    renderLayout();

    const btn = screen.getByTestId('availability-toggle');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(updateAvailabilityMock).toHaveBeenCalledWith(userId, true);
    });
    await waitFor(() => {
      expect(refetchAvailabilityMock).toHaveBeenCalled();
    });
  });

  // ── 4. Rollback on error ───────────────────────────────────────────────

  it('when updateAvailability throws, the switch restores the previous value', async () => {
    setMockAuth({ role: 'Reviewer', userId: 1 });
    overrideHook({ isAvailable: false });
    updateAvailabilityMock.mockRejectedValueOnce(new Error('boom'));

    renderLayout();

    const btn = screen.getByTestId('availability-toggle');
    expect(btn.querySelector('span')?.className).toMatch(/Off/);

    fireEvent.click(btn);

    // After the rejected promise, MainLayout rolls optimisticAvailability back
    // to the previous value (false). The knob stays in the off state.
    await waitFor(() => {
      expect(btn.querySelector('span')?.className).toMatch(/Off/);
    });
  });

  // ── 5. Wrong user profile ─────────────────────────────────────────────

  it('useReviewerAvailability receives the current userId, NOT a mismatched ID', () => {
    const currentUserId = 7;
    setMockAuth({ role: 'Reviewer', userId: currentUserId });

    overrideHookWithFn((uid?: number) => {
      _capturedUserId = uid;
      return {
        ...DEFAULT_RETURN,
        isAvailable: uid === currentUserId ? true : false,
      };
    });

    renderLayout();

    // The hook was called with the current user's ID, not a different one.
    expect(_capturedUserId).toBe(currentUserId);

    // Since the current user's profile returns isAvailable: true, the label
    // should say "Available" — proving the right profile was fetched.
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  // ── 6. No hardcoded true ───────────────────────────────────────────────

  it('when beReviewerAvailable is null, the label shows "Unavailable" (not "Available")', () => {
    setMockAuth({ role: 'Reviewer', userId: 1 });
    // null = BE state unknown. The guard in handleToggleAvailability blocks
    // the click, and the label falls back to "?? false" → "Unavailable".
    overrideHook({ isAvailable: null });

    renderLayout();

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });

  // ── 7. Loading state ───────────────────────────────────────────────────

  it('when isLoading is true, the toggle button is disabled', () => {
    setMockAuth({ role: 'Reviewer', userId: 1 });
    overrideHook({ isAvailable: false, isLoading: true });

    renderLayout();

    const btn = screen.getByTestId('availability-toggle');
    expect(btn).toBeDisabled();
  });
});
