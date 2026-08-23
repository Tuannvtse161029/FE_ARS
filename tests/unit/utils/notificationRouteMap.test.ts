/**
 * notificationRouteMap tests — the single source of truth for the
 * message → route + RBAC dispatch.
 *
 * Coverage (per the agent-28 spec):
 *   - Every role can navigate to /forum for their respective forum-reply
 *     events.
 *   - Lecturer and Graduate Student can navigate to /seminar-workspace for
 *     a seminar-invitation event.
 *   - Admin role can navigate to /admin/role-requests for role-request
 *     events; Reviewer cannot.
 *   - Graduate Student can navigate to /student/research-groups for
 *     topic-assigned events.
 *   - Reviewer/Researcher cannot be deep-linked into Admin pages.
 *   - Unknown messages resolve to the safe /forum fallback.
 *   - Withdrawal-prefix messages resolve to the safe fallback while the
 *     withdrawal feature is disabled.
 *   - The resolver never returns null — it always returns a string so the
 *     dropdown can close consistently.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  inferNotificationKind,
  resolveNotificationRoute,
  getSafeFallbackRoute,
  KNOWN_NOTIFICATION_KINDS,
} from '../../../src/utils/notificationRouteMap';
import { AppConfig } from '../../../src/config/app';

describe('notificationRouteMap', () => {
  beforeEach(() => {
    // The default feature state for the withdrawal gate must be off —
    // these tests assert the withdrawal suppression branch.
    expect(AppConfig.features.enableWithdrawals).toBe(false);
  });

  describe('inferNotificationKind', () => {
    it('maps researcher-prefixed messages to the right kind', () => {
      expect(inferNotificationKind('[Review] accepted: paper #42 is reviewed')).toBe(
        'review-request-accepted',
      );
      expect(inferNotificationKind('[Paper] status changed: Draft → Pending')).toBe(
        'paper-status-changed',
      );
      expect(inferNotificationKind('[Paper] needs revision: please address feedback')).toBe(
        'paper-needs-revision',
      );
    });

    it('maps reviewer-prefixed messages to the right kind', () => {
      expect(inferNotificationKind('[Review] new request: paper #42')).toBe(
        'new-review-request',
      );
      expect(inferNotificationKind('[Review] deadline: review in 24 hours')).toBe(
        'review-deadline-reminder',
      );
    });

    it('maps lecturer-prefixed messages to the right kind', () => {
      expect(inferNotificationKind('[Lecturer] report submitted by student #5')).toBe(
        'student-report-submitted',
      );
      expect(inferNotificationKind('[Seminar] participant accepted your invite')).toBe(
        'seminar-participant-response',
      );
    });

    it('maps graduate-student-prefixed messages to the right kind', () => {
      expect(inferNotificationKind('[Seminar] invitation: please join the ethics seminar')).toBe(
        'seminar-invitation',
      );
      expect(inferNotificationKind('[Student] topic assigned by your lecturer')).toBe(
        'topic-assigned',
      );
      expect(inferNotificationKind('[Student] learning material available')).toBe(
        'learning-material-available',
      );
    });

    it('maps admin-prefixed messages to the right kind', () => {
      expect(inferNotificationKind('[Admin] role request filed')).toBe(
        'role-request-submitted',
      );
      expect(inferNotificationKind('[Admin] violation report from user #12')).toBe(
        'violation-report-submitted',
      );
    });

    it('maps platform-prefixed messages to the right kind', () => {
      expect(inferNotificationKind('[Account] status changed')).toBe(
        'account-status-changed',
      );
      expect(inferNotificationKind('[Account] role accepted')).toBe(
        'role-request-accepted',
      );
    });

    it('returns unknown for messages without a known prefix', () => {
      expect(inferNotificationKind('Just a plain system message')).toBe('unknown');
      expect(inferNotificationKind('')).toBe('unknown');
      // Wrong-case prefix is still matched because we lowercase both sides.
      expect(inferNotificationKind('[REVIEW] NEW REQUEST: hello')).toBe(
        'new-review-request',
      );
    });
  });

  describe('resolveNotificationRoute', () => {
    it('returns a string for every input — never null', () => {
      const roles = ['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin'] as const;
      for (const role of roles) {
        for (const kind of KNOWN_NOTIFICATION_KINDS) {
          const route = resolveNotificationRoute(`[${kind}] fake body`, role);
          expect(typeof route).toBe('string');
          expect(route.length).toBeGreaterThan(0);
        }
      }
    });

    it('routes reviewer "new review request" to /review-tasks', () => {
      expect(
        resolveNotificationRoute('[Review] new request: paper #42', 'Reviewer'),
      ).toBe('/review-tasks');
    });

    it('routes graduate student "seminar invitation" to /seminar-workspace', () => {
      expect(
        resolveNotificationRoute(
          '[Seminar] invitation: please join the ethics seminar',
          'Graduate Student',
        ),
      ).toBe('/seminar-workspace');
    });

    it('routes lecturer "seminar invitation" to /seminar-workspace as well', () => {
      expect(
        resolveNotificationRoute(
          '[Seminar] invitation: please join the ethics seminar',
          'Lecturer',
        ),
      ).toBe('/seminar-workspace');
    });

    it('routes graduate student "topic assigned" to /student/research-groups', () => {
      expect(
        resolveNotificationRoute('[Student] topic assigned', 'Graduate Student'),
      ).toBe('/student/research-groups');
    });

    it('routes admin "role request submitted" to /admin/role-requests', () => {
      expect(
        resolveNotificationRoute('[Admin] role request filed', 'Admin'),
      ).toBe('/admin/role-requests');
    });

    it('routes admin "violation report submitted" to /admin/reports', () => {
      expect(
        resolveNotificationRoute('[Admin] violation report from user #12', 'Admin'),
      ).toBe('/admin/reports');
    });

    it('routes reviewer "payment result" to /earnings-wallet', () => {
      expect(
        resolveNotificationRoute('[Wallet] payment result: 500000 VND', 'Reviewer'),
      ).toBe('/earnings-wallet');
    });

    it('routes forum-reply messages to /forum for every role', () => {
      const roles = ['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin'] as const;
      for (const role of roles) {
        expect(
          resolveNotificationRoute('[Forum] reply: someone replied', role),
        ).toBe('/forum');
      }
    });

    it('falls back to /forum for an unknown message', () => {
      expect(
        resolveNotificationRoute('plain text with no prefix', 'Researcher'),
      ).toBe(getSafeFallbackRoute());
    });

    it('falls back to /forum for an unknown message regardless of role', () => {
      expect(
        resolveNotificationRoute('plain text with no prefix', 'Admin'),
      ).toBe(getSafeFallbackRoute());
    });

    it('falls back to /forum when the role cannot reach the matched route', () => {
      // Reviewer must not be deep-linked into Admin pages.
      expect(
        resolveNotificationRoute('[Admin] role request filed', 'Reviewer'),
      ).toBe(getSafeFallbackRoute());
    });

    it('falls back to /forum when the role is null/empty/undefined', () => {
      expect(resolveNotificationRoute('[Paper] status changed', null)).toBe(
        getSafeFallbackRoute(),
      );
      expect(resolveNotificationRoute('[Paper] status changed', undefined)).toBe(
        getSafeFallbackRoute(),
      );
      expect(resolveNotificationRoute('[Paper] status changed', '')).toBe(
        getSafeFallbackRoute(),
      );
    });

    it('suppresses withdrawal destinations while the withdrawal feature is disabled', () => {
      // Default AppConfig.features.enableWithdrawals === false. The route
      // map must NOT navigate to /earnings-wallet for withdrawal-prefixed
      // messages — instead it returns the safe /forum fallback so the
      // withdrawn feature cannot be deep-linked by a stale notification.
      expect(
        resolveNotificationRoute(
          '[Wallet] withdrawal completed: 500000 VND',
          'Reviewer',
        ),
      ).toBe(getSafeFallbackRoute());
      expect(
        resolveNotificationRoute(
          '[Wallet] withdrawal approved: bank transfer queued',
          'Reviewer',
        ),
      ).toBe(getSafeFallbackRoute());
    });

    it('still routes non-withdrawal wallet messages normally', () => {
      // "[Wallet] payment result" is NOT a withdrawal event — the prefix
      // is intentionally distinct so legitimate wallet notifications
      // continue to land on /earnings-wallet.
      expect(
        resolveNotificationRoute('[Wallet] payment result: 500000 VND', 'Reviewer'),
      ).toBe('/earnings-wallet');
    });
  });
});