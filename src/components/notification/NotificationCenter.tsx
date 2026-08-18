import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, CheckCheck, Inbox, AlertTriangle } from 'lucide-react';
import type { NotificationItem } from '../../types/domain';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import {
  inferNotificationKind,
  resolveNotificationRoute,
} from '../../utils/notificationRouteMap';
import { formatRelativeTime } from '../../utils/formatDate';
import styles from './NotificationCenter.module.css';

interface NotificationCenterProps {
  // Optional override: when `null`/omitted, the bell is hidden. Used by
  // tests to mount the component without going through MainLayout.
  userId?: number | null;
  // Called when the user clicks a notification that maps to an internal
  // route. The parent (MainLayout) is responsible for actually navigating;
  // the child just decides the route.
  onNavigate: (path: string) => void;
}

// Public, testable entrypoint. Wraps the dropdown panel around the bell
// trigger and delegates all data fetching / state management to
// `useNotifications`. The component is intentionally header-local — it
// owns no global state, no localStorage, and no fabricated rows.
export function NotificationCenter({ userId, onNavigate }: NotificationCenterProps): JSX.Element {
  const { user } = useAuth();
  const resolvedUserId = typeof userId === 'number' ? userId : user?.userId ?? null;
  const role = user?.role ?? null;

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch,
    markRead,
    markAllRead,
  } = useNotifications(resolvedUserId);

  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Track whether a mark-read request is in flight so we don't fire the
  // click handler twice while the optimistic UI is updating.
  const pendingRef = useRef<Set<number>>(new Set());

  // Outside-click + Escape close. Bound once on mount, torn down on
  // unmount. We listen on `mousedown` (not `click`) so the trigger
  // itself doesn't immediately close the dropdown it just opened.
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleItemClick = useCallback(
    (notification: NotificationItem) => {
      // Dedupe concurrent clicks while a mark-read request is in flight —
      // prevents double-fire when the user double-clicks an item.
      if (pendingRef.current.has(notification.id)) return;
      // Mark read first — only navigate when the BE confirmed. The
      // optimistic flip inside `markRead` updates the bell badge
      // immediately; if the BE call fails we stay on the dropdown.
      pendingRef.current.add(notification.id);
      void (async () => {
        try {
          if (!notification.isRead) {
            const ok = await markRead(notification.id);
            if (!ok) return;
          }
          const target = resolveNotificationRoute(notification.message, role);
          setIsOpen(false);
          if (target) {
            onNavigate(target);
          }
        } finally {
          pendingRef.current.delete(notification.id);
        }
      })();
    },
    [markRead, onNavigate, role],
  );

  const handleMarkAll = useCallback(async () => {
    const failures = await markAllRead();
    // If the BE refused any row we silently keep the partial state; the
    // dropdown will reflect what the BE actually persisted on the next
    // refetch.
    if (failures.length > 0) {
      void refetch();
    }
  }, [markAllRead, refetch]);

  // Build an a11y-friendly label that includes the unread count.
  const bellLabel = useMemo(
    () => `Notifications, ${unreadCount} unread`,
    [unreadCount],
  );

  // Hide the bell entirely for users who are not authenticated. MainLayout
  // already filters by role, but the extra check keeps the component
  // safe to mount in isolation.
  if (!resolvedUserId) {
    return <></>;
  }

  return (
    <div ref={wrapperRef} className={styles.dropdownWrapper}>
      <button
        type="button"
        className={styles.bellBtn}
        aria-label={bellLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={handleToggle}
        data-testid="notification-bell"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className={styles.bellBadge}
            data-testid="notification-bell-badge"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={styles.dropdown}
          data-testid="notification-dropdown"
        >
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className={styles.headerCount} data-testid="notification-unread-count">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <button
              type="button"
              className={styles.markAllBtn}
              onClick={() => void handleMarkAll()}
              disabled={unreadCount === 0 || isLoading}
              data-testid="notification-mark-all"
            >
              <CheckCheck size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Mark all as read
            </button>
          </div>

          <div className={styles.body}>
            {isLoading && notifications.length === 0 ? (
              <div className={styles.loadingState} data-testid="notification-loading">
                <div className={styles.spinner} />
                <span>Loading notifications…</span>
              </div>
            ) : error ? (
              <div className={styles.errorState} data-testid="notification-error">
                <AlertTriangle size={22} />
                <span className={styles.errorTitle}>Couldn't load notifications</span>
                <span>{error.message}</span>
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => void refetch()}
                  data-testid="notification-retry"
                >
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.emptyState} data-testid="notification-empty">
                <BellOff size={22} />
                <span>You're all caught up</span>
              </div>
            ) : (
              <ul className={styles.itemList} data-testid="notification-list">
                {notifications.map((n) => {
                  const kind = inferNotificationKind(n.message);
                  return (
                    <li key={n.id} style={{ listStyle: 'none' }}>
                      <button
                        type="button"
                        className={`${styles.item} ${!n.isRead ? styles.itemUnread : ''}`}
                        onClick={() => void handleItemClick(n)}
                        data-testid={`notification-item-${n.id}`}
                        data-read={n.isRead ? 'true' : 'false'}
                        data-kind={kind}
                      >
                        <span
                          className={`${styles.itemIcon} ${!n.isRead ? styles.itemIconUnread : ''}`}
                          aria-hidden="true"
                        >
                          <Inbox size={14} />
                        </span>
                        <span className={styles.itemBody}>
                          <span className={styles.itemTitle}>
                            {!n.isRead && (
                              <span className={styles.unreadDot} aria-hidden="true" />
                            )}
                            {titleForKind(kind)}
                          </span>
                          <span className={styles.itemMessage}>{n.message}</span>
                          {n.createdAt && (
                            <span className={styles.itemTime}>
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.viewAllLink}
              onClick={() => {
                setIsOpen(false);
                onNavigate('/forum');
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Local title helper — pure UI sugar that turns a kind code into a
// human-readable heading. Centralized so test snapshots stay stable.
function titleForKind(kind: ReturnType<typeof inferNotificationKind>): string {
  switch (kind) {
    case 'review-request-accepted':
      return 'Review request accepted';
    case 'review-request-rejected':
      return 'Review request rejected';
    case 'review-request-started':
      return 'Review started';
    case 'review-request-completed':
      return 'Review completed';
    case 'paper-status-changed':
      return 'Paper status updated';
    case 'review-result-available':
      return 'Review result available';
    case 'new-review-request':
      return 'New review request';
    case 'withdrawal-approved':
    case 'withdrawal-denied':
    case 'withdrawal-processing':
    case 'withdrawal-completed':
      return 'Wallet withdrawal update';
    case 'student-report-submitted':
      return 'Report submitted';
    case 'student-report-resubmitted':
      return 'Report resubmitted';
    case 'student-topic-requested':
      return 'New topic request';
    case 'topic-assigned':
      return 'Topic assigned';
    case 'group-invitation':
      return 'Group invitation';
    case 'milestone-opened':
      return 'Milestone opened';
    case 'report-evaluated':
      return 'Report evaluated';
    case 'report-rejected':
      return 'Report rejected';
    case 'role-request-submitted':
      return 'New role request';
    case 'withdrawal-request-submitted':
      return 'New withdrawal request';
    case 'violation-report-submitted':
      return 'New violation report';
    case 'account-platform-update':
      return 'Account update';
    case 'unknown':
    default:
      return 'Notification';
  }
}

export default NotificationCenter;
