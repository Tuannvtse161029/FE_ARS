// Unit tests for the ForumPost → ForumPostViewModel mapper.
//
// The plan §10 says the vital tests should cover:
//   1. Zero counts render visibly (covered via integration tests).
//   2. Engagement row order (covered via integration tests).
//   3. Like single-request (covered via integration tests).
//   4. Successful Like updates (BTR-AGENT42-A blocks this in the FE today).
//   5. Failed Like rollback (BTR-AGENT42-A blocks this in the FE today).
//   6. Comments expand/collapse (covered via integration tests).
//   7. Feed rendering does not auto-inflate views (mapper is the
//      foundation of that guarantee).
//   8. Guest cannot mutate (covered via integration tests).
//   9. Missing mutation endpoints do not produce fake local persistence
//      (covered here — the mapper returns `null` instead of inventing 0).
//
// We test the mapper here because it's the single place that decides
// whether a counter is rendered as `0` or `—`. The integration tests
// rely on this behavior to keep their expectations tight.

import { describe, it, expect } from 'vitest';
import { buildForumPostViewModel } from '../../types/forumPostViewModel';
import type { ForumPost } from '../../types/forum.types';

const basePost: ForumPost = {
  id: 42,
  title: 'Test',
  content: 'body',
  createdAt: '2026-08-15T10:00:00Z',
};

describe('buildForumPostViewModel', () => {
  it('returns null for likeCount / viewCount when BE does not publish them', () => {
    // Older wire shape — the BE omitted the counter fields.
    const vm = buildForumPostViewModel({ post: basePost, commentCount: 0 });
    expect(vm.postId).toBe(42);
    expect(vm.likeCount).toBeNull();
    expect(vm.viewCount).toBeNull();
    expect(vm.commentCount).toBe(0);
    expect(vm.isLikedByCurrentUser).toBeNull();
  });

  it('preserves zero — `0` is a valid count, not collapsed to —', () => {
    const vm = buildForumPostViewModel({
      post: {
        ...basePost,
        likeCount: 0,
        viewCount: 0,
        commentCount: 0,
        isLikedByCurrentUser: false,
      },
      commentCount: 0,
    });
    expect(vm.likeCount).toBe(0);
    expect(vm.viewCount).toBe(0);
    expect(vm.commentCount).toBe(0);
    expect(vm.isLikedByCurrentUser).toBe(false);
  });

  it('reads counters from the live wire shape (post.likeCount etc.)', () => {
    const vm = buildForumPostViewModel({
      post: {
        ...basePost,
        likeCount: 7,
        viewCount: 12,
        commentCount: 5,
        isLikedByCurrentUser: true,
      },
    });
    expect(vm.likeCount).toBe(7);
    expect(vm.viewCount).toBe(12);
    expect(vm.commentCount).toBe(5);
    expect(vm.isLikedByCurrentUser).toBe(true);
  });

  it('prefers the wire commentCount over the loaded comments fallback', () => {
    const vm = buildForumPostViewModel({
      post: { ...basePost, commentCount: 5 },
      commentCount: 99,
    });
    expect(vm.commentCount).toBe(5);
  });

  it('falls back to the supplied commentCount when the wire omits it', () => {
    const vm = buildForumPostViewModel({
      post: { ...basePost },
      commentCount: 12,
    });
    expect(vm.commentCount).toBe(12);
  });

  it('returns null for commentCount when neither the wire nor the parent supplies it', () => {
    const vm = buildForumPostViewModel({ post: { ...basePost } });
    expect(vm.commentCount).toBeNull();
  });

  it('coerces negative counters to 0 so the UI never renders a negative number', () => {
    const vm = buildForumPostViewModel({
      post: {
        ...basePost,
        likeCount: -3,
        viewCount: -1,
        commentCount: -10,
      },
      commentCount: -5,
    });
    expect(vm.likeCount).toBe(0);
    expect(vm.viewCount).toBe(0);
    expect(vm.commentCount).toBe(0);
  });

  it('accepts string-encoded counters from a future BE response', () => {
    const vm = buildForumPostViewModel({
      post: {
        ...basePost,
        likeCount: '7',
        viewCount: '12',
        commentCount: '5',
        isLikedByCurrentUser: true,
      },
    });
    expect(vm.likeCount).toBe(7);
    expect(vm.viewCount).toBe(12);
    expect(vm.commentCount).toBe(5);
    expect(vm.isLikedByCurrentUser).toBe(true);
  });

  it('coerces non-numeric string counters to null (defensive)', () => {
    const vm = buildForumPostViewModel({
      post: { ...basePost, likeCount: 'many' as unknown as number },
    });
    expect(vm.likeCount).toBeNull();
  });
});
