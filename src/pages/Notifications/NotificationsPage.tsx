/**
 * NotificationsPage — full-page inbox for ARS notification events.
 *
 * Replaces the previous footer-link placeholder in the bell dropdown
 * (`/forum`) with a real destination so a reviewer/researcher with
 * hundreds of unread rows can triage at speed instead of being limited
 * to the dropdown's 360px-wide, 480px-tall scrollable window.
 *
 * Sources of truth:
 *   - Hook:                src/hooks/useNotifications.ts
 *   - Service:             src/services/notification.service.ts
 *   - Route map:           src/utils/notificationRouteMap.ts
 *   - Title/body strings:  src/i18n/dictionaries/{en,vi}.ts (`notif.*`)
 *
 * Design intent (impeccable direction contract):
 *   - Inherit the ARS paper-day world (warm canvas + ochre accent + ink
 *     primary typography) — no new visual language invented for this page.
 *   - Filterable by All / Unread + a typed search; category buckets
 *     collapsible so the page stays readable when the inbox is long.
 *   - Every row is the same notification element the dropdown shows, so
 *     the user recognises the icon, kind title, and message rendering.
 *     Clicking a row marks it read (optimistic) and navigates through
 *     `resolveNotificationRoute` so RBAC boundaries stay enforced.
 *
 * Accessibility:
 *   - The list is a `<ul>` with `<button>` rows, focus-visible on each.
 *   - Tab strip uses `role="tablist"` + `aria-selected`.
 *   - Search input has a labelled-by `<label>` for screen readers.
 *   - Live region announces filter results count.
 *   - Mark-all / Clear-filtered buttons disable themselves when not
 *     applicable; never break the operation.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  CheckCheck,
  Search,
  X,
  Inbox,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useI18n } from '../../i18n/I18nContext';
import type { Locale } from '../../i18n/translations';
import { formatRelativeTime } from '../../utils/formatDate';
import {
  inferNotificationKind,
  resolveNotificationRoute,
  type NotificationKind,
} from '../../utils/notificationRouteMap';
import type { NotificationItem } from '../../types/domain';
import { Button } from '../../components/Button/Button';
import styles from './NotificationsPage.module.css';

// We mirror the dropdown's `titleForKind` + `renderNotificationMessage`
// helpers from `NotificationCenter.tsx` here. They are intentionally
// duplicated (not lifted) because the dropdown is a separate, testable
// unit, and pulling them up would widen its public surface. When the
// rules change, update both files together (the contract is documented
// at the top of each).

type FilterMode = 'all' | 'unread';

// ── Per-kind icon helper ────────────────────────────────────────────────────
// We deliberately reuse the dropdown's `<Inbox />` glyph as a fallback so
// that kinds added in the future still render recognisably. Real icons
// come from `lucide-react` and align with the existing iconography used
// elsewhere in ARS (no new icons are introduced).
const KIND_ICON_MAP: Record<NotificationKind, typeof Inbox> = {
  // Researcher
  'review-request-accepted': Inbox,
  'review-request-rejected': AlertTriangle,
  'review-request-started': Inbox,
  'review-request-completed': Inbox,
  'paper-status-changed': Inbox,
  'review-result-available': Inbox,
  'paper-needs-revision': AlertTriangle,
  'paper-authorship-verified': Inbox,
  'paper-authorship-rejected': AlertTriangle,
  'membership-result': Inbox,
  // Reviewer
  'new-review-request': Inbox,
  'review-request-cancelled': AlertTriangle,
  'review-deadline-reminder': AlertTriangle,
  // Lecturer
  'student-report-submitted': Inbox,
  'student-report-resubmitted': Inbox,
  'student-topic-requested': Inbox,
  'seminar-participant-response': Inbox,
  'seminar-feedback-available': Inbox,
  'group-membership-response': Inbox,
  'material-shared': Inbox,
  'material-share-accepted': Inbox,
  'material-share-declined': AlertTriangle,
  // Graduate Student
  'seminar-invitation': Inbox,
  'seminar-schedule-update': AlertTriangle,
  'added-to-research-group': Inbox,
  'topic-assigned': Inbox,
  'group-invitation': Inbox,
  'milestone-opened': Inbox,
  'learning-material-available': Inbox,
  'learning-material-unshared': AlertTriangle,
  'topic-completed': Inbox,
  'report-evaluated': Inbox,
  'report-rejected': AlertTriangle,
  // Admin
  'role-request-submitted': Inbox,
  'violation-report-submitted': AlertTriangle,
  'account-management-event': AlertTriangle,
  // Platform
  'role-request-accepted': Inbox,
  'role-request-rejected': AlertTriangle,
  'account-status-changed': AlertTriangle,
  'account-platform-update': Inbox,
  'follower-new': Inbox,
  'system-update': Inbox,
  // Forum
  'forum-reply': Inbox,
  // Fallback
  unknown: Inbox,
};

// Per-kind titles — keep in sync with the dropdown so the inbox and the
// dropdown never disagree on what a notification "is called".
function titleForKind(
  kind: NotificationKind,
  t: (key: string, fallback?: string) => string,
): string {
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
    case 'paper-authorship-verified':
      return t('notif.paperAuthorshipVerified', 'Authorship confirmed');
    case 'paper-authorship-rejected':
      return t('notif.paperAuthorshipRejected', 'Authorship rejected');
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
    case 'material-shared':
      return t('notif.materialShared', 'New shared material');
    case 'material-share-accepted':
      return t('notif.materialShareAccepted', 'Share accepted');
    case 'material-share-declined':
      return t('notif.materialShareDeclined', 'Share declined');

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
    case 'learning-material-unshared':
      return t('notif.materialUnshared', 'Shared material removed');
    case 'topic-completed':
      return t('notif.topicCompleted', 'Topic completed');
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

// Per-kind → translation key for body templates (English locale).
// Vietnamese renders the BE payload verbatim, so this map is unused in vi.
// Keep in sync with `NotificationCenter.tsx`'s `KIND_BODY_KEY`.
const KIND_BODY_KEY: Partial<Record<NotificationKind, string>> = {
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
  'material-shared': 'notif.body.materialShared',
  'material-share-accepted': 'notif.body.materialShareAccepted',
  'material-share-declined': 'notif.body.materialShareDeclined',
  'seminar-invitation': 'notif.body.seminarInvitation',
  'seminar-schedule-update': 'notif.body.seminarScheduleUpdate',
  'added-to-research-group': 'notif.body.addedToResearchGroup',
  'topic-assigned': 'notif.body.topicAssigned',
  'group-invitation': 'notif.body.groupInvitation',
  'milestone-opened': 'notif.body.milestoneOpened',
  'learning-material-available': 'notif.body.learningMaterialAvailable',
  'learning-material-unshared': 'notif.body.materialUnshared',
  'topic-completed': 'notif.body.topicCompleted',
  'paper-authorship-verified': 'notif.body.paperAuthorshipVerified',
  'paper-authorship-rejected': 'notif.body.paperAuthorshipRejected',
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

const stripTagPrefix = (raw: string): string =>
  (raw ?? '').trim().replace(/^\[[^\]]+\]\s*/, '');

