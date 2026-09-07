import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Plus, X } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { useTableSort } from '../../../hooks/useTableSort';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { Button } from '../../../components/Button/Button';
import { SortableHeader } from '../../../components/table/SortableHeader';
import {
  getSubmittedPaperLabel,
  type SubmittedPaperTone,
} from '../utils/statusPresentation';
import {
  type PublicationPaper,
  type PublicationStatus,
} from '../types/publication';
import { formatDisplayDate } from '../../../utils/datetime';
import { useT } from '../../../i18n/I18nContext';
import styles from './researcher.module.css';

/** Sortable column ids for the Researcher Submissions table. */
type SortColumn = 'title' | 'status' | 'submittedAt';

/** Status filter options shown in the toolbar dropdown. "ALL" shows every
 *  paper; each specific value filters to that exact backend status. */
type StatusFilter = 'ALL' | PublicationStatus;

const RESEARCHER_ACCENT = 'var(--ars-researcher)';

/** The six filterable status buckets in the dropdown.
 *  "Submitted papers" maps the five specified BE states; "Other" collects
 *  every remaining backend status so the researcher can still see those rows. */
const STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: StatusFilter;
  i18nKey: string;
}> = [
  { value: 'ALL',                             i18nKey: 'researcher.submissions.filter.allStatuses' },
  { value: 'SUBMITTED',                       i18nKey: 'researcher.submissions.filter.submitted' },
  { value: 'REVIEWER_ASSIGNED',               i18nKey: 'researcher.submissions.filter.reviewerAssigned' },
  { value: 'PUBLISHED',                       i18nKey: 'researcher.submissions.filter.published' },
  { value: 'ADMIN_REJECTED',                   i18nKey: 'researcher.submissions.filter.adminRejected' },
  { value: 'REVIEWER_RECOMMENDED_REJECT',      i18nKey: 'researcher.submissions.filter.reviewerRecommendedImprovement' },
  { value: 'DRAFT',                           i18nKey: 'researcher.submissions.filter.draft' },
];

const formatDate = (iso: string | undefined): string => {
  if (!iso) return '—';
  const formatted = formatDisplayDate(iso);
  return formatted === '—' ? '—' : formatted;
};

export const ResearcherSubmissions = () => {
  const navigate = useNavigate();
  const t = useT();
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  /** Single status filter — replaces the old two-row stage + status tab UI. */
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Default sort by submittedAt (newest first) so recently submitted
  // submissions surface at the top. The user can override per column.
  const sort = useTableSort<PublicationPaper, SortColumn>('submittedAt', 'desc');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    publicationAdapter
      .getResearcherSubmissions()
      .then((items) => {
        if (cancelled) return;
        setPapers(items);
      })
      .catch(() => {
        if (!cancelled) setError(t('researcher.submissions.loadError.body'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  // Papers that need immediate researcher action — draft, revision, or
  // authorship verification. Shown in the attention banner.
  const attentionPapers = useMemo(
    () =>
      papers.filter(
        (paper) =>
          paper.status === 'REVISION_REQUIRED' ||
          paper.status === 'RESEARCHER_VERIFICATION_REQUIRED' ||
          paper.status === 'DRAFT',
      ),
    [papers],
  );

  // Count papers per status filter option so the dropdown shows accurate totals.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: papers.length };
    for (const opt of STATUS_FILTER_OPTIONS) {
      if (opt.value === 'ALL') continue;
      counts[opt.value] = papers.filter((p) => p.status === opt.value).length;
    }
    return counts;
  }, [papers]);

  const visiblePapers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return papers.filter((paper) => {
      // Apply status filter
      if (statusFilter !== 'ALL' && paper.status !== statusFilter) return false;
      // Apply search filter
      if (!term) return true;
      const haystack = [
        paper.title,
        paper.abstract,
        paper.paperType,
        paper.doi,
        paper.openAlexId,
        ...paper.authors.map((author) => author.name),
        ...paper.institutions.map((institution) => institution.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [papers, search, statusFilter]);

  // Apply column sort on top of filtered list.
  const sortedPapers = useMemo(
    () =>
      sort.sortedItemsBy(visiblePapers, (paper) => {
        switch (sort.sortState.column) {
          case 'title':
            return paper.title ?? '';
          case 'status':
            return paper.status;
          case 'submittedAt':
          default:
            return paper.submittedAt ?? paper.createdAt ?? null;
        }
      }),
    [visiblePapers, sort],
  );

  // Whether a filter is active — drives "Clear filters" visibility.
  const hasActiveFilter = search.trim() !== '' || statusFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
  };

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow={t('researcher.submissions.eyebrow')}
        title={t('researcher.submissions.title')}
        description={t('researcher.submissions.description')}
        accent={RESEARCHER_ACCENT}
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={14} aria-hidden />}
            onClick={() => navigate('/researcher/submissions/new')}
          >
            {t('researcher.submissions.cta.new')}
          </Button>
        }
      />

      {loading ? (
        <SkeletonRow count={5} withHeader />
      ) : error ? (
        <ErrorBanner
          tone="error"
          title={t('researcher.submissions.loadError.title')}
          message={error}
        />
      ) : papers.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title={t('researcher.submissions.empty.title')}
          description={t('researcher.submissions.empty.description')}
          action={
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={14} aria-hidden />}
              onClick={() => navigate('/researcher/submissions/new')}
            >
              {t('researcher.submissions.cta.firstPaper')}
            </Button>
          }
        />
      ) : (
        <>
          {/* Attention banner — papers needing immediate researcher action */}
          {attentionPapers.length > 0 && (
            <section className={styles.attentionPanel} aria-labelledby="submission-attention-title">
              <div>
                <h2 id="submission-attention-title">{t('researcher.submissions.attention.title')}</h2>
                <p>
                  {t('researcher.submissions.attention.body', undefined, {
                    count: attentionPapers.length,
                  })}
                </p>
              </div>
              <div className={styles.attentionActions}>
                {attentionPapers.slice(0, 3).map((paper) => {
                  let actionLabel: string;
                  if (paper.status === 'DRAFT') {
                    actionLabel = t('researcher.submissions.action.completeDraft');
                  } else if (paper.status === 'RESEARCHER_VERIFICATION_REQUIRED') {
                    actionLabel = t('researcher.submissions.action.verifyAuthorship');
                  } else {
                    actionLabel = t('researcher.submissions.action.submitRevision');
                  }
                  return (
                    <Button
                      key={paper.id}
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/researcher/submissions/${paper.id}`)}
                    >
                      {actionLabel}
                    </Button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Compact toolbar: search + status filter + clear + count ─── */}
          <div className={styles.toolbar} role="search" aria-label={t('researcher.submissions.toolbar.aria')}>
            <label className={styles.searchField}>
              <span className={styles.searchLabel} id="researcher-search-label">
                {t('researcher.submissions.search.label')}
              </span>
              <input
                type="search"
                className={styles.searchInput}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('researcher.submissions.search.placeholder')}
                aria-labelledby="researcher-search-label"
              />
            </label>

            <div className={styles.statusField}>
              <label className={styles.searchLabel} id="researcher-status-label">
                {t('researcher.submissions.filter.label')}
              </label>
              <select
                className={styles.statusSelect}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                aria-labelledby="researcher-status-label"
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.i18nKey)}
                    {opt.value !== 'ALL' && statusCounts[opt.value] != null
                      ? ` (${statusCounts[opt.value]})`
                      : ` (${papers.length})`}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={clearFilters}
                aria-label={t('researcher.submissions.filter.clear')}
              >
                <X size={14} aria-hidden />
                {t('researcher.submissions.filter.clear')}
              </button>
            )}

            <span className={styles.count} aria-live="polite">
              {search || statusFilter !== 'ALL'
                ? t('researcher.submissions.count', undefined, {
                    visible: visiblePapers.length,
                    total: papers.length,
                  })
                : t('researcher.submissions.count_noChange', undefined, { total: papers.length })}
            </span>
          </div>

          {/* Empty state when filters return no results */}
          {visiblePapers.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} aria-hidden />}
              title={t('researcher.submissions.emptyFiltered.title')}
              description={t('researcher.submissions.emptyFiltered.description')}
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.thTitle}>
                      <SortableHeader
                        column="title"
                        label={t('researcher.submissions.column.title')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th scope="col">
                      <SortableHeader
                        column="status"
                        label={t('researcher.submissions.column.status')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th scope="col">
                      <SortableHeader
                        column="submittedAt"
                        label={t('researcher.submissions.column.updated')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th scope="col" className={styles.thActions}>
                      {t('researcher.submissions.column.action')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPapers.map((paper) => {
                    const displayLabel = getSubmittedPaperLabel(paper.status);

                    // Determine what tone the next-action chip should use, based
                    // on the backend status.
                    const nextActionTone = ((): SubmittedPaperTone => {
                      switch (paper.status) {
                        case 'DRAFT':
                        case 'REVISION_REQUIRED':
                        case 'RESEARCHER_VERIFICATION_REQUIRED':
                          return 'submitted';
                        case 'SUBMITTED':
                        case 'ADMIN_SCREENING':
                        case 'READY_FOR_REVIEWER':
                        case 'REVIEWER_ASSIGNED':
                        case 'RESUBMITTED':
                        case 'UNDER_REVIEW':
                          return 'assigned';
                        case 'REVIEWER_RECOMMENDED_ACCEPT':
                        case 'ADMIN_APPROVED':
                          return 'assigned';
                        case 'PUBLISHED':
                          return 'published';
                        case 'ADMIN_REJECTED':
                          return 'rejected';
                        case 'REVIEWER_RECOMMENDED_REJECT':
                          return 'improvement';
                        default:
                          return 'unknown';
                      }
                    })();

                    const nextActionLabel = (() => {
                      switch (paper.status) {
                        case 'DRAFT':
                          return t('researcher.submissions.action.completeDraft');
                        case 'REVISION_REQUIRED':
                          return t('researcher.submissions.action.submitRevision');
                        case 'RESEARCHER_VERIFICATION_REQUIRED':
                          return t('researcher.submissions.action.verifyAuthorship');
                        case 'SUBMITTED':
                        case 'ADMIN_SCREENING':
                        case 'READY_FOR_REVIEWER':
                        case 'REVIEWER_ASSIGNED':
                        case 'RESUBMITTED':
                          return t('researcher.submissions.action.awaitingAdmin');
                        case 'UNDER_REVIEW':
                        case 'REVIEWER_RECOMMENDED_ACCEPT':
                        case 'REVIEWER_RECOMMENDED_REJECT':
                          return t('researcher.submissions.action.awaitingDecision');
                        case 'ADMIN_APPROVED':
                          return t('researcher.submissions.action.awaitingPublication');
                        case 'PUBLISHED':
                          return t('researcher.submissions.action.published');
                        case 'ADMIN_REJECTED':
                        case 'WITHDRAWN':
                        case 'INACTIVE':
                          return displayLabel;
                        default:
                          return t('researcher.submissions.action.unknown');
                      }
                    })();

                    return (
                      <tr key={paper.id} data-testid="researcher-submission-row" data-paper-id={paper.id}>
                        <td className={styles.tdTitle}>
                          <button
                            type="button"
                            className={styles.titleLink}
                            onClick={() =>
                              navigate(`/researcher/submissions/${paper.id}`)
                            }
                            aria-label={t('researcher.submissions.openRow.aria', undefined, {
                              title: paper.title,
                            })}
                          >
                            {paper.title}
                          </button>
                          <span className={styles.titleMeta}>
                            {paper.paperType || '—'}
                            {paper.version != null ? ` · v${paper.version}` : ''}
                          </span>
                          <span
                            className={styles.nextAction}
                            data-tone={nextActionTone}
                            aria-label={t('researcher.submissions.nextAction.aria', undefined, {
                              status: nextActionLabel,
                            })}
                          >
                            {nextActionLabel}
                          </span>
                        </td>

                        <td>
                          <StatusBadge
                            status={paper.status}
                            label={displayLabel}
                            size="sm"
                          />
                        </td>

                        <td>
                          <span className={styles.titleMeta}>
                            {formatDate(paper.submittedAt ?? paper.createdAt)}
                          </span>
                        </td>

                        <td className={styles.tdActions}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`/researcher/submissions/${paper.id}`)
                            }
                          >
                            {t('researcher.submissions.openRow')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ResearcherSubmissions;
