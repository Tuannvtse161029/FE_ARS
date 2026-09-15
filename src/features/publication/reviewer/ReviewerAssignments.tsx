import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { StatusBadge } from '../../../components/common/StatusBadge';
import reviewer from './reviewer.module.css';
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
import type { PublicationPaper, PublicationStatus } from '../types/publication';
import {
  statusLabel,
  reviewTypeLabel,
  paperTypeLabel,
} from '../types/publication';

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

/** Map a reviewer-visible status to a StatusBadge variant token. */
const REVIEWER_STATUS_TO_VARIANT: Partial<Record<PublicationStatus, string>> = {
  REVIEWER_ASSIGNED: 'pubBucketPending',          // accent indigo
  UNDER_REVIEW: 'pubBucketPending',               // accent indigo
  REVISION_REQUIRED: 'pubBucketNeedRevision',     // purple
  RESUBMITTED: 'pubBucketPending',                // accent indigo
  REVIEWER_RECOMMENDED_ACCEPT: 'pubBucketVerified', // blue
  REVIEWER_RECOMMENDED_REJECT: 'pubBucketNeedRevision', // purple
};

/** Status filter bar options for the reviewer list. */
type ReviewerStatusFilter = 'ALL' | PublicationStatus;

const REVIEWER_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: ReviewerStatusFilter;
  labelKey: string;
  descriptionKey: string;
}> = [
  { value: 'ALL',                               labelKey: 'reviewer.assignments.filter.all',       descriptionKey: 'reviewer.assignments.filter.desc.all' },
  { value: 'REVIEWER_ASSIGNED',               labelKey: 'reviewer.assignments.filter.assigned', descriptionKey: 'reviewer.assignments.filter.desc.assigned' },
  { value: 'UNDER_REVIEW',                    labelKey: 'reviewer.assignments.filter.underReview', descriptionKey: 'reviewer.assignments.filter.desc.underReview' },
  { value: 'REVISION_REQUIRED',               labelKey: 'reviewer.assignments.filter.revisionRequired', descriptionKey: 'reviewer.assignments.filter.desc.revisionRequired' },
  { value: 'RESUBMITTED',                     labelKey: 'reviewer.assignments.filter.resubmitted', descriptionKey: 'reviewer.assignments.filter.desc.resubmitted' },
  { value: 'REVIEWER_RECOMMENDED_ACCEPT',     labelKey: 'reviewer.assignments.filter.recommendedAccept', descriptionKey: 'reviewer.assignments.filter.desc.recommendedAccept' },
  { value: 'REVIEWER_RECOMMENDED_REJECT',     labelKey: 'reviewer.assignments.filter.recommendedReject', descriptionKey: 'reviewer.assignments.filter.desc.recommendedReject' },
];

const isVisibleReviewerAssignment = (paper: PublicationPaper): boolean =>
  paper.reviewRequestId != null && REVIEWER_VISIBLE_STATUSES.has(paper.status);

const actionableLabel = (paper: PublicationPaper): string => {
  if (paper.reviewer?.recommendation) return 'Review submitted · awaiting Admin';
  if (isReviewerActionable(paper.status)) return 'Ready for evaluation';
  if (isAwaitingReviewerResponse(paper.status)) return 'Awaiting your response';
  return 'Not actionable yet';
};

