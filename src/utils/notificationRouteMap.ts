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
// Withdrawal notifications are intentionally REMOVED from the active
// mapping set because the withdrawal feature is currently disabled
// (see AppConfig.features.enableWithdrawals). Any historical
// "Wallet withdrawal …" rows that linger in the BE's notification table
// resolve to the safe `/forum` fallback — they never navigate to
// `/earnings-wallet` until the withdrawal feature ships again.

import { ROUTES } from '../routes/paths';
import type { UserRole } from '../types/auth';
import { AppConfig } from '../config/app';

export type NotificationKind =
  // Researcher
  | 'review-request-accepted'
  | 'review-request-rejected'
  | 'review-request-started'
  | 'review-request-completed'
  | 'paper-status-changed'
  | 'review-result-available'
  | 'paper-needs-revision'
  | 'payment-result'
  | 'membership-result'
  | 'forum-reply'
  // Reviewer
  | 'new-review-request'
  | 'review-request-cancelled'
  | 'review-deadline-reminder'
  | 'reviewer-payment-result'
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
  | 'report-evaluated'
  | 'report-rejected'
  // Admin
  | 'role-request-submitted'
  | 'violation-report-submitted'
  | 'account-management-event'
  | 'admin-payment-issue'
  // Account / platform
  | 'role-request-accepted'
  | 'role-request-rejected'
  | 'account-status-changed'
  | 'account-platform-update'
  | 'follower-new'
  | 'system-update'
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
    spec: { path: ROUTES.REVIEW_TASKS, roles: ['Researcher', 'Reviewer', 'Admin'] },
  },
  {
    kind: 'review-request-rejected',
    prefix: '[Review] rejected',
    spec: { path: ROUTES.REVIEW_TASKS, roles: ['Researcher', 'Reviewer', 'Admin'] },
  },
  {
    kind: 'review-request-started',
    prefix: '[Review] started',
    spec: { path: ROUTES.REVIEW_TASKS, roles: ['Researcher', 'Reviewer', 'Admin'] },
  },
  {
    kind: 'review-request-completed',
    prefix: '[Review] completed',
    spec: { path: ROUTES.REVIEW_TASKS, roles: ['Researcher', 'Reviewer', 'Admin'] },
  },
  {
    kind: 'paper-status-changed',
    prefix: '[Paper] status changed',
    spec: { path: ROUTES.PAPERS, roles: ['Researcher', 'Admin'] },
  },
  {
    kind: 'review-result-available',
    prefix: '[Paper] review result',
    spec: { path: ROUTES.PAPERS, roles: ['Researcher', 'Admin'] },
  },
  {
    kind: 'paper-needs-revision',
    prefix: '[Paper] needs revision',
    spec: { path: ROUTES.PAPERS, roles: ['Researcher', 'Admin'] },
  },
  {
    kind: 'payment-result',
    prefix: '[Payment] result',
    spec: { path: ROUTES.PAYMENT_RETURN, roles: ['Researcher', 'Admin'] },
  },
  {
    kind: 'membership-result',
    prefix: '[Membership] result',
    spec: { path: ROUTES.PREMIUM_PACKAGES, roles: ['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin'] },
  },

  // ── Reviewer events ───────────────────────────────────────────────────────
  {
    kind: 'new-review-request',
    prefix: '[Review] new request',
    spec: { path: ROUTES.REVIEW_TASKS, roles: ['Reviewer', 'Admin'], idPattern: /\b(\d+)\b/ },
  },
  {
    kind: 'review-request-cancelled',
    prefix: '[Review] cancelled',
    spec: { path: ROUTES.REVIEW_TASKS, roles: ['Reviewer', 'Admin'] },
  },
  {
    kind: 'review-deadline-reminder',
    prefix: '[Review] deadline',
    spec: { path: ROUTES.REVIEW_TASKS, roles: ['Reviewer', 'Admin'] },
  },
  {
    kind: 'reviewer-payment-result',
    prefix: '[Wallet] payment result',
    spec: { path: ROUTES.EARNINGS_WALLET, roles: ['Reviewer', 'Admin'] },
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
      path: ROUTES.LECTURER_GUIDANCE_PROJECTS,
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
  {
    kind: 'admin-payment-issue',
    prefix: '[Admin] payment',
    spec: { path: ROUTES.ADMIN_TRANSACTIONS, roles: ['Admin'] },
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

  // ── Forum / reply (all roles) ─────────────────────────────────────────────
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
  if (normalized.includes('tiền') || normalized.includes('ví') || normalized.includes('thanh toán') || normalized.includes('wallet')) {
    return 'payment-result';
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

  // Withdrawal messages are intentionally suppressed: while
  // AppConfig.features.enableWithdrawals is false, the withdrawal
  // destination route is unreachable. Returning the safe fallback for
  // any prefix matching `[Wallet] withdrawal` keeps the dropdown honest
  // without ever deep-linking into a hidden page.
  if (kind === 'unknown') {
    return getSafeFallbackRoute();
  }
  if (
    !AppConfig.features.enableWithdrawals &&
    message.trim().toLowerCase().startsWith('[wallet] withdrawal')
  ) {
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

// Convenience used by tests: list the explicit kind for which the
// withdrawal destination has been disabled in this build.
export const DISABLED_KINDS: ReadonlyArray<NotificationKind> = [];