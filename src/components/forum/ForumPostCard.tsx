import { useState, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Image as ImageIcon,
  MoreHorizontal,
  Flag,
  CheckCircle2,
  X,
} from 'lucide-react';
import { CommentSection } from './CommentSection';
import { FollowButton } from './FollowButton';
import { ReportModal } from './ReportModal';
import { ForumPostEngagementRow } from './ForumPostEngagementRow';
import { UserFlairBadge } from '../../components/medals/UserFlairBadge';
import { ImageViewer } from '../../components/ImageViewer';
import { useForumComments } from '../../hooks/useForumComments';
import { useCanInteractInForum } from '../../hooks/useCanInteractInForum';
import { useI18n } from '../../i18n/I18nContext';
import { forumPostService } from '../../services/forumPost.service';
import { signalrService } from '../../services/signalr.service';
import { buildForumPostViewModel } from '../../types/forumPostViewModel';
import type { ForumPost } from '../../types/forum.types';
import { initialsFromName, formatRelativeTime } from '../../pages/Forum/forum.utils';
import styles from './ForumPostCard.module.css';

// `LazyPdfViewer` dynamically imports `pdfjs-dist` (≈ 1.7 MB raw) so it does
// not bloat the forum feed chunk. The Suspense boundary keeps the surrounding
// card markup stable while the viewer chunk is fetched on demand.
const LazyPdfViewer = lazy(() =>
  import('../../components/PdfViewer/LazyPdfViewer').then((m) => ({ default: m.default }))
);

