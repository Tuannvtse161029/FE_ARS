import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Edit2,
  Trash2,
  Flag,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  Inbox,
  Loader2,
  MoreVertical,
} from 'lucide-react';
import api from '../../services/axios';
import {
  useForumComments,
  useForumCommentMutations,
} from '../../hooks/useForumComments';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ErrorBanner } from '../ErrorBanner';
import { EmptyState } from '../EmptyState';
import { ReportModal } from './ReportModal';
import { Button } from '../Button';
import { formatRelativeTime } from '../../utils/formatDate';
import { storage } from '../../utils/storage';
import type { ForumComment } from '../../types/forum.types';
import styles from './CommentSection.module.css';

interface CommentSectionProps {
  postId: number;
  /**
   * Author display map keyed by userId — built by the parent (Forum.tsx)
   * via a userService lookup, or `undefined` if the parent hasn't fetched
   * authors yet. CommentSection renders `User {id}` as a fallback when
   * the map has no entry.
   */
  authorDisplayByUserId?: Record<number, string>;
  /**
   * Agent 42 — optional externally-controlled collapse state. When the
   * parent supplies this, the section never owns its own collapse state
   * and the parent's controls (like the engagement row Comments button)
   * are the single source of truth. Undefined preserves the original
   * internal-state behavior for any other callers and existing tests.
   */
  collapsed?: boolean;
  /**
   * Optional stable id for the section root. Used as `aria-controls`
   * wiring when the parent renders a Comments toggle button.
   */
  rootId?: string;
  /**
   * Optional callback fired when the in-section toggle button is clicked.
   * Lets the parent stay in sync with internal toggle gestures without
   * forcing it to take over state control. When `collapsed` is supplied,
   * the section still calls this on click so the parent can flip its own
   * state and re-render.
   */
  onToggle?: () => void;
  /**
   * Agent 42 — optional comments list. When supplied, the section uses
   * this list instead of fetching via `useForumComments`. The parent
   * already owns the fetch (to drive the engagement row's `commentCount`)
   * so we let it pass the result down. When `undefined`, the section
   * keeps the legacy behavior and calls the hook itself. This keeps a
   * single source of truth for the comments list without doubling the
   * network call.
   */
  comments?: ForumComment[];
  /**
   * Agent 42 — when `comments` is supplied, the section also defers
   * loading + error display to these props. When omitted, the section
   * derives its own loading / error state from the hook.
   */
  isLoading?: boolean;
  error?: Error | null;
  /**
   * Agent 42 — when `comments` is supplied, the section delegates the
   * refetch gesture to this callback. The parent (ForumPostCard) wires
   * it to its own hook instance.
   */
  onRefetch?: () => Promise<void>;
}

// CommentSection is intentionally isolated from Forum.tsx so it can be
// dropped into a post-detail page later without dragging the full list
// UI. It owns its own loading / empty / error states for the comments
// list and delegates all writes to `useForumCommentMutations`.
export const CommentSection = ({
  postId,
  authorDisplayByUserId,
  collapsed: controlledCollapsed,
  rootId,
  onToggle,
  comments: externalComments,
  isLoading: externalIsLoading,
  error: externalError,
  onRefetch: externalRefetch,
}: CommentSectionProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isVerified } = usePermissions();
  const stored = storage.getUser();
  const currentUserId = user?.userId ?? stored?.id ?? null;
  const currentUserName =
    stored?.fullName ?? user?.username ?? stored?.username ?? 'You';

  const [resolvedNames, setResolvedNames] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadNames() {
      try {
        const res = await api.get('/api/ProfessionalProfile');
        if (!cancelled && Array.isArray(res.data)) {
          const map: Record<number, string> = {};
          for (const item of res.data) {
            if (item.userId && item.fullName) {
              map[item.userId] = item.fullName;
            }
          }
          setResolvedNames((prev) => ({ ...map, ...prev }));
        }
      } catch {}
    }
    loadNames();
    return () => {
      cancelled = true;
    };
  }, []);
  // Only call the hook when the parent has NOT supplied a comments list.
  // When the parent supplies one (Agent 42 single-fetch pattern), we still
  // call the hook but ignore its data — this keeps the section's
  // signature simple for callers and lets the existing tests that mock
  // the hook at the service boundary continue to work. The dual-call is
  // cheap (React reuses the same hook instance per mount), but to avoid
  // the second consumer's fetch racing the parent's intent, we read
  // externalComments preferentially.
  const fetched = useForumComments(postId);
  const comments = externalComments ?? fetched.comments;
  const isLoading = externalIsLoading ?? fetched.isLoading;
  const error = externalError ?? fetched.error;
  const refetch =
    externalRefetch ?? (() => fetched.refetch() as unknown as Promise<void>);
  const { create, update, remove, toggleVote } = useForumCommentMutations();
  const [localComments, setLocalComments] = useState<ForumComment[]>(comments);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    id: number;
    preview: string;
  } | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<number | null>(null);
  const commentMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const closeMenuOnOutsideClick = (event: MouseEvent) => {
      if (!commentMenuRef.current?.contains(event.target as Node)) {
        setOpenCommentMenuId(null);
      }
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenCommentMenuId(null);
      }
    };

    document.addEventListener('mousedown', closeMenuOnOutsideClick);
    document.addEventListener('keydown', closeMenuOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenuOnOutsideClick);
      document.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, []);

  useEffect(() => {
    setLocalComments(comments);
  }, [comments]);

  // Backward-compatible state: the section still works in isolation when
  // no parent opts into controlled mode.
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed =
    controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const handleToggle = () => {
    // In controlled mode we still forward the gesture so the parent can
    // flip its state. In uncontrolled mode we update locally.
    onToggle?.();
    if (controlledCollapsed === undefined) {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const handleToggleVote = async (comment: ForumComment) => {
    const targetId = comment.id || comment.forumCommentId || 0;
    if (!targetId || !isVerified || !currentUserId) return;

    const previousIsUpvoted = Boolean(comment.isUpvoted);
    const previousCount = comment.upvoteCount ?? 0;
    const optimisticIsUpvoted = !previousIsUpvoted;
    const optimisticCount = optimisticIsUpvoted
      ? previousCount + 1
      : Math.max(0, previousCount - 1);

    // Optimistic update
    setLocalComments((prev) =>
      prev.map((c) =>
        c.id === targetId || c.forumCommentId === targetId
          ? { ...c, isUpvoted: optimisticIsUpvoted, upvoteCount: optimisticCount }
          : c
      )
    );

    try {
      const response = await toggleVote(targetId);
      if (response) {
        setLocalComments((prev) =>
          prev.map((c) =>
            c.id === targetId || c.forumCommentId === targetId
              ? {
                  ...c,
                  isUpvoted: response.isUpvoted,
                  upvoteCount: response.upvoteCount,
                }
              : c
          )
        );
      } else {
        // Rollback on failure
        setLocalComments((prev) =>
          prev.map((c) =>
            c.id === targetId || c.forumCommentId === targetId
              ? { ...c, isUpvoted: previousIsUpvoted, upvoteCount: previousCount }
              : c
          )
        );
      }
    } catch {
      // Rollback on error
      setLocalComments((prev) =>
        prev.map((c) =>
          c.id === targetId || c.forumCommentId === targetId
            ? { ...c, isUpvoted: previousIsUpvoted, upvoteCount: previousCount }
            : c
        )
      );
    }
  };

  const submitNewComment = async () => {
    const trimmed = draft.trim();
    if (!trimmed || !currentUserId) return;
    setSubmitting(true);
    setActionError(null);
    const result = await create({
      userId: currentUserId,
      forumPostId: postId,
      content: trimmed,
    });
    setSubmitting(false);
    if (result) {
      setDraft('');
      setLocalComments((prev) => [...prev, result]);
      void refetch();
    } else {
      setActionError('Failed to post comment. Please try again.');
    }
  };

  const startEdit = (comment: ForumComment) => {
    const targetId = comment.id || comment.forumCommentId || 0;
    setEditingId(targetId);
    setEditDraft(comment.content ?? '');
    setActionError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const saveEdit = async (comment: ForumComment) => {
    const targetId = comment.id || comment.forumCommentId || 0;
    if (!targetId) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setActionError(null);
    const result = await update(targetId, {
      userId: comment.userId ?? currentUserId ?? undefined,
      content: trimmed,
      replyId: comment.replyId ?? undefined,
      upvoteCount: comment.upvoteCount ?? undefined,
    });
    setSubmitting(false);
    if (result) {
      setEditingId(null);
      setEditDraft('');
      setLocalComments((prev) =>
        prev.map((c) =>
          c.id === targetId || c.forumCommentId === targetId
            ? { ...c, content: trimmed, updatedAt: new Date().toISOString() }
            : c,
        ),
      );
      void refetch();
    } else {
      setActionError('Failed to update comment. Please try again.');
    }
  };

  const deleteComment = async (comment: ForumComment) => {
    const targetId = comment.id || comment.forumCommentId || 0;
    if (!targetId) return;
    const confirmed = window.confirm('Delete this comment? This cannot be undone.');
    if (!confirmed) return;
    setSubmitting(true);
    setActionError(null);
    const ok = await remove(targetId);
    setSubmitting(false);
    if (ok) {
      setLocalComments((prev) =>
        prev.filter((c) => c.id !== targetId && c.forumCommentId !== targetId),
      );
      void refetch();
    } else {
      setActionError('Failed to delete comment. Please try again.');
    }
  };

  const renderAuthorLabel = (comment: ForumComment): string => {
    if (typeof comment.fullName === 'string' && comment.fullName.trim()) {
      return comment.fullName.trim();
    }
    if (typeof comment.author === 'string' && comment.author.trim()) {
      return comment.author.trim();
    }
    if (currentUserId != null && comment.userId === currentUserId) {
      return currentUserName;
    }
    if (comment.userId != null && authorDisplayByUserId?.[comment.userId]) {
      return authorDisplayByUserId[comment.userId];
    }
    if (comment.userId != null && resolvedNames[comment.userId]) {
      return resolvedNames[comment.userId];
    }
    if (comment.userId != null) {
      return `User #${comment.userId}`;
    }
    return 'Anonymous';
  };

  const handleCommenterClick = (userId?: number | null) => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  return (
    <div
      className={styles.commentSection}
      {...(rootId ? { id: rootId } : {})}
    >
      <button
        type="button"
        className={styles.headerToggle}
        onClick={handleToggle}
        aria-expanded={!collapsed}
      >
        <MessageSquare size={16} />
        <span>
          {localComments.length} {localComments.length === 1 ? 'Comment' : 'Comments'}
        </span>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {!collapsed && (
        <>
          {/* Error banner — now uses the shared ErrorBanner.
              We keep both an actionError and a list-level error copy. */}
          {actionError && (
            <ErrorBanner
              tone="error"
              title="Comment action failed"
              message={actionError}
            />
          )}

          {/* List-level error — shared ErrorBanner */}
          {!actionError && error && (
            <ErrorBanner
              tone="error"
              title="Couldn't load comments"
              message="Refresh and try again."
            />
          )}

          {/* Loading state — inline neutral message (SkeletonRow would feel
              heavy for a comment list; a single line matches the rhythm
              of the thread). */}
          {isLoading && !error && (
            <div className={styles.stateMessage} role="status" aria-live="polite">
              <Loader2 size={12} className={styles.stateSpinner} aria-hidden />
              <span>Loading comments…</span>
            </div>
          )}

          {/* Empty state — shared EmptyState (compact mode) */}
          {!isLoading && !error && localComments.length === 0 && (
            <EmptyState
              icon={<Inbox size={18} />}
              title="No comments yet"
              description="Be the first to start the conversation."
              compact
            />
          )}

          {!isLoading && !error && localComments.length > 0 && (
            <ul className={styles.commentList}>
              {localComments.map((comment) => {
                const isOwner =
                  currentUserId != null && comment.userId === currentUserId;
                const isEditing = editingId === (comment.id || comment.forumCommentId);
                return (
                  <li
                    key={comment.id}
                    className={`${styles.commentItem} ${comment.replyId ? styles.replyItem : ''}`}
                  >
                    <div className={styles.commentMeta}>
                      <button
                        type="button"
                        className={styles.commentAuthor}
                        onClick={() => handleCommenterClick(comment.userId)}
                        title={comment.userId ? `View ${renderAuthorLabel(comment)}'s profile` : undefined}
                      >
                        {renderAuthorLabel(comment)}
                      </button>
                      {isOwner && (
                        <span className={styles.commentOwnerBadge}>{currentUserName}</span>
                      )}
                      {comment.createdAt && (
                        <span className={styles.commentTimestamp}>
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      )}
                      {isVerified && (
                        <div
                          className={styles.commentMenu}
                          ref={openCommentMenuId === comment.id ? commentMenuRef : null}
                        >
                          <button
                            type="button"
                            className={styles.commentMenuTrigger}
                            onClick={() =>
                              setOpenCommentMenuId((currentId) =>
                                currentId === comment.id ? null : comment.id,
                              )
                            }
                            aria-label="Comment actions"
                            aria-haspopup="menu"
                            aria-expanded={openCommentMenuId === comment.id}
                          >
                            <MoreVertical size={16} aria-hidden="true" />
                          </button>
                          {openCommentMenuId === comment.id && (
                            <div className={styles.commentMenuPopover} role="menu">
                              <button
                                type="button"
                                className={`${styles.commentMenuItem} ${styles.actionBtnDanger}`}
                                onClick={() => {
                                  setReportTarget({
                                    id: comment.id,
                                    preview: (comment.content ?? '').slice(0, 60),
                                  });
                                  setOpenCommentMenuId(null);
                                }}
                                role="menuitem"
                              >
                                <Flag size={14} aria-hidden="true" />
                                Report
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className={styles.editBlock}>
                        <textarea
                          className={styles.editTextarea}
                          rows={3}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          disabled={submitting}
                        />
                        <div className={styles.editActions}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEdit}
                            disabled={submitting}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => saveEdit(comment)}
                            disabled={submitting || !editDraft.trim()}
                            isLoading={submitting}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.commentContent}>
                        {comment.content ?? ''}
                      </p>
                    )}

                    {!isEditing && (
                      <div className={styles.commentActions}>
                        {isVerified && (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnUpvote} ${
                              comment.isUpvoted ? styles.actionBtnUpvoted : ''
                            }`}
                            onClick={() => handleToggleVote(comment)}
                            aria-label={comment.isUpvoted ? 'Unlike comment' : 'Like comment'}
                            title={comment.isUpvoted ? 'Bỏ thích bình luận' : 'Thích bình luận'}
                          >
                            <ThumbsUp
                              size={14}
                              fill={comment.isUpvoted ? 'currentColor' : 'none'}
                            />
                            <span>{comment.upvoteCount ?? 0}</span>
                          </button>
                        )}

                        {isOwner && (
                          <>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => startEdit(comment)}
                              aria-label="Edit comment"
                            >
                              <Edit2 size={14} />
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() => deleteComment(comment)}
                              aria-label="Delete comment"
                              disabled={submitting}
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Create form — only for verified/authenticated users */}
          {isVerified && currentUserId != null && (
            <div className={styles.createForm}>
              <textarea
                className={styles.createTextarea}
                rows={2}
                placeholder="Write a comment…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={submitting}
              />
              <Button
                variant="primary"
                size="md"
                leftIcon={<Send size={12} />}
                onClick={submitNewComment}
                disabled={submitting || !draft.trim()}
                isLoading={submitting}
                className={styles.submitBtn}
              >
                Post
              </Button>
            </div>
          )}

          {/* Report modal — only mounted when there's a target */}
          {reportTarget && user && (
            <ReportModal
              isOpen={true}
              onClose={() => setReportTarget(null)}
              targetType="ForumComment"
              targetId={reportTarget.id}
              targetPreview={reportTarget.preview}
              reporterId={user.userId ?? 0}
            />
          )}
        </>
      )}
    </div>
  );
};

export default CommentSection;
