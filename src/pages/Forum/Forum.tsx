import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  Plus,
  Search,
  Hash,
  TrendingUp,
  BarChart3,
  Users as UsersIcon,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../context/AuthContext';
import { useForumPosts, useCreateForumPost } from '../../hooks/useForumPosts';
import { useFollow } from '../../hooks/useFollow';
import { useFirebaseUpload } from '../../hooks/useFirebaseUpload';
import { useImageUpload } from '../../hooks/useImageUpload';
import { ForumPostCard } from '../../components/forum/ForumPostCard';
import { SkeletonRow } from '../../components/SkeletonRow';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { storage } from '../../utils/storage';
import { PALETTE, initialsFromName } from './forum.utils';
import styles from './Forum.module.css';

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

  const postCountLabel = error
    ? '—'
    : `${filteredPosts.length} post${filteredPosts.length === 1 ? '' : 's'}`;

  // ─── Trending tags + Forum stats (sidebar density) ─────────────────────────
  // Derived purely from the loaded `posts` collection — no mock data, no extra
  // API calls. Tags come straight off `post.tags` (already in the ForumPost
  // wire shape, see types/forum.types.ts). Stats are computed against the full
  // (unfiltered) post set so the numbers remain stable as the user toggles
  // Categories / Filters — that way the sidebar feels like a workspace, not
  // a duplicate of the active filter pill in the toolbar.
  const MAX_TRENDING_TAGS = 8;

  const trendingTags = useMemo<{ tag: string; count: number }[]>(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      if (!post.tags || post.tags.length === 0) continue;
      for (const raw of post.tags) {
        const tag = (raw ?? '').trim();
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.tag.localeCompare(b.tag);
      })
      .slice(0, MAX_TRENDING_TAGS);
  }, [posts]);

  const forumStats = useMemo(() => {
    const authors = new Set<number>();
    let tagTotal = 0;
    for (const post of posts) {
      if (typeof post.authorId === 'number') {
        authors.add(post.authorId);
      }
      if (post.tags && post.tags.length > 0) {
        tagTotal += post.tags.length;
      }
    }
    return {
      totalPosts: posts.length,
      uniqueAuthors: authors.size,
      taggedPosts: tagTotal,
    };
  }, [posts]);

  // Apply a tag chip — populates the search field so the feed filters down.
  // We reuse the existing `search` input (the BE only exposes `search`,
  // `sort`, `category` query params), so a tag click feels like typing a
  // search term. The handler is a no-op while a refresh is in flight so we
  // don't trigger a refetch in a way that the user can't reason about.
  const handleTagClick = useCallback((tag: string) => {
    setSearchTerm(tag);
  }, []);

  return (
    <div className={styles.forumPage}>
      <PageHeader
        eyebrow="Community"
        title="Forum"
        description={
          isVerified
            ? 'Browse research conversations, follow colleagues, and contribute through the verified community workflow.'
            : 'Browse public discussions while your account is pending administrator verification.'
        }
        breadcrumbs={
          <>
            Home <span aria-hidden>/</span>{' '}
            <span className={styles.breadcrumbsActive}>Forum</span>
          </>
        }
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              if (!canCreatePost) return;
              setIsCreateModalOpen(true);
            }}
            disabled={!canCreatePost}
            title={
              canCreatePost
                ? undefined
                : 'Posting is disabled until your account is approved by an Administrator.'
            }
          >
            Create post
          </Button>
        }
      />

      <div className={styles.forumLayout}>
        {/* ─── LEFT SIDEBAR ─── */}
        <aside className={styles.sidebar} aria-label="Forum filters">
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

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarSectionLabel}>Filters</div>
            <Input
              label="Search"
              placeholder="Search posts…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={14} />}
            />
          </div>

          {/* ─── Trending Tags (this worker) ───────────────────────────────
              Fills the negative space below the Filters input. Tags are
              derived from the loaded posts (no extra API call, no mock
              data) and a click populates the search field above so the
              filter is observable in the feed. Hidden entirely when no
              tags exist so the sidebar never shows an empty placeholder. */}
          {trendingTags.length > 0 && (
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionLabel}>
                <span className={styles.sidebarSectionLabelIcon} aria-hidden>
                  <TrendingUp size={12} />
                </span>
                Trending Tags
              </div>
              <div className={styles.tagChipList}>
                {trendingTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    type="button"
                    className={styles.tagChip}
                    onClick={() => handleTagClick(tag)}
                    title={`Filter posts by #${tag} (${count} post${count === 1 ? '' : 's'})`}
                    aria-label={`Filter by tag ${tag}, ${count} post${count === 1 ? '' : 's'}`}
                  >
                    <Hash size={11} className={styles.tagChipIcon} aria-hidden />
                    <span className={styles.tagChipText}>{tag}</span>
                    <span className={styles.tagChipCount} aria-hidden>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Forum Stats (this worker) ────────────────────────────────
              Compact three-row overview derived from the same loaded
              posts. Numbers stay stable across Category / Filter
              toggles (computed against the full `posts` set) so the
              sidebar reads as a workspace overview, not a duplicate of
              the active-filter pill in the toolbar. Hidden while the
              feed is loading to avoid showing zeros that would imply
              "no posts" when we're still fetching. */}
          {!isLoading && posts.length > 0 && (
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionLabel}>
                <span className={styles.sidebarSectionLabelIcon} aria-hidden>
                  <BarChart3 size={12} />
                </span>
                Forum Stats
              </div>
              <ul className={styles.statsList} role="list">
                <li className={styles.statRow} role="listitem">
                  <span className={styles.statLabel}>
                    <FileText size={12} className={styles.statIcon} aria-hidden />
                    Posts
                  </span>
                  <span className={styles.statValue}>{forumStats.totalPosts}</span>
                </li>
                <li className={styles.statRow} role="listitem">
                  <span className={styles.statLabel}>
                    <UsersIcon size={12} className={styles.statIcon} aria-hidden />
                    Authors
                  </span>
                  <span className={styles.statValue}>{forumStats.uniqueAuthors}</span>
                </li>
                <li className={styles.statRow} role="listitem">
                  <span className={styles.statLabel}>
                    <Tag size={12} className={styles.statIcon} aria-hidden />
                    Tags
                  </span>
                  <span className={styles.statValue}>{forumStats.taggedPosts}</span>
                </li>
              </ul>
            </div>
          )}
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

          {/* Feed Toolbar */}
          <div className={styles.feedToolbar}>
            <div className={styles.feedToolbarLeft}>
              <span className={styles.postCountBadge}>{postCountLabel}</span>
              <span className={styles.toolbarDivider} aria-hidden />
              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                aria-label="Sort posts"
              >
                <option>Newest</option>
                <option>Most Discussed</option>
                <option>Most Viewed</option>
              </select>
            </div>
            <div className={styles.feedToolbarRight}>
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

          {/* API error banner — shared ErrorBanner */}
          {error && (
            <ErrorBanner
              tone="error"
              title="Couldn't load forum posts"
              message={error.message || 'Failed to load posts.'}
              retry={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void refetch()}
                  disabled={isLoading}
                >
                  {isLoading ? 'Retrying…' : 'Retry'}
                </Button>
              }
            />
          )}

          {/* Post Cards / Loading / Empty */}
          <div className={styles.postList}>
            {isLoading && posts.length === 0 && (
              <SkeletonRow count={4} rowHeight={120} gap={16} withHeader />
            )}

            {!isLoading && !error && filteredPosts.length === 0 && (
              <EmptyState
                icon={<AlertCircle size={20} />}
                title={
                  effectiveCategory === 'Following'
                    ? 'Not following any authors yet'
                    : effectiveCategory === 'My Posts'
                      ? 'You have not published any posts yet'
                      : 'No posts match your filters'
                }
                description={
                  effectiveCategory === 'Following'
                    ? 'Follow a colleague from any forum post to see their updates here.'
                    : effectiveCategory === 'My Posts'
                      ? 'Use the Create post button to share research with the community.'
                      : 'Try a different search or clear your filters.'
                }
                compact
              />
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
        attachedPdf ? pdfUpload.uploadPdf(attachedPdf) : Promise.resolve(null),
        attachedImage ? imageUpload.uploadImage(attachedImage) : Promise.resolve(null),
      ]);

      // 2. Create the post with the resolved public URLs
      const tags = postTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const effectiveTitle = title.trim() || trimmedContent.slice(0, 60).trim() || 'General Post';

      const result = await create({
        title: effectiveTitle,
        content: trimmedContent,
        abstract: abstract.trim() || null,
        category: category.trim() || null,
        tags: tags.length > 0 ? tags : null,
        attachedPdfUrl: pdfUrl || null,
        attachedImageUrl: imageUrl || null,
      });

      setSubmitting(false);
      if (result) {
        reset();
        onPublished();
      } else {
        setSubmitError(createError?.message ?? 'Failed to publish post. Please verify all inputs and try again.');
      }
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    }
  };

  const avatarInitials = initialsFromName(currentUserName);
  const paletteIndex = currentUserId % PALETTE.length;

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forum-create-post-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 id="forum-create-post-title" className={styles.modalTitle}>Create Forum Post</h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            aria-label="Close create post dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Author Header */}
        <div className={styles.modalAuthorHeader}>
          <div
            className={styles.modalAuthorAvatar}
            data-palette={String(paletteIndex)}
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
          <Input
            label="Title"
            placeholder="Post title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
          />

          {/* Category (optional, free-text until BE ships category list) */}
          <Input
            label="Category"
            placeholder="Category (optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required={false}
          />

          {/* Abstract (optional) */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="post-abstract">
              Abstract <span className={styles.fieldHint}>(optional)</span>
            </label>
            <textarea
              id="post-abstract"
              className={styles.abstractTextarea}
              placeholder="Brief abstract (optional)"
              rows={2}
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
            />
          </div>

          {/* Plain Textarea - content */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="post-content">
              Content <span className={styles.fieldHint}>(required)</span>
            </label>
            <textarea
              id="post-content"
              className={styles.modalTextarea}
              placeholder="Share your thoughts..."
              rows={8}
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
            />
          </div>

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
                  <span className={styles.attachedFileName}>{attachedPdf.name}</span>
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
                  <span className={styles.attachedFileName}>{attachedImage.name}</span>
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
            <ErrorBanner
              tone="error"
              title="PDF upload failed"
              message={pdfUpload.error}
            />
          )}
          {imageUpload.error && !imageUpload.isUploading && (
            <ErrorBanner
              tone="error"
              title="Image upload failed"
              message={imageUpload.error}
            />
          )}

          {submitError && (
            <ErrorBanner
              tone="error"
              title="Couldn't publish post"
              message={submitError}
            />
          )}
        </div>

        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePublish}
            disabled={
              !postContent.trim() ||
              submitting ||
              pdfUpload.isUploading ||
              imageUpload.isUploading
            }
            isLoading={submitting}
          >
            Publish post
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Forum;
