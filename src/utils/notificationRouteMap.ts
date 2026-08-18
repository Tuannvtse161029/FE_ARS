// Centralized notification-type → frontend route mapping.
//
// The BE Notification DTO has no `type` field and no `targetUrl` field
// (`NotificationItem` only carries `id`, `userId`, `message`, `isRead`,
// optional `createdAt`). So we cannot dispatch on a server-supplied
// discriminator. Instead we infer a notification "kind" from the message
// text using a deterministic pattern list. Every notification produced by
// the BE for the ARS workflow must use one of the prefixes below; any
// message that does not match falls back to staying on the dropdown
// (see `resolveNotificationRoute`).
//
// Keeping this in one place — instead of scattering `if message.includes…`
// checks across components — is required so the navigation rule stays
// auditable and so RBAC checks happen in exactly one location.
//
// The `roles` field is the set of roles that are allowed to land on the
// resolved target. Notifications for other roles are silently dropped to
// the fallback route to prevent a Reviewer from being deep-linked into
// the Admin surface, etc.

import { ROUTES } from '../routes/paths';
import type { UserRole } from '../types/auth';

export type NotificationKind =
  // Researcher
  | 'review-request-accepted'
  | 'review-request-rejected'
  | 'review-request-started'
  | 'review-request-completed'
  | 'paper-status-changed'
  | 'review-result-available'
  // Reviewer
  | 'new-review-request'
  | 'withdrawal-approved'
  | 'withdrawal-denied'
  | 'withdrawal-processing'
  | 'withdrawal-completed'
  // Lecturer
  | 'student-report-submitted'
  | 'student-report-resubmitted'
  | 'student-topic-requested'
  // Graduate Student
  | 'topic-assigned'
  | 'group-invitation'
  | 'milestone-opened'
  | 'report-evaluated'
  | 'report-rejected'
  // Admin
  | 'role-request-submitted'
  | 'withdrawal-request-submitted'
  | 'violation-report-submitted'
  // Account / platform
  | 'account-platform-update'
  // Catch-all
  | 'unknown';

interface NotificationRouteSpec {
  // Path used when the notification is clicked. Must be an internal
  // ARS route — never an external URL. Components may interpolate the
  // notification id (e.g. /review-tasks/<id>) but the prefix is fixed.
  path: string;
  // The set of roles that may navigate to this path. If the
  // authenticated user's role is not in this set, the route resolver
  // returns `null` and the UI keeps the user on the dropdown.
  roles: ReadonlyArray<UserRole>;
  // Optional: a regex that captures a numeric id from the message so
  // we can build `/review-tasks/123` style URLs. The first capture group
  // is the id.
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

  // ── Reviewer events ───────────────────────────────────────────────────────
  {
    kind: 'new-review-request',
    prefix: '[Review] new request',
    spec: { path: ROUTES.REVIEW_TASKS, roles: ['Reviewer', 'Admin'], idPattern: /\b(\d+)\b/ },
  },
  {
    kind: 'withdrawal-approved',
    prefix: '[Wallet] withdrawal approved',
    spec: { path: ROUTES.EARNINGS_WALLET, roles: ['Reviewer', 'Admin'] },
  },
  {
    kind: 'withdrawal-denied',
    prefix: '[Wallet] withdrawal denied',
    spec: { path: ROUTES.EARNINGS_WALLET, roles: ['Reviewer', 'Admin'] },
  },
  {
    kind: 'withdrawal-processing',
    prefix: '[Wallet] withdrawal processing',
    spec: { path: ROUTES.EARNINGS_WALLET, roles: ['Reviewer', 'Admin'] },
  },
  {
    kind: 'withdrawal-completed',
    prefix: '[Wallet] withdrawal completed',
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

  // ── Graduate Student events ───────────────────────────────────────────────
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
    kind: 'withdrawal-request-submitted',
    prefix: '[Admin] withdrawal request',
    spec: { path: ROUTES.ADMIN_TRANSACTIONS, roles: ['Admin'] },
  },
  {
    kind: 'violation-report-submitted',
    prefix: '[Admin] violation report',
    spec: { path: ROUTES.ADMIN_REPORTS, roles: ['Admin'] },
  },

  // ── Platform-wide ─────────────────────────────────────────────────────────
  {
    kind: 'account-platform-update',
    prefix: '[Account]',
    spec: { path: ROUTES.ACCOUNT_SETTINGS, roles: [
      'Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin',
    ] },
  },
];

// Infer a notification kind from the BE-supplied message text. The BE
// authors the message, so the prefixes are a contract — if the BE changes
// the wording, this function will return `unknown` and the UI falls back
// to keeping the user on the dropdown. This is safer than guessing.
export function inferNotificationKind(message: string): NotificationKind {
  const normalized = (message ?? '').trim();
  for (const { kind, prefix } of ROUTE_SPECS) {
    if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
      return kind;
    }
  }
  return 'unknown';
}

// Resolve a notification to a target route, given the current role.
//
// Returns `null` when:
//   * the message did not match any known prefix, OR
//   * the matched prefix targets a role the current user does not hold.
//
// Callers must treat `null` as "stay on the dropdown" — never navigate
// elsewhere. This is the single source of truth for the
// "navigate-into-a-page-they-cannot-access" rule.
export function resolveNotificationRoute(
  message: string,
  currentRole: UserRole | string | null | undefined,
): string | null {
  const role: UserRole | null =
    typeof currentRole === 'string' && currentRole.length > 0
      ? (currentRole as UserRole)
      : null;
  const kind = inferNotificationKind(message);
  if (kind === 'unknown') return null;
  const spec = ROUTE_SPECS.find((entry) => entry.kind === kind)?.spec;
  if (!spec) return null;
  if (!role) return null;
  if (!spec.roles.includes(role)) return null;
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
