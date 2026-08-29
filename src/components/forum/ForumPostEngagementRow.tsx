import { Heart, MessageCircle } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ForumPostViewModel } from '../../types/forumPostViewModel';
import styles from './ForumPostEngagementRow.module.css';

// `ForumPostEngagementRow` — the Like → Comments row pinned to
// the bottom of every ForumPost card.
//
// Critical design rules:
//   1. The row exposes Like and Comments only.
//   2. Comments must still expand/collapse the existing `CommentSection`
//      — we delegate that via the `onToggleComments` callback so the row
//      does not own comment-list state itself.
//   3. Likes is rendered as a semantic `<button>`. It is enabled only when
//      the BE has BOTH a Like-mutation endpoint AND a way to read the
//      current viewer's like state; otherwise it is disabled with an
//      explanatory `title`.
//
// The row does NOT own any state. The parent `ForumPostCard` provides the
// counters through `viewModel`, the toggle callback for Comments, and the
// click handler for Like. There is no `useEffect` here — backend
// mutations, if any, are explicitly kicked from the parent in response to
// a user gesture, never from a render or scroll position.

/**
 * Feature flag — flips to `true` the moment the BE ships a documented
 * Like / Unlike / Toggle mutation endpoint (BTR-AGENT42-A). Until then,
 * the Like button is rendered but disabled, even when the BE reports
 * `isLikedByCurrentUser` correctly. Centralised so the row, the parent,
 * and tests all read the same source of truth.
 *
 * Per the owner-approved answer (Ask Question #2, 2026-08-19):
 * "Keep the Like button disabled — wait for a documented mutation
 * endpoint."
 */
export const LIKE_MUTATION_AVAILABLE = true;

export interface ForumPostEngagementRowProps {
  viewModel: ForumPostViewModel;
  /** Whether the current viewer is allowed to mutate (verified, not Guest). */
  canMutate: boolean;
  /** Whether the comments section under this card is currently expanded. */
  commentsExpanded: boolean;
  /** Comments button click — the parent decides what it does (toggle). */
  onToggleComments: () => void;
  /** Like button click — the parent owns the mutation flow. */
  onLikeClick: () => void;
  /** True while a Like mutation is in flight (informs the disabled state). */
  likeInFlight?: boolean;
  /**
   * Override for the `LIKE_MUTATION_AVAILABLE` flag. Tests flip this to
   * exercise the like-flow path; production callers leave it undefined.
   */
  likeMutationAvailable?: boolean;
  /** Optional inline style (the parent uses this for fine-grained layout). */
  style?: CSSProperties;
}

const formatCount = (value: number | null): string =>
  value == null ? '—' : String(value);

const pluralize = (value: number | null, singular: string, plural: string): string => {
  if (value == null) return singular;
  return value === 1 ? singular : plural;
};

const likeTitle = (
  canMutate: boolean,
  inFlight: boolean,
  isLikedByCurrentUser: boolean | null,
  likeMutationAvailable: boolean,
): string => {
  if (!canMutate) {
    return 'Sign in with an approved account to like posts.';
  }
  if (!likeMutationAvailable) {
    return 'Liking is unavailable until the forum API exposes a Like mutation endpoint.';
  }
  if (isLikedByCurrentUser !== true && isLikedByCurrentUser !== false) {
    // The BE cannot report who has liked; we cannot enable the control.
    return 'Liking is unavailable until the forum API exposes a Like mutation endpoint.';
  }
  if (inFlight) return 'Working…';
  return isLikedByCurrentUser ? 'Unlike this post' : 'Like this post';
};

export const ForumPostEngagementRow = ({
  viewModel,
  canMutate,
  commentsExpanded,
  onToggleComments,
  onLikeClick,
  likeInFlight = false,
  likeMutationAvailable,
  style,
}: ForumPostEngagementRowProps) => {
  // The Like button is enabled ONLY when all four conditions hold:
  //   1. the viewer is allowed to mutate (verified, not Guest)
  //   2. the BE has a documented Like mutation endpoint
  //      (BTR-AGENT42-A — see LIKE_MUTATION_AVAILABLE)
  //   3. the BE has reported a definitive isLikedByCurrentUser value
  //   4. no mutation is currently in flight
  const effectiveLikeAvailable =
    likeMutationAvailable ?? LIKE_MUTATION_AVAILABLE;
  const likeEnabled =
    canMutate &&
    effectiveLikeAvailable &&
    viewModel.isLikedByCurrentUser !== null &&
    !likeInFlight;

  return (
    <div
      className={styles.engagementRow}
      data-testid="forum-post-engagement-row"
      style={style}
      role="group"
      aria-label="Post engagement"
    >
      {/* ── 1. LIKE ─────────────────────────────────────────────────────
          A semantic button — disabled when no Like mutation endpoint
          exists or the viewer cannot mutate (Guest). Click is delegated
          to the parent so the parent owns the optimistic / rollback flow. */}
      <button
        type="button"
        className={`${styles.engagementControl} ${styles.engagementControlLike} ${
          viewModel.isLikedByCurrentUser === true ? styles.engagementControlLiked : ''
        }`}
        onClick={onLikeClick}
        disabled={!likeEnabled}
        aria-pressed={viewModel.isLikedByCurrentUser ?? undefined}
        aria-label={`Like this post (${formatCount(viewModel.likeCount)})`}
        title={likeTitle(
          canMutate,
          likeInFlight,
          viewModel.isLikedByCurrentUser,
          effectiveLikeAvailable,
        )}
        data-testid="forum-post-like-button"
      >
        <Heart
          size={14}
          aria-hidden
          fill={viewModel.isLikedByCurrentUser === true ? 'currentColor' : 'none'}
        />
        <span className={styles.engagementCount}>
          {formatCount(viewModel.likeCount)}
        </span>
        <span className={styles.engagementLabel}>
          {pluralize(viewModel.likeCount, 'Like', 'Likes')}
        </span>
      </button>

      {/* ── 2. COMMENTS ─────────────────────────────────────────────────
          A semantic button that delegates to the parent's
          `onToggleComments` so the existing expand/collapse behavior of
          CommentSection keeps working. Clicking does NOT open the post
          menu or trigger any other engagement. */}
      <button
        type="button"
        className={`${styles.engagementControl} ${styles.engagementControlComments} ${
          commentsExpanded ? styles.engagementControlActive : ''
        }`}
        onClick={onToggleComments}
        aria-expanded={commentsExpanded}
        aria-controls={`forum-post-comments-${viewModel.postId}`}
        aria-label={`${commentsExpanded ? 'Hide' : 'Show'} comments (${formatCount(
          viewModel.commentCount,
        )})`}
        data-testid="forum-post-comments-button"
      >
        <MessageCircle size={14} aria-hidden />
        <span className={styles.engagementCount}>
          {formatCount(viewModel.commentCount)}
        </span>
        <span className={styles.engagementLabel}>
          {pluralize(viewModel.commentCount, 'Comment', 'Comments')}
        </span>
      </button>

    </div>
  );
};

export default ForumPostEngagementRow;
