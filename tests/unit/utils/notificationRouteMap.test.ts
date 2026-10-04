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