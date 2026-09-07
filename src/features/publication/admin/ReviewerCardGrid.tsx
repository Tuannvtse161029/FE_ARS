/**
 * ReviewerCardGrid — Admin reviewer directory for the Assign Reviewer action.
 *
 * Replaces the legacy "enter a Reviewer ID manually" input. The grid surfaces
 * the data admins actually need to pick well: avatar, full name, professional
 * profile (H-index, citations, publications), major + sub field, and pending
 * review load. Sorts so the best matches surface first.
 *
 * Sort (3-tier):
 *   1. Reviewers whose `subFieldId` matches the paper's `subFieldId` → "Best match"
 *   2. Then ascending pending-review count (workload-balanced)
 *   3. Then alphabetical by full name
 *
 * 9 cards per page (3×3). The grid supports two interaction modes:
 *   - single-select (default): each card has an "Assign" button
 *   - multi-select: a mode-toggle button switches the grid into a checkbox
 *     layout where the admin can pick up to 3 reviewers and confirm them as a
 *     batch via the parent's `onAssignMany(reviewerIds[])` callback.
 *
 * The grid still owns its confirmation / feedback modals so the caller does
 * not need to render any extra UI.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  Loader2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { reviewerService, type ReviewerProfile } from '../../../services/reviewer.service';
import { reviewRequestService } from '../../../services/reviewRequest.service';
import { userService } from '../../../services/user.service';
import type { User } from '../../../types/auth';
import styles from './ReviewerCardGrid.module.css';

interface ReviewerCardGridProps {
  paperSubFieldId: number | null | undefined;
  paperSubFieldName?: string | null;
  currentReviewerId?: number | null;
  /** True while the parent is dispatching the assign request. */
  isAssigning: boolean;
  /** Receives the chosen reviewer ID; resolves when the assign succeeds and
   *  rejects when it fails. The grid maps those outcomes to its own feedback
   *  modal, so the caller does not need to render any extra UI. */
  onAssign: (reviewerId: number) => Promise<void>;
  /** Receives up to 3 reviewer IDs when the admin uses the multi-select
   *  confirm action. The grid enforces the 3-reviewer cap. */
  onAssignMany?: (reviewerIds: number[]) => Promise<void>;
  /** Maximum number of reviewers allowed in multi-select mode. Defaults
   *  to 3, which is the BE cap for manual reviewer assignment. */
  maxBatchSize?: number;
}

interface ReviewerRow {
  user: User;
  profile: ReviewerProfile | null;
  pendingCount: number;
}

type ConfirmState =
  | { kind: 'single'; reviewer: ReviewerRow }
  | { kind: 'batch'; reviewers: ReviewerRow[] }
  | null;

type FeedbackState =
  | { kind: 'success'; reviewerName: string; reviewerCount?: number }
  | { kind: 'error'; message: string }
  | null;

const PAGE_SIZE = 9;

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatNumber = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return n.toLocaleString();
};

// Map a raw review-request status string to the two values that count as
// "pending work" for workload balancing. Anything terminal or cancelled is
// excluded — we only want outstanding assignments on the count.
const isPendingReview = (status: string | null | undefined): boolean => {
  const normalized = (status ?? '').trim().toUpperCase();
  return normalized === 'PENDING' || normalized === 'IN_PROGRESS';
};

export const ReviewerCardGrid = ({
  paperSubFieldId,
  paperSubFieldName,
  currentReviewerId,
  isAssigning,
  onAssign,
  onAssignMany,
  maxBatchSize = 3,
}: ReviewerCardGridProps): JSX.Element => {
  const [reviewers, setReviewers] = useState<ReviewerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  // Multi-select state. When `multiSelect` is true, cards render a
  // selection circle instead of a per-card "Assign" button and the
  // toolbar exposes a batch-assign action.
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const supportsBatchAssign = typeof onAssignMany === 'function';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      userService.getAllUsers().then((res) => res.items),
      reviewerService.getAll().catch(() => [] as ReviewerProfile[]),
      reviewRequestService.getAll().catch(() => []),
    ])
      .then(([users, profiles, requests]) => {
        if (!active) return;

        const profileMap = new Map<number, ReviewerProfile>();
        profiles.forEach((p) => profileMap.set(p.userId, p));

        const pendingMap = new Map<number, number>();
        for (const r of requests) {
          if (!isPendingReview(r.status)) continue;
          const reviewerId = Number(r.reviewerId);
          if (!Number.isInteger(reviewerId) || reviewerId <= 0) continue;
          pendingMap.set(reviewerId, (pendingMap.get(reviewerId) ?? 0) + 1);
        }

        const rows: ReviewerRow[] = users
          .filter((u) => (u.roleName ?? '').trim().toLowerCase() === 'reviewer')
          .map((user) => ({
            user,
            profile: profileMap.get(user.id) ?? null,
            pendingCount: pendingMap.get(user.id) ?? 0,
          }));

        setReviewers(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load reviewers.');
        setReviewers([]);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sorted = useMemo(() => {
    const trimmed = search.trim();
    const filtered = trimmed
      ? reviewers.filter((r) => {
          const hay = [
            r.user.fullName ?? '',
            r.user.email,
            r.profile?.subFieldName ?? '',
            r.profile?.majorFieldName ?? '',
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(trimmed.toLowerCase());
        })
      : reviewers;

    return [...filtered].sort((a, b) => {
      const aMatch =
        paperSubFieldId != null && a.profile?.subFieldId === paperSubFieldId ? 0 : 1;
      const bMatch =
        paperSubFieldId != null && b.profile?.subFieldId === paperSubFieldId ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      if (a.pendingCount !== b.pendingCount) return a.pendingCount - b.pendingCount;
      return (a.user.fullName ?? '').localeCompare(b.user.fullName ?? '');
    });
  }, [reviewers, search, paperSubFieldId]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  // Reset to page 1 whenever the search filter changes so the user never
  // lands on an empty page after narrowing the results.
  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleConfirm = async (state: Exclude<ConfirmState, null>) => {
    setConfirm(null);
    try {
      if (state.kind === 'single') {
        await onAssign(state.reviewer.user.id);
        const reviewerName = state.reviewer.user.fullName?.trim() ||
          `Reviewer #${state.reviewer.user.id}`;
        setFeedback({ kind: 'success', reviewerName });
      } else {
        // Batch assign. Caller is responsible for the BE call.
        const ids = state.reviewers.map((row) => row.user.id);
        if (onAssignMany) {
          await onAssignMany(ids);
        } else {
          // Should not be reachable — batch confirm is only opened when
          // the parent supplied onAssignMany — but guard anyway.
          throw new Error('Batch assign is not supported by the parent.');
        }
        const joined = state.reviewers
          .map((row) => row.user.fullName?.trim() || `Reviewer #${row.user.id}`)
          .join(', ');
        setFeedback({
          kind: 'success',
          reviewerName: joined,
          reviewerCount: state.reviewers.length,
        });
        // Clear the multi-select basket on success — the paper now has its
        // reviewers, and the admin can switch back to single-select mode
        // (or start a fresh batch) without stale selections lingering.
        setSelectedIds(new Set());
      }
    } catch (e) {
      setFeedback({
        kind: 'error',
        message:
          e instanceof Error ? e.message : 'The reviewer(s) could not be assigned.',
      });
    }
  };

  const toggleSelect = (row: ReviewerRow): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.user.id)) {
        next.delete(row.user.id);
        return next;
      }
      // Cap the selection at the BE-enforced maximum. If we are already at
      // the cap, refuse the new selection rather than silently dropping it
      // — admins need to see why a click "did nothing".
      if (next.size >= maxBatchSize) {
        setFeedback({
          kind: 'error',
          message: `You can assign at most ${maxBatchSize} reviewers at once. Remove one first.`,
        });
        return prev;
      }
      next.add(row.user.id);
      return next;
    });
  };

  const exitMultiSelect = (): void => {
    setMultiSelect(false);
    setSelectedIds(new Set());
  };

  const selectedRows = useMemo<ReviewerRow[]>(
    () => reviewers.filter((row) => selectedIds.has(row.user.id)),
    [reviewers, selectedIds],
  );

  if (loading) {
    return (
      <div className={styles.shell} aria-busy="true" aria-live="polite">
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} aria-hidden="true" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.shell}>
        <div className={styles.errorState} role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <p>Could not load the reviewer directory.</p>
          <small>{error}</small>
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className={styles.shell}>
        <div className={styles.emptyState} role="status">
          <Users size={20} aria-hidden="true" />
          <p>
            {reviewers.length === 0
              ? 'No reviewers are registered in the system yet.'
              : 'No reviewers match your search.'}
          </p>
          <small>
            {reviewers.length === 0
              ? 'Ask Admin to invite reviewers, or use Auto-assign once a profile exists.'
              : 'Try a different name, email, or field keyword.'}
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLabel}>
          {multiSelect
            ? `Pick up to ${maxBatchSize} reviewers`
            : 'Choose a reviewer'}
          <span className={styles.toolbarCount}>
            {sorted.length} reviewer{sorted.length === 1 ? '' : 's'}
            {paperSubFieldId != null && paperSubFieldName
              ? ` · subfield: ${paperSubFieldName}`
              : ''}
            {multiSelect
              ? ` · ${selectedIds.size}/${maxBatchSize} selected`
              : ''}
          </span>
        </div>
        <div className={styles.toolbarActions}>
          <input
            className={styles.search}
            type="text"
            placeholder="Search by name, email, or field"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search reviewers"
          />
          {supportsBatchAssign ? (
            <button
              type="button"
              className={`${styles.modeToggle} ${multiSelect ? styles.modeToggleActive : ''}`}
              onClick={() => (multiSelect ? exitMultiSelect() : setMultiSelect(true))}
              disabled={isAssigning}
              aria-pressed={multiSelect}
              title={
                multiSelect
                  ? 'Switch back to assigning one reviewer at a time.'
                  : `Pick up to ${maxBatchSize} reviewers and assign them in a single batch.`
              }
              data-testid="reviewer-multi-toggle"
            >
              {multiSelect ? (
                <>
                  <X size={14} aria-hidden="true" /> Exit multi-select
                </>
              ) : (
                <>
                  <CircleCheck size={14} aria-hidden="true" /> Pick multiple
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {multiSelect ? (
        <div className={styles.batchBar} role="status" aria-live="polite">
          <span className={styles.batchBarText}>
            {selectedIds.size === 0
              ? 'Tick up to 3 reviewers to assign them together.'
              : `${selectedIds.size} reviewer${selectedIds.size === 1 ? '' : 's'} selected.`}
          </span>
          <button
            type="button"
            className={styles.batchConfirm}
            disabled={isAssigning || selectedIds.size === 0}
            onClick={() => {
              if (selectedRows.length === 0) return;
              setConfirm({ kind: 'batch', reviewers: selectedRows });
            }}
            data-testid="reviewer-batch-confirm"
          >
            <CircleCheck size={14} aria-hidden="true" />
            Assign {selectedIds.size || ''} reviewer{selectedIds.size === 1 ? '' : 's'}
          </button>
        </div>
      ) : null}

      <div className={styles.grid}>
        {pageItems.map((row) => {
          const isMatch =
            paperSubFieldId != null && row.profile?.subFieldId === paperSubFieldId;
          const isCurrent = currentReviewerId != null && row.user.id === currentReviewerId;
          const isSelected = selectedIds.has(row.user.id);
          return (
            <article
              key={row.user.id}
              className={[
                styles.card,
                isMatch ? styles.cardMatch : '',
                isCurrent ? styles.cardCurrent : '',
                isSelected ? styles.cardSelected : '',
                multiSelect ? styles.cardSelectable : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`Reviewer ${row.user.fullName ?? row.user.id}`}
              data-testid={`reviewer-card-${row.user.id}`}
              onClick={
                multiSelect
                  ? () => {
                      if (!isAssigning) toggleSelect(row);
                    }
                  : undefined
              }
              role={multiSelect ? 'button' : undefined}
              aria-pressed={multiSelect ? isSelected : undefined}
              tabIndex={multiSelect ? 0 : undefined}
              onKeyDown={
                multiSelect
                  ? (event) => {
                      if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault();
                        if (!isAssigning) toggleSelect(row);
                      }
                    }
                  : undefined
              }
            >
              <div className={styles.cardTopRow}>
                <div className={styles.identity}>
                  {row.user.avatarUrl ? (
                    <img
                      className={styles.avatar}
                      src={row.user.avatarUrl}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.avatarFallback} aria-hidden="true">
                      {initials(row.user.fullName ?? row.user.email)}
                    </div>
                  )}
                  <div className={styles.identityText}>
                    <h4 className={styles.name}>
                      {row.user.fullName?.trim() || `Reviewer #${row.user.id}`}
                    </h4>
                    <p className={styles.email} title={row.user.email}>
                      {row.user.email}
                    </p>
                  </div>
                </div>
                <div className={styles.cardTopBadges}>
                  {multiSelect ? (
                    <span
                      className={`${styles.selectCircle} ${isSelected ? styles.selectCircleOn : ''}`}
                      aria-hidden="true"
                    >
                      {isSelected ? <CircleCheck size={14} /> : <Circle size={14} />}
                    </span>
                  ) : null}
                  {isMatch ? (
                    <span
                      className={styles.matchBadge}
                      title={`Matches the paper's subfield${paperSubFieldName ? `: ${paperSubFieldName}` : ''}`}
                    >
                      <Sparkles size={11} aria-hidden="true" /> Best match
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Professional profile</div>
                <div className={styles.statRow}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {formatNumber(row.profile?.hindex)}
                    </span>
                    <span className={styles.statLabel}>H-Index</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {formatNumber(row.profile?.totalCitations)}
                    </span>
                    <span className={styles.statLabel}>Citations</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {formatNumber(row.profile?.publicationCount)}
                    </span>
                    <span className={styles.statLabel}>Publications</span>
                  </div>
                </div>
              </div>

              <dl className={styles.fields}>
                <div>
                  <dt>Major field</dt>
                  <dd>{row.profile?.majorFieldName?.trim() || '—'}</dd>
                </div>
                <div>
                  <dt>Sub field</dt>
                  <dd>
                    <span className={isMatch ? styles.subFieldMatch : ''}>
                      {row.profile?.subFieldName?.trim() || '—'}
                    </span>
                    {isMatch ? (
                      <CheckCircle2
                        size={12}
                        aria-hidden="true"
                        className={styles.matchCheck}
                      />
                    ) : null}
                  </dd>
                </div>
              </dl>

              <div className={styles.workload}>
                <span className={styles.workloadLabel}>Pending reviews</span>
                <WorkloadPill count={row.pendingCount} />
              </div>

              {multiSelect ? (
                <button
                  type="button"
                  className={`${styles.assignButton} ${isSelected ? styles.assignButtonSelected : ''}`}
                  disabled={isAssigning}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSelect(row);
                  }}
                  aria-pressed={isSelected}
                  aria-label={
                    isSelected
                      ? `Remove ${row.user.fullName ?? 'this reviewer'} from the batch`
                      : `Add ${row.user.fullName ?? 'this reviewer'} to the batch`
                  }
                  data-testid={`reviewer-toggle-${row.user.id}`}
                >
                  {isSelected ? (
                    <>
                      <CircleCheck size={13} aria-hidden="true" /> Selected
                    </>
                  ) : (
                    <>
                      <Circle size={13} aria-hidden="true" /> Select
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.assignButton}
                  disabled={isAssigning}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirm({ kind: 'single', reviewer: row });
                  }}
                  aria-label={`Assign ${row.user.fullName ?? 'this reviewer'} to this paper`}
                >
                  {isCurrent ? 'Reassign Reviewer' : 'Assign Reviewer'}
                </button>
              )}
              {!multiSelect && isCurrent ? <small className={styles.currentNote}>Currently assigned</small> : null}
            </article>
          );
        })}
      </div>

      <nav className={styles.pagination} aria-label="Reviewer pages">
        <span className={styles.paginationInfo}>
          Page {safePage} of {totalPages} · Showing {pageItems.length} of {sorted.length}
        </span>
        <div className={styles.paginationControls}>
          <button
            type="button"
            className={styles.pageButton}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} aria-hidden="true" /> Prev
          </button>
          <button
            type="button"
            className={styles.pageButton}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Next page"
          >
            Next <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {confirm ? (
        confirm.kind === 'single' ? (
          <ReviewerAssignConfirmModal
            reviewerName={
              confirm.reviewer.user.fullName?.trim() ||
              `Reviewer #${confirm.reviewer.user.id}`
            }
            isMatch={
              paperSubFieldId != null &&
              confirm.reviewer.profile?.subFieldId === paperSubFieldId
            }
            isSubmitting={isAssigning}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              void handleConfirm(confirm);
            }}
          />
        ) : (
          <ReviewerBatchAssignConfirmModal
            reviewers={confirm.reviewers.map((row) => ({
              id: row.user.id,
              name: row.user.fullName?.trim() || `Reviewer #${row.user.id}`,
              isMatch:
                paperSubFieldId != null &&
                row.profile?.subFieldId === paperSubFieldId,
            }))}
            isSubmitting={isAssigning}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              void handleConfirm(confirm);
            }}
          />
        )
      ) : null}

      {feedback ? (
        <ReviewerAssignFeedbackModal
          feedback={feedback}
          onClose={() => setFeedback(null)}
        />
      ) : null}
    </div>
  );
};

const workloadTone = (count: number): 'low' | 'med' | 'high' => {
  if (count <= 2) return 'low';
  if (count <= 5) return 'med';
  return 'high';
};

const workloadHint = (count: number): string => {
  if (count === 0) return 'available';
  if (count <= 2) return 'light load';
  if (count <= 5) return 'busy';
  return 'overloaded';
};

const WorkloadPill = ({ count }: { count: number }): JSX.Element => {
  const tone = workloadTone(count);
  return (
    <span className={`${styles.workloadPill} ${styles[`workload_${tone}`]}`}>
      <span className={styles.workloadDot} aria-hidden="true" />
      <span className={styles.workloadCount}>{count}</span>
      <span className={styles.workloadHint}>{workloadHint(count)}</span>
    </span>
  );
};

// ── Modals ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  reviewerName: string;
  isMatch: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ReviewerAssignConfirmModal = ({
  reviewerName,
  isMatch,
  isSubmitting,
  onCancel,
  onConfirm,
}: ConfirmModalProps): JSX.Element => {
  const backdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isSubmitting) onCancel();
  };
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={backdropMouseDown}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reviewer-confirm-title"
      >
        <header className={styles.modalHeader}>
          <div className={styles.modalHeading}>
            <Sparkles size={18} aria-hidden="true" />
            <h2 id="reviewer-confirm-title">Assign this reviewer?</h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Close confirmation"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <p className={styles.modalBody}>
          <strong>{reviewerName}</strong> will be asked to review this paper
          {isMatch ? ' (their subfield matches the paper)' : ''}. They will
          receive a notification and have 14 days to accept or decline.
        </p>
        <footer className={styles.modalFooter}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2
                  size={14}
                  aria-hidden="true"
                  className={styles.spinning}
                />{' '}
                Assigning…
              </>
            ) : (
              'Assign reviewer'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

interface FeedbackModalProps {
  feedback: NonNullable<FeedbackState>;
  onClose: () => void;
}

const ReviewerAssignFeedbackModal = ({ feedback, onClose }: FeedbackModalProps): JSX.Element => {
  const backdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  const isSuccess = feedback.kind === 'success';
  const isBatch =
    isSuccess && typeof feedback.reviewerCount === 'number' && feedback.reviewerCount > 1;
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={backdropMouseDown}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reviewer-feedback-title"
      >
        <header className={styles.modalHeader}>
          <div
            className={`${styles.modalHeading} ${
              isSuccess ? styles.headingSuccess : styles.headingError
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <AlertCircle size={18} aria-hidden="true" />
            )}
            <h2 id="reviewer-feedback-title">
              {isSuccess
                ? isBatch
                  ? `Assigned ${feedback.reviewerCount} reviewers`
                  : 'Reviewer assigned'
                : 'Could not assign reviewer'}
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close feedback"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <p className={styles.modalBody}>
          {isSuccess ? (
            isBatch ? (
              <>
                {feedback.reviewerName} have been notified. The paper is now in
                <strong> Reviewer Assigned</strong> status and waits for their
                responses.
              </>
            ) : (
              <>
                “{feedback.reviewerName}” has been notified. The paper is now
                in <strong>Reviewer Assigned</strong> status and waits for their
                response.
              </>
            )
          ) : (
            feedback.message
          )}
        </p>
        <footer className={styles.modalFooter}>
          <button type="button" className={styles.confirmButton} onClick={onClose}>
            {isSuccess ? 'Got it' : 'Try again'}
          </button>
        </footer>
      </div>
    </div>
  );
};

interface BatchConfirmModalProps {
  reviewers: Array<{ id: number; name: string; isMatch: boolean }>;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ReviewerBatchAssignConfirmModal = ({
  reviewers,
  isSubmitting,
  onCancel,
  onConfirm,
}: BatchConfirmModalProps): JSX.Element => {
  const backdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isSubmitting) onCancel();
  };
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={backdropMouseDown}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reviewer-batch-confirm-title"
      >
        <header className={styles.modalHeader}>
          <div className={styles.modalHeading}>
            <CircleCheck size={18} aria-hidden="true" />
            <h2 id="reviewer-batch-confirm-title">
              Assign {reviewers.length} reviewer{reviewers.length === 1 ? '' : 's'}?
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Close confirmation"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.modalBody}>
          <p className={styles.batchConfirmIntro}>
            Each of these reviewers will be asked to review the paper
            (matching subfields are marked):
          </p>
          <ul className={styles.batchConfirmList}>
            {reviewers.map((reviewer) => (
              <li key={reviewer.id} className={styles.batchConfirmItem}>
                <span>{reviewer.name}</span>
                {reviewer.isMatch ? (
                  <span className={styles.batchMatchBadge}>Best match</span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className={styles.batchConfirmHint}>
            Each reviewer receives an independent notification and 14 days to
            accept or decline.
          </p>
        </div>
        <footer className={styles.modalFooter}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2
                  size={14}
                  aria-hidden="true"
                  className={styles.spinning}
                />{' '}
                Assigning…
              </>
            ) : (
              `Assign ${reviewers.length} reviewer${reviewers.length === 1 ? '' : 's'}`
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ReviewerCardGrid;