const PdfViewerFallback = () => (
  <div
    className={styles.pdfViewerFallback}
    role="status"
    aria-live="polite"
  >
    Loading PDF viewer…
  </div>
);

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
}: ForumPostCardProps) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    id: number;
    preview: string;
  } | null>(null);

  // Combined permission: approved by Admin AND (not Researcher/Lecturer,
  // or subscription ACTIVE).
  const { canInteract } = useCanInteractInForum();

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

  // Attachment viewer state — `null` means no viewer is open. The PDF
  // viewer keeps the URL string; the image viewer accepts either a URL or
  // a File/Blob, so we share the same value but pass it through to the
  // appropriate viewer component.
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [imageViewerSrc, setImageViewerSrc] = useState<string | null>(null);

  // Escape closes the PDF viewer overlay (the ImageViewer already handles
  // its own Escape internally). We attach the listener only while the
  // overlay is open and we lock body scroll so background content can't
  // shift under the modal.
  useEffect(() => {
    if (!pdfViewerUrl) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPdfViewerUrl(null);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [pdfViewerUrl]);

  useEffect(() => {
    setIsLiked(Boolean(post.isLiked ?? post.isLikedByCurrentUser));
    setLikesCount(Number(post.likes ?? post.likeCount ?? 0));
  }, [post.isLiked, post.isLikedByCurrentUser, post.likes, post.likeCount]);

  // Real-time post likes update via SignalR
  useEffect(() => {
    if (!post.id) return;
    const unsub = signalrService.on('ForumPostLiked', (data: unknown) => {
      if (data && typeof data === 'object') {
        const rawId = Number(
          (data as { forumPostId?: unknown; postId?: unknown; id?: unknown }).forumPostId ??
          (data as { postId?: unknown }).postId ??
          (data as { id?: unknown }).id ?? 0
        );
        if (rawId === Number(post.id)) {
          const nextLikes =
            (data as { likes?: unknown; likeCount?: unknown }).likes ??
            (data as { likeCount?: unknown }).likeCount;
          if (typeof nextLikes === 'number') {
            setLikesCount(nextLikes);
          }
        }
      }
    });
    return () => {
      unsub();
    };
  }, [post.id]);

  const {
    comments,
    isLoading: isLoadingComments,
    error: errorComments,
    refetch: refetchComments,
  } = useForumComments(post.id);

  const authorLabel =
    // Bug fix (Sep 2026): check ownership FIRST so the current user's own
    // posts always show "Me" regardless of whether the BE returns fullName.
    (post.authorId != null && currentUserId != null && post.authorId === currentUserId
      ? t('forum.comment.me', 'Me')
      : typeof post.fullName === 'string' && post.fullName.trim()
        ? post.fullName.trim()
        : typeof post.author === 'string' && post.author.trim()
          ? post.author.trim()
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
    if (!currentUserId || !canInteract || likeInFlight) return;
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
          <span className={styles.authorNameRow}>
            <button
              type="button"
              className={styles.authorName}
              onClick={handleAuthorClick}
              title={post.authorId ? `View ${authorLabel}'s profile` : undefined}
            >
              {authorLabel}
            </button>
            {post.authorId != null && (
              <UserFlairBadge userId={post.authorId} size="xs" showTooltip />
            )}
          </span>
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
                aria-label={t('forum.post.moreOptions', 'More options')}
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
                    {t('forum.post.reportPost', 'Report this post')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {reportSuccess && (
        <div className={styles.reportSuccessBanner} role="status">
          <CheckCircle2 size={14} />
          <span>{t('forum.report.successToast', 'Your report has been submitted to moderators.')}</span>
        </div>
      )}

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
            <button
              type="button"
              className={styles.attachmentThumbnailBtn}
              onClick={() => setImageViewerSrc(post.attachedImageUrl ?? null)}
              aria-label={t('forum.post.openAttachmentImage', 'View attached image')}
            >
              <img
                src={post.attachedImageUrl}
                alt={t('forum.post.attachmentImageAlt', 'Attached image preview')}
                className={styles.attachmentThumbnail}
                loading="lazy"
              />
              <span className={styles.attachmentThumbnailOverlay}>
                <ImageIcon size={14} aria-hidden="true" />
                {t('forum.post.viewImage', 'View image')}
              </span>
            </button>
          )}
          {post.attachedPdfUrl && (
            <button
              type="button"
              className={styles.attachmentPdfBtn}
              onClick={() => setPdfViewerUrl(post.attachedPdfUrl ?? null)}
              aria-label={t('forum.post.openAttachmentPdf', 'Open attached PDF paper')}
            >
              <FileText size={14} aria-hidden="true" />
              {t('forum.post.attachmentPdf', 'Attached PDF')}
              <span className={styles.attachmentPdfSublabel}>
                {t('forum.post.attachmentPdfOpen', 'Open viewer')}
              </span>
            </button>
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
        canMutate={canInteract && currentUserId != null}
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
          onSuccess={() => {
            setReportSuccess(true);
            setTimeout(() => setReportSuccess(false), 5000);
          }}
          targetType="ForumPost"
          targetId={reportTarget.id}
          targetPreview={reportTarget.preview}
          reporterId={currentUserId}
        />
      )}

      {/* In-app PDF viewer for attached PDF paper. Wrapped in a portal
          overlay + close button because the bare PdfViewer is just the
          viewer block — it doesn't ship its own modal chrome. */}
      {pdfViewerUrl &&
        createPortal(
          <div
            className={styles.pdfViewerOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={t('forum.post.attachmentPdfViewerTitle', 'Attached PDF viewer')}
          >
            <button
              type="button"
              className={styles.pdfViewerCloseBtn}
              onClick={() => setPdfViewerUrl(null)}
              aria-label={t('common.close', 'Close')}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <div className={styles.pdfViewerContainer}>
              <Suspense fallback={<PdfViewerFallback />}>
                <LazyPdfViewer url={pdfViewerUrl} />
              </Suspense>
            </div>
          </div>,
          document.body
        )}

      {/* In-app image viewer for attached cover image */}
      <ImageViewer
        isOpen={imageViewerSrc !== null}
        src={imageViewerSrc}
        onClose={() => setImageViewerSrc(null)}
        title={t('forum.post.attachmentImageViewerTitle', 'Attached image')}
      />
    </article>
  );
};

export default ForumPostCard;
