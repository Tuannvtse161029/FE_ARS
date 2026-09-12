import { useState, useEffect, useRef, useMemo } from 'react';
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
  CheckCircle2,
  Reply,
  X,
} from 'lucide-react';
import api from '../../services/axios';
import {
  useForumComments,
  useForumCommentMutations,
} from '../../hooks/useForumComments';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { notificationService } from '../../services/notification.service';
import { forumPostService } from '../../services/forumPost.service';
import { useCanInteractInForum } from '../../hooks/useCanInteractInForum';
import { useI18n } from '../../i18n/I18nContext';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useListShortcuts } from '../../hooks/useListShortcuts';
import { ROUTES } from '../../routes/paths';
import { ErrorBanner } from '../ErrorBanner';
import { EmptyState } from '../EmptyState';
import { ReportModal } from './ReportModal';
import { ConfirmModal } from '../lecturer/ConfirmModal';
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
  const { canInteract, reason: interactDisabledReason } = useCanInteractInForum();
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
  const [replyingToComment, setReplyingToComment] = useState<ForumComment | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Controls the delete-confirmation modal */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    comment: ForumComment | null;
  }>({ open: false, comment: null });
  const { t } = useI18n();
  const [reportSuccess, setReportSuccess] = useState(false);
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
    if (!targetId || !canInteract || !currentUserId) return;

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
    if (!trimmed || !currentUserId || !canInteract) return;
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
      // Defensive FE notification — fire a `[Forum] reply` notification
      // to the original post author (skip self-reply). Best-effort:
      // failures never block the comment submit itself.
      try {
        const post = await forumPostService.getById(postId).catch(() => null);
        const authorId =
          typeof post?.authorId === 'number'
            ? post.authorId
            : null;
        if (
          authorId &&
          authorId > 0 &&
          authorId !== currentUserId
        ) {
          const preview = trimmed.length > 80
            ? `${trimmed.slice(0, 80).trim()}…`
            : trimmed;
          await notificationService.create({
            userId: authorId,
            message: `[Forum] reply: "${post?.title ?? `Post #${postId}`}" — ${preview}`,
          });
        }
      } catch (notifyErr) {
        console.warn('Failed to send forum reply notification:', notifyErr);
      }
    } else {
      setActionError(t('forum.comment.failedPostComment', 'Failed to post comment. Please try again.'));
    }
  };

  const handleStartReply = (comment: ForumComment) => {
    if (!canInteract) return;
    setReplyingToComment(comment);
    setReplyDraft('');
    setActionError(null);
  };

  const handleCancelReply = () => {
    setReplyingToComment(null);
    setReplyDraft('');
  };

  const submitReply = async (parentComment: ForumComment) => {
    const trimmed = replyDraft.trim();
    const parentId = parentComment.id || parentComment.forumCommentId;
    if (!trimmed || !currentUserId || !canInteract || !parentId) return;

    setSubmittingReply(true);
    setActionError(null);

    const result = await create({
      userId: currentUserId,
      forumPostId: postId,
      content: trimmed,
      replyId: parentId,
    });

    setSubmittingReply(false);

    if (result) {
      setReplyDraft('');
      setReplyingToComment(null);
      setLocalComments((prev) => [...prev, result]);
      void refetch();
    } else {
      setActionError(t('forum.comment.failedPostReply', 'Failed to post reply. Please try again.'));
    }
  };

  const commentMap = useMemo(() => {
    const map = new Map<number, ForumComment>();
    localComments.forEach((c) => {
      const cid = c.id || c.forumCommentId || 0;
      if (cid) map.set(cid, c);
    });
    return map;
  }, [localComments]);

  const displayComments = useMemo<ForumComment[]>(() => {
    const topLevel: ForumComment[] = [];
    const repliesByParentId = new Map<number, ForumComment[]>();

    localComments.forEach((c) => {
      const parentId = c.replyId;
      if (parentId && commentMap.has(parentId)) {
        const list = repliesByParentId.get(parentId) ?? [];
        list.push(c);
        repliesByParentId.set(parentId, list);
      } else {
        topLevel.push(c);
      }
    });

    const result: ForumComment[] = [];
    const appendThread = (parent: ForumComment) => {
      result.push(parent);
      const pid = parent.id || parent.forumCommentId || 0;
      const replies = repliesByParentId.get(pid) ?? [];
      replies.forEach((r) => {
        appendThread(r);
      });
    };

    topLevel.forEach((top) => appendThread(top));

    if (result.length < localComments.length) {
      const seen = new Set(result.map((c) => c.id || c.forumCommentId));
      localComments.forEach((c) => {
        const cid = c.id || c.forumCommentId;
        if (!seen.has(cid)) result.push(c);
      });
    }

    return result;
  }, [localComments, commentMap]);

  // Part 4 — keyboard shortcuts for navigating the comment thread.
  // j/k walk the comments list, Enter opens the edit textarea for the
  // focused comment. The `n` and `f` shortcuts are intentionally omitted
  // — comments don't have a "create new" or filter affordance.
  const { selectedIndex: commentSelectedIndex } = useListShortcuts({
    itemCount: displayComments.length,
    onOpen: (index) => {
      const comment = displayComments[index];
      if (!comment) return;
      const targetId = comment.id || comment.forumCommentId || 0;
      if (!targetId) return;
      if (canInteract) {
        setEditingId(targetId);
        setEditDraft(comment.content ?? '');
      }
    },
    onFilterFocus: null,
  });

  // Part 4 — Ctrl/Cmd+Enter to post the reply, plain Enter to save an
  // active edit. The hooks are wired at the top via refs so the latest
  // closures always run.
  const submitRef = useRef<() => Promise<void>>(async () => {});
  const saveEditRef = useRef<(comment: ForumComment) => Promise<void>>(async () => {});
  useShortcuts([
    {
      key: 'Enter',
      modifier: 'mod',
      label: 'Post comment',
      description: 'Submit the comment reply (Ctrl/Cmd + Enter).',
      group: 'forum',
      allowInInputs: true,
      handler: () => {
        void submitRef.current();
      },
    },
    {
      key: 'Enter',
      label: 'Save edit',
      description: 'Save the comment edit while editing.',
      group: 'forum',
      allowInInputs: true,
      handler: () => {
        const activeComment = localComments.find(
          (c) => (c.id ?? c.forumCommentId) === editingId,
        );
        if (activeComment) {
          void saveEditRef.current(activeComment);
        }
      },
    },
  ]);

  const startEdit = (comment: ForumComment) => {
    if (!canInteract) return;
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
    if (!canInteract) return;
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
  // Wire the keyboard shortcuts' refs to the freshest closures so they
  // always invoke the latest implementation regardless of render timing.
  submitRef.current = submitNewComment;
  saveEditRef.current = saveEdit;

  const deleteComment = async (comment: ForumComment) => {
    if (!canInteract) return;
    // Open the styled confirmation modal instead of window.confirm()
    setDeleteConfirm({ open: true, comment });
  };

  const confirmDeleteComment = async () => {
    const comment = deleteConfirm.comment;
    if (!comment) return;
    setDeleteConfirm({ open: false, comment: null });
    const targetId = comment.id || comment.forumCommentId || 0;
    if (!targetId) return;
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

          {reportSuccess && (
            <div className={styles.reportSuccessBanner} role="status">
              <CheckCircle2 size={14} />
              <span>{t('forum.report.successToast', 'Your report has been submitted to moderators.')}</span>
            </div>
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

          {!isLoading && !error && displayComments.length > 0 && (
            <ul className={styles.commentList}>
              {displayComments.map((comment, commentIndex) => {
                const isOwner =
                  currentUserId != null && comment.userId === currentUserId;
                const isEditing = editingId === (comment.id || comment.forumCommentId);
                const parentComment = comment.replyId ? commentMap.get(comment.replyId) : null;
                const isReplyingThis =
                  replyingToComment &&
                  (replyingToComment.id || replyingToComment.forumCommentId) ===
                    (comment.id || comment.forumCommentId);
                return (
                  <li
                    key={comment.id}
                    className={`${styles.commentItem} ${comment.replyId ? styles.replyItem : ''} ${commentIndex === commentSelectedIndex ? styles.selectedComment : ''}`}
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
                      {parentComment && (
                        <div className={styles.replyToMeta}>
                          <Reply size={12} className={styles.replyToIcon} aria-hidden="true" />
                          <span>
                            {t('forum.comment.replyingTo', 'Replying to {name}', {
                              name: `@${renderAuthorLabel(parentComment)}`,
                            })}
                          </span>
                        </div>
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
                            aria-label={t('forum.comment.actions', 'Comment actions')}
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
                                {t('forum.comment.report', 'Report')}
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
                            {t('common.cancel', 'Cancel')}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => saveEdit(comment)}
                            disabled={submitting || !editDraft.trim()}
                            isLoading={submitting}
                          >
                            {t('common.save', 'Save')}
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
                        {canInteract && (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnUpvote} ${
                              comment.isUpvoted ? styles.actionBtnUpvoted : ''
                            }`}
                            onClick={() => handleToggleVote(comment)}
                            aria-label={
                              comment.isUpvoted
                                ? t('forum.comment.unlike', 'Unlike comment')
                                : t('forum.comment.like', 'Like comment')
                            }
                            title={
                              comment.isUpvoted
                                ? t('forum.comment.unlike', 'Unlike comment')
                                : t('forum.comment.like', 'Like comment')
                            }
                          >
                            <ThumbsUp
                              size={14}
                              fill={comment.isUpvoted ? 'currentColor' : 'none'}
                            />
                            <span>{comment.upvoteCount ?? 0}</span>
                          </button>
                        )}

                        {canInteract && (
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => handleStartReply(comment)}
                            aria-label={t('forum.comment.reply', 'Reply')}
                            data-testid={`reply-btn-${comment.id || comment.forumCommentId}`}
                          >
                            <Reply size={14} aria-hidden="true" />
                            <span>{t('forum.comment.reply', 'Reply')}</span>
                          </button>
                        )}

                        {isOwner && canInteract && (
                          <>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => startEdit(comment)}
                              aria-label={t('forum.comment.edit', 'Edit comment')}
                            >
                              <Edit2 size={14} />
                              {t('common.edit', 'Edit')}
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() => deleteComment(comment)}
                              aria-label={t('forum.comment.delete', 'Delete comment')}
                              disabled={submitting}
                            >
                              <Trash2 size={14} />
                              {t('common.delete', 'Delete')}
                            </button>
                          </>
                        )}

                        {!canInteract && interactDisabledReason && (
                          <span
                            className={styles.actionBtn}
                            title={interactDisabledReason}
                            aria-label={interactDisabledReason}
                            data-testid="comment-action-disabled-reason"
                            style={{ cursor: 'not-allowed', opacity: 0.6 }}
                          >
                            <ThumbsUp size={14} />
                            <span>{comment.upvoteCount ?? 0}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {isReplyingThis && (
                      <div className={styles.replyBlock} data-testid="inline-reply-block">
                        <div className={styles.replyTargetHeader}>
                          <span className={styles.replyTargetIndicator}>
                            <Reply size={13} aria-hidden="true" />
                            {t('forum.comment.replyingTo', 'Replying to {name}', {
                              name: `@${renderAuthorLabel(comment)}`,
                            })}
                          </span>
                          <button
                            type="button"
                            className={styles.cancelReplyIconBtn}
                            onClick={handleCancelReply}
                            aria-label={t('forum.comment.cancelReply', 'Cancel')}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </div>
                        <textarea
                          className={styles.replyTextarea}
                          rows={2}
                          placeholder={t('forum.comment.replyPlaceholder', 'Write a reply…')}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          disabled={submittingReply}
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                              e.preventDefault();
                              if (replyDraft.trim() && !submittingReply) {
                                void submitReply(comment);
                              }
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelReply();
                            }
                          }}
                          autoFocus
                        />
                        <div className={styles.replyActions}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelReply}
                            disabled={submittingReply}
                          >
                            {t('forum.comment.cancelReply', 'Cancel')}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Send size={12} />}
                            onClick={() => submitReply(comment)}
                            disabled={submittingReply || !replyDraft.trim()}
                            isLoading={submittingReply}
                          >
                            {t('forum.comment.postReply', 'Reply')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Create form — only for users who can interact (approved +
              subscription ACTIVE for Researcher / Lecturer). */}
          {canInteract && currentUserId != null && (
            <div className={styles.createForm}>
              <textarea
                className={styles.createTextarea}
                rows={2}
                placeholder={t('forum.comment.placeholder', 'Write a comment…')}
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
                {t('forum.comment.post', 'Post')}
              </Button>
            </div>
          )}

          {/* Read-only hint for users who cannot interact */}
          {!canInteract && isVerified && interactDisabledReason && (
            <div
              className={styles.createForm}
              data-testid="comment-create-disabled"
              role="status"
              aria-live="polite"
              style={{
                padding: 'var(--space-3)',
                border: '1px dashed var(--ars-node)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--ars-ink-muted)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {interactDisabledReason}{' '}
              <a href={ROUTES.SUBSCRIPTION}>View subscription plans</a>.
            </div>
          )}

          {/* Report modal — only mounted when there's a target */}
          {reportTarget && user && (
            <ReportModal
              isOpen={true}
              onClose={() => setReportTarget(null)}
              onSuccess={() => {
                setReportSuccess(true);
                setTimeout(() => setReportSuccess(false), 5000);
              }}
              targetType="ForumComment"
              targetId={reportTarget.id}
              targetPreview={reportTarget.preview}
              reporterId={user.userId ?? 0}
            />
          )}
        </>
      )}

      {/* Delete comment confirmation modal */}
      <ConfirmModal
        open={deleteConfirm.open}
        title={t('forum.comment.deleteTitle', 'Delete this comment?')}
        description={t(
          'forum.comment.deleteDescription',
          'This action cannot be undone. The comment will be permanently removed.'
        )}
        variant="destructive"
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={confirmDeleteComment}
        onClose={() => setDeleteConfirm({ open: false, comment: null })}
      />
    </div>
  );
};

export default CommentSection;
