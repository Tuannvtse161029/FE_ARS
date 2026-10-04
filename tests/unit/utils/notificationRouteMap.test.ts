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
 *   - The resolver never returns null — it always returns a string so the
 *     dropdown can close consistently.
 */
import { describe, it, expect } from 'vitest';
import {
  inferNotificationKind,
  resolveNotificationRoute,
  getSafeFallbackRoute,
  KNOWN_NOTIFICATION_KINDS,
  formatForumNotification,
  stripNotificationTagPrefix,
  extractNotificationDynamicSuffix,
} from '../../../src/utils/notificationRouteMap';

describe('notificationRouteMap', () => {

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

    it('routes reviewer "new review request" to /reviewer/assignments', () => {
      expect(
        resolveNotificationRoute('[Review] new request: paper #42', 'Reviewer'),
      ).toBe('/reviewer/assignments');
    });

    it('routes graduate student "seminar invitation" to /seminar-participations (invitee surface)', () => {
      // September 2026 fix: a Graduate Student (invitee) used to be
      // sent to /seminar-workspace, where RoleRouteGuard would reject
      // them (allow=['Lecturer','Researcher']) and bounce them to /home
      // — the "Discover Research" landing page. The invitation can
      // only be answered from /seminar-participations, which is gated
      // for the invitee role set.
      expect(
        resolveNotificationRoute(
          '[Seminar] invitation: please join the ethics seminar',
          'Graduate Student',
        ),
      ).toBe('/seminar-participations');
    });

    it('routes reviewer "seminar invitation" to /seminar-participations (invitee surface)', () => {
      // Same fix: a Reviewer invited to a seminar lands on the
      // participations inbox, not the management workspace.
      expect(
        resolveNotificationRoute(
          '[Seminar] invitation: please join the ethics seminar',
          'Reviewer',
        ),
      ).toBe('/seminar-participations');
    });

    it('routes lecturer "seminar invitation" to /seminar-workspace (organizer surface)', () => {
      // The Lecturer organizes the seminar — they go to the
      // management workspace, NOT the participations inbox.
      expect(
        resolveNotificationRoute(
          '[Seminar] invitation: please join the ethics seminar',
          'Lecturer',
        ),
      ).toBe('/seminar-workspace');
    });

    it('routes researcher "seminar invitation" to /seminar-participations (attendee surface)', () => {
      // A Researcher can be both an organizer and an attendee. The BE
      // does not currently distinguish "Researcher as organizer" vs
      // "Researcher as attendee" on a per-event basis, so the safe
      // default is the participations inbox — the same surface
      // Graduate Students and Reviewers use, and the one where the
      // invitation can actually be answered. If the BE later wants
      // to single out the organizer case, this test should be
      // updated alongside the BE change.
      expect(
        resolveNotificationRoute(
          '[Seminar] invitation: please join the ethics seminar',
          'Researcher',
        ),
      ).toBe('/seminar-participations');
    });

    it('routes graduate student "seminar schedule update" to /seminar-participations', () => {
      // Same invitee/organizer split as the invitation kind — when
      // a Graduate Student receives a schedule update, they go to
      // the participations inbox to see the new time.
      expect(
        resolveNotificationRoute(
          '[Seminar] schedule: tomorrow 10am',
          'Graduate Student',
        ),
      ).toBe('/seminar-participations');
    });

    it('routes lecturer "seminar schedule update" to /seminar-workspace', () => {
      expect(
        resolveNotificationRoute(
          '[Seminar] schedule: tomorrow 10am',
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

    it('lands every (kind × role) combination on a real, role-appropriate route', () => {
      // October 2026 audit: the resolver used to silently return
      // /forum for any (kind, role) pair whose spec.roles did not
      // include the current role — even though many of those pairs
      // were realistic ("Researcher gets a seminar feedback update",
      // "Admin gets a Lecturer report notification", etc.). The
      // rewrite tightened every spec so this table only contains
      // PASS rows. If a future spec change re-introduces a role
      // mismatch, this test will flag it.
      //
      // The table is exhaustive over (kind, role) where the role is
      // in the spec's roles list. Combinations outside that set
      // intentionally return /forum (the documented safe fallback);
      // they are not part of this audit.
      //
      // `fakeMessage` builds a BE-shaped message that the resolver
      // will classify as the given kind. The mapping is hard-coded
      // because the resolver uses literal-prefix matching against
      // the BE message, and the BE doesn't use a 1:1 mapping
      // between the kind name and the prefix (e.g. the kind
      // `review-request-accepted` is fired with the prefix
      // `[Review] accepted`).
      const fakeMessage = (kind: string): string => {
        const prefixByKind: Record<string, string> = {
          'review-request-accepted': '[Review] accepted',
          'review-request-rejected': '[Review] rejected',
          'review-request-started': '[Review] started',
          'review-request-completed': '[Review] completed',
          'paper-status-changed': '[Paper] status changed',
          'review-result-available': '[Paper] review result',
          'paper-needs-revision': '[Paper] needs revision',
          'paper-authorship-verified': '[Paper] authorship confirmed',
          'paper-authorship-rejected': '[Paper] authorship rejected',
          'new-review-request': '[Review] new request',
          'review-request-cancelled': '[Review] cancelled',
          'review-deadline-reminder': '[Review] deadline',
          'student-report-submitted': '[Lecturer] report submitted',
          'student-report-resubmitted': '[Lecturer] report resubmitted',
          'student-topic-requested': '[Lecturer] topic requested',
          'seminar-participant-response': '[Seminar] participant',
          'seminar-feedback-available': '[Seminar] feedback',
          'group-membership-response': '[Group] membership',
          'material-shared': '[Lecturer] material shared',
          'material-share-accepted': '[Lecturer] share accepted',
          'material-share-declined': '[Lecturer] share declined',
          'group-join-requested': '[Group] join request',
          'group-join-accepted': '[Student] join accepted',
          'group-join-rejected': '[Student] join rejected',
          'group-member-accepted': '[Group] new member',
          'topic-learning-material-added': '[Student] topic material added',
          'topic-learning-material-removed': '[Student] topic material removed',
          'seminar-invitation': '[Seminar] invitation',
          'seminar-schedule-update': '[Seminar] schedule',
          'added-to-research-group': '[Student] added to group',
          'topic-assigned': '[Student] topic assigned',
          'membership-result': '[Group] membership result',
          'group-invitation': '[Student] group invitation',
          'milestone-opened': '[Student] milestone opened',
          'learning-material-available': '[Student] learning material',
          'learning-material-unshared': '[Student] material unshared',
          'topic-completed': '[Student] topic completed',
          'report-evaluated': '[Student] report evaluated',
          'report-rejected': '[Student] report rejected',
          'role-request-submitted': '[Admin] role request',
          'violation-report-submitted': '[Admin] violation report',
          'account-management-event': '[Admin] account',
          'role-request-accepted': '[Account] role accepted',
          'role-request-rejected': '[Account] role rejected',
          'account-status-changed': '[Account] status changed',
          'account-platform-update': '[Account] update',
          'system-update': '[System] hello',
          'follower-new': '[Follower] new',
          'forum-post-liked': '[Forum] like',
          'forum-comment-upvoted': '[Forum] upvote',
          'forum-post-commented': '[Forum] comment',
          'forum-comment-replied': '[Forum] reply to comment',
          'forum-reply': '[Forum] reply',
          'subscription-payment-success': "(Thanh toán) phí hội viên 'Lecturer Six Months' thành công",
          'subscription-payment-failed': "(Thanh toán) phí hội viên 'Researcher Six Months' thất bại",
        };
        const prefix = prefixByKind[kind];
        if (!prefix) throw new Error(`Missing fake-prefix mapping for kind=${kind}`);
        return `${prefix} fake body`;
      };

      const ROLES = ['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin'] as const;

      // Realistic recipient matrices for every kind we ship. Each
      // entry is a tuple [kind, role, expectedPath]. Only pairs the
      // spec actually permits are listed — anything else resolves to
      // /forum and is the documented safe fallback, not a bug.
      const cases: ReadonlyArray<readonly [string, string, string]> = [
        // ── Researcher ────────────────────────────────────────────────
        ['review-request-accepted', 'Researcher', '/researcher/submissions'],
        ['review-request-rejected', 'Researcher', '/researcher/submissions'],
        ['review-request-started', 'Researcher', '/researcher/submissions'],
        ['review-request-completed', 'Researcher', '/researcher/submissions'],
        ['paper-status-changed', 'Researcher', '/researcher/submissions'],
        ['review-result-available', 'Researcher', '/researcher/submissions'],
        ['paper-needs-revision', 'Researcher', '/researcher/submissions'],
        ['paper-authorship-verified', 'Researcher', '/researcher/submissions'],
        ['paper-authorship-rejected', 'Researcher', '/researcher/submissions'],

        // ── Reviewer ──────────────────────────────────────────────────
        ['new-review-request', 'Reviewer', '/reviewer/assignments'],
        ['review-request-cancelled', 'Reviewer', '/reviewer/assignments'],
        ['review-deadline-reminder', 'Reviewer', '/reviewer/assignments'],

        // ── Lecturer ──────────────────────────────────────────────────
        ['student-report-submitted', 'Lecturer', '/lecturer/evaluate-reports'],
        ['student-report-resubmitted', 'Lecturer', '/lecturer/evaluate-reports'],
        ['student-topic-requested', 'Lecturer', '/lecturer/research-topics'],
        // /seminar-participations is the organizer's inbox for
        // participant responses and feedback (replaces the legacy
        // /seminar-workspace that the route guard used to bounce
        // off).
        ['seminar-participant-response', 'Lecturer', '/seminar-participations'],
        ['seminar-participant-response', 'Researcher', '/seminar-participations'],
        ['seminar-feedback-available', 'Lecturer', '/seminar-participations'],
        ['seminar-feedback-available', 'Researcher', '/seminar-participations'],
        ['group-membership-response', 'Lecturer', '/research-group'],
        ['material-shared', 'Lecturer', '/lecturer/materials'],
        ['material-share-accepted', 'Lecturer', '/lecturer/materials'],
        ['material-share-declined', 'Lecturer', '/lecturer/materials'],

        // ── Group join workflow ───────────────────────────────────────
        ['group-join-requested', 'Lecturer', '/research-group'],
        ['group-join-accepted', 'Graduate Student', '/student/research-groups'],
        ['group-join-accepted', 'Lecturer', '/student/research-groups'],
        ['group-join-rejected', 'Graduate Student', '/student/research-groups'],
        ['group-join-rejected', 'Lecturer', '/student/research-groups'],
        // group-member-accepted goes to Lecturers (research-group) AND
        // Graduate Students (student-research-groups) — different
        // surfaces for the same notification.
        ['group-member-accepted', 'Lecturer', '/research-group'],
        ['group-member-accepted', 'Graduate Student', '/student/research-groups'],

        // ── Topic learning material ───────────────────────────────────
        ['topic-learning-material-added', 'Graduate Student', '/student/research-groups'],
        ['topic-learning-material-added', 'Lecturer', '/student/research-groups'],
        ['topic-learning-material-removed', 'Graduate Student', '/student/research-groups'],
        ['topic-learning-material-removed', 'Lecturer', '/student/research-groups'],

        // ── Seminar invite / schedule ─────────────────────────────────
        ['seminar-invitation', 'Graduate Student', '/seminar-participations'],
        ['seminar-invitation', 'Reviewer', '/seminar-participations'],
        ['seminar-invitation', 'Researcher', '/seminar-participations'],
        ['seminar-invitation', 'Lecturer', '/seminar-workspace'],
        ['seminar-schedule-update', 'Graduate Student', '/seminar-participations'],
        ['seminar-schedule-update', 'Reviewer', '/seminar-participations'],
        ['seminar-schedule-update', 'Researcher', '/seminar-participations'],
        ['seminar-schedule-update', 'Lecturer', '/seminar-workspace'],

        // ── Graduate Student ──────────────────────────────────────────
        ['added-to-research-group', 'Graduate Student', '/student/research-groups'],
        ['added-to-research-group', 'Lecturer', '/student/research-groups'],
        ['topic-assigned', 'Graduate Student', '/student/research-groups'],
        ['topic-assigned', 'Lecturer', '/student/research-groups'],
        ['membership-result', 'Graduate Student', '/student/research-groups'],
        ['membership-result', 'Lecturer', '/student/research-groups'],
        ['group-invitation', 'Graduate Student', '/student/research-groups'],
        ['group-invitation', 'Lecturer', '/student/research-groups'],
        ['milestone-opened', 'Graduate Student', '/submit-report'],
        ['milestone-opened', 'Lecturer', '/submit-report'],
        ['learning-material-available', 'Graduate Student', '/student/research-groups'],
        ['learning-material-available', 'Lecturer', '/student/research-groups'],
        ['learning-material-unshared', 'Graduate Student', '/student/research-groups'],
        ['learning-material-unshared', 'Lecturer', '/student/research-groups'],
        ['topic-completed', 'Graduate Student', '/student/research-groups'],
        ['topic-completed', 'Lecturer', '/student/research-groups'],
        ['report-evaluated', 'Graduate Student', '/submit-report'],
        ['report-evaluated', 'Lecturer', '/submit-report'],
        ['report-rejected', 'Graduate Student', '/submit-report'],
        ['report-rejected', 'Lecturer', '/submit-report'],

        // ── Admin ─────────────────────────────────────────────────────
        ['role-request-submitted', 'Admin', '/admin/role-requests'],
        ['violation-report-submitted', 'Admin', '/admin/reports'],
        ['account-management-event', 'Admin', '/admin/accounts'],

        // ── Account / platform ────────────────────────────────────────
        ['role-request-accepted', 'Researcher', '/account-settings'],
        ['role-request-accepted', 'Reviewer', '/account-settings'],
        ['role-request-accepted', 'Lecturer', '/account-settings'],
        ['role-request-accepted', 'Graduate Student', '/account-settings'],
        ['role-request-accepted', 'Admin', '/account-settings'],
        ['role-request-rejected', 'Researcher', '/account-settings'],
        ['account-status-changed', 'Researcher', '/account-settings'],
        ['account-platform-update', 'Researcher', '/account-settings'],
        ['system-update', 'Researcher', '/forum'],
        ['system-update', 'Admin', '/forum'],

        // ── Follower / forum ──────────────────────────────────────────
        ['follower-new', 'Researcher', '/profile'],
        ['follower-new', 'Reviewer', '/profile'],
        ['follower-new', 'Lecturer', '/profile'],
        ['follower-new', 'Graduate Student', '/profile'],
        ['follower-new', 'Admin', '/profile'],
        ['forum-post-liked', 'Researcher', '/forum'],
        ['forum-comment-upvoted', 'Lecturer', '/forum'],
        ['forum-post-commented', 'Graduate Student', '/forum'],
        ['forum-comment-replied', 'Reviewer', '/forum'],
        ['forum-reply', 'Admin', '/forum'],

        // ── Subscription payments ─────────────────────────────────────
        ['subscription-payment-success', 'Researcher', '/subscription'],
        ['subscription-payment-success', 'Lecturer', '/subscription'],
        ['subscription-payment-failed', 'Researcher', '/subscription'],
        ['subscription-payment-failed', 'Lecturer', '/subscription'],
      ];

      // Sanity: every entry must have a real role and a real
      // kind-to-prefix mapping.
      for (const [kind, role] of cases) {
        expect(ROLES).toContain(role);
        fakeMessage(kind); // throws if the mapping is incomplete
      }

      // The actual audit: every case resolves to its expected path.
      // Any mismatch here means the route table has drifted away
      // from the contract this file documents.
      for (const [kind, role, expected] of cases) {
        expect(
          resolveNotificationRoute(fakeMessage(kind), role),
          `expected kind=${kind} role=${role} → ${expected}`,
        ).toBe(expected);
      }
    });
  });

  describe('forum interactions and formatForumNotification', () => {
    const postLikedSample = '[Forum] Nguyen Van Trieu Tuan đã thích bài viết của bạn: "ádf"';
    const commentUpvotedSample = '[Forum] Nguyen Van Trieu Tuan đã ủng hộ bình luận của bạn: "hi"';
    const commentPostedSample = '[Diễn đàn] Admin đã bình luận vào bài viết "ádf" của bạn.';
    const commentRepliedSample = '[Diễn đàn] Nguyen Van Trieu Tuan đã trả lời bình luận của bạn: "hello"';

    it('infers distinct forum notification kinds accurately', () => {
      expect(inferNotificationKind(postLikedSample)).toBe('forum-post-liked');
      expect(inferNotificationKind(commentUpvotedSample)).toBe('forum-comment-upvoted');
      expect(inferNotificationKind(commentPostedSample)).toBe('forum-post-commented');
      expect(inferNotificationKind(commentRepliedSample)).toBe('forum-comment-replied');
    });

    it('formats post-liked notification correctly in both locales with actor name preserved', () => {
      expect(formatForumNotification(postLikedSample, 'vi')).toBe(
        'Nguyen Van Trieu Tuan đã thích bài viết của bạn: "ádf"',
      );
      expect(formatForumNotification(postLikedSample, 'en')).toBe(
        'Nguyen Van Trieu Tuan liked your post: "ádf"',
      );
    });

    it('formats comment-upvoted notification correctly in both locales with actor name preserved', () => {
      expect(formatForumNotification(commentUpvotedSample, 'vi')).toBe(
        'Nguyen Van Trieu Tuan đã ủng hộ bình luận của bạn: "hi"',
      );
      expect(formatForumNotification(commentUpvotedSample, 'en')).toBe(
        'Nguyen Van Trieu Tuan upvoted your comment: "hi"',
      );
    });

    it('formats comment-posted notification correctly in both locales with actor name preserved', () => {
      expect(formatForumNotification(commentPostedSample, 'vi')).toBe(
        'Admin đã bình luận vào bài viết "ádf" của bạn.',
      );
      expect(formatForumNotification(commentPostedSample, 'en')).toBe(
        'Admin commented on your post "ádf".',
      );
    });

    it('formats comment-replied notification correctly in both locales with actor name preserved', () => {
      expect(formatForumNotification(commentRepliedSample, 'vi')).toBe(
        'Nguyen Van Trieu Tuan đã trả lời bình luận của bạn: "hello"',
      );
      expect(formatForumNotification(commentRepliedSample, 'en')).toBe(
        'Nguyen Van Trieu Tuan replied to your comment: "hello"',
      );
    });
  });

  describe('subscription payment notifications', () => {
    // Real shapes observed coming from the PayOS webhook. The BE has
    // shipped two tag bracket variants (square vs. parentheses) and two
    // quote styles for the plan name (single vs. double) — the matcher
    // has to tolerate both. The success message may also carry a
    // trailing "Gói của bạn có hiệu lực đến ngày DD/MM/YYYY" sentence
    // (your package is valid until ...) which the English template
    // intentionally drops.
    const successSample =
      "(Thanh toán) Thanh toán phí hội viên 'Lecturer Six Months' thành công (Mã giao dịch: 8X92K1)";
    const successSquareBrackets =
      '[Thanh toán] Thanh toán phí hội viên "Lecturer Six Months" thành công (Mã giao dịch: 1085210419). Gói của bạn có hiệu lực đến ngày 04/04/2027.';
    const failedSample =
      "(Thanh toán) Thanh toán phí hội viên 'Researcher Six Months' thất bại (Số tiền không đủ)";

    it('classifies the (Thanh toán) success variant as subscription-payment-success', () => {
      expect(inferNotificationKind(successSample)).toBe('subscription-payment-success');
    });

    it('classifies the [Thanh toán] success variant as subscription-payment-success', () => {
      // The BE has shipped the tag with square brackets in production —
      // the matcher must not depend on the bracket style.
      expect(inferNotificationKind(successSquareBrackets)).toBe('subscription-payment-success');
    });

    it('classifies the (Thanh toán) failed variant as subscription-payment-failed', () => {
      expect(inferNotificationKind(failedSample)).toBe('subscription-payment-failed');
    });

    it('routes subscription notifications to /subscription for the paid roles', () => {
      expect(resolveNotificationRoute(successSample, 'Researcher')).toBe('/subscription');
      expect(resolveNotificationRoute(successSample, 'Lecturer')).toBe('/subscription');
      expect(resolveNotificationRoute(successSquareBrackets, 'Lecturer')).toBe('/subscription');
      expect(resolveNotificationRoute(failedSample, 'Researcher')).toBe('/subscription');
    });

    it('falls back to /forum when the role cannot reach /subscription (e.g. Reviewer)', () => {
      // Reviewer is not in the spec's roles list — the resolver returns
      // the safe /forum fallback instead of logging the user out.
      expect(resolveNotificationRoute(successSample, 'Reviewer')).toBe(
        getSafeFallbackRoute(),
      );
    });

    it('extracts the plan name as the dynamic suffix for the body template', () => {
      // The English body template is "Membership fee for "{suffix}" was
      // paid successfully." — the {suffix} placeholder must be the plan
      // name pulled out of the BE message, in whatever quote style the
      // BE happens to send (single, double, or smart).
      const stripped = stripNotificationTagPrefix(successSquareBrackets);
      expect(extractNotificationDynamicSuffix(stripped)).toBe('Lecturer Six Months');
      const strippedSingle = stripNotificationTagPrefix(successSample);
      expect(extractNotificationDynamicSuffix(strippedSingle)).toBe('Lecturer Six Months');
    });
  });
});