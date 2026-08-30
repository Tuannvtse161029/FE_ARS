import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { forumPostService } from '../../services/forumPost.service';
import { buildForumPostViewModel } from '../../types/forumPostViewModel';
import type { ForumPost } from '../../types/forum.types';
import { initialsFromName, formatRelativeTime } from '../../pages/Forum/forum.utils';
import styles from './ForumPostCard.module.css';

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
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    id: number;
    preview: string;
  } | null>(null);

  // Lifted out of `CommentSection` so the engagement-row Comments button
  // is the single source of truth for expand/collapse. We start expanded
  // so existing tests / render paths that expect comments immediately
  // continue to work.
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);

  const initialLiked = Boolean(post.isLiked ?? post.isLikedByCurrentUser);
  const initialCount = Number(post.likes ?? post.likeCount ?? 0);
  const [isLiked, setIsLiked] = useState<boolean>(initialLiked);
  const [likesCount, setLikesCount] = useState<number>(initialCount);
  const [likeInFlight, setLikeInFlight] = useState<boolean>(false);

  useEffect(() => {
    setIsLiked(Boolean(post.isLiked ?? post.isLikedByCurrentUser));
    setLikesCount(Number(post.likes ?? post.likeCount ?? 0));
  }, [post.isLiked, post.isLikedByCurrentUser, post.likes, post.likeCount]);

  const {
    comments,
    isLoading: isLoadingComments,
    error: errorComments,
    refetch: refetchComments,
  } = useForumComments(post.id);

  const authorLabel =
    (typeof post.fullName === 'string' && post.fullName.trim()) ||
    (typeof post.author === 'string' && post.author.trim()) ||
    (post.authorId != null && currentUserId != null && post.authorId === currentUserId
      ? currentUserName
      : post.authorId != null
        ? `Author #${post.authorId}`
        : 'Unknown author');

  const authorInitials = initialsFromName(authorLabel);

  const viewModel = buildForumPostViewModel({
    post: {
      ...post,
      likes: likesCount,
      likeCount: likesCount,
      isLiked,
      isLikedByCurrentUser: isLiked,
    },
    commentCount: comments.length,
  });

  const handleToggleComments = () => {
    setCommentsCollapsed((prev) => !prev);
  };

  const handleLikeClick = async () => {
    if (!currentUserId || !isVerified || likeInFlight) return;
    const prevLiked = isLiked;
    const prevCount = likesCount;
    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    // Optimistic instant update
    setIsLiked(nextLiked);
    setLikesCount(nextCount);
    setLikeInFlight(true);

    try {
      const res = await forumPostService.toggleLike(post.id);
      if (res && typeof res.isLiked === 'boolean') {
        setIsLiked(res.isLiked);
        if (typeof res.likes === 'number') {
          setLikesCount(res.likes);
        }
      }
    } catch {
      // Rollback on error
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    } finally {
      setLikeInFlight(false);
    }
  };

  const handleAuthorClick = () => {
    if (post.authorId) {
      navigate(`/profile/${post.authorId}`);
    }
  };

  return (
    <article
      className={`${styles.card} ${commentsCollapsed ? '' : styles.cardOpen}`}
      data-component="ForumPostCard"
    >
      {/* Author row */}
      <div className={styles.authorRow}>
        <button
          type="button"
          className={styles.avatarButton}
          onClick={handleAuthorClick}
          title={post.authorId ? `View ${authorLabel}'s profile` : undefined}
          aria-label={post.authorId ? `Open ${authorLabel}'s profile` : undefined}
        >
          {authorInitials}
        </button>
        <div className={styles.authorInfo}>
          <button
            type="button"
            className={styles.authorName}
            onClick={handleAuthorClick}
            title={post.authorId ? `View ${authorLabel}'s profile` : undefined}
          >
            {authorLabel}
          </button>
          <span className={styles.timestamp}>
            {formatRelativeTime(post.createdAt)}
          </span>
        </div>
        {isVerified && (
          <div className={styles.authorActions}>
            {/* FollowButton — only verified viewers, only when we know the
                authorId, and never on the viewer's own posts. */}
            {post.authorId != null && post.authorId !== currentUserId && (
              <FollowButton authorId={post.authorId} size="sm" />
            )}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.menuTrigger}
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={18} />
              </button>

              {menuOpen && (
                <div className={styles.menuDropdown} role="menu">
                  <button
                    className={`${styles.menuItem} ${styles.menuItemReport}`}
                    onClick={() => {
                      setReportTarget({
                        id: post.id,
                        preview: post.title ?? '(untitled post)',
                      });
                      setMenuOpen(false);
                    }}
                    role="menuitem"
                  >
                    <Flag size={16} className={styles.menuIcon} />
                    Report this post
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Title */}
      {post.title && <h3 className={styles.title}>{post.title}</h3>}

      {/* Abstract / content */}
      {(post.abstract ?? post.content) && (
        <p className={styles.abstract}>
          {post.abstract ?? post.content}
        </p>
      )}

      {/* Attachments */}
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
        <div className={styles.tags}>
          {post.tags.map((tag, idx) => (
            <span key={`${tag}-${idx}`} className={styles.tag}>
              {tag.startsWith('#') ? tag : `#${tag}`}
            </span>
          ))}
        </div>
      )}

      {/* Engagement row — Like → Comments */}
      <ForumPostEngagementRow
        viewModel={viewModel}
        canMutate={isVerified && currentUserId != null}
        commentsExpanded={!commentsCollapsed}
        onToggleComments={handleToggleComments}
        onLikeClick={handleLikeClick}
        likeInFlight={likeInFlight}
      />

      {/* Comments */}
      <CommentSection
        postId={post.id}
        authorDisplayByUserId={undefined}
        collapsed={commentsCollapsed}
        rootId={`forum-post-comments-${post.id}`}
        onToggle={handleToggleComments}
        comments={comments}
        isLoading={isLoadingComments}
        error={errorComments}
        onRefetch={refetchComments}
      />

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
    </article>
  );
};

export default ForumPostCard;