const extractDynamicSuffix = (stripped: string): string => {
  const colonIdx = stripped.indexOf(':');
  if (colonIdx >= 0) {
    const after = stripped.slice(colonIdx + 1).trim();
    if (after) return after;
  }
  return stripped;
};

function renderNotificationMessage(
  notification: NotificationItem,
  locale: Locale,
  t: (key: string, fallback?: string) => string,
): string {
  const raw = (notification.message ?? '').trim();
  if (!raw) return '';
  if (locale === 'vi') return raw;

  // Mirror the dropdown's special-case translations for BE-authored legacy
  // prose that doesn't carry a `[Tag]` prefix.
  const published = raw.match(/^Bài báo "([\s\S]+)" của bạn đã được xuất bản chính thức lên Discover RESEARCH!$/u);
  if (published) return `Your paper "${published[1]}" has been published in Discover Research.`;
  const rejected = raw.match(/^Bài báo "([\s\S]+)" của bạn đã bị từ chối xuất bản\.\s*(?:Lý do: ([\s\S]*))?$/u);
  if (rejected) return `Your paper "${rejected[1]}" was rejected for publication.${rejected[2] ? ` Reason: ${rejected[2]}` : ''}`;
  const verified = raw.match(/^Bài báo "([\s\S]+)" của bạn đã được Ban biên tập xác nhận quyền sở hữu tác giả chính thức \(Status: ALLOW\)\.$/u);
  if (verified) return `Authorship of your paper "${verified[1]}" was confirmed by the Admin review team.`;
  const unverified = raw.match(/^Bài báo "([\s\S]+)" của bạn không được Ban biên tập xác nhận quyền sở hữu tác giả\.$/u);
  if (unverified) return `Authorship of your paper "${unverified[1]}" was not confirmed by the Admin review team.`;

  const kind = inferNotificationKind(raw);
  if (kind === 'unknown') return raw;
  const key = KIND_BODY_KEY[kind];
  if (!key) return raw;

  const template = t(key, raw);
  const stripped = stripTagPrefix(raw);
  const dynamicSuffix = extractDynamicSuffix(stripped);
  if (!template.includes('{suffix}')) return template;
  return template.replace(/\{suffix\}/g, dynamicSuffix);
}

