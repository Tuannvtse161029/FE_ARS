/**
 * Shared harness for MainLayout test files.
 *
 * `MainLayout` pulls wallet / notifications / reviewer-availability /
 * wallet-top-up-modal hooks and AuthContext. Rendering it in isolation
 * (MemoryRouter only) needs every one of those mocked, plus a way to swap
 * the auth user per test. Every existing test file repeated the same ~30
 * lines of mock scaffolding; this helper collapses that into one import.
 *
 * Usage:
 *
 *   import { setupMainLayoutMocks, renderMainLayout, findSidebarLinkByHref } from '../utils/renderMainLayout';
 *
 *   setupMainLayoutMocks();
 *
 *   beforeEach(() => { setMockAuth({ role: 'Graduate Student' }); });
 *
 *   it('does X', () => {
 *     renderMainLayout(ROUTES.FORUM);
 *     expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
 *   });
 */
import { vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainLayout } from '../../layouts/MainLayout';
import { buildMockAuth } from './mockAuth';
import type { MockUseAuthOptions } from './mockAuth';

// ── Module-level mocks (hoisted by vitest) ────────────────────────────────────
vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    wallet: null,
    balance: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../hooks/useNotifications', () => ({
  // Default mock — every MainLayout-routing test in this folder expects
  // the bell to render but doesn't care about the notification surface.
  // The Agent-16 notification tests live in their own file and provide
  // a richer mock. We intentionally return no notifications and a zero
  // unread count so existing assertions (sidebar / nav) keep passing.
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

vi.mock('../../hooks/useReviewerProfiles', () => ({
  useReviewerAvailability: () => ({
    isAvailable: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../services/reviewer.service', () => ({
  reviewerService: {
    updateAvailability: () => Promise.resolve(),
  },
}));

vi.mock('../../components/wallet/WalletTopUpModal', () => ({
  WalletTopUpModal: () => null,
}));

// ── Per-test auth override ────────────────────────────────────────────────────
// Tests swap this vi.fn() between cases via `setMockAuth(...)`. Imported by the
// mocked useAuth below.
export const useAuthMock = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

export const setMockAuth = (opts: MockUseAuthOptions = {}) => {
  useAuthMock.mockReturnValue(buildMockAuth(opts));
};

// ── Reset state between tests ─────────────────────────────────────────────────
// Storage must be cleared so the dual-signal admin check in MainLayout can't
// accidentally flip the role to Admin from a previous test's leftover blob.
export const setupMainLayoutMocks = () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
};

// ── Render + sidebar query helpers ────────────────────────────────────────────
export const renderMainLayout = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
    </MemoryRouter>,
  );

export const findSidebarLinkByHref = (href: string): HTMLAnchorElement | null =>
  document.querySelector(`aside a[href="${href}"]`);

export const findSidebarLinkByText = (label: string): HTMLAnchorElement | null => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const anchors = Array.from(aside.querySelectorAll('a'));
  return anchors.find((a) => (a.textContent ?? '').trim().includes(label)) ?? null;
};
