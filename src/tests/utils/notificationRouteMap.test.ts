/**
 * Notification route-mapping helper tests.
 *
 * Source of truth: see `src/utils/notificationRouteMap.ts`. The
 * dispatcher lives in exactly one place so RBAC checks and target paths
 * stay auditable.
 */
import { describe, it, expect } from 'vitest';
import {
  inferNotificationKind,
  resolveNotificationRoute,
  KNOWN_NOTIFICATION_KINDS,
} from '../../utils/notificationRouteMap';
import { ROUTES } from '../../routes/paths';

describe('notificationRouteMap — inferNotificationKind', () => {
  it('returns "review-request-accepted" for the matching prefix', () => {
    expect(inferNotificationKind('[Review] accepted — your paper has a reviewer')).toBe(
      'review-request-accepted',
    );
  });

  it('returns "withdrawal-completed" for the wallet prefix', () => {
    expect(inferNotificationKind('[Wallet] withdrawal completed')).toBe(
      'withdrawal-completed',
    );
  });

  it('is case-insensitive on the prefix', () => {
    expect(inferNotificationKind('[review] accepted')).toBe('review-request-accepted');
  });

  it('returns "unknown" for messages that do not match a known prefix', () => {
    expect(inferNotificationKind('Some random system ping')).toBe('unknown');
    expect(inferNotificationKind('')).toBe('unknown');
  });

  it('handles "unknown" gracefully on null-ish input', () => {
    expect(inferNotificationKind(null as unknown as string)).toBe('unknown');
    expect(inferNotificationKind(undefined as unknown as string)).toBe('unknown');
  });

  it('exposes the full list of known kinds', () => {
    // Researcher
    expect(KNOWN_NOTIFICATION_KINDS).toContain('review-request-accepted');
    expect(KNOWN_NOTIFICATION_KINDS).toContain('paper-status-changed');
    // Reviewer
    expect(KNOWN_NOTIFICATION_KINDS).toContain('new-review-request');
    expect(KNOWN_NOTIFICATION_KINDS).toContain('withdrawal-approved');
    // Lecturer
    expect(KNOWN_NOTIFICATION_KINDS).toContain('student-report-submitted');
    // Student
    expect(KNOWN_NOTIFICATION_KINDS).toContain('topic-assigned');
    // Admin
    expect(KNOWN_NOTIFICATION_KINDS).toContain('role-request-submitted');
  });
});

describe('notificationRouteMap — resolveNotificationRoute (RBAC gate)', () => {
  it('routes Reviewer "new-review-request" to /review-tasks', () => {
    expect(
      resolveNotificationRoute('[Review] new request assigned to you', 'Reviewer'),
    ).toBe(ROUTES.REVIEW_TASKS);
  });

  it('routes Researcher "paper-status-changed" to /papers', () => {
    expect(
      resolveNotificationRoute('[Paper] status changed', 'Researcher'),
    ).toBe(ROUTES.PAPERS);
  });

  it('routes Lecturer "student-report-submitted" to /lecturer/evaluate-reports', () => {
    expect(
      resolveNotificationRoute('[Lecturer] report submitted by group X', 'Lecturer'),
    ).toBe(ROUTES.LECTURER_EVALUATE_REPORTS);
  });

  it('routes Graduate Student "topic-assigned" to /student/research-groups', () => {
    expect(
      resolveNotificationRoute('[Student] topic assigned', 'Graduate Student'),
    ).toBe(ROUTES.STUDENT_RESEARCH_GROUPS);
  });

  it('routes Admin "role-request-submitted" to /admin/role-requests', () => {
    expect(
      resolveNotificationRoute('[Admin] role request filed', 'Admin'),
    ).toBe(ROUTES.ADMIN_ROLE_REQUESTS);
  });

  it('returns null when the role does not match the kind (RBAC)', () => {
    // A Graduate Student receiving an Admin-only notification MUST NOT
    // be deep-linked into the admin surface.
    expect(
      resolveNotificationRoute('[Admin] role request filed', 'Graduate Student'),
    ).toBeNull();
    // A Reviewer receiving a Lecturer event stays on the dropdown.
    expect(
      resolveNotificationRoute('[Lecturer] report submitted', 'Reviewer'),
    ).toBeNull();
  });

  it('returns null when the message is unparseable', () => {
    expect(resolveNotificationRoute('Random ping', 'Researcher')).toBeNull();
  });

  it('returns null when there is no role (logged out)', () => {
    expect(
      resolveNotificationRoute('[Review] new request', null),
    ).toBeNull();
    expect(
      resolveNotificationRoute('[Review] new request', undefined),
    ).toBeNull();
  });

  it('returns null when the role is empty string', () => {
    expect(
      resolveNotificationRoute('[Review] new request', ''),
    ).toBeNull();
  });
});
