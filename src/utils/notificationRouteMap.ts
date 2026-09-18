// Centralized notification-type → frontend route mapping.
//
// The BE Notification DTO has no `type` field and no `targetUrl` field
// (`NotificationItem` only carries `id`, `userId`, `message`, `isRead`,
// optional `createdAt`). So we cannot dispatch on a server-supplied
// discriminator. Instead we infer a notification "kind" from the message
// text using a deterministic pattern list. Every notification produced by
// the BE for the ARS workflow must use one of the prefixes below; any
// message that does not match falls back to a safe destination (the
// shared /forum route) so the user is never deep-linked into a page they
// cannot reach.
//
// Keeping this in one place — instead of scattering `if message.includes…`
// checks across components — is required so the navigation rule stays
// auditable and so RBAC checks happen in exactly one location.
//
// The `roles` field is the set of roles that are allowed to land on the
// resolved target. Notifications for other roles are silently dropped to
// the safe fallback to prevent a Reviewer from being deep-linked into
// the Admin surface, etc.
//
// Historical wallet / withdrawal / payment notification rows (prefix
// `[Wallet]…`) are no longer produced; any stale rows that still match
// those prefixes resolve to the safe `/forum` fallback because no
// destination route exists for them any longer.

import { ROUTES } from '../routes/paths';
import type { UserRole } from '../types/auth';
import type { Locale } from '../i18n/translations';

export type NotificationKind =
  // Researcher
  | 'review-request-accepted'
  | 'review-request-rejected'
  | 'review-request-started'
  | 'review-request-completed'
  | 'paper-status-changed'
  | 'review-result-available'
  | 'paper-needs-revision'
  | 'membership-result'
  | 'forum-reply'
  | 'forum-post-liked'
  | 'forum-comment-upvoted'
  | 'forum-post-commented'
  | 'forum-comment-replied'
  // Reviewer
  | 'new-review-request'
  | 'review-request-cancelled'
  | 'review-deadline-reminder'
  // Lecturer
  | 'student-report-submitted'
  | 'student-report-resubmitted'
  | 'student-topic-requested'
  | 'seminar-participant-response'
  | 'seminar-feedback-available'
  | 'group-membership-response'
  // Graduate Student
  | 'seminar-invitation'
  | 'seminar-schedule-update'
  | 'added-to-research-group'
  | 'topic-assigned'
  | 'group-invitation'
  | 'milestone-opened'
  | 'learning-material-available'
  | 'learning-material-unshared'
  | 'report-evaluated'
  | 'report-rejected'
  // Admin
  | 'role-request-submitted'
  | 'violation-report-submitted'
  | 'account-management-event'
  // Account / platform
  | 'role-request-accepted'
  | 'role-request-rejected'
  | 'account-status-changed'
  | 'account-platform-update'
  | 'follower-new'
  | 'system-update'
  // Lecturer material sharing events
  | 'material-shared'
  | 'material-share-accepted'
  | 'material-share-declined'
  // Research Group join request workflow
  | 'group-join-requested'
  | 'group-join-accepted'
  | 'group-join-rejected'
  | 'group-member-accepted'
  // Research Topic learning material events
  | 'topic-learning-material-added'
  | 'topic-learning-material-removed'
  // Researcher authorship events
  | 'paper-authorship-verified'
  | 'paper-authorship-rejected'
  // Graduate Student topic completion
  | 'topic-completed'
  | 'unknown';

interface NotificationRouteSpec {
  // Path used when the notification is clicked. Must be an internal
  // ARS route — never an external URL. Components may interpolate the
  // notification id (e.g. /review-tasks/<id>) but the prefix is fixed.
  path: string;
  // The set of roles that may navigate to this path. If the
  // authenticated user's role is not in this set, the route resolver
  // returns the safe fallback instead of navigating.
  roles: ReadonlyArray<UserRole>;
  // Optional: a regex that captures a numeric id from the message so
  // we can build `/review-tasks/123` style URLs. The first capture group
  // is the id. Reserved for future per-entity routing — currently unused.
  idPattern?: RegExp;
}

