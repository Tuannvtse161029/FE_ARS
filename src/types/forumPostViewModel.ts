// UI-side ViewModel for a ForumPost card.
//
// Why a separate model type?
//   The wire `ForumPost` (`src/types/forum.types.ts`) is intentionally narrow
//   — it mirrors what the current Swagger contract publishes and nothing more.
//   The ForumPostCard engagement row, however, must render normalized
//   counters that the BE either (a) supplies (commentCount, once shipped) or
//   (b) we derive client-side from `useForumComments`. To keep that
//   normalization in one place, we model the UI-side counters here.
//
// Rules enforced by the build:
//   - `likeCount` is `number | null` — `null` means "the BE did not publish a
//     counter for this field". The UI renders `—` instead of `0`.
//   - `viewCount` follows the same nullability rule.
//   - `commentCount` follows the same nullability rule, but in practice
//     always has a value (the live BE publishes it; the fallback uses the
//     loaded comments collection).
//   - `isLikedByCurrentUser` is `boolean | null` — `null` means "we cannot
//     tell" (i.e. no per-user like state in the BE). The UI keeps the
//     Like control disabled in this branch. Note: even when the BE sets
//     this to `true`, the Like button is still disabled today because
//     BTR-AGENT42-A (the Like mutation endpoint) is still unresolved.
//
// We preserve zeros: `0` is a valid count and must NOT collapse to `—`.

import type { ForumPost } from './forum.types';

/**
 * UI-side normalized representation of one ForumPost card's counters and
 * per-viewer like state. Built by `buildForumPostViewModel` so call sites
 * never have to repeat the nullability rule.
 *
 * @see BTR-AGENT42-A and BTR-AGENT42-B for the source-of-truth contract that
 *      this ViewModel is derived from.
 */
export interface ForumPostViewModel {
  postId: number;
  // `null` means "the BE did not report a value for this field" — the UI
  // renders `—` in that case. `0` is a valid count and is preserved.
  likeCount: number | null;
  commentCount: number | null;
  viewCount: number | null;
  // `null` means "the BE has no way to report the current viewer's like
  // state" — the UI disables the Like control rather than guess.
  isLikedByCurrentUser: boolean | null;
}

export interface BuildForumPostViewModelInput {
  post: ForumPost;
  /**
   * Number of comments the BE returned for this post via the loaded
   * `useForumComments` collection. Used as a fallback when the wire
   * `post.commentCount` is missing (e.g. older rows, partial BE response).
   * When this is the source of truth, the result is non-null.
   */
  commentCount?: number | null;
}

const toCountOrNull = (value: unknown): number | null => {
  // The live BE publishes these fields as numbers, but we defensively
  // coerce any string-encoded value to support future shape changes. We
  // never return `NaN` or a stringified zero — those are surfaced as
  // `null` so the UI renders `—` rather than corrupt garbage.
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const clampNonNegative = (value: number | null): number | null => {
  if (value == null) return null;
  return value < 0 ? 0 : value;
};

/**
 * Build a {@link ForumPostViewModel} from the raw wire `ForumPost` plus
 * the number of comments currently loaded for that post.
 *
 * Counter precedence:
 *   - `likeCount` / `viewCount`: read from the wire only. If the BE
 *     omits a field, the row renders `—` rather than inventing a zero.
 *   - `commentCount`: prefer the wire value when present; otherwise
 *     fall back to the loaded comments collection length. Either
 *     source yields a real number (including 0).
 */
export function buildForumPostViewModel({
  post,
  commentCount,
}: BuildForumPostViewModelInput): ForumPostViewModel {
  const wireLike = toCountOrNull(post.likeCount);
  const wireView = toCountOrNull(post.viewCount);
  const wireComment = toCountOrNull(post.commentCount);

  // Compute the comment-count value:
  //   1. If the wire supplies a number, use it (clamped to >= 0).
  //   2. Else if the parent supplied a commentCount, use it.
  //   3. Else null (the row renders `—`).
  let commentCountValue: number | null;
  if (wireComment != null) {
    commentCountValue = clampNonNegative(wireComment);
  } else if (commentCount !== undefined && commentCount !== null) {
    commentCountValue = clampNonNegative(toCountOrNull(commentCount));
  } else {
    commentCountValue = null;
  }

  return {
    postId: post.id,
    likeCount: clampNonNegative(wireLike),
    commentCount: commentCountValue,
    viewCount: clampNonNegative(wireView),
    isLikedByCurrentUser:
      typeof post.isLikedByCurrentUser === 'boolean'
        ? post.isLikedByCurrentUser
        : null,
  };
}
