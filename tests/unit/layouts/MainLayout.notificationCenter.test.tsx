/**
 * MainLayout integration with NotificationCenter (Agent-16).
 *
 * Verifies the wiring between the shared header and the new
 * NotificationCenter component:
 *   - The header renders exactly ONE bell (no role-layout duplication).
 *   - The bell label includes the unread count from the BE hook.
 *   - The badge hides when there are no unread notifications.
 *   - The bell is rendered for verified users across every role.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Hoisted mocks — must be declared BEFORE imports so the factory can
// reference them. We declare our own auth mock here so this file doesn't
// depend on the helper's setupMainLayoutMocks (which sets its own
// `useNotifications` mock we can't easily override).
const { useAuthMock, useNotificationsMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useNotificationsMock: vi.fn(),
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

// Re-mock every header-internal hook the MainLayout uses, mirroring the
// setupMainLayoutMocks helper. This avoids depending on the helper
// entirely and lets us drive the notification hook per-test.
vi.mock('../../../src/hooks/useWallet', () => ({
  useWallet: () => ({
    wallet: null,
    balance: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../../src/hooks/useNotifications', () => ({
  useNotifications: (...args: unknown[]) => useNotificationsMock(...args),
  useMarkNotificationRead: () => ({
    markRead: () => Promise.resolve(true),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../../src/hooks/useReviewerProfiles', () => ({
  useReviewerAvailability: () => ({
    isAvailable: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../../src/services/reviewer.service', () => ({
  reviewerService: { updateAvailability: () => Promise.resolve() },
}));

vi.mock('../../../src/components/wallet/WalletTopUpModal', () => ({
  WalletTopUpModal: () => null,
}));

import { MainLayout } from '../../../src/layouts/MainLayout';
import type { UserRole } from '../../../src/types/auth';
import { buildMockAuth } from '../../../src/utils/mockAuth';

const setAuth = (role: UserRole | string, roleId?: number) => {
  useAuthMock.mockReturnValue(buildMockAuth({ role, roleId }));
};

const buildNotificationsMock = (overrides: {
  notifications?: unknown[];
  unreadCount?: number;
}) => {
  useNotificationsMock.mockReturnValue({
    notifications: overrides.notifications ?? [],
    unreadCount: overrides.unreadCount ?? 0,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
    markRead: () => Promise.resolve(true),
    markAllRead: () => Promise.resolve([]),
    reset: () => undefined,
  });
};

const renderLayout = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('MainLayout — NotificationCenter integration (AGENT_16)', () => {
  it('renders the bell exactly once (no duplicate from role-layout variants)', () => {
    setAuth('Researcher');
    buildNotificationsMock({ unreadCount: 3 });
    renderLayout('/forum');
    const bells = document.querySelectorAll('[data-testid="notification-bell"]');
    expect(bells.length).toBe(1);
  });

  it('shows the red unread badge when the BE reports unread notifications', () => {
    setAuth('Researcher');
    buildNotificationsMock({ unreadCount: 5 });
    renderLayout('/forum');
    const badge = document.querySelector('[data-testid="notification-bell-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('5');
  });

  it('hides the badge when the BE reports zero unread notifications', () => {
    setAuth('Researcher');
    buildNotificationsMock({ unreadCount: 0 });
    renderLayout('/forum');
    expect(document.querySelector('[data-testid="notification-bell-badge"]')).toBeNull();
  });

  it('includes the unread count in the bell aria-label for screen readers', () => {
    setAuth('Reviewer');
    buildNotificationsMock({ unreadCount: 7 });
    renderLayout('/forum');
    const bell = document.querySelector('[data-testid="notification-bell"]');
    expect(bell?.getAttribute('aria-label')).toBe('Notifications, 7 unread');
  });

  it('renders the bell for an Admin user (verified)', () => {
    setAuth('Admin', 2);
    buildNotificationsMock({ unreadCount: 1 });
    renderLayout('/admin');
    expect(document.querySelector('[data-testid="notification-bell"]')).not.toBeNull();
  });

  it('still renders the bell for a Lecturer', () => {
    setAuth('Lecturer');
    buildNotificationsMock({ unreadCount: 2 });
    renderLayout('/forum');
    expect(document.querySelector('[data-testid="notification-bell"]')).not.toBeNull();
  });

  it('still renders the bell for a Graduate Student', () => {
    setAuth('Graduate Student');
    buildNotificationsMock({ unreadCount: 2 });
    renderLayout('/forum');
    expect(document.querySelector('[data-testid="notification-bell"]')).not.toBeNull();
  });
});
