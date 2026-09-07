import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { useTableSort } from '../../../hooks/useTableSort';
import reviewer from './reviewer.module.css';
import { statusLabel, reviewTypeLabel, type PublicationPaper, type PublicationStatus } from '../types/publication';
import {
  isAwaitingReviewerResponse,
  isReviewerActionable,
  isReviewerSubmitted,
} from './reviewerCriteria';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { Button } from '../../../components/Button/Button';
import { useListShortcuts } from '../../../hooks/useListShortcuts';
import { formatDisplayDate } from '../../../utils/datetime';
import { useT } from '../../../i18n/I18nContext';
import { ROUTES } from '../../../routes/paths';

/** Sortable column ids for the Reviewer Assignments table. */
type SortColumn = 'title' | 'status' | 'actionability' | 'assigned' | 'deadline';

// ReviewerAssignments — Reviewer-only list of Admin-assigned papers.
//
// ORGANIZATION:
//   The list is organized into three action-centered groups:
//   1. Response needed  — reviewer must accept/decline (REVIEWER_ASSIGNED)
//   2. Accepted/in progress — reviewer has accepted and is evaluating
//      (UNDER_REVIEW, REVISION_REQUIRED, RESUBMITTED)
//   3. Completed recommendations — reviewer has submitted and is awaiting
//      Admin (REVIEWER_RECOMMENDED_ACCEPT/REJECT)
//
// AVAILABILITY:
//   The reviewer's availability setting is shown next to its control
//   (in the Professional Profile page). An empty queue is NOT solely
//   attributed to availability — Admin may simply not have assigned any
//   matching papers yet.
//
// PRIVACY:
//   This page never renders `PublicationReview.privateComments` or
//   `PublicationReview.privateScores`. The reviewer can only see their
//   own work product from inside the detail page after they submit.
//
// I18N:
//   All user-facing copy routes through the shared i18n dictionary.
//   Status labels come from `statusLabel()` (BE contract preserved); the
//   i18n dictionary owns the bucket titles, hints, and empty-state copy.

const REVIEWER_ACCENT = 'var(--ars-reviewer)';

const formatDate = (iso: string | undefined): string => {
  if (!iso) return '—';
  const formatted = formatDisplayDate(iso);
  return formatted === '—' ? '—' : formatted;
};

const REVIEWER_VISIBLE_STATUSES: ReadonlySet<PublicationStatus> = new Set([
  'REVIEWER_ASSIGNED',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'RESUBMITTED',
  'REVIEWER_RECOMMENDED_ACCEPT',
  'REVIEWER_RECOMMENDED_REJECT',
]);

const isVisibleReviewerAssignment = (paper: PublicationPaper): boolean =>
  REVIEWER_VISIBLE_STATUSES.has(paper.status);

const actionableLabel = (paper: PublicationPaper): string => {
  if (isReviewerSubmitted(paper.status)) return 'Review submitted · awaiting Admin';
  if (isReviewerActionable(paper.status)) return 'Ready for evaluation';
  if (isAwaitingReviewerResponse(paper.status)) return 'Awaiting your response';
  return 'Not actionable yet';
};

const actionableTone = (paper: PublicationPaper): 'submitted' | 'evaluated' | 'waiting' | 'unknown' => {
  if (isReviewerSubmitted(paper.status)) return 'submitted';
  if (isReviewerActionable(paper.status)) return 'evaluated';
  if (isAwaitingReviewerResponse(paper.status)) return 'waiting';
  return 'unknown';
};

// Group assignments by next-action bucket.
type ActionBucket = 'response' | 'in_progress' | 'completed';

const ACTION_BUCKET_ORDER: ActionBucket[] = ['response', 'in_progress', 'completed'];

const ACTION_BUCKET_I18N: Record<ActionBucket, { label: string; hint: string }> = {
  response: {
    label: 'reviewer.assignments.bucket.response.label',
    hint: 'reviewer.assignments.bucket.response.hint',
  },
  in_progress: {
    label: 'reviewer.assignments.bucket.inProgress.label',
    hint: 'reviewer.assignments.bucket.inProgress.hint',
  },
  completed: {
    label: 'reviewer.assignments.bucket.completed.label',
    hint: 'reviewer.assignments.bucket.completed.hint',
  },
};

const bucketFor = (paper: PublicationPaper): ActionBucket => {
  if (isAwaitingReviewerResponse(paper.status)) return 'response';
  if (isReviewerActionable(paper.status)) return 'in_progress';
  if (isReviewerSubmitted(paper.status)) return 'completed';
  // Revision / resubmission still need reviewer attention.
  if (paper.status === 'REVISION_REQUIRED' || paper.status === 'RESUBMITTED') {
    return 'in_progress';
  }
  return 'completed';
};

export const ReviewerAssignments = () => {
  const navigate = useNavigate();
  const t = useT();
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Default sort by assigned (newest first) so recently assigned papers
  // surface at the top. The user can override per column header click.
  const sort = useTableSort<PublicationPaper, SortColumn>('assigned', 'desc');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    publicationAdapter
      .getReviewerAssignments()
      .then((items) => {
        if (cancelled) return;
        setPapers(items.filter(isVisibleReviewerAssignment));
      })
      .catch(() => {
        if (!cancelled) setError(t('reviewer.assignments.loadError.title'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const visiblePapers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return papers.filter((paper) => {
      if (!term) return true;
      const haystack = [
        paper.title,
        paper.abstract,
        paper.paperType,
        paper.domain,
        paper.field,
        paper.subfield,
        ...paper.authors.map((author) => author.name),
        ...paper.institutions.map((institution) => institution.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [papers, search]);

  // Apply column sort on top of filtered list.
  const sortedPapers = useMemo(
    () =>
      sort.sortedItemsBy(visiblePapers, (paper) => {
        switch (sort.sortState.column) {
          case 'title':
            return paper.title ?? '';
          case 'status':
            return paper.status;
          case 'actionability':
            return actionableLabel(paper);
          case 'assigned':
            return paper.assignmentCreatedAt ?? paper.submittedAt ?? null;
          case 'deadline':
            return paper.reviewDeadline ?? null;
          default:
            return paper.assignmentCreatedAt ?? paper.submittedAt ?? paper.createdAt ?? null;
        }
      }),
    [visiblePapers, sort],
  );

  // Group sorted papers by action bucket so reviewers see what to do next
  // before scanning detail.
  const groupedPapers = useMemo(() => {
    const groups: Record<ActionBucket, PublicationPaper[]> = {
      response: [],
      in_progress: [],
      completed: [],
    };
    for (const paper of sortedPapers) {
      groups[bucketFor(paper)].push(paper);
    }
    return groups;
  }, [sortedPapers]);

  const rows = useMemo(
    () =>
      sortedPapers.map((paper) => ({
        paper,
        actionable: actionableLabel(paper),
        actionableTone: actionableTone(paper),
        assignedAt: formatDate(paper.assignmentCreatedAt ?? paper.submittedAt),
        deadline: formatDate(paper.reviewDeadline),
      })),
    [sortedPapers],
  );

  // Intentional next-action hint per paper.
  const nextActionHint = (paper: PublicationPaper): string => {
    if (isAwaitingReviewerResponse(paper.status)) return t('reviewer.assignments.nextAction.accept');
    if (isReviewerActionable(paper.status)) return t('reviewer.assignments.nextAction.evaluate');
    if (paper.status === 'REVISION_REQUIRED' || paper.status === 'RESUBMITTED') {
      return t('reviewer.assignments.nextAction.revise');
    }
    if (isReviewerSubmitted(paper.status)) return t('reviewer.assignments.nextAction.submitted');
    return t('reviewer.assignments.nextAction.viewOnly');
  };

  const aiRecommendedLabel = (paper: PublicationPaper): string | null => {
    if (paper.aiRecommended == null) return null;
    return paper.aiRecommended
      ? t('reviewer.assignments.status.aiRecommended')
      : t('reviewer.assignments.status.notAiRecommended');
  };

  // Keyboard shortcuts for the reviewer queue.
  // j/k navigate assignments, Enter opens the focused assignment,
  // f focuses the toolbar search input.
  const { selectedIndex } = useListShortcuts({
    itemCount: rows.length,
    onOpen: (index) => {
      const row = rows[index];
      if (!row?.paper?.id) return;
      navigate(`/reviewer/assignments/${row.paper.id}`);
    },
    filterFocusId: 'reviewer-assignments-search',
  });

  return (
    <section className={reviewer.page}>
      <PageHeader
        eyebrow={t('reviewer.assignments.eyebrow')}
        title={t('reviewer.assignments.title')}
        description={t('reviewer.assignments.description')}
        accent={REVIEWER_ACCENT}
      />

      {loading ? (
        <SkeletonRow count={5} withHeader />
      ) : error ? (
        <ErrorBanner
          tone="error"
          title={t('reviewer.assignments.loadError.title')}
          message={error}
        />
      ) : (
        <>
          {/* Availability control — explained inline next to it. */}
          <section className={reviewer.availabilityPanel} aria-labelledby="availability-title">
            <div>
              <h2 id="availability-title" className={reviewer.availabilityTitle}>
                {t('reviewer.assignments.availability.title')}
              </h2>
              <p className={reviewer.availabilityHint}>
                {t('reviewer.assignments.availability.hint')}
              </p>
            </div>
            <Link
              to={ROUTES.PROFESSIONAL_PROFILE}
              className={reviewer.availabilityLink}
            >
              {t('reviewer.assignments.availability.manage')}
            </Link>
          </section>

          {papers.length > 0 && (
            <div className={reviewer.toolbar} role="search">
              <label className={reviewer.searchField}>
                <span className={reviewer.searchLabel} id="reviewer-search-label">
                  {t('reviewer.assignments.search.label')}
                </span>
                <input
                  id="reviewer-assignments-search"
                  type="search"
                  className={reviewer.searchInput}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('reviewer.assignments.search.placeholder')}
                  aria-labelledby="reviewer-search-label"
                />
              </label>
              <span className={reviewer.count} aria-live="polite">
                {search
                  ? t('reviewer.assignments.count', undefined, {
                      visible: visiblePapers.length,
                      total: papers.length,
                    })
                  : t('reviewer.assignments.count', undefined, {
                      visible: papers.length,
                      total: papers.length,
                    })}
              </span>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} aria-hidden />}
              title={
                search
                  ? t('reviewer.assignments.empty.titleFiltered')
                  : t('reviewer.assignments.empty.title')
              }
              description={
                search
                  ? t('reviewer.assignments.empty.descriptionFiltered')
                  : t('reviewer.assignments.empty.description')
              }
              action={
                !search ? (
                  <Link to={ROUTES.PROFESSIONAL_PROFILE}>
                    <Button variant="outline" size="md">
                      {t('reviewer.assignments.openAvailability')}
                    </Button>
                  </Link>
                ) : undefined
              }
              data-testid="empty-assignments"
            />
          ) : (
            <div className={reviewer.buckets}>
              {ACTION_BUCKET_ORDER.map((bucket) => {
                const bucketPapers = groupedPapers[bucket];
                if (bucketPapers.length === 0) return null;
                const bucketCopy = ACTION_BUCKET_I18N[bucket];
                return (
                  <section
                    key={bucket}
                    className={reviewer.bucket}
                    aria-labelledby={`bucket-${bucket}-title`}
                    data-testid={`bucket-${bucket}`}
                  >
                    <header className={reviewer.bucketHeader}>
                      <h2
                        id={`bucket-${bucket}-title`}
                        className={reviewer.bucketTitle}
                      >
                        {t(bucketCopy.label)}
                        <span className={reviewer.bucketCount}>{bucketPapers.length}</span>
                      </h2>
                      <p className={reviewer.bucketHint}>{t(bucketCopy.hint)}</p>
                    </header>
                    <ul className={reviewer.bucketList}>
                      {bucketPapers.map((paper) => {
                        const rowIndex = rows.findIndex((row) => row.paper.id === paper.id);
                        const aiLabel = aiRecommendedLabel(paper);
                        return (
                          <li
                            key={`${paper.id}-${paper.reviewRequestId ?? 'assignment'}`}
                            className={reviewer.bucketItem}
                          >
                            <Link
                              to={`/reviewer/assignments/${paper.id}`}
                              className={reviewer.bucketLink}
                              data-testid="assignment-row"
                              data-paper-id={paper.id}
                              aria-current={selectedIndex === rowIndex ? 'true' : undefined}
                            >
                              <div className={reviewer.bucketMain}>
                                <span className={reviewer.bucketTitleText}>{paper.title}</span>
                                <span className={reviewer.bucketMeta}>
                                  {paper.paperType || '—'}
                                  {paper.reviewType ? ` · ${reviewTypeLabel(paper.reviewType)}` : ''}
                                  {aiLabel ? ` · ${aiLabel}` : ''}
                                </span>
                              </div>
                              <div className={reviewer.bucketStatus}>
                                <span className={reviewer.bucketStatusLabel}>
                                  {statusLabel(paper.status)}
                                </span>
                                <span
                                  className={reviewer.bucketActionable}
                                  data-tone={actionableTone(paper)}
                                >
                                  {actionableLabel(paper)}
                                </span>
                              </div>
                              <div className={reviewer.bucketDates}>
                                <span>
                                  <span className={reviewer.bucketDateLabel}>
                                    {t('reviewer.assignments.assigned')}
                                  </span>
                                  <span className={reviewer.mono}>
                                    {formatDate(paper.assignmentCreatedAt ?? paper.submittedAt)}
                                  </span>
                                </span>
                                <span>
                                  <span className={reviewer.bucketDateLabel}>
                                    {t('reviewer.assignments.deadline')}
                                  </span>
                                  <span className={reviewer.mono}>
                                    {formatDate(paper.reviewDeadline)}
                                  </span>
                                </span>
                              </div>
                              <div className={reviewer.bucketAction}>
                                <span className={reviewer.bucketNextAction}>
                                  {nextActionHint(paper)} →
                                </span>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ReviewerAssignments;
