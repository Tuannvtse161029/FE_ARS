import { useState } from 'react';
import {
  MessageSquare,
  Send,
  Edit2,
  Trash2,
  Flag,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  useForumComments,
  useForumCommentMutations,
} from '../../hooks/useForumComments';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ReportModal } from './ReportModal';
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
}

// CommentSection is intentionally isolated from Forum.tsx so it can be
// dropped into a post-detail page later without dragging the full list
// UI. It owns its own loading / empty / error states for the comments
// list and delegates all writes to `useForumCommentMutations`.
export const CommentSection = ({
  postId,
  authorDisplayByUserId,
}: CommentSectionProps) => {
  const { user } = useAuth();
  const { isVerified } = usePermissions();
  const { comments, isLoading, error, refetch } = useForumComments(postId);
  const { create, update, remove } = useForumCommentMutations();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    id: number;
    preview: string;
  } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const currentUserId = user?.userId;

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
      await refetch();
    } else {
      setActionError('Failed to post comment. Please try again.');
    }
  };

  const startEdit = (comment: ForumComment) => {
    setEditingId(comment.id);
    setEditDraft(comment.content ?? '');
    setActionError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const saveEdit = async (comment: ForumComment) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setActionError(null);
    const result = await update(comment.id, {
      userId: comment.userId ?? currentUserId ?? undefined,
      content: trimmed,
      replyId: comment.replyId ?? undefined,
      upvoteCount: comment.upvoteCount ?? undefined,
    });
    setSubmitting(false);
    if (result) {
      setEditingId(null);
      setEditDraft('');
      await refetch();
    } else {
      setActionError('Failed to update comment. Please try again.');
    }
  };

  const deleteComment = async (comment: ForumComment) => {
    const confirmed = window.confirm('Delete this comment? This cannot be undone.');
    if (!confirmed) return;
    setSubmitting(true);
    setActionError(null);
    const ok = await remove(comment.id);
    setSubmitting(false);
    if (ok) {
      await refetch();
    } else {
      setActionError('Failed to delete comment. Please try again.');
    }
  };

  const renderAuthorLabel = (comment: ForumComment): string => {
    if (comment.userId == null) return 'Anonymous';
    const cached = authorDisplayByUserId?.[comment.userId];
    return cached ?? `User ${comment.userId}`;
  };

  return (
    <div className={styles.commentSection}>
      <button
        type="button"
        className={styles.headerToggle}
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        <MessageSquare size={16} />
        <span>
          {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
        </span>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {!collapsed && (
        <>
          {/* Error banner */}
          {actionError && (
            <div className={styles.errorBanner} role="alert">
              <AlertCircle size={14} />
              {actionError}
            </div>
          )}

          {/* Loading / empty / error states for the list itself */}
          {isLoading && (
            <div className={styles.stateMessage}>Loading comments…</div>
          )}

          {!isLoading && error && (
            <div className={styles.stateMessage} role="alert">
              Failed to load comments.
            </div>
          )}

          {!isLoading && !error && comments.length === 0 && (
            <div className={styles.stateMessage}>
              No comments yet. Be the first to start the conversation.
            </div>
          )}

          {!isLoading && !error && comments.length > 0 && (
            <ul className={styles.commentList}>
              {comments.map((comment) => {
                const isOwner =
                  currentUserId != null && comment.userId === currentUserId;
                const isEditing = editingId === comment.id;
                return (
                  <li key={comment.id} className={styles.commentItem}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentAuthor}>
                        {renderAuthorLabel(comment)}
                      </span>
                      {comment.createdAt && (
                        <span className={styles.commentTimestamp}>
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
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
                          <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={cancelEdit}
                            disabled={submitting}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={styles.saveBtn}
                            onClick={() => saveEdit(comment)}
                            disabled={submitting || !editDraft.trim()}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.commentContent}>
                        {comment.content ?? ''}
                      </p>
                    )}

                    {!isEditing && isVerified && (
                      <div className={styles.commentActions}>
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
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() =>
                            setReportTarget({
                              id: comment.id,
                              preview: (comment.content ?? '').slice(0, 60),
                            })
                          }
                          aria-label="Report comment"
                        >
                          <Flag size={14} />
                          Report
                        </button>
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
              <button
                type="button"
                className={styles.submitBtn}
                onClick={submitNewComment}
                disabled={submitting || !draft.trim()}
              >
                <Send size={14} />
                {submitting ? 'Posting…' : 'Post'}
              </button>
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