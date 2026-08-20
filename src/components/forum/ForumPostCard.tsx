import { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  MoreHorizontal,
  Flag,
} from 'lucide-react';
import { CommentSection } from './CommentSection';
import { FollowButton } from './FollowButton';
import { ReportModal } from './ReportModal';
import { ForumPostEngagementRow } from './ForumPostEngagementRow';
import { useForumComments } from '../../hooks/useForumComments';
import { buildForumPostViewModel } from '../../types/forumPostViewModel';
import type { ForumPost } from '../../types/forum.types';
import { initialsFromName, formatRelativeTime, PALETTE } from '../../pages/Forum/forum.utils';
import styles from '../../pages/Forum/Forum.module.css';

// One row of the feed. Owns:
//   - "more options" overflow menu
//   - per-card report-target state
//   - comments-collapse state (lifted out of `CommentSection` so the
//     engagement row's Comments button is the single source of truth)
//   - Like button disabled-state tooltip copy
//
// The card is intentionally dumb: it does NOT mutate engagement counters
// itself. Until Swagger exposes a Like mutation endpoint (BTR-AGENT42-A)
// and a per-viewer like-state field (BTR-AGENT42-C), the Like button is
// disabled by the row. Once the BE ships those endpoints, the parent
// (Forum page) wires an `onLikeMutation` callback into a future
// `useForumLike` hook that the row calls via `onLikeClick`. Today
// `onLikeClick` simply logs a dev warning so silent misconfiguration is
// loud in dev only.

export interface ForumPostCardProps {
  post: ForumPost;
  isVerified: boolean;
  currentUserId: number | null;
  currentUserName: string;
}

export const ForumPostCard = ({
  post,
  isVerified,
  currentUserId,
  currentUserName,
}: ForumPostCardProps) => {
  const [openMenuId, setOpenMenuId] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    id: number;
    preview: string;
  } | null>(null);
  // Controlled comments-collapse: lifted out of CommentSection so the
  // engagement row's Comments button can flip it. We start expanded so
  // existing tests/usages that render the comments list immediately keep
  // working.
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);

  // Re-use the canonical comments hook so the engagement row's
  // `commentCount` reflects whatever the BE actually loaded for this
  // post. We intentionally do not call this twice for the same post — the
  // `<CommentSection>` instance below reuses the same hook and React
  // batches the state.
  const { comments } = useForumComments(post.id);

  const avatarColor = PALETTE[post.id % PALETTE.length];

  // Author label — Swagger doesn't return fullName on the post, only
  // authorId. Until the BE ships it we render "Author #{id}" or, if the
  // post belongs to the current user, fall back to their own name.
  const authorLabel =
    post.authorId != null && currentUserId != null && post.authorId === currentUserId
      ? currentUserName
      : post.authorId != null
        ? `Author #${post.authorId}`
        : 'Unknown author';

  const authorInitials = initialsFromName(authorLabel);

  const viewModel = buildForumPostViewModel({
    post,
    commentCount: comments.length,
  });

  const handleToggleComments = () => {
    setCommentsCollapsed((prev) => !prev);
  };

  const handleLikeClick = () => {
    // BTR-AGENT42-A: Like mutation is unavailable until the BE ships it.
    // This branch is reachable only when the row's internal `likeEnabled`
    // returns true — meaning the BE has published both a mutation and a
    // per-viewer like state. When that happens, replace this no-op with
    // the optimistic + rollback pattern from useFollow.ts.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ForumPostCard] Like click reached but no Like mutation endpoint is wired. See BTR-AGENT42-A.',
      );
    }
  };

  return (
    <div className={styles.postCardWrapper}>
      <div className={styles.postCard}>
        {/* Author row */}
        <div className={styles.postAuthorRow}>
          <div
            className={styles.postAvatar}
            style={{ backgroundColor: avatarColor, color: '#0f172a' }}
          >
            {authorInitials}
          </div>
          <div className={styles.postAuthorInfo}>
            <span className={styles.postAuthorName}>{authorLabel}</span>
            <span className={styles.postTimestamp}>
              {formatRelativeTime(post.createdAt)}
            </span>
          </div>
          {/* FollowButton — only for verified viewers, only when we know
              the authorId, and never on the viewer's own posts. The
              component itself enforces these guards; we just gate the
              render so the button doesn't appear at all for guests. */}
          {isVerified &&
            post.authorId != null &&
            post.authorId !== currentUserId && (
              <div className={styles.postAuthorActions}>
                <FollowButton authorId={post.authorId} size="sm" />
              </div>
            )}
        </div>

        {/* Title */}
        {post.title && <h3 className={styles.postTitle}>{post.title}</h3>}

        {/* Abstract / content */}
        {(post.abstract ?? post.content) && (
          <p className={styles.postAbstract}>
            {post.abstract ?? post.content}
          </p>
        )}

        {/* Attachments (if any) */}
        {(post.attachedImageUrl || post.attachedPdfUrl) && (
          <div className={styles.attachmentRow}>
            {post.attachedImageUrl && (
              <a
                href={post.attachedImageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.attachmentLink}
              >
                <ImageIcon size={14} />
                Attached image
              </a>
            )}
            {post.attachedPdfUrl && (
              <a
                href={post.attachedPdfUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.attachmentLink}
              >
                <FileText size={14} />
                Attached PDF
              </a>
            )}
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className={styles.postTags}>
            {post.tags.map((tag, idx) => (
              <span key={`${tag}-${idx}`} className={styles.postTag}>
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Engagement row — Like → Comments → Views, in that exact order.
            The row delegates Comments-expand/collapse via its
            `onToggleComments` callback (we own the state). */}
        <ForumPostEngagementRow
          viewModel={viewModel}
          canMutate={isVerified && currentUserId != null}
          commentsExpanded={!commentsCollapsed}
          onToggleComments={handleToggleComments}
          onLikeClick={handleLikeClick}
        />

        {/* Comments thread — controlled by the engagement row's
            Comments button. The `rootId` lets the row's
            `aria-controls="forum-post-comments-{id}"` resolve to the
            actual DOM node. We pass our own `comments` (fetched here for
            the engagement row's counter) so the section doesn't issue a
            second fetch for the same data. */}
        <CommentSection
          postId={post.id}
          collapsed={commentsCollapsed}
          rootId={`forum-post-comments-${post.id}`}
          onToggle={handleToggleComments}
          comments={comments}
        />
      </div>

      {/* Overflow Menu - only for verified users */}
      {isVerified && (
        <div className={styles.postCardActions}>
          <button
            className={styles.menuTrigger}
            onClick={() => setOpenMenuId((prev) => !prev)}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={openMenuId}
          >
            <MoreHorizontal size={18} />
          </button>

          {openMenuId && (
            <div className={styles.menuDropdown} role="menu">
              <button
                className={`${styles.menuItem} ${styles.menuItemReport}`}
                onClick={() => {
                  setReportTarget({
                    id: post.id,
                    preview: post.title ?? '(untitled post)',
                  });
                  setOpenMenuId(false);
                }}
                role="menuitem"
              >
                <Flag size={16} className={styles.menuIcon} />
                Report this post
              </button>
            </div>
          )}
        </div>
      )}

      {reportTarget && currentUserId != null && (
        <ReportModal
          isOpen={true}
          onClose={() => setReportTarget(null)}
          targetType="ForumPost"
          targetId={reportTarget.id}
          targetPreview={reportTarget.preview}
          reporterId={currentUserId}
        />
      )}
    </div>
  );
};

export default ForumPostCard;