// Each entry maps a kind prefix → route + RBAC. Add new events here, never
// inline in a component, so the navigation matrix stays auditable.
const ROUTE_SPECS: ReadonlyArray<{ kind: NotificationKind; prefix: string; spec: NotificationRouteSpec }> = [
  // ── Researcher events ─────────────────────────────────────────────────────
  {
    kind: 'review-request-accepted',
    prefix: '[Review] accepted',
    spec: { path: ROUTES.RESEARCHER_SUBMISSIONS, roles: ['Researcher'] },
  },
  {
    kind: 'review-request-rejected',
    prefix: '[Review] rejected',
    spec: { path: ROUTES.RESEARCHER_SUBMISSIONS, roles: ['Researcher'] },
  },
  {
    kind: 'review-request-started',
    prefix: '[Review] started',
    spec: { path: ROUTES.RESEARCHER_SUBMISSIONS, roles: ['Researcher'] },
  },
  {
    kind: 'review-request-completed',
    prefix: '[Review] completed',
    spec: { path: ROUTES.RESEARCHER_SUBMISSIONS, roles: ['Researcher'] },
  },
  {
    kind: 'paper-status-changed',
    prefix: '[Paper] status changed',
    spec: { path: ROUTES.RESEARCHER_SUBMISSIONS, roles: ['Researcher'] },
  },
  {
    kind: 'review-result-available',
    prefix: '[Paper] review result',
    spec: { path: ROUTES.RESEARCHER_SUBMISSIONS, roles: ['Researcher'] },
  },
  {
    kind: 'paper-needs-revision',
    prefix: '[Paper] needs revision',
    spec: { path: ROUTES.RESEARCHER_SUBMISSIONS, roles: ['Researcher'] },
  },
  {
    kind: 'paper-authorship-verified',
    prefix: '[Paper] authorship confirmed',
    spec: { path: ROUTES.RESEARCHER_SUBMISSIONS, roles: ['Researcher'] },
  },
  {
    kind: 'paper-authorship-rejected',
    prefix: '[Paper] authorship rejected',
    spec: { path: ROUTES.RESEARCHER_SUBMISSIONS, roles: ['Researcher'] },
  },

  // ── Reviewer events ───────────────────────────────────────────────────────
  {
    kind: 'new-review-request',
    prefix: '[Review] new request',
    spec: { path: ROUTES.REVIEWER_ASSIGNMENTS, roles: ['Reviewer'], idPattern: /\b(\d+)\b/ },
  },
  {
    kind: 'review-request-cancelled',
    prefix: '[Review] cancelled',
    spec: { path: ROUTES.REVIEWER_ASSIGNMENTS, roles: ['Reviewer'] },
  },
  {
    kind: 'review-deadline-reminder',
    prefix: '[Review] deadline',
    spec: { path: ROUTES.REVIEWER_ASSIGNMENTS, roles: ['Reviewer'] },
  },

  // ── Lecturer events ───────────────────────────────────────────────────────
  {
    kind: 'student-report-submitted',
    prefix: '[Lecturer] report submitted',
    spec: {
      path: ROUTES.LECTURER_EVALUATE_REPORTS,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'student-report-resubmitted',
    prefix: '[Lecturer] report resubmitted',
    spec: {
      path: ROUTES.LECTURER_EVALUATE_REPORTS,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'student-topic-requested',
    prefix: '[Lecturer] topic requested',
    spec: {
      path: ROUTES.LECTURER_RESEARCH_TOPICS,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'seminar-participant-response',
    prefix: '[Seminar] participant',
    spec: {
      path: ROUTES.SEMINAR_WORKSPACE,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'seminar-feedback-available',
    prefix: '[Seminar] feedback',
    spec: {
      path: ROUTES.SEMINAR_WORKSPACE,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'group-membership-response',
    prefix: '[Group] membership',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'material-shared',
    prefix: '[Lecturer] material shared',
    spec: {
      path: ROUTES.LECTURER_MATERIALS,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'material-share-accepted',
    prefix: '[Lecturer] share accepted',
    spec: {
      path: ROUTES.LECTURER_MATERIALS,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'material-share-declined',
    prefix: '[Lecturer] share declined',
    spec: {
      path: ROUTES.LECTURER_MATERIALS,
      roles: ['Lecturer', 'Admin'],
    },
  },

  // ── Research Group Join Request workflow ────────────────────────────────
  // Graduate Student → Lecturer: a new application arrived.
  {
    kind: 'group-join-requested',
    prefix: '[Group] join request',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'group-join-requested',
    prefix: '(Nhóm nghiên cứu) Yêu cầu tham gia mới',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Lecturer', 'Admin'],
    },
  },
  // Lecturer → Graduate Student: the Lecturer accepted.
  {
    kind: 'group-join-accepted',
    prefix: '[Student] join accepted',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'group-join-accepted',
    prefix: '(Nhóm nghiên cứu) Yêu cầu tham gia được chấp thuận',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  // Lecturer → Graduate Student: the Lecturer rejected.
  {
    kind: 'group-join-rejected',
    prefix: '[Student] join rejected',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'group-join-rejected',
    prefix: '(Nhóm nghiên cứu) Yêu cầu tham gia bị từ chối',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  // BE → existing group members when a new member is accepted.
  {
    kind: 'group-member-accepted',
    prefix: '[Group] new member',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Lecturer', 'Admin'],
    },
  },
  {
    kind: 'group-member-accepted',
    prefix: '(Nhóm nghiên cứu) Thành viên mới được chấp thuận',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Lecturer', 'Admin'],
    },
  },

  // ── Research Topic learning-material events ─────────────────────────────
  // Lecturer attached a new library material to a topic → notify the
  // Graduate Students assigned to that topic.
  {
    kind: 'topic-learning-material-added',
    prefix: '[Student] topic material added',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'topic-learning-material-added',
    prefix: '(Nhóm nghiên cứu) Tài liệu học tập mới được thêm',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  // Lecturer detached a material from a topic.
  {
    kind: 'topic-learning-material-removed',
    prefix: '[Student] topic material removed',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'topic-learning-material-removed',
    prefix: '(Nhóm nghiên cứu) Tài liệu học tập bị xóa',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },

  // ── Graduate Student events ───────────────────────────────────────────────
  // Seminar invitation → redirect to the Seminar workspace. Accept/Decline
  // lives on the destination page (per the spec — never on the dropdown).
  // Both Lecturer and Graduate Student share the seminar workspace route;
  // the role guard permits either.
  {
    kind: 'seminar-invitation',
    prefix: '[Seminar] invitation',
    spec: {
      path: ROUTES.SEMINAR_WORKSPACE,
      roles: ['Graduate Student', 'Lecturer', 'Admin'],
    },
  },
  {
    kind: 'seminar-schedule-update',
    prefix: '[Seminar] schedule',
    spec: {
      path: ROUTES.SEMINAR_WORKSPACE,
      roles: ['Graduate Student', 'Lecturer', 'Admin'],
    },
  },
  {
    kind: 'added-to-research-group',
    prefix: '[Student] added to group',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'topic-assigned',
    prefix: '[Student] topic assigned',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'group-invitation',
    prefix: '[Student] group invitation',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'milestone-opened',
    prefix: '[Student] milestone opened',
    spec: { path: ROUTES.SUBMIT_REPORT, roles: ['Graduate Student', 'Admin'] },
  },
  {
    kind: 'learning-material-available',
    prefix: '[Student] learning material',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'learning-material-unshared',
    prefix: '[Student] material unshared',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'topic-completed',
    prefix: '[Student] topic completed',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Admin'],
    },
  },
  {
    kind: 'report-evaluated',
    prefix: '[Student] report evaluated',
    spec: { path: ROUTES.SUBMIT_REPORT, roles: ['Graduate Student', 'Admin'] },
  },
  {
    kind: 'report-rejected',
    prefix: '[Student] report rejected',
    spec: { path: ROUTES.SUBMIT_REPORT, roles: ['Graduate Student', 'Admin'] },
  },

  // ── Admin events ──────────────────────────────────────────────────────────
  {
    kind: 'role-request-submitted',
    prefix: '[Admin] role request',
    spec: { path: ROUTES.ADMIN_ROLE_REQUESTS, roles: ['Admin'] },
  },
  {
    kind: 'violation-report-submitted',
    prefix: '[Admin] violation report',
    spec: { path: ROUTES.ADMIN_REPORTS, roles: ['Admin'] },
  },
  {
    kind: 'account-management-event',
    prefix: '[Admin] account',
    spec: { path: ROUTES.ADMIN_ACCOUNTS, roles: ['Admin'] },
  },

  // ── Platform-wide ─────────────────────────────────────────────────────────
  {
    kind: 'role-request-accepted',
    prefix: '[Account] role accepted',
    spec: { path: ROUTES.ACCOUNT_SETTINGS, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
  {
    kind: 'role-request-rejected',
    prefix: '[Account] role rejected',
    spec: { path: ROUTES.ACCOUNT_SETTINGS, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
  {
    kind: 'account-status-changed',
    prefix: '[Account] status changed',
    spec: { path: ROUTES.ACCOUNT_SETTINGS, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
  {
    kind: 'account-platform-update',
    prefix: '[Account]',
    spec: { path: ROUTES.ACCOUNT_SETTINGS, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
  {
    kind: 'system-update',
    prefix: '[System]',
    spec: { path: ROUTES.FORUM, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },

  // ── Follower events (all roles) ──────────────────────────────────────────
  {
    kind: 'follower-new',
    prefix: '[Follower]',
    spec: { path: ROUTES.PROFILE, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
  {
    kind: 'follower-new',
    prefix: 'theo dõi',
    spec: { path: ROUTES.PROFILE, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },

  // ── Forum interactions (all roles) ─────────────────────────────────────────
  {
    kind: 'forum-post-liked',
    prefix: '[Forum] like',
    spec: { path: ROUTES.FORUM, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
  {
    kind: 'forum-comment-upvoted',
    prefix: '[Forum] upvote',
    spec: { path: ROUTES.FORUM, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
  {
    kind: 'forum-post-commented',
    prefix: '[Forum] comment',
    spec: { path: ROUTES.FORUM, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
  {
    kind: 'forum-comment-replied',
    prefix: '[Forum] reply to comment',
    spec: { path: ROUTES.FORUM, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
  {
    kind: 'forum-reply',
    prefix: '[Forum] reply',
    spec: { path: ROUTES.FORUM, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
];

export function inferNotificationKind(message: string): NotificationKind {
  const normalized = (message ?? '').trim().toLowerCase();
  for (const { kind, prefix } of ROUTE_SPECS) {
    if (normalized.startsWith(prefix.toLowerCase())) {
      return kind;
    }
  }

  // Fallback keyword inspection for natural language BE notifications
  if (normalized.includes('thích bài viết') || normalized.includes('liked your post')) {
    return 'forum-post-liked';
  }
  if (normalized.includes('ủng hộ bình luận') || normalized.includes('upvoted your comment')) {
    return 'forum-comment-upvoted';
  }
  if (
    normalized.includes('trả lời bình luận') ||
    normalized.includes('replied to your comment') ||
    normalized.includes('trả lời phản hồi')
  ) {
    return 'forum-comment-replied';
  }
  if (
    normalized.includes('bình luận vào bài viết') ||
    normalized.includes('commented on your post')
  ) {
    return 'forum-post-commented';
  }
  if (normalized.includes('theo dõi') || normalized.includes('follow')) {
    return 'follower-new';
  }
  if (normalized.includes('vai trò') || normalized.includes('phê duyệt') || normalized.includes('role')) {
    return 'role-request-accepted';
  }
  if (normalized.includes('phản biện') || normalized.includes('review')) {
    return 'new-review-request';
  }
  if (normalized.includes('hội thảo') || normalized.includes('seminar')) {
    return 'seminar-invitation';
  }
  if (normalized.includes('bình luận') || normalized.includes('bài viết') || normalized.includes('diễn đàn') || normalized.includes('forum')) {
    return 'forum-reply';
  }
  if (normalized.includes('báo cáo') || normalized.includes('giai đoạn') || normalized.includes('report')) {
    return 'student-report-submitted';
  }
  // Research group join request workflow keywords
  if (normalized.includes('yêu cầu tham gia') && normalized.includes('chấp thuận')) {
    return 'group-join-accepted';
  }
  if (normalized.includes('yêu cầu tham gia') && (normalized.includes('từ chối') || normalized.includes('bị từ chối'))) {
    return 'group-join-rejected';
  }
  if (normalized.includes('yêu cầu tham gia')) {
    return 'group-join-requested';
  }
  if (normalized.includes('thành viên mới') && (normalized.includes('chấp thuận') || normalized.includes('được chấp thuận'))) {
    return 'group-member-accepted';
  }
  // Research topic learning-material keywords
  if (normalized.includes('tài liệu học tập') && (normalized.includes('được thêm') || normalized.includes('đã được thêm') || normalized.includes('thêm mới'))) {
    return 'topic-learning-material-added';
  }
  if (normalized.includes('tài liệu học tập') && (normalized.includes('bị xóa') || normalized.includes('đã xóa') || normalized.includes('đã gỡ'))) {
    return 'topic-learning-material-removed';
  }

  return 'unknown';
}

// Safe fallback destination for any notification that does not match a
// known prefix, or whose matched prefix targets a role the current user
// does not hold. Returning the shared /forum route (which every role can
// reach) keeps the user in a page they can actually view without
// deep-linking them past their role boundary.
//
// Exported as a getter so tests / callers can document the contract —
// and so a future change to the fallback destination only touches this
// single definition.
export function getSafeFallbackRoute(): string {
  return ROUTES.FORUM;
}

// Resolve a notification to a target route, given the current role.
//
// Returns the safe fallback (never null) when:
//   * the message did not match any known prefix, OR
//   * the matched prefix targets a role the current user does not hold.
//
// This is the single source of truth for the
// "navigate-into-a-page-they-cannot-access" rule. The UI MUST always
// navigate to the returned path (even when it is the fallback) so the
// dropdown closes consistently.
export function resolveNotificationRoute(
  message: string,
  currentRole: UserRole | string | null | undefined,
): string {
  const role: UserRole | null =
    typeof currentRole === 'string' && currentRole.length > 0
      ? (currentRole as UserRole)
      : null;
  const kind = inferNotificationKind(message);

  if (kind === 'unknown') {
    return getSafeFallbackRoute();
  }

  const spec = ROUTE_SPECS.find((entry) => entry.kind === kind)?.spec;
  if (!spec) {
    return getSafeFallbackRoute();
  }
  if (!role) {
    return getSafeFallbackRoute();
  }
  if (!spec.roles.includes(role)) {
    return getSafeFallbackRoute();
  }
  // The idPattern branch is reserved for routes like `/review-tasks/:id`
  // that need a captured numeric id from the message. We currently don't
  // have any such route wired up, but the hook keeps the seam so adding
  // one is a one-line change.
  return spec.path;
}

// Convenience used by tests: list every kind we currently handle. Adding a
// new entry to `ROUTE_SPECS` automatically extends this list.
export const KNOWN_NOTIFICATION_KINDS: ReadonlyArray<NotificationKind> =
  ROUTE_SPECS.map((entry) => entry.kind);

/**
 * Strip a leading BE-side tag (e.g. `[Seminar] invitation`) so the
 * remainder can be used as plain prose. Exported so the dropdown and the
 * notifications page share the exact same definition — they used to
 * duplicate this in two places and drift apart.
 */
export const stripNotificationTagPrefix = (raw: string): string =>
  (raw ?? '').trim().replace(/^\[[^\]]+\]\s*/, '').replace(/^\([^\)]+\)\s*/, '');

/**
 * Pull just the dynamic suffix out of a BE notification message so it can
 * be substituted into the English body template without dragging the
 * whole Vietnamese sentence across.
 *
 * BE messages come in two shapes:
 *
 *   1. Legacy `[Tag] prefix: <DynamicValue>` — the original
 *      machine-authored templates. The dynamic value sits after the
 *      first colon. Example:
 *        "[REVIEWER_PAPER_ASSIGNED] Bạn có một bài báo mới được phân
 *         công phản biện: Deep Learning for Climate Prediction"
 *      → suffix = "Deep Learning for Climate Prediction"
 *
 *   2. Natural-language prose — newer BE messages are full Vietnamese
 *      sentences with the dynamic entity name embedded in quotes
 *      (curly or straight). Example:
 *        'Bạn đã được mời tham dự hội thảo "Demo Seminar 5" vào
 *         Thứ Năm, 17 tháng 9 năm 2026.'
 *      → suffix = "Demo Seminar 5"
 *
 * We try the quoted-name strategy first (it matches the vast majority
 * of recent BE messages), then fall back to the legacy colon split, and
 * finally return null so the English template can drop the `{suffix}`
 * placeholder cleanly. Returning null instead of the full prose is the
 * whole point of this fix — the previous fallback emitted a half-
 * Vietnamese sentence inside an English notification.
 */
export function extractNotificationDynamicSuffix(stripped: string): string | null {
  const text = (stripped ?? '').trim();
  if (!text) return null;

  // Strategy 1: a quoted entity name — straight OR curly quotes. Covers
  // virtually every modern BE notification: seminar title, group name,
  // topic title, etc.
  const quoted = text.match(/["“”«»]([^"“”«»]{1,200})["“”«»]/u);
  if (quoted && quoted[1].trim()) {
    return quoted[1].trim();
  }

  // Strategy 2: legacy `[Tag] prefix: <DynamicValue>` format. Only
  // honour the colon split if what follows looks like a short suffix
  // (≤ 120 chars) — anything longer is almost certainly a full sentence
  // and the legacy fallback would re-introduce the bug we just fixed.
  const colonIdx = text.indexOf(':');
  if (colonIdx >= 0) {
    const after = text.slice(colonIdx + 1).trim();
    if (after && after.length <= 120 && !/[.!?]\s/.test(after)) {
      return after;
    }
  }

  return null;
}

/**
 * Parses and formats a forum notification string into localized prose.
 * Returns null if the message is not a recognized natural-language forum notification.
 */
export function formatForumNotification(raw: string, locale: Locale): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;

  // 1. Post liked: "[Forum] {Actor} đã thích bài viết của bạn: \"{Title}\""
  const likeMatch = text.match(
    /^(?:\[(?:Forum|Diễn đàn)\]\s*)?([\s\S]+?)\s+đã thích bài viết của bạn:\s*["“”«»]([\s\S]*?)["“”«»]\.?$/u,
  );
  if (likeMatch) {
    const actor = likeMatch[1].trim();
    const title = likeMatch[2].trim();
    return locale === 'vi'
      ? `${actor} đã thích bài viết của bạn: "${title}"`
      : `${actor} liked your post: "${title}"`;
  }

  // 2. Comment upvoted: "[Forum] {Actor} đã ủng hộ bình luận của bạn: \"{Snippet}\""
  const upvoteMatch = text.match(
    /^(?:\[(?:Forum|Diễn đàn)\]\s*)?([\s\S]+?)\s+đã ủng hộ bình luận của bạn:\s*["“”«»]([\s\S]*?)["“”«»]\.?$/u,
  );
  if (upvoteMatch) {
    const actor = upvoteMatch[1].trim();
    const snippet = upvoteMatch[2].trim();
    return locale === 'vi'
      ? `${actor} đã ủng hộ bình luận của bạn: "${snippet}"`
      : `${actor} upvoted your comment: "${snippet}"`;
  }

  // 3. Comment posted: "[Diễn đàn] {Actor} đã bình luận vào bài viết \"{Title}\" của bạn."
  const commentMatch = text.match(
    /^(?:\[(?:Forum|Diễn đàn)\]\s*)?([\s\S]+?)\s+đã bình luận vào bài viết\s*["“”«»]([\s\S]*?)["“”«»]\s*của bạn\.?$/u,
  );
  if (commentMatch) {
    const actor = commentMatch[1].trim();
    const title = commentMatch[2].trim();
    return locale === 'vi'
      ? `${actor} đã bình luận vào bài viết "${title}" của bạn.`
      : `${actor} commented on your post "${title}".`;
  }

  // 4. Comment replied: "[Diễn đàn] {Actor} đã trả lời bình luận của bạn: \"{Snippet}\""
  const replyMatch = text.match(
    /^(?:\[(?:Forum|Diễn đàn)\]\s*)?([\s\S]+?)\s+đã trả lời bình luận của bạn:\s*["“”«»]([\s\S]*?)["“”«»]\.?$/u,
  );
  if (replyMatch) {
    const actor = replyMatch[1].trim();
    const snippet = replyMatch[2].trim();
    return locale === 'vi'
      ? `${actor} đã trả lời bình luận của bạn: "${snippet}"`
      : `${actor} replied to your comment: "${snippet}"`;
  }

  return null;
}

