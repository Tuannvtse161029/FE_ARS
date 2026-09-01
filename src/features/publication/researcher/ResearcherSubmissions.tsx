import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Plus } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { useTableSort } from '../../../hooks/useTableSort';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { StatusBadge } from '../../../components/lecturer/StatusBadge';
import { Button } from '../../../components/Button/Button';
import { SortableHeader } from '../../../components/table/SortableHeader';
import { statusLabel, type PublicationPaper, type PublicationStatus } from '../types/publication';
import styles from './researcher.module.css';

/** Sortable column ids for the Researcher Submissions table. */
type SortColumn = 'title' | 'status' | 'reviewer' | 'submittedAt';

// ResearcherSubmissions — Researcher-only list of manuscripts the
// current author owns. Coordinator authority: the route /researcher/
// submissions is rendered only when RoleRouteGuard admits the Researcher
// role; the API adapter filters by authorId server-side.
//
// Visual: status-first table. Status badge is the leading scannable
// column; the rest is plain metadata. No decorative patterns. All
// tokens come from ars-tokens.css and the shared PageHeader /
// StatusBadge / Button / Input family.

const RESEARCHER_ACCENT = 'var(--ars-researcher)';

// Only statuses a Researcher-owned paper can be in. We deliberately
// exclude ADMIN_APPROVED / PUBLISHED from the quick filter list
// because the Researcher list also surfaces terminal states, and
// "All" covers the long tail.
const STATUS_FILTER_OPTIONS: ReadonlyArray<PublicationStatus | 'ALL'> = [
  'ALL',
  'DRAFT',
  'SUBMITTED',
  'ADMIN_SCREENING',
  'RESEARCHER_VERIFICATION_REQUIRED',
  'READY_FOR_REVIEWER',
  'REVIEWER_ASSIGNED',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'RESUBMITTED',
  'REVIEWER_RECOMMENDED_ACCEPT',
  'REVIEWER_RECOMMENDED_REJECT',
  'ADMIN_APPROVED',
  'PUBLISHED',
  'ADMIN_REJECTED',
  'WITHDRAWN',
];

const formatDate = (iso: string | undefined): string => {
  if (!iso) return 'Not supplied';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not supplied';
  return parsed.toISOString().slice(0, 10);
};

export const ResearcherSubmissions = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PublicationStatus | 'ALL'>('ALL');

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
        if (!cancelled) setError('Your submissions could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const visiblePapers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = papers.filter((paper) => {
      if (statusFilter !== 'ALL' && paper.status !== statusFilter) return false;
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
    // Sort is applied via sort.sortedItemsBy below.
    return filtered;
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
          case 'reviewer':
            return paper.reviewer?.reviewerName ?? '';
          case 'submittedAt':
          default:
            return paper.submittedAt ?? paper.createdAt ?? null;
        }
      }),
    [visiblePapers, sort],
  );

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow="RESEARCHER WORKSPACE"
        title="My Submissions"
        description="Create drafts, submit metadata and manuscripts to Admin, and follow the editorial decision for every submission you own."
        accent={RESEARCHER_ACCENT}
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={14} aria-hidden />}
            onClick={() => navigate('/researcher/submissions/new')}
          >
            New submission
          </Button>
        }
      />

      {loading ? (
        <SkeletonRow count={5} withHeader />
      ) : error ? (
        <ErrorBanner
          tone="error"
          title="Could not load submissions"
          message={error}
        />
      ) : papers.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title="No submissions yet"
          description="Start your first manuscript submission. You can save a draft and submit it to Admin only when the required metadata and PDF are in place."
          action={
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={14} aria-hidden />}
              onClick={() => navigate('/researcher/submissions/new')}
            >
              Create your first submission
            </Button>
          }
        />
      ) : (
        <>
          {attentionPapers.length > 0 && (
            <section className={styles.attentionPanel} aria-labelledby="submission-attention-title">
              <div>
                <h2 id="submission-attention-title">Needs your attention</h2>
                <p>
                  {attentionPapers.length} submission{attentionPapers.length === 1 ? '' : 's'} need a researcher action before the editorial workflow can continue.
                </p>
              </div>
              <div className={styles.attentionActions}>
                {attentionPapers.slice(0, 3).map((paper) => (
                  <Button
                    key={paper.id}
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/researcher/submissions/${paper.id}`)}
                  >
                    {paper.status === 'DRAFT' ? 'Complete draft' : statusLabel(paper.status)}
                  </Button>
                ))}
              </div>
            </section>
          )}

          <div className={styles.toolbar} role="search">
            <label className={styles.searchField}>
              <span className={styles.searchLabel} id="researcher-search-label">
                Search submissions
              </span>
              <input
                type="search"
                className={styles.searchInput}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, author, DOI…"
                aria-labelledby="researcher-search-label"
              />
            </label>
            <label className={styles.statusField}>
              <span className={styles.searchLabel} id="researcher-status-label">
                Status
              </span>
              <select
                className={styles.statusSelect}
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as PublicationStatus | 'ALL')
                }
                aria-labelledby="researcher-status-label"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All statuses' : statusLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <span className={styles.count} aria-live="polite">
              {visiblePapers.length} of {papers.length} submission{papers.length === 1 ? '' : 's'}
            </span>
          </div>

          {visiblePapers.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} aria-hidden />}
              title="No submissions match your filters"
              description="Try a different keyword, clear the search, or change the status filter to see every submission."
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.thTitle}>
                      <SortableHeader
                        column="title"
                        label="Title"
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th scope="col">
                      <SortableHeader
                        column="status"
                        label="Status"
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                        filterOptions={STATUS_FILTER_OPTIONS.map(
                          (option) => ({
                            value: option,
                            label:
                              option === 'ALL'
                                ? 'All statuses'
                                : statusLabel(option),
                          }),
                        )}
                        activeFilter={statusFilter}
                        onFilterChange={(next) =>
                          setStatusFilter(
                            next as PublicationStatus | 'ALL',
                          )
                        }
                      />
                    </th>
                    <th scope="col">
                      <SortableHeader
                        column="reviewer"
                        label="Reviewer"
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th scope="col">
                      <SortableHeader
                        column="submittedAt"
                        label="Updated"
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th scope="col" className={styles.thActions}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPapers.map((paper) => {
                    const showReviewer =
                      paper.status === 'REVIEWER_ASSIGNED' ||
                      paper.status === 'UNDER_REVIEW' ||
                      paper.status === 'REVIEWER_RECOMMENDED_ACCEPT' ||
                      paper.status === 'REVIEWER_RECOMMENDED_REJECT' ||
                      Boolean(paper.reviewer);
                    return (
                      <tr key={paper.id} data-testid="researcher-submission-row" data-paper-id={paper.id}>
                        <td className={styles.tdTitle}>
                          <button
                            type="button"
                            className={styles.titleLink}
                            onClick={() =>
                              navigate(`/researcher/submissions/${paper.id}`)
                            }
                            aria-label={`Open ${paper.title}`}
                          >
                            {paper.title}
                          </button>
                          <span className={styles.titleMeta}>
                            {paper.paperType || 'Not supplied'}
                            {paper.version != null ? ` · v${paper.version}` : ''}
                          </span>
                        </td>
                        <td>
                          <StatusBadge
                            status={paper.status}
                            label={statusLabel(paper.status)}
                            size="sm"
                          />
                        </td>
                        <td>
                          {showReviewer ? (
                            <div className={styles.reviewerCell}>
                              <span className={styles.reviewerName}>
                                {paper.reviewer?.reviewerName ?? 'Assignment pending'}
                              </span>
                              <span className={styles.reviewerHint}>
                                {paper.reviewer ? 'Reviewer assigned' : 'Assignment in progress'}
                              </span>
                            </div>
                          ) : (
                            <span className={styles.reviewerHint}>
                              Not assigned
                            </span>
                          )}
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
                            Open
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