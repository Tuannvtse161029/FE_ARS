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
  // Subscription payment events — the BE fires one of these the moment
  // PayOS confirms a purchase. The message is fully Vietnamese prose
  // (e.g. "(Thanh toán) Thanh toán phí hội viên 'Lecturer Six Months'
  // thành công (Mã giao dịch: ...)"). We classify by that pattern so the
  // notification routes the user to /subscription instead of falling
  // through to the /forum safe-fallback (which would be unreachable
  // without an active session and would log the user out via the auth
  // guard).
  | 'subscription-payment-success'
  | 'subscription-payment-failed'
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
  // Optional per-role path override. When the current user's role has
  // an entry here, it wins over `path`. Use this when the same kind
  // of notification should land different roles on different
  // surfaces — e.g. a seminar invitation needs to send the
  // organizer (Lecturer / Researcher) to the management workspace
  // at `/seminar-workspace`, but the invitee (Graduate Student /
  // Reviewer) to the participations inbox at `/seminar-participations`
  // because the management surface rejects the invitee role via
  // RoleRouteGuard and would otherwise redirect them to their
  // landing page (which is what the September 2026 bug report
  // described: "clicking a seminar invitation sends me to Discover
  // Research").
  pathByRole?: Partial<Record<UserRole, string>>;
  // Optional: a regex that captures a numeric id from the message so
  // we can build `/review-tasks/123` style URLs. The first capture group
  // is the id. Reserved for future per-entity routing — currently unused.
  idPattern?: RegExp;
}

// Each entry maps a kind prefix → route + RBAC. Add new events here, never
// inline in a component, so the navigation matrix stays auditable.
//
// Authoring rule (October 2026 audit):
//   The `roles` array MUST be a subset of the destination route's
//   `RoleRouteGuard.allow` list. If a role would be accepted by the
//   resolver but rejected by the route guard, the user is silently
//   bounced to their landing page — the exact bug that motivated the
//   seminar-invitation fix in the previous turn. Mismatches here fall
//   through to the safe `/forum` fallback and break the user
//   experience. When a single notification kind should land
//   different roles on different surfaces, use `pathByRole` (e.g.
//   `group-member-accepted` sends Lecturers to /research-group but
//   Graduate Students to /student-research-groups).
//
// To verify, every spec was cross-referenced against the route guards
// in src/App.tsx. The audit table lives in the September 2026
// notification-routing audit doc.
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
  // Note: every Lecturer-targeted route guard is `allow={['Lecturer']}`
  // (not `['Lecturer', 'Admin']`). Admin is intentionally NOT in the
  // allow list for the Lecturer workspace — Admin has a separate
  // workspace under /admin. Including Admin in these spec `roles`
  // arrays would make the resolver return /lecturer/... for an Admin,
  // and RoleRouteGuard would silently bounce them to /home
  // ("Discover Research"). They are listed as ['Lecturer'] so an
  // Admin receiving one of these (an unanticipated BE mis-fire)
  // falls through to the safe /forum fallback instead of being
  // deep-linked into a page they cannot read.
  {
    kind: 'student-report-submitted',
    prefix: '[Lecturer] report submitted',
    spec: {
      path: ROUTES.LECTURER_EVALUATE_REPORTS,
      roles: ['Lecturer'],
    },
  },
  {
    kind: 'student-report-resubmitted',
    prefix: '[Lecturer] report resubmitted',
    spec: {
      path: ROUTES.LECTURER_EVALUATE_REPORTS,
      roles: ['Lecturer'],
    },
  },
  {
    kind: 'student-topic-requested',
    prefix: '[Lecturer] topic requested',
    spec: {
      path: ROUTES.LECTURER_RESEARCH_TOPICS,
      roles: ['Lecturer'],
    },
  },
  {
    kind: 'seminar-participant-response',
    prefix: '[Seminar] participant',
    spec: {
      // /seminar-workspace is gated for ['Lecturer','Researcher'].
      // A Researcher can also organise a seminar, so they legitimately
      // receive this notification when an invitee responds to their
      // seminar. We avoid /forum and instead land them on their
      // participations inbox (the only surface that shows the
      // accept/decline ledger they care about).
      path: ROUTES.SEMINAR_PARTICIPATIONS,
      roles: ['Lecturer', 'Researcher'],
    },
  },
  {
    kind: 'seminar-feedback-available',
    prefix: '[Seminar] feedback',
    spec: {
      // Same as seminar-participant-response — the organizer's
      // participations inbox is where the feedback is rendered.
      path: ROUTES.SEMINAR_PARTICIPATIONS,
      roles: ['Lecturer', 'Researcher'],
    },
  },

  // ── Group membership lifecycle events ─────────────────────────────────
  // The BE fires a `[Group] membership result: …` notification to a
  // Graduate Student when their application to a group is accepted
  // or rejected, and a `[Group] membership: …` notification to the
  // supervising Lecturer when a new application arrives. Both
  // prefixes share the literal token `[Group] membership`; because
  // `inferNotificationKind` does a longest-prefix-wins by spec
  // ORDER (not by length), the more specific `membership-result`
  // entry MUST be declared BEFORE the catch-all
  // `group-membership-response` entry, otherwise the
  // Graduate-Student-targeted message would be misclassified as
  // the Lecturer-targeted one. (This was the September 2026 audit
  // finding — the entry had been declared later in the table and
  // therefore was effectively dead code.)
  {
    kind: 'membership-result',
    prefix: '[Group] membership result',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'group-membership-response',
    prefix: '[Group] membership',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Lecturer'],
    },
  },
  {
    kind: 'material-shared',
    prefix: '[Lecturer] material shared',
    spec: {
      path: ROUTES.LECTURER_MATERIALS,
      roles: ['Lecturer'],
    },
  },
  {
    kind: 'material-share-accepted',
    prefix: '[Lecturer] share accepted',
    spec: {
      path: ROUTES.LECTURER_MATERIALS,
      roles: ['Lecturer'],
    },
  },
  {
    kind: 'material-share-declined',
    prefix: '[Lecturer] share declined',
    spec: {
      path: ROUTES.LECTURER_MATERIALS,
      roles: ['Lecturer'],
    },
  },

  // ── Research Group Join Request workflow ────────────────────────────────
  // Graduate Student → Lecturer: a new application arrived.
  {
    kind: 'group-join-requested',
    prefix: '[Group] join request',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Lecturer'],
    },
  },
  {
    kind: 'group-join-requested',
    prefix: '(Nhóm nghiên cứu) Yêu cầu tham gia mới',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Lecturer'],
    },
  },
  // Lecturer → Graduate Student: the Lecturer accepted.
  // /student-research-groups is gated for ['Graduate Student','Lecturer'].
  // The Lecturer is included in the allow list because a Lecturer can
  // navigate to the same page (e.g. to inspect a student's view of the
  // group they share), but this kind is only fired to the Graduate
  // Student in practice. Adding Lecturer here is harmless: the resolver
  // would land a Lecturer who received this on /student-research-groups
  // which they can read.
  {
    kind: 'group-join-accepted',
    prefix: '[Student] join accepted',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'group-join-accepted',
    prefix: '(Nhóm nghiên cứu) Yêu cầu tham gia được chấp thuận',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  // Lecturer → Graduate Student: the Lecturer rejected.
  {
    kind: 'group-join-rejected',
    prefix: '[Student] join rejected',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'group-join-rejected',
    prefix: '(Nhóm nghiên cứu) Yêu cầu tham gia bị từ chối',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  // BE → existing group members when a new member is accepted.
  // Recipients include BOTH the supervising Lecturer AND the other
  // Graduate Students already in the group. The Lecturer's
  // /research-group and the Graduate Student's
  // /student-research-groups are different surfaces (and different
  // RoleRouteGuard allow lists), so this is the textbook case for
  // `pathByRole` — see the September 2026 routing fix.
  {
    kind: 'group-member-accepted',
    prefix: '[Group] new member',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Graduate Student', 'Lecturer'],
      pathByRole: {
        'Graduate Student': ROUTES.STUDENT_RESEARCH_GROUPS,
      },
    },
  },
  {
    kind: 'group-member-accepted',
    prefix: '(Nhóm nghiên cứu) Thành viên mới được chấp thuận',
    spec: {
      path: ROUTES.RESEARCH_GROUP,
      roles: ['Graduate Student', 'Lecturer'],
      pathByRole: {
        'Graduate Student': ROUTES.STUDENT_RESEARCH_GROUPS,
      },
    },
  },

  // ── Research Topic learning-material events ─────────────────────────────
  // Lecturer attached a new library material to a topic → notify the
  // Graduate Students assigned to that topic. (A Lecturer can also
  // navigate to /student-research-groups as a courtesy read; the route
  // allows it. So the spec lists ['Graduate Student','Lecturer'] to
  // match the route's allow list and avoid the safe-fallback bounce.)
  {
    kind: 'topic-learning-material-added',
    prefix: '[Student] topic material added',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'topic-learning-material-added',
    prefix: '(Nhóm nghiên cứu) Tài liệu học tập mới được thêm',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  // Lecturer detached a material from a topic.
  {
    kind: 'topic-learning-material-removed',
    prefix: '[Student] topic material removed',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'topic-learning-material-removed',
    prefix: '(Nhóm nghiên cứu) Tài liệu học tập bị xóa',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },

  // ── Graduate Student events ───────────────────────────────────────────────
  // Seminar invitation / schedule update. Accept/Decline lives on the
  // destination page (per the spec — never on the dropdown).
  //
  // Recipient-by-recipient:
  //   * Lecturer  →  /seminar-workspace  (organizer, manages the seminar)
  //   * Researcher (organizer)  →  /seminar-workspace
  //   * Researcher (attendee)   →  /seminar-participations
  //   * Graduate Student  →  /seminar-participations  (invitee)
  //   * Reviewer  →  /seminar-participations  (invitee)
  //
  // The BE doesn't currently distinguish "Researcher as organizer" vs
  // "Researcher as attendee" on a per-event basis, so the pathByRole
  // for Researcher defaults to /seminar-participations (the safer
  // attendee surface). If the BE later wants to single out the
  // organizer case, the test that asserts this routing is the
  // "researcher seminar invitation lands on /seminar-participations"
  // test in notificationRouteMap.test.ts — update that test alongside
  // the BE change so the contract stays pinned.
  {
    kind: 'seminar-invitation',
    prefix: '[Seminar] invitation',
    spec: {
      path: ROUTES.SEMINAR_WORKSPACE,
      roles: ['Graduate Student', 'Lecturer', 'Researcher', 'Reviewer'],
      pathByRole: {
        'Graduate Student': ROUTES.SEMINAR_PARTICIPATIONS,
        Reviewer: ROUTES.SEMINAR_PARTICIPATIONS,
        Researcher: ROUTES.SEMINAR_PARTICIPATIONS,
      },
    },
  },
  {
    kind: 'seminar-schedule-update',
    prefix: '[Seminar] schedule',
    spec: {
      path: ROUTES.SEMINAR_WORKSPACE,
      roles: ['Graduate Student', 'Lecturer', 'Researcher', 'Reviewer'],
      pathByRole: {
        'Graduate Student': ROUTES.SEMINAR_PARTICIPATIONS,
        Reviewer: ROUTES.SEMINAR_PARTICIPATIONS,
        Researcher: ROUTES.SEMINAR_PARTICIPATIONS,
      },
    },
  },
  {
    kind: 'added-to-research-group',
    prefix: '[Student] added to group',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'topic-assigned',
    prefix: '[Student] topic assigned',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'topic-assigned',
    prefix: '(Nhóm nghiên cứu) Chủ đề được phân công',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'group-invitation',
    prefix: '[Student] group invitation',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'milestone-opened',
    prefix: '[Student] milestone opened',
    spec: { path: ROUTES.SUBMIT_REPORT, roles: ['Graduate Student', 'Lecturer'] },
  },
  {
    kind: 'learning-material-available',
    prefix: '[Student] learning material',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'learning-material-unshared',
    prefix: '[Student] material unshared',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'topic-completed',
    prefix: '[Student] topic completed',
    spec: {
      path: ROUTES.STUDENT_RESEARCH_GROUPS,
      roles: ['Graduate Student', 'Lecturer'],
    },
  },
  {
    kind: 'report-evaluated',
    prefix: '[Student] report evaluated',
    spec: { path: ROUTES.SUBMIT_REPORT, roles: ['Graduate Student', 'Lecturer'] },
  },
  {
    kind: 'report-rejected',
    prefix: '[Student] report rejected',
    spec: { path: ROUTES.SUBMIT_REPORT, roles: ['Graduate Student', 'Lecturer'] },
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
  // Subscription payment events. The BE tags the message with a parenthesised
  // "(Thanh toán)" prefix (e.g. "(Thanh toán) Thanh toán phí hội viên
  // 'Lecturer Six Months' thành công (Mã giao dịch: ...)"). We match the
  // tag prefix here so the kind can be classified without first stripping
  // it, then route the user to /subscription. The dropdown closes and the
  // user lands on their subscription page; previously the message fell
  // through to `unknown`, the resolver returned the /forum safe-fallback,
  // and the auth guard kicked the user back to /login (the same
  // redirect-to-login symptom users reported).
  {
    kind: 'subscription-payment-success',
    prefix: '(Thanh toán)',
    spec: { path: ROUTES.SUBSCRIPTION, roles: ['Researcher', 'Lecturer'] },
  },
  {
    kind: 'subscription-payment-failed',
    prefix: '(Thanh toán)',
    spec: { path: ROUTES.SUBSCRIPTION, roles: ['Researcher', 'Lecturer'] },
  },
];

export function inferNotificationKind(message: string): NotificationKind {
  const normalized = (message ?? '').trim().toLowerCase();
  const stripped = stripNotificationTagPrefix(normalized);

  // Subscription payment — detected by the body keyword "phí hội viên"
  // (membership fee). This is independent of the tag bracket style so
  // the BE can switch between `[Thanh toán]` and `(Thanh toán)` without
  // breaking classification. Both flavours route to /subscription so
  // the user can see their current plan + history.
  //
  // Must run BEFORE the ROUTE_SPECS prefix loop so the failed flavour
  // can win over the (Thanh toán) prefix that ROUTE_SPECS has wired up
  // as the success default. Real BE shapes we've seen:
  //   [Thanh toán] Thanh toán phí hội viên "Lecturer Six Months" thành công (Mã giao dịch: ...). Gói của bạn có hiệu lực đến ngày 04/04/2027.
  //   (Thanh toán) Thanh toán phí hội viên 'Lecturer Six Months' thành công (Mã giao dịch: ...)
  //   (Thanh toán) Thanh toán phí hội viên 'Researcher Six Months' thất bại (Số tiền không đủ)
  if (stripped.includes('phí hội viên')) {
    if (
      stripped.includes('thất bại') ||
      stripped.includes('đã hủy') ||
      stripped.includes('bị hủy')
    ) {
      return 'subscription-payment-failed';
    }
    return 'subscription-payment-success';
  }

  for (const { kind, prefix } of ROUTE_SPECS) {
    if (normalized.startsWith(prefix.toLowerCase())) {
      return kind;
    }
  }

  // Fallback keyword inspection for natural language BE notifications
  if (
    normalized.includes('thích bài viết') ||
    normalized.includes('liked your post') ||
    normalized.includes('thích bài đăng') ||
    normalized.includes('thả tim bài viết') ||
    normalized.includes('thả tim bài') ||
    normalized.includes('bày tỏ cảm xúc về bài viết') ||
    normalized.includes('bày tỏ cảm xúc')
  ) {
    return 'forum-post-liked';
  }
  if (
    normalized.includes('ủng hộ bình luận') ||
    normalized.includes('upvoted your comment') ||
    normalized.includes('thích bình luận') ||
    normalized.includes('liked your comment') ||
    normalized.includes('thả tim bình luận') ||
    normalized.includes('upvote bình luận') ||
    normalized.includes('thích phản hồi')
  ) {
    return 'forum-comment-upvoted';
  }
  if (
    normalized.includes('trả lời bình luận') ||
    normalized.includes('replied to your comment') ||
    normalized.includes('trả lời phản hồi') ||
    normalized.includes('phản hồi bình luận') ||
    normalized.includes('đã trả lời')
  ) {
    return 'forum-comment-replied';
  }
  if (
    normalized.includes('bình luận vào bài viết') ||
    normalized.includes('bình luận về bài viết') ||
    normalized.includes('bình luận bài viết') ||
    normalized.includes('bình luận bài đăng') ||
    normalized.includes('commented on your post') ||
    normalized.includes('đã bình luận')
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
  // Per-role path override wins over the default `path` so the same
  // notification can land different roles on different surfaces.
  // Currently used by `seminar-invitation` / `seminar-schedule-update`
  // to send invitees (Graduate Student / Reviewer) to the
  // participations inbox while organizers (Lecturer / Researcher) keep
  // landing on the management workspace. Without this seam, an
  // invitee clicking a seminar invitation would be redirected by
  // RoleRouteGuard to /home (the "Discover Research" landing page) —
  // see the September 2026 bug report.
  const roleSpecificPath = spec.pathByRole?.[role];
  if (roleSpecificPath) {
    return roleSpecificPath;
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

  // Strategy 1: a quoted entity name — single quotes ('), straight
  // double quotes ("), smart double quotes (“”), or guillemets («»).
  // Covers virtually every modern BE notification: seminar title,
  // group name, topic title, plan name, etc. The BE has shipped the
  // plan name in both 'Lecturer Six Months' and "Lecturer Six Months"
  // styles, so we accept either.
  const quoted = text.match(
    /['"“”«»]([^'"“”«»]{1,200})['"“”«»]/u,
  );
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