const actionableTone = (paper: PublicationPaper): 'submitted' | 'evaluated' | 'waiting' | 'unknown' => {
  if (paper.reviewer?.recommendation) return 'submitted';
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
  if (paper.reviewer?.recommendation) return 'completed';
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
  /** Status filter — narrows the table to one reviewer-visible status. */
  const [statusFilter, setStatusFilter] = useState<ReviewerStatusFilter>('ALL');
  const tabListRef = useRef<HTMLDivElement>(null);

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
      if (statusFilter !== 'ALL' && paper.status !== statusFilter) return false;
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
  }, [papers, search, statusFilter]);

  // Apply default sort by assigned (newest first).
  const sortedPapers = useMemo(
    () =>
      [...visiblePapers].sort((a, b) => {
        const av = a.assignmentCreatedAt ?? a.submittedAt ?? a.createdAt ?? '';
        const bv = b.assignmentCreatedAt ?? b.submittedAt ?? b.createdAt ?? '';
        return bv.localeCompare(av);
      }),
    [visiblePapers],
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

  /** Per-status totals for the filter pill bar. */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: papers.length };
    for (const opt of REVIEWER_STATUS_FILTER_OPTIONS) {
      if (opt.value === 'ALL') continue;
      counts[opt.value] = papers.filter((p) => p.status === opt.value).length;
    }
    return counts;
  }, [papers]);

  const rows = useMemo(
    () =>
      ACTION_BUCKET_ORDER.flatMap((bucket) => groupedPapers[bucket]).map((paper) => ({
        paper,
        actionable: actionableLabel(paper),
        actionableTone: actionableTone(paper),
        assignedAt: formatDate(paper.assignmentCreatedAt ?? paper.submittedAt),
        deadline: formatDate(paper.reviewDeadline),
      })),
    [groupedPapers],
  );

  // Keyboard navigation handler for status filter tab bar
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    const tabs = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    if (!tabs || tabs.length === 0) return;

    const currentIndex = Array.from(tabs).findIndex(
      (tab) => tab === document.activeElement,
    );
    if (currentIndex === -1) return;

    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabs.length;
        tabs[nextIndex].focus();
        event.preventDefault();
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        tabs[nextIndex].focus();
        event.preventDefault();
        break;
      case 'Home':
        tabs[0].focus();
        event.preventDefault();
        break;
      case 'End':
        tabs[tabs.length - 1].focus();
        event.preventDefault();
        break;
      default:
        break;
    }
  };

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
      if (row?.paper?.reviewRequestId == null) return;
      navigate(`/reviewer/assignments/${row.paper.reviewRequestId}`);
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
              to={`${ROUTES.PROFILE}?tab=professional`}
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
                  <Link to={`${ROUTES.PROFILE}?tab=professional`}>
                    <Button variant="outline" size="md">
                      {t('reviewer.assignments.openAvailability')}
                    </Button>
                  </Link>
                ) : undefined
              }
              data-testid="empty-assignments"
            />
          ) : (
            <>
              {/* Status filter pill bar — narrows the table to one status */}
              <div
                ref={tabListRef}
                role="tablist"
                aria-label={t('reviewer.assignments.filter.label')}
                className={reviewer.tabBar}
                onKeyDown={handleTabKeyDown}
              >
                {REVIEWER_STATUS_FILTER_OPTIONS.map((opt) => {
                  const count = opt.value === 'ALL' ? papers.length : (statusCounts[opt.value] ?? 0);
                  const isSelected = statusFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      role="tab"
                      type="button"
                      className={`${reviewer.tab} ${isSelected ? reviewer.tabActive : ''}`}
                      aria-selected={isSelected}
                      aria-description={t(opt.descriptionKey)}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setStatusFilter(opt.value)}
                    >
                      {t(opt.labelKey)}
                      <span className={reviewer.tabCount}>{count}</span>
                    </button>
                  );
                })}
              </div>

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
                      <div className={reviewer.tableWrap}>
                        <table className={reviewer.table}>
                          <thead>
                            <tr>
                              <th scope="col" className={reviewer.thTitle}>
                                {t('reviewer.assignments.column.title')}
                              </th>
                              <th scope="col" className={reviewer.thAbstract}>
                                {t('reviewer.assignments.column.abstract')}
                              </th>
                              <th scope="col">{t('reviewer.assignments.column.status')}</th>
                              <th scope="col">{t('reviewer.assignments.column.assigned')}</th>
                              <th scope="col">{t('reviewer.assignments.column.deadline')}</th>
                              <th scope="col" className={reviewer.thActions}>
                                {t('reviewer.assignments.column.action')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {bucketPapers.map((paper) => {
                              const rowIndex = rows.findIndex(
                                (row) => row.paper.reviewRequestId === paper.reviewRequestId,
                              );
                              const aiLabel = aiRecommendedLabel(paper);
                              const authorsLine = paper.authors.map((a) => a.name).filter(Boolean).join(', ')
                                || t('reviewer.detail.notSupplied', 'Not supplied');
                              return (
                                <tr
                                  key={`${paper.id}-${paper.reviewRequestId ?? 'assignment'}`}
                                  data-testid="assignment-row"
                                  data-paper-id={paper.id}
                                  data-assignment-id={paper.reviewRequestId}
                                  aria-current={selectedIndex === rowIndex ? 'true' : undefined}
                                >
                                  <td className={reviewer.tdTitle}>
                                    <Link
                                      to={`/reviewer/assignments/${paper.reviewRequestId}`}
                                      className={reviewer.titleLink}
                                    >
                                      {paper.title}
                                    </Link>
                                    <span className={reviewer.titleMeta}>
                                      {[
                                        paperTypeLabel(paper.paperType),
                                        paper.reviewType ? reviewTypeLabel(paper.reviewType) : '',
                                        aiLabel,
                                      ].filter(Boolean).join(' · ')}
                                    </span>
                                    <span className={reviewer.titleMeta}>{authorsLine}</span>
                                  </td>
                                  <td className={reviewer.tdAbstract}>
                                    {paper.abstract ? (
                                      <span className={reviewer.assignmentAbstract}>{paper.abstract}</span>
                                    ) : (
                                      <span className={reviewer.titleMeta}>
                                        {t('reviewer.detail.notSupplied', 'Not supplied')}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <div className={reviewer.statusCell}>
                                      <StatusBadge
                                        status={REVIEWER_STATUS_TO_VARIANT[paper.status] ?? 'unknown'}
                                        label={statusLabel(paper.status)}
                                        size="sm"
                                      />
                                      <span
                                        className={reviewer.bucketActionable}
                                        data-tone={actionableTone(paper)}
                                      >
                                        {actionableLabel(paper)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className={reviewer.mono}>
                                    {formatDate(paper.assignmentCreatedAt ?? paper.submittedAt)}
                                  </td>
                                  <td className={reviewer.mono}>
                                    {formatDate(paper.reviewDeadline)}
                                  </td>
                                  <td className={reviewer.tdActions}>
                                    <Link
                                      to={`/reviewer/assignments/${paper.reviewRequestId}`}
                                      className={reviewer.bucketNextAction}
                                    >
                                      {nextActionHint(paper)} →
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
};

export default ReviewerAssignments;
