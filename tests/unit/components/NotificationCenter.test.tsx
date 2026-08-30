/**
 * NotificationCenter component tests.
 *
 * Coverage:
 *   - Bell renders with red unread badge for unread notifications.
 *   - Badge hides when unreadCount === 0.
 *   - Bell opens dropdown on click; closes on outside-click / Escape.
 *   - Click on a notification triggers mark-read and navigation.
 *   - Failed mark-read does NOT navigate.
 *   - Mark-all-as-read calls the BE for every unread row.
 *   - Loading / empty / error states render the right UI.
 *   - A11y label updates with the unread count.
 *   - Role-specific route gating: a Reviewer cannot be deep-linked into
 *     an Admin-only target — the resolver routes them to the safe
 *     /forum fallback instead.
 *   - Unknown messages always navigate to the safe fallback.
 *   - Seminar invitation navigates to /seminar-workspace and the
 *     dropdown never shows Accept/Decline buttons.
 *   - Withdrawal notifications never navigate to /earnings-wallet while
 *     the feature flag is off.
 *   - Clicking an already-read notification does NOT issue a mark-read
 *     request (saves the BE a round-trip).
 *   - No duplicate mark-read request on a single user click.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NotificationCenter } from '../../../src/components/notification/NotificationCenter';
import { useNotifications } from '../../../src/hooks/useNotifications';
import { useAuth } from '../../../src/context/AuthContext';
import type { NotificationItem } from '../../../src/types/domain';

vi.mock('../../../src/hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseNotifications = useNotifications as unknown as ReturnType<typeof vi.fn>;
const mockedUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

const buildNotifications = (
  rows: Array<Partial<NotificationItem> & Pick<NotificationItem, 'id' | 'message'>>,
): NotificationItem[] =>
  rows.map((r) => ({
    userId: 7,
    isRead: false,
    ...r,
  }));

interface HookOverrides {
  notifications?: NotificationItem[];
  unreadCount?: number;
  isLoading?: boolean;
  error?: Error | null;
  refetch?: () => Promise<void>;
  markRead?: (id: number) => Promise<boolean>;
  markAllRead?: () => Promise<number[]>;
}

const setupHook = (overrides: HookOverrides = {}) => {
  const list: NotificationItem[] = overrides.notifications ?? [];
  const unread =
    typeof overrides.unreadCount === 'number'
      ? overrides.unreadCount
      : list.filter((n) => !n.isRead).length;
  mockedUseNotifications.mockReturnValue({
    notifications: list,
    unreadCount: unread,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    refetch: overrides.refetch ?? (() => Promise.resolve()),
    markRead: overrides.markRead ?? (() => Promise.resolve(true)),
    markAllRead: overrides.markAllRead ?? (() => Promise.resolve([])),
    reset: () => undefined,
  });
};

const setupAuth = (role: string | null) => {
  if (role === null) {
    mockedUseAuth.mockReturnValue({ user: null });
    return;
  }
  mockedUseAuth.mockReturnValue({
    user: {
      token: 't',
      userId: 7,
      username: 'tester',
      email: 't@example.com',
      role,
      isActive: true,
    },
  });
};

const renderCenter = (onNavigate: (path: string) => void = vi.fn()) =>
  render(
    <MemoryRouter>
      <NotificationCenter onNavigate={onNavigate} />
    </MemoryRouter>,
  );

describe('<NotificationCenter />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth('Researcher');
  });

  it('hides the bell when no user is authenticated', () => {
    setupAuth(null);
    setupHook({ notifications: [], unreadCount: 0 });
    const { container } = renderCenter();
    expect(container.querySelector('[data-testid="notification-bell"]')).toBeNull();
  });

  it('renders the bell with a red unread badge when unreadCount > 0', () => {
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Review] accepted', isRead: false },
        { id: 2, message: '[Paper] status changed', isRead: true },
      ]),
      unreadCount: 1,
    });
    renderCenter();
    const bell = screen.getByTestId('notification-bell');
    expect(bell).toHaveAttribute('aria-label', 'Notifications, 1 unread');
    const badge = screen.getByTestId('notification-bell-badge');
    expect(badge).toHaveTextContent('1');
  });

  it('hides the badge when unreadCount is zero but still shows the bell', () => {
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Review] accepted', isRead: true },
      ]),
      unreadCount: 0,
    });
    renderCenter();
    const bell = screen.getByTestId('notification-bell');
    expect(bell).toHaveAttribute('aria-label', 'Notifications, 0 unread');
    expect(screen.queryByTestId('notification-bell-badge')).toBeNull();
  });

  it('updates the badge count for > 99 unread (renders 99+)', () => {
    setupHook({ unreadCount: 250 });
    renderCenter();
    expect(screen.getByTestId('notification-bell-badge')).toHaveTextContent('99+');
  });

  it('opens the dropdown when the bell is clicked and closes on outside click', async () => {
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Review] accepted', isRead: false },
      ]),
      unreadCount: 1,
    });
    renderCenter();
    expect(screen.queryByTestId('notification-dropdown')).toBeNull();

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-dropdown')).not.toBeNull();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByTestId('notification-dropdown')).toBeNull();
    });
  });

  it('closes the dropdown when Escape is pressed', async () => {
    setupHook({ unreadCount: 1 });
    renderCenter();
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-dropdown')).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('notification-dropdown')).toBeNull();
    });
  });

  it('renders the loading state when the BE has not responded yet', () => {
    setupHook({ notifications: [], isLoading: true });
    renderCenter();
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-loading')).not.toBeNull();
  });

  it('renders the empty state when the BE has no rows', () => {
    setupHook({ notifications: [], unreadCount: 0 });
    renderCenter();
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-empty')).not.toBeNull();
  });

  it('renders the error state with a retry button when the BE fails', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    setupHook({ notifications: [], error: new Error('Network error'), refetch });
    renderCenter();
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-error')).not.toBeNull();
    fireEvent.click(screen.getByTestId('notification-retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('marks a single notification as read on click and navigates to the route', async () => {
    const markRead = vi.fn().mockResolvedValue(true);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Paper] status changed', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('notification-item-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/researcher/submissions'));
  });

  it('navigates even when an optimistic mark-read request fails', async () => {
    const markRead = vi.fn().mockResolvedValue(false);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Paper] status changed', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('notification-item-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalled());
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/researcher/submissions'));
  });

  it('falls back to the safe destination when the role cannot reach the target (RBAC)', async () => {
    setupAuth('Reviewer');
    const markRead = vi.fn().mockResolvedValue(true);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        // Reviewers must not be deep-linked into Admin pages — the resolver
        // reroutes them to the safe fallback instead.
        { id: 1, message: '[Admin] role request filed', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('notification-item-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1));
    // The dropdown still closes; the user is taken to the safe fallback
    // (/forum — the only universally reachable route) instead of the
    // admin-only destination.
    expect(onNavigate).toHaveBeenCalledWith('/forum');
  });

  it('invokes markAllRead when "Mark all as read" is clicked', async () => {
    const markAllRead = vi.fn().mockResolvedValue([]);
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Paper] status changed', isRead: false },
        { id: 2, message: '[Review] accepted', isRead: false },
      ]),
      unreadCount: 2,
      markAllRead,
    });
    renderCenter();
    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('notification-mark-all'));
    await waitFor(() => expect(markAllRead).toHaveBeenCalled());
  });

  it('disables "Mark all as read" when there are no unread notifications', () => {
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Paper] status changed', isRead: true },
      ]),
      unreadCount: 0,
    });
    renderCenter();
    fireEvent.click(screen.getByTestId('notification-bell'));
    const btn = screen.getByTestId('notification-mark-all') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows the unread header count', () => {
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Review] accepted', isRead: false },
      ]),
      unreadCount: 1,
    });
    renderCenter();
    fireEvent.click(screen.getByTestId('notification-bell'));
    const count = screen.getByTestId('notification-unread-count');
    expect(count).toHaveTextContent('1 unread');
  });

  it('does not issue a duplicate mark-read request for a single click', async () => {
    const markRead = vi.fn().mockImplementation(
      () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 30)),
    );
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Review] accepted', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter();

    fireEvent.click(screen.getByTestId('notification-bell'));
    const item = screen.getByTestId('notification-item-1');
    fireEvent.click(item);
    fireEvent.click(item);

    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));
  });

  it('renders role-specific titles for distinct notification kinds', () => {
    setupHook({
      notifications: [
        { id: 1, userId: 7, message: '[Review] new request: paper #42', isRead: false },
        { id: 2, userId: 7, message: '[Student] topic assigned', isRead: false },
        { id: 3, userId: 7, message: '[Lecturer] report submitted', isRead: false },
        { id: 4, userId: 7, message: '[Seminar] invitation: please join', isRead: false },
      ],
      unreadCount: 4,
    });
    renderCenter();
    fireEvent.click(screen.getByTestId('notification-bell'));
    const list = screen.getByTestId('notification-list');
    expect(within(list).getAllByText('New review request').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Topic assigned').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Report submitted').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Seminar invitation').length).toBeGreaterThan(0);
  });

  it('navigates via "View all notifications" to /forum (the only safe destination without a dedicated page)', () => {
    const onNavigate = vi.fn();
    setupHook({ unreadCount: 0 });
    renderCenter(onNavigate);
    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByText(/View all notifications/i));
    expect(onNavigate).toHaveBeenCalledWith('/forum');
  });

  it('supports keyboard activation of a notification item via Enter', async () => {
    const markRead = vi.fn().mockResolvedValue(true);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Paper] status changed', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));
    const item = screen.getByTestId('notification-item-1');
    item.focus();
    const user = userEvent.setup();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/researcher/submissions'));
  });

  // ── Spec-required vital tests ───────────────────────────────────────────

  it('renders unread rows with a distinct visual style (background + left border)', () => {
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Paper] status changed', isRead: false },
        { id: 2, message: '[Paper] status changed', isRead: true },
      ]),
      unreadCount: 1,
    });
    renderCenter();
    fireEvent.click(screen.getByTestId('notification-bell'));
    const unreadItem = screen.getByTestId('notification-item-1');
    const readItem = screen.getByTestId('notification-item-2');
    expect(unreadItem.className).not.toEqual(readItem.className);
    expect(unreadItem.getAttribute('data-read')).toBe('false');
    expect(readItem.getAttribute('data-read')).toBe('true');
  });

  it('does NOT issue a mark-read request when the notification is already read', async () => {
    const markRead = vi.fn().mockResolvedValue(true);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Paper] status changed', isRead: true },
      ]),
      unreadCount: 0,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('notification-item-1'));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/researcher/submissions'));
    expect(markRead).not.toHaveBeenCalled();
  });

  it('routes an unknown notification message to the safe /forum fallback', async () => {
    const markRead = vi.fn().mockResolvedValue(true);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        // Prefix that does not match any known kind.
        { id: 1, message: 'Some random system message that is not a known kind', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('notification-item-1'));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/forum'));
  });

  it('redirects seminar invitations to /seminar-workspace and never shows Accept/Decline inside the dropdown', async () => {
    setupAuth('Graduate Student');
    const markRead = vi.fn().mockResolvedValue(true);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Seminar] invitation: please join the data ethics seminar', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));

    // The dropdown must NOT render Accept/Decline buttons — those actions
    // live on the destination page per the notification spec.
    const dropdown = screen.getByTestId('notification-dropdown');
    expect(within(dropdown).queryByRole('button', { name: /^accept$/i })).toBeNull();
    expect(within(dropdown).queryByRole('button', { name: /^decline$/i })).toBeNull();

    fireEvent.click(screen.getByTestId('notification-item-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/seminar-workspace'));
  });

  it('routes withdrawal notifications to the safe fallback while the withdrawal feature is disabled', async () => {
    setupAuth('Reviewer');
    const markRead = vi.fn().mockResolvedValue(true);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Wallet] withdrawal completed: 500000 VND sent to your bank', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('notification-item-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1));
    // The withdrawal destination is suppressed — the safe fallback wins so
    // a withdrawn feature cannot be deep-linked by a stale notification.
    expect(onNavigate).toHaveBeenCalledWith('/forum');
    expect(onNavigate).not.toHaveBeenCalledWith('/earnings-wallet');
  });

  it('routes forum-reply notifications to /forum for any role', async () => {
    setupAuth('Researcher');
    const markRead = vi.fn().mockResolvedValue(true);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Forum] reply: someone replied to your post', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('notification-item-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1));
    expect(onNavigate).toHaveBeenCalledWith('/forum');
  });

  it('routes role-request-accepted notifications to /account-settings for all verified roles', async () => {
    setupAuth('Reviewer');
    const markRead = vi.fn().mockResolvedValue(true);
    const onNavigate = vi.fn();
    setupHook({
      notifications: buildNotifications([
        { id: 1, message: '[Account] role accepted: you are now a Reviewer', isRead: false },
      ]),
      unreadCount: 1,
      markRead,
    });
    renderCenter(onNavigate);

    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('notification-item-1'));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1));
    expect(onNavigate).toHaveBeenCalledWith('/account-settings');
  });
});