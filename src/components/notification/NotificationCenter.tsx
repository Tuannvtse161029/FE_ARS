import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, CheckCheck, Inbox, AlertTriangle } from 'lucide-react';
import type { NotificationItem } from '../../types/domain';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import type { Locale } from '../../i18n/translations';
import {
  inferNotificationKind,
  resolveNotificationRoute,
  type NotificationKind,
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
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const isGuest = user?.role === 'Guest' || !user?.isActive;
  const resolvedUserId = isGuest ? null : (typeof userId === 'number' ? userId : user?.userId ?? null);
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
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  // Track whether a mark-read request is in flight so we don't fire the
  // click handler twice while the optimistic UI is updating.
  const pendingRef = useRef<Set<number>>(new Set());

  // Outside-click + Escape close. Pointer events cover mouse, touch, and pen;
  // `mousedown` keeps the interaction testable in browsers that do not expose
  // PointerEvent in their DOM environment.
  useEffect(() => {
    if (!isOpen) return;
    const closeAndRestoreFocus = () => {
      setIsOpen(false);
      bellRef.current?.focus();
    };
    const onPointerDown = (e: PointerEvent | MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        closeAndRestoreFocus();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAndRestoreFocus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleItemClick = useCallback(
    (notification: NotificationItem) => {
      // Dedupe concurrent clicks while a mark-read request is in flight —
      // prevents double-fire when the user double-clicks an item. The
      // pendingRef is also reused for the navigation step so an already
      // dispatched click can't fire mark-read or navigation a second time.
      if (pendingRef.current.has(notification.id)) return;
      pendingRef.current.add(notification.id);
      void (async () => {
        try {
          // Only mark-read for unread rows. Reading the BE on an already-read
          // row is wasted bandwidth and would re-bump the unread badge if the
          // BE round-trips a fresh optimistic row.
          if (!notification.isRead && notification.id > 0) {
            void markRead(notification.id);
          }
          const target = resolveNotificationRoute(notification.message ?? '', role);
          setIsOpen(false);
          bellRef.current?.focus();
          onNavigate(target);
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
    () => `${t('notif.title', 'Notifications')}, ${unreadCount} ${t('notif.unreadCount', 'unread')}`,
    [unreadCount, t],
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
        ref={bellRef}
        type="button"
        className={styles.bellBtn}
        aria-label={bellLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
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
          id={menuId}
          role="dialog"
          aria-label={t('notif.title', 'Notifications')}
          className={styles.dropdown}
          data-testid="notification-dropdown"
        >
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span>{t('notif.title', 'Notifications')}</span>
              {unreadCount > 0 && (
                <span className={styles.headerCount} data-testid="notification-unread-count">
                  {unreadCount} {t('notif.unreadCount', 'unread')}
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
              {t('notif.markAllRead', 'Mark all as read')}
            </button>
          </div>

          <div className={styles.body}>
            {isLoading && notifications.length === 0 ? (
              <div className={styles.loadingState} data-testid="notification-loading">
                <div className={styles.spinner} />
                <span>{t('notif.loading', 'Loading notifications…')}</span>
              </div>
            ) : error ? (
              <div className={styles.errorState} data-testid="notification-error">
                <AlertTriangle size={22} />
                <span className={styles.errorTitle}>{t('notif.errorLoad', "Couldn't load notifications")}</span>
                <span>{error.message}</span>
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => void refetch()}
                  data-testid="notification-retry"
                >
                  {t('common.retry', 'Retry')}
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.emptyState} data-testid="notification-empty">
                <BellOff size={22} />
                <span>{t('notif.caughtUp', "You're all caught up")}</span>
              </div>
            ) : (
              <ul className={styles.itemList} data-testid="notification-list">
                {notifications.map((n) => {
                  const kind = inferNotificationKind(n.message ?? '');
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
                            {titleForKind(kind, t)}
                          </span>
                          <span className={styles.itemMessage}>
                            {renderNotificationMessage(n, locale, t)}
                          </span>
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
                bellRef.current?.focus();
                onNavigate('/forum');
              }}
            >
              {t('notif.viewAll', 'View all notifications')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Local title helper — pure UI sugar that turns a kind code into a
// human-readable heading. Centralized so test snapshots stay stable.
function titleForKind(kind: ReturnType<typeof inferNotificationKind>, t: (key: string, fallback?: string) => string): string {
  switch (kind) {
    // Researcher
    case 'review-request-accepted':
      return t('notif.reviewRequestAccepted', 'Review request accepted');
    case 'review-request-rejected':
      return t('notif.reviewRequestRejected', 'Review request rejected');
    case 'review-request-started':
      return t('notif.reviewStarted', 'Review started');
    case 'review-request-completed':
      return t('notif.reviewCompleted', 'Review completed');
    case 'paper-status-changed':
      return t('notif.paperStatusUpdated', 'Paper status updated');
    case 'paper-needs-revision':
      return t('notif.paperNeedsRevision', 'Paper needs revision');
    case 'review-result-available':
      return t('notif.reviewResultAvailable', 'Review result available');
    case 'membership-result':
      return t('notif.membershipUpdate', 'Membership update');

    // Reviewer
    case 'new-review-request':
      return t('notif.newReviewRequest', 'New review request');
    case 'review-request-cancelled':
      return t('notif.reviewRequestCancelled', 'Review request cancelled');
    case 'review-deadline-reminder':
      return t('notif.reviewDeadlineReminder', 'Review deadline reminder');

    // Lecturer
    case 'student-report-submitted':
      return t('notif.reportSubmitted', 'Report submitted');
    case 'student-report-resubmitted':
      return t('notif.reportResubmitted', 'Report resubmitted');
    case 'student-topic-requested':
      return t('notif.newTopicRequest', 'New topic request');
    case 'seminar-participant-response':
      return t('notif.seminarParticipantUpdate', 'Seminar participant update');
    case 'seminar-feedback-available':
      return t('notif.seminarFeedbackAvailable', 'Seminar feedback available');
    case 'group-membership-response':
      return t('notif.groupMembershipUpdate', 'Group membership update');

    // Graduate Student
    case 'seminar-invitation':
      return t('notif.seminarInvitation', 'Seminar invitation');
    case 'seminar-schedule-update':
      return t('notif.seminarScheduleUpdate', 'Seminar schedule update');
    case 'added-to-research-group':
      return t('notif.addedToResearchGroup', 'Added to research group');
    case 'topic-assigned':
      return t('notif.topicAssigned', 'Topic assigned');
    case 'group-invitation':
      return t('notif.groupInvitation', 'Group invitation');
    case 'milestone-opened':
      return t('notif.milestoneOpened', 'Milestone opened');
    case 'learning-material-available':
      return t('notif.newLearningMaterial', 'New learning material');
    case 'report-evaluated':
      return t('notif.reportEvaluated', 'Report evaluated');
    case 'report-rejected':
      return t('notif.reportRejected', 'Report rejected');

    // Admin
    case 'role-request-submitted':
      return t('notif.newRoleRequest', 'New role request');
    case 'violation-report-submitted':
      return t('notif.newViolationReport', 'New violation report');
    case 'account-management-event':
      return t('notif.accountManagementUpdate', 'Account management update');

    // Platform
    case 'role-request-accepted':
      return t('notif.roleRequestAccepted', 'Role request accepted');
    case 'role-request-rejected':
      return t('notif.roleRequestRejected', 'Role request rejected');
    case 'account-status-changed':
      return t('notif.accountStatusChanged', 'Account status changed');
    case 'account-platform-update':
      return t('notif.accountUpdate', 'Account update');
    case 'system-update':
      return t('notif.systemUpdate', 'System update');

    // Cross-role
    case 'forum-reply':
      return t('notif.forumReply', 'Forum reply');

    case 'unknown':
    default:
      return t('notif.notification', 'Notification');
  }
}

export default NotificationCenter;

// ────────────────────────────────────────────────────────────────────────────
// Per-kind → translation key mapping.
//
// The BE only ships Vietnamese payloads today, so when the UI is in
// `vi` we render the BE message verbatim (it already carries the
// authoritative translation). When the UI is in `en`, we strip the
// leading `[Tag]` prefix and rebuild the message using one of these
// keys. Adding a new kind requires only adding one entry here and the
// matching dictionary string.
const KIND_BODY_KEY: Readonly<Partial<Record<NotificationKind, string>>> = {
  'review-request-accepted': 'notif.body.reviewRequestAccepted',
  'review-request-rejected': 'notif.body.reviewRequestRejected',
  'review-request-started': 'notif.body.reviewRequestStarted',
  'review-request-completed': 'notif.body.reviewRequestCompleted',
  'paper-status-changed': 'notif.body.paperStatusChanged',
  'paper-needs-revision': 'notif.body.paperNeedsRevision',
  'review-result-available': 'notif.body.reviewResultAvailable',
  'membership-result': 'notif.body.membershipResult',
  'new-review-request': 'notif.body.newReviewRequest',
  'review-request-cancelled': 'notif.body.reviewRequestCancelled',
  'review-deadline-reminder': 'notif.body.reviewDeadlineReminder',
  'student-report-submitted': 'notif.body.studentReportSubmitted',
  'student-report-resubmitted': 'notif.body.studentReportResubmitted',
  'student-topic-requested': 'notif.body.studentTopicRequested',
  'seminar-participant-response': 'notif.body.seminarParticipantResponse',
  'seminar-feedback-available': 'notif.body.seminarFeedbackAvailable',
  'group-membership-response': 'notif.body.groupMembershipResponse',
  'seminar-invitation': 'notif.body.seminarInvitation',
  'seminar-schedule-update': 'notif.body.seminarScheduleUpdate',
  'added-to-research-group': 'notif.body.addedToResearchGroup',
  'topic-assigned': 'notif.body.topicAssigned',
  'group-invitation': 'notif.body.groupInvitation',
  'milestone-opened': 'notif.body.milestoneOpened',
  'learning-material-available': 'notif.body.learningMaterialAvailable',
  'report-evaluated': 'notif.body.reportEvaluated',
  'report-rejected': 'notif.body.reportRejected',
  'role-request-submitted': 'notif.body.roleRequestSubmitted',
  'violation-report-submitted': 'notif.body.violationReportSubmitted',
  'account-management-event': 'notif.body.accountManagementEvent',
  'role-request-accepted': 'notif.body.roleRequestAccepted',
  'role-request-rejected': 'notif.body.roleRequestRejected',
  'account-status-changed': 'notif.body.accountStatusChanged',
  'account-platform-update': 'notif.body.accountPlatformUpdate',
  'follower-new': 'notif.body.followerNew',
  'system-update': 'notif.body.systemUpdate',
  'forum-reply': 'notif.body.forumReply',
};

// Strip the BE-side `[Tag]` prefix from a notification message so we can
// use the dynamic suffix (e.g., "Report #123 by Student A") as a
// variable inside our i18n template. Returns the original string (trimmed)
// when no `[Tag]` prefix is present — natural-language BE messages and
// unknown kinds are still surfaced to the user unchanged.
const stripTagPrefix = (raw: string): string => (raw ?? '').trim().replace(/^\[[^\]]+\]\s*/, '');

// Render a notification message in the active locale.
//
// Rules:
//   * When the locale is `vi` we trust the BE payload — it is already
//     Vietnamese and is the authoritative source. We pass the message
//     through unchanged so any dynamic names (student, group, …) render
//     exactly as authored.
//   * When the locale is `en` we look up the kind-specific template, strip
//     the `[Tag]` prefix, and substitute the dynamic suffix. If the BE
//     sent a natural-language message with no prefix or the kind is
//     `unknown`, we keep the original message body — translating arbitrary
//     machine-generated prose is unsafe and the user would still see the
//     same information.
function renderNotificationMessage(
  notification: NotificationItem,
  locale: Locale,
  t: (key: string, fallback?: string) => string,
): string {
  const raw = (notification.message ?? '').trim();
  if (!raw) return '';
  if (locale === 'vi') return raw;

  const kind = inferNotificationKind(raw);
  if (kind === 'unknown') return raw;

  const key = KIND_BODY_KEY[kind];
  if (!key) return raw;

  const template = t(key, raw);
  const suffix = stripTagPrefix(raw);
  if (!suffix) return template.replace(/\s*:\s*\{suffix\}\s*$/u, '').trim();
  return template.replace('{suffix}', suffix);
}