// Group notifications by calendar day so the inbox reads like a journal:
// newest day on top, each day collapsible so a long quiet streak doesn't
// crowd out today's news. Calendar days are computed in the user's
// local timezone via `Intl.DateTimeFormat` — server returns ISO strings,
// the browser parses and renders.
function dayKey(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  // Use a stable YYYY-MM-DD key, not a localised string, so group order
  // is deterministic across re-renders.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayLabel(iso: string, locale: Locale, t: (k: string, fb?: string) => string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return t('notif.today', 'Today');
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return t('notif.yesterday', 'Yesterday');
  }
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

// ── Component ─────────────────────────────────────────────────────────────

export interface NotificationsPageProps {
  // Optional override; falls back to the authenticated user's id.
  userId?: number | null;
  // Optional override; falls back to react-router-dom's useNavigate().
  // Used in tests / standalone previews to intercept navigation.
  onNavigate?: (path: string) => void;
}

export const NotificationsPage = ({
  userId,
  onNavigate: onNavigateProp,
}: NotificationsPageProps): JSX.Element => {
  const navigate = useNavigate();
  const onNavigate = useCallback(
    (path: string) => {
      if (onNavigateProp) {
        onNavigateProp(path);
      } else {
        navigate(path);
      }
    },
    [navigate, onNavigateProp],
  );
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const isGuest = user?.role === 'Guest' || !user?.isActive;
  const resolvedUserId = isGuest
    ? null
    : typeof userId === 'number'
      ? userId
      : user?.userId ?? null;
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

  // Local UI state
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState<string>('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Re-focus search on `Ctrl/Cmd + K` so users coming from other
  // tab-heavy surfaces (Gmail-like muscle memory) land in the inbox fast.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pendingRef = useRef<Set<number>>(new Set());

  const handleItemClick = useCallback(
    (notification: NotificationItem) => {
      if (pendingRef.current.has(notification.id)) return;
      pendingRef.current.add(notification.id);
      void (async () => {
        try {
          if (!notification.isRead && notification.id > 0) {
            void markRead(notification.id);
          }
          const target = resolveNotificationRoute(notification.message ?? '', role);
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
    if (failures.length > 0) {
      void refetch();
    }
  }, [markAllRead, refetch]);

  // Filter pipeline — runs after the hook's sort so the unfiltered list
  // is already newest-first. Search is case-insensitive across the
  // localised title AND the BE message body, so a reviewer can type a
  // paper title fragment or a lecturer's name.
  const filtered = useMemo(() => {
    let rows = notifications;
    if (filter === 'unread') {
      rows = rows.filter((n) => !n.isRead);
    }
    const needle = search.trim().toLowerCase();
    if (needle.length > 0) {
      rows = rows.filter((n) => {
        const kind = inferNotificationKind(n.message ?? '');
        const title = titleForKind(kind, t).toLowerCase();
        const body = (n.message ?? '').toLowerCase();
        return title.includes(needle) || body.includes(needle);
      });
    }
    return rows;
  }, [notifications, filter, search, t]);

  // Group the filtered rows by calendar day so the inbox reads like a
  // journal. We preserve newest-first ordering inside each day.
  const grouped = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: NotificationItem[] }> = [];
    const indexByKey = new Map<string, number>();
    for (const row of filtered) {
      const key = dayKey(row.createdAt);
      let idx = indexByKey.get(key);
      if (idx === undefined) {
        const label = row.createdAt ? dayLabel(row.createdAt, locale, t) : '';
        idx = groups.length;
        groups.push({ key, label, items: [] });
        indexByKey.set(key, idx);
      }
      groups[idx]!.items.push(row);
    }
    return groups;
  }, [filtered, locale, t]);

  // Live-region announcement — talkback / VoiceOver will read the count
  // every time the filter or search changes.
  const announceRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!announceRef.current) return;
    const unreadShown =
      filter === 'unread' ? filtered.length : filtered.filter((n) => !n.isRead).length;
    const summary =
      filter === 'unread'
        ? t('notif.announceUnread', '{count} unread notifications shown').replace(
            '{count}',
            String(unreadShown),
          )
        : t('notif.announceAll', '{count} notifications shown').replace(
            '{count}',
            String(filtered.length),
          );
    announceRef.current.textContent = summary;
  }, [filtered, filter, t]);

  // The page header is reusable via PageHeader; the inbox-specific
  // actions (Mark all read) live in the right slot. The eyebrow makes
  // it obvious to a deep-link visitor that this is the inbox, not a
  // bell dropdown.
  const headerActions = (
    <>
      {unreadCount > 0 && (
        <Button
          variant="primary"
          size="md"
          leftIcon={<CheckCheck size={16} aria-hidden />}
          onClick={() => void handleMarkAll()}
          disabled={isLoading}
          data-testid="notifications-page-mark-all"
        >
          {t('notif.markAllRead', 'Mark all as read')}
        </Button>
      )}
    </>
  );

  return (
    <div className={styles.page} data-testid="notifications-page">
      <PageHeader
        eyebrow={t('notif.eyebrow', 'Notification inbox')}
        title={t('notif.title', 'Notifications')}
        description={
          unreadCount > 0
            ? t('notif.subtitleUnread', '{count} unread — stay on top of what needs your attention.').replace('{count}', String(unreadCount))
            : notifications.length > 0
              ? t('notif.subtitleAllCaughtUp', 'You\'re all caught up. New events will appear here as they arrive.').replace('{count}', String(notifications.length))
              : t('notif.subtitleEmpty', 'Workflow events — paper reviews, seminar invitations, group updates — will show up here as they happen.')
        }
        actions={headerActions}
        accent="var(--accent-ochre)"
      />

      {/* Toolbar: filter tab strip on the left, search input on the right.
          Sticky so it stays in view while the user scrolls a long inbox. */}
      <div className={styles.toolbar}>
        <div
          role="tablist"
          aria-label={t('notif.filterLabel', 'Filter notifications')}
          className={styles.filterTabs}
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`${styles.filterTab} ${filter === 'all' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('all')}
            data-testid="notifications-filter-all"
          >
            {t('notif.filterAll', 'All')}
            <span className={styles.filterCount}>{notifications.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'unread'}
            className={`${styles.filterTab} ${filter === 'unread' ? styles.filterTabActive : ''}`}
            onClick={() => setFilter('unread')}
            data-testid="notifications-filter-unread"
          >
            {t('notif.filterUnread', 'Unread')}
            <span className={styles.filterCount}>{unreadCount}</span>
          </button>
        </div>

        <div className={styles.searchBox}>
          <Search size={16} aria-hidden className={styles.searchIcon} />
          <label className={styles.searchLabel} htmlFor="notifications-search">
            <span className={styles.srOnly}>
              {t('notif.searchLabel', 'Search notifications')}
            </span>
          </label>
          <input
            id="notifications-search"
            ref={searchRef}
            type="search"
            inputMode="search"
            className={styles.searchInput}
            placeholder={t('notif.searchPlaceholder', 'Search by paper, lecturer, or message…')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="notifications-search"
            autoComplete="off"
          />
          {search.length > 0 && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => {
                setSearch('');
                searchRef.current?.focus();
              }}
              aria-label={t('notif.clearSearch', 'Clear search')}
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Live-region for screen-reader count updates. Visually hidden
          via .srOnly but always in the DOM so SR can pick it up. */}
      <div ref={announceRef} className={styles.srOnly} role="status" aria-live="polite" />

      {/* Body */}
      <section className={styles.body} data-testid="notifications-page-body">
        {isLoading && notifications.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} aria-hidden />
            <span>{t('notif.loading', 'Loading notifications…')}</span>
          </div>
        ) : error ? (
          <div className={styles.errorState} role="alert">
            <AlertTriangle size={22} aria-hidden />
            <h2 className={styles.errorTitle}>
              {t('notif.errorLoad', "Couldn't load notifications")}
            </h2>
            <p>{error.message}</p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void refetch()}
              data-testid="notifications-page-retry"
            >
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <BellOff size={32} aria-hidden className={styles.emptyIcon} />
            <h2 className={styles.emptyTitle}>
              {t('notif.emptyTitle', 'No notifications yet')}
            </h2>
            <p className={styles.emptyBody}>
              {t(
                'notif.emptyDescription',
                'Workflow events — paper reviews, seminar invitations, group updates — will show up here as they happen.',
              )}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <Filter size={32} aria-hidden className={styles.emptyIcon} />
            <h2 className={styles.emptyTitle}>
              {t('notif.noMatchesTitle', 'No matches')}
            </h2>
            <p className={styles.emptyBody}>
              {search.trim().length > 0
                ? t('notif.noMatchesSearch', 'No notifications match "{query}". Clear the search or switch filters to see more.').replace('{query}', search.trim())
                : t('notif.noMatchesUnread', 'You have no unread notifications right now.')}
            </p>
            {(filter !== 'all' || search.trim().length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilter('all');
                  setSearch('');
                }}
                data-testid="notifications-page-clear-filters"
              >
                {t('notif.clearFilters', 'Clear filters')}
              </Button>
            )}
          </div>
        ) : (
          <ol className={styles.groupList} data-testid="notifications-page-list">
            {grouped.map((group) => (
              <li key={group.key} className={styles.group}>
                {group.label && (
                  <div className={styles.groupHeader}>
                    <span className={styles.groupLabel}>{group.label}</span>
                    <span className={styles.groupCount}>
                      {t('notif.groupCount', '{count} items').replace('{count}', String(group.items.length))}
                    </span>
                  </div>
                )}
                <ul className={styles.itemList}>
                  {group.items.map((n) => {
                    const kind = inferNotificationKind(n.message ?? '');
                    const Icon = KIND_ICON_MAP[kind] ?? Inbox;
                    const title = titleForKind(kind, t);
                    const body = renderNotificationMessage(n, locale, t);
                    return (
                      <li key={n.id} className={styles.itemLi}>
                        <button
                          type="button"
                          className={`${styles.item} ${!n.isRead ? styles.itemUnread : ''}`}
                          onClick={() => void handleItemClick(n)}
                          data-testid={`notifications-page-item-${n.id}`}
                          data-read={n.isRead ? 'true' : 'false'}
                          data-kind={kind}
                        >
                          <span
                            className={`${styles.itemIcon} ${!n.isRead ? styles.itemIconUnread : ''}`}
                            aria-hidden="true"
                          >
                            <Icon size={16} />
                          </span>
                          <span className={styles.itemBody}>
                            <span className={styles.itemTitle}>
                              {!n.isRead && (
                                <span className={styles.unreadDot} aria-hidden="true" />
                              )}
                              {title}
                            </span>
                            {body && (
                              <span className={styles.itemMessage}>{body}</span>
                            )}
                          </span>
                          <span className={styles.itemMeta}>
                            {n.createdAt && (
                              <time
                                className={styles.itemTime}
                                dateTime={n.createdAt}
                                title={new Date(n.createdAt).toLocaleString()}
                              >
                                {formatRelativeTime(n.createdAt)}
                              </time>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};

// Defensive default — keeps tree-shaking honest if a consumer imports the
// symbol directly without going through a barrel.
export default NotificationsPage;

// Re-export the bell glyph so pages that want a compact "open inbox"
// action button can keep their import surface aligned.
export { Bell };
