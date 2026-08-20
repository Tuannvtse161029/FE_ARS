import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import styles from './Forum.module.css';
import {
  X,
  Tag,
  FileText,
  Image as ImageIcon,
  LayoutList,
  PenLine,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../context/AuthContext';
import { useForumPosts, useCreateForumPost } from '../../hooks/useForumPosts';
import { useFollow } from '../../hooks/useFollow';
import { useFirebaseUpload } from '../../hooks/useFirebaseUpload';
import { useImageUpload } from '../../hooks/useImageUpload';
import { ForumPostCard } from '../../components/forum/ForumPostCard';
import { storage } from '../../utils/storage';
import { PALETTE, initialsFromName } from './forum.utils';


type Category = 'All Posts' | 'My Posts' | 'Following';
type SortBy = 'Newest' | 'Most Discussed' | 'Most Viewed';

const ALL_CATEGORIES: readonly Category[] = ['All Posts', 'My Posts', 'Following'];

// Page size for client-side pagination. The Swagger `GET /api/ForumPost`
// endpoint doesn't declare a pageNumber/pageSize parameter, so we cap the
// rendered list at 10 posts per page to keep the UI snappy.
const POSTS_PER_PAGE = 10;

// Constants for client-side sort options. The BE only declares a `sort`
// query param as a string; we send these values through verbatim so a
// future BE-side sort handler can map them.
const SORT_QUERY_VALUE: Record<SortBy, string> = {
  Newest: 'newest',
  'Most Discussed': 'most-discussed',
  'Most Viewed': 'most-viewed',
};

export const Forum = () => {
  const { isVerified, canCreatePost } = usePermissions();
  const { user } = useAuth();
  const stored = storage.getUser();
  const currentUserId = user?.userId ?? stored?.id ?? null;
  const currentUserName =
    stored?.fullName ?? stored?.username ?? user?.username ?? 'You';

  const [activeCategory, setActiveCategory] = useState<Category>('All Posts');
  const [sortBy, setSortBy] = useState<SortBy>('Newest');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Build the filter object passed to useForumPosts. search is trimmed so
  // whitespace-only inputs don't trigger an unnecessary refetch.
  const filters = useMemo(
    () => ({
      search: searchTerm.trim() || undefined,
      sort: SORT_QUERY_VALUE[sortBy],
    }),
    [searchTerm, sortBy],
  );

  const { posts, isLoading, error, refetch } = useForumPosts(filters);

  // Followers — drives the "Following" category AND the per-card follow
  // button. useFollow is the canonical hook: it owns the GET /api/Follower
  // fetch, filters to the current viewer's follow rows, and exposes an
  // optimistic `toggleFollow` for the button.
  const { followingIds } = useFollow();

  // Reset to page 1 whenever the user changes search or sort — otherwise
  // they could end up on a page that no longer exists in the result set.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, sortBy, activeCategory]);

  // Visible categories: unverified (guest) users only see "All Posts" —
  // they have no verified identity to filter by and can't follow authors.
  const visibleCategories: readonly Category[] = isVerified
    ? ALL_CATEGORIES
    : ['All Posts'] as const;

  // Coerce a stale activeCategory (e.g. "My Posts" survives a verification
  // flip back to false) to "All Posts" so the list never silently empties.
  const effectiveCategory: Category = visibleCategories.includes(activeCategory)
    ? activeCategory
    : 'All Posts';

  // Client-side category filter — the BE doesn't know about "My Posts" /
  // "Following"; those are user-relative views so we apply them locally
  // using the resolved authorId and the follow set.
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (effectiveCategory === 'All Posts') return true;
      if (effectiveCategory === 'My Posts') {
        return currentUserId != null && post.authorId === currentUserId;
      }
      if (effectiveCategory === 'Following') {
        return post.authorId != null && followingIds.has(post.authorId);
      }
      return true;
    });
  }, [posts, effectiveCategory, currentUserId, followingIds]);

  const paginatedPosts = useMemo(() => {
    const start = (page - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(start, start + POSTS_PER_PAGE);
  }, [filteredPosts, page]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPosts.length / POSTS_PER_PAGE),
  );

  return (
    <div className={styles.forumPage}>
      <div className={styles.forumLayout}>
        {/* ─── LEFT SIDEBAR ─── */}
        <aside className={styles.sidebar}>
          <h1 className={styles.forumTitle}>FORUM</h1>

          {/* Categories */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarSectionLabel}>Categories</div>
            <div className={styles.categoryList}>
              {visibleCategories.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.categoryItem} ${effectiveCategory === cat ? styles.categoryItemActive : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat === 'All Posts' && <LayoutList size={14} className={styles.catIcon} />}
                  {cat === 'My Posts' && <PenLine size={14} className={styles.catIcon} />}
                  {cat === 'Following' && <UserCheck size={14} className={styles.catIcon} />}
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarSectionLabel}>Filters</div>
            <div className={styles.filterInputs}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Search</label>
                <input
                  type="text"
                  className={styles.filterInput}
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* ─── RIGHT FEED ─── */}
        <div className={styles.feed}>
          {/* Pending-state banner — shown only to unverified users */}
          {!isVerified && (
            <div className={styles.pendingBanner} role="status" aria-live="polite">
              <span className={styles.pendingBannerIcon}>
                <AlertTriangle size={18} />
              </span>
              <div className={styles.pendingBannerText}>
                <p className={styles.pendingBannerTitle}>
                  Your account is pending Admin verification.
                </p>
                <p className={styles.pendingBannerHint}>
                  You currently have read-only access to public forum posts. Once
                  an Administrator approves your role request, posting, comments,
                  and reactions will unlock automatically.
                </p>
              </div>
            </div>
          )}

          {/* Feed Header */}
          <div className={styles.feedHeader}>
            <div className={styles.feedTitleRow}>
              <h2 className={styles.feedTitle}>PUBLIC FORUM</h2>
              {error ? (
                <span
                  className={styles.postCountBadge}
                  aria-label="Post count unavailable"
                  title="Post count unavailable while the forum is unreachable"
                >
                  —
                </span>
              ) : (
                <span className={styles.postCountBadge}>{filteredPosts.length} posts</span>
              )}
              <button
                className={`${styles.createPostBtn} ${!canCreatePost ? styles.createPostBtnDisabled : ''}`}
                onClick={() => {
                  if (!canCreatePost) return;
                  setIsCreateModalOpen(true);
                }}
                disabled={!canCreatePost}
                aria-disabled={!canCreatePost}
                title={
                  canCreatePost
                    ? undefined
                    : 'Posting is disabled until your account is approved by an Administrator.'
                }
              >
                + Create Post
              </button>
            </div>

            {/* Sort & Filter Toolbar */}
            <div className={styles.toolbar}>
              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option>Newest</option>
                <option>Most Discussed</option>
                <option>Most Viewed</option>
              </select>
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={() => void refetch()}
                disabled={isLoading}
                aria-label="Refresh posts"
                title="Refresh posts"
              >
                <RefreshCw size={14} className={isLoading ? styles.refreshIconSpin : ''} />
              </button>
            </div>
          </div>

          {/* API error banner */}
          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertCircle size={16} />
              <span>{error.message || 'Failed to load posts.'}</span>
              <button
                type="button"
                className={styles.errorBannerRetry}
                onClick={() => void refetch()}
                disabled={isLoading}
                aria-label="Retry loading forum posts"
              >
                {isLoading ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}

          {/* Post Cards */}
          <div className={styles.postList}>
            {isLoading && posts.length === 0 && (
              <div className={styles.stateMessage}>Loading posts…</div>
            )}

            {!isLoading && !error && filteredPosts.length === 0 && (
              <div className={styles.stateMessage}>
                {effectiveCategory === 'Following'
                  ? 'You are not following any authors yet.'
                  : effectiveCategory === 'My Posts'
                    ? 'You have not published any posts yet.'
                    : 'No posts match your filters.'}
              </div>
            )}

            {paginatedPosts.map((post) => (
              <ForumPostCard
                key={post.id}
                post={post}
                isVerified={isVerified}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
              />
            ))}
          </div>

          {/* Pagination — client-side, 10 per page */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.paginationBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Previous
              </button>
              <span className={styles.paginationLabel}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={styles.paginationBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      {isCreateModalOpen && canCreatePost && currentUserId != null && (
        <CreatePostModal
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setIsCreateModalOpen(false)}
          onPublished={() => {
            setIsCreateModalOpen(false);
            void refetch();
          }}
        />
      )}
    </div>
  );
};

// ForumPostCard has been extracted to its own file:
//   src/components/forum/ForumPostCard.tsx
// It re-uses `PALETTE` and `initialsFromName` (imported below) plus all the
// existing CSS modules. The Forum page still owns the feed-state +
// pagination. The card owns per-card local UI state (overflow menu, report
// modal, comments collapse, like-disabled tooltip).

// ─── CreatePostModal ─────────────────────────────────────────────────────────
// Owns the create-form local state and the actual POST /api/ForumPost call.
// Closes itself on successful publish and asks the parent to refetch.
interface CreatePostModalProps {
  currentUserId: number;
  currentUserName: string;
  onClose: () => void;
  onPublished: () => void;
}

const CreatePostModal = ({
  currentUserId,
  currentUserName,
  onClose,
  onPublished,
}: CreatePostModalProps) => {
  const { create, error: createError } = useCreateForumPost();

  // Firebase upload hooks — one per attachment type
  const pdfUpload = useFirebaseUpload('forum_pdfs/');
  const imageUpload = useImageUpload('forum_images/');

  const [title, setTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [abstract, setAbstract] = useState('');
  const [category, setCategory] = useState('');
  const [postTags, setPostTags] = useState('');
  const [attachedPdf, setAttachedPdf] = useState<File | null>(null);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Local submitError captures synchronous failures (e.g. attachment upload
  // errors). The hook's `error` already handles BE failures with a sanitized
  // 5xx message — we surface whichever is more relevant.
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Reset both upload hooks when the modal closes so stale URLs don't bleed
  // into the next open session.
  const reset = useCallback(() => {
    setTitle('');
    setPostContent('');
    setAbstract('');
    setCategory('');
    setPostTags('');
    setAttachedPdf(null);
    setAttachedImage(null);
    setSubmitError(null);
    setSubmitting(false);
    pdfUpload.resetUpload();
    imageUpload.resetUpload();
  }, [pdfUpload, imageUpload]);

  const handlePublish = async () => {
    const trimmedContent = postContent.trim();
    if (!trimmedContent || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload attachments to Firebase (if any), in parallel
      const [pdfUrl, imageUrl] = await Promise.all([
        attachedPdf ? pdfUpload.uploadPdf(attachedPdf).then(() => pdfUpload.pdfUrl) : Promise.resolve(null),
        attachedImage ? imageUpload.uploadImage(attachedImage).then(() => imageUpload.imageUrl) : Promise.resolve(null),
      ]);

      // 2. Create the post with the resolved public URLs
      const tags = postTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const result = await create({
        title: title.trim() || null,
        content: trimmedContent,
        abstract: abstract.trim() || null,
        category: category.trim() || null,
        tags: tags.length > 0 ? tags : null,
        attachedPdfUrl: pdfUrl,
        attachedImageUrl: imageUrl,
      });

      setSubmitting(false);
      if (result) {
        reset();
        onPublished();
      } else {
        // The hook already sanitizes the message; prefer it over a hardcoded
        // string so the user sees the same "temporarily unavailable" copy
        // as the list banner.
        setSubmitError(createError?.message ?? 'Failed to publish post. Please try again.');
      }
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    }
  };

  const avatarInitials = initialsFromName(currentUserName);
  const avatarColor = PALETTE[currentUserId % PALETTE.length];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create Forum Post</h2>
        </div>

        {/* Author Header */}
        <div className={styles.modalAuthorHeader}>
          <div
            className={styles.modalAuthorAvatar}
            style={{ backgroundColor: avatarColor, color: '#0f172a' }}
          >
            {avatarInitials}
          </div>
          <div className={styles.modalAuthorInfo}>
            <span className={styles.modalAuthorName}>{currentUserName}</span>
            <span className={styles.modalPostingTo}>Posting to Forums</span>
          </div>
        </div>

        <div className={styles.modalBody}>
          {/* Title */}
          <input
            type="text"
            className={styles.titleInput}
            placeholder="Post title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
          />

          {/* Category (optional, free-text until BE ships category list) */}
          <input
            type="text"
            className={styles.titleInput}
            placeholder="Category (optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          {/* Abstract (optional) */}
          <textarea
            className={styles.abstractTextarea}
            placeholder="Brief abstract (optional)"
            rows={2}
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
          />

          {/* Plain Textarea - content */}
          <textarea
            className={styles.modalTextarea}
            placeholder="Share your thoughts..."
            rows={8}
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
          />

          {/* Tag Input with # prefix display */}
          <div className={styles.tagInputRow}>
            <label className={styles.tagLabel}>
              <Tag size={14} />
              Tags
            </label>
            <div className={styles.tagInputWrapper}>
              <span className={styles.tagHashPrefix}>#</span>
              <input
                type="text"
                className={styles.tagInputField}
                placeholder="Add tags, comma separated..."
                value={postTags}
                onChange={(e) => setPostTags(e.target.value)}
              />
            </div>
          </div>

          {/* Attachment Buttons — UI only for now, see report */}
          <div className={styles.attachmentRow}>
            <button
              type="button"
              className={styles.attachPdfBtn}
              onClick={() => pdfInputRef.current?.click()}
            >
              <FileText size={16} />
              Attach PDF Paper
            </button>
            <input
              type="file"
              ref={pdfInputRef}
              accept=".pdf"
              className={styles.hiddenInput}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setAttachedPdf(file);
              }}
            />

            <button
              type="button"
              className={styles.uploadImgBtn}
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageIcon size={16} />
              Upload Image
            </button>
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              className={styles.hiddenInput}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setAttachedImage(file);
              }}
            />
          </div>

          {/* Show attached files (UI-only preview; not yet uploaded) */}
          {(attachedPdf || attachedImage) && (
            <div className={styles.attachedFilesList}>
              {attachedPdf && (
                <div className={styles.attachedFile}>
                  <FileText size={14} />
                  <span>{attachedPdf.name}</span>
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    onClick={() => setAttachedPdf(null)}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {attachedImage && (
                <div className={styles.attachedFile}>
                  <ImageIcon size={14} />
                  <span>{attachedImage.name}</span>
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    onClick={() => setAttachedImage(null)}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upload progress indicators — shown while Firebase is transferring */}
          {(pdfUpload.isUploading || imageUpload.isUploading) && (
            <div className={styles.uploadProgressWrapper}>
              {pdfUpload.isUploading && (
                <div className={styles.uploadProgressItem}>
                  <span className={styles.uploadProgressLabel}>
                    <FileText size={12} />
                    PDF
                  </span>
                  <div className={styles.uploadProgressBarTrack}>
                    <div
                      className={styles.uploadProgressBarFill}
                      style={{ width: `${pdfUpload.progress}%` }}
                    />
                  </div>
                  <span className={styles.uploadProgressPct}>{pdfUpload.progress}%</span>
                </div>
              )}
              {imageUpload.isUploading && (
                <div className={styles.uploadProgressItem}>
                  <span className={styles.uploadProgressLabel}>
                    <ImageIcon size={12} />
                    Image
                  </span>
                  <div className={styles.uploadProgressBarTrack}>
                    <div
                      className={styles.uploadProgressBarFill}
                      style={{ width: `${imageUpload.progress}%` }}
                    />
                  </div>
                  <span className={styles.uploadProgressPct}>{imageUpload.progress}%</span>
                </div>
              )}
            </div>
          )}

          {/* Per-upload errors shown once the upload has finished with an error */}
          {pdfUpload.error && !pdfUpload.isUploading && (
            <div className={styles.errorBanner} role="alert" style={{ marginTop: 8 }}>
              <AlertCircle size={14} />
              PDF upload: {pdfUpload.error}
            </div>
          )}
          {imageUpload.error && !imageUpload.isUploading && (
            <div className={styles.errorBanner} role="alert" style={{ marginTop: 8 }}>
              <AlertCircle size={14} />
              Image upload: {imageUpload.error}
            </div>
          )}

          {submitError && (
            <div className={styles.errorBanner} role="alert">
              <AlertCircle size={14} />
              {submitError}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.publishBtn}
            disabled={!postContent.trim() || submitting || pdfUpload.isUploading || imageUpload.isUploading}
            onClick={handlePublish}
          >
            {submitting ? 'Publishing…' : 'Publish Post'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Forum;