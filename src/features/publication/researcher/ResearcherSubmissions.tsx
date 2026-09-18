import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Plus, X } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { signalrService } from '../../../services/signalr.service';
import { useTableSort } from '../../../hooks/useTableSort';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { Button } from '../../../components/Button/Button';
import { SortableHeader } from '../../../components/table/SortableHeader';
import {
  paperTypeLabel,
  type PublicationPaper,
  type PublicationStatus,
} from '../types/publication';
import { formatDisplayDate } from '../../../utils/datetime';
import { useT } from '../../../i18n/I18nContext';
import {
  RESEARCHER_STATUS_FILTER_OPTIONS,
  toResearcherBucket,
  toResearcherBucketTone,
  type ResearcherBucket,
  type ResearcherBucketTone,
} from './researcherStatusGroups';
import styles from './researcher.module.css';

/** Sortable column ids for the Researcher Submissions table. */
type SortColumn = 'title' | 'status' | 'submittedAt';

/**
 * Single status bucket filter — the 5 user-facing buckets plus 'ALL'.
 * Replaces the per-BE-status filter that previously exposed every
 * PublicationStatus individually.
 */
type StatusFilter = ResearcherBucket;

const RESEARCHER_ACCENT = 'var(--ars-researcher)';

/**
 * Map a Researcher's bucket tone → matching StatusBadge variant.
 * StatusBadge receives the variant via the `status` prop and resolves
 * the corresponding palette token.
 */
const BUCKET_TONE_TO_VARIANT: Record<ResearcherBucketTone, string> = {
  pending: 'pubBucketPending',
  verified: 'pubBucketVerified',
  invalid: 'pubBucketInvalid',
  published: 'pubBucketPublished',
  needRevision: 'pubBucketNeedRevision',
  other: 'pubBucketOther',
};

/** Friendly display labels for the 5 user-facing buckets. */

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

  // Ref for keyboard navigation on tab bar
  const tabListRef = useRef<HTMLDivElement>(null);

  // Default sort by submittedAt (newest first) so recently submitted
  // submissions surface at the top. The user can override per column.
  const sort = useTableSort<PublicationPaper, SortColumn>('submittedAt', 'desc');

  const fetchPapers = useCallback(() => {
    setError(null);
    publicationAdapter
      .getResearcherSubmissions()
      .then((items) => {
        setPapers(items);
      })
      .catch(() => {
        setError(t('researcher.submissions.loadError.body'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Real-time paper status updates via SignalR
  useEffect(() => {
    const unsub = signalrService.onPaperStatusUpdated((data: unknown) => {
      try {
        if (data && typeof data === 'object') {
          const rawId = (data as { paperId?: unknown; id?: unknown }).paperId ?? (data as { id?: unknown }).id;
          const nextStatus = (data as { status?: unknown }).status;
          if (rawId !== undefined && typeof nextStatus === 'string') {
            setPapers((prev) =>
              prev.map((p) => {
                if (String(p.id) === String(rawId)) {
                  return { ...p, status: nextStatus as PublicationStatus };
                }
                return p;
              }),
            );
          }
        }
      } catch (err) {
        console.error('[ResearcherSubmissions] Failed to apply real-time paper update:', err);
      }
      // Trigger background refetch to synchronize all associated metadata
      fetchPapers();
    });

    return () => {
      unsub();
    };
  }, [fetchPapers]);

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

  // Count papers per bucket so the tab bar shows accurate totals.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: papers.length };
    for (const opt of RESEARCHER_STATUS_FILTER_OPTIONS) {
      if (opt.value === 'ALL') continue;
      counts[opt.value] = papers.filter((p) => {
        const bucket = toResearcherBucket(p.status);
        return bucket === opt.value;
      }).length;
    }
    return counts;
  }, [papers]);

  // Keyboard navigation handler for tab bar
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

  const visiblePapers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return papers.filter((paper) => {
      // Apply status filter (bucket filter)
      if (statusFilter !== 'ALL') {
        const bucket = toResearcherBucket(paper.status);
        if (bucket !== statusFilter) return false;
      }
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

          {/* ── Compact toolbar: search + status filter tabs + clear + count ─── */}
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

            {/* Status filter tab bar */}
            <div
              ref={tabListRef}
              role="tablist"
              aria-label={t('researcher.submissions.filter.label')}
              className={styles.tabBar}
              onKeyDown={handleTabKeyDown}
            >
              {RESEARCHER_STATUS_FILTER_OPTIONS.map((opt) => {
                const count = opt.value === 'ALL' ? papers.length : (statusCounts[opt.value] ?? 0);
                const isSelected = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    role="tab"
                    type="button"
                    className={styles.tab}
                    aria-selected={isSelected}
                    aria-description={t(opt.descriptionKey)}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setStatusFilter(opt.value)}
                  >
                    {t(opt.labelKey)}
                    <span className={styles.tabCount}>{count}</span>
                  </button>
                );
              })}
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
                    const bucket = toResearcherBucket(paper.status);
                    const bucketLabel = bucket ?? 'Other';
                    const bucketTone = toResearcherBucketTone(paper.status);
                    const badgeVariant = BUCKET_TONE_TO_VARIANT[bucketTone];

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
                          return t('researcher.submissions.action.awaitingDecision');
                        case 'ADMIN_APPROVED':
                          return t('researcher.submissions.action.awaitingPublication');
                        case 'PUBLISHED':
                          return t('researcher.submissions.action.published');
                        case 'ADMIN_REJECTED':
                        case 'WITHDRAWN':
                        case 'INACTIVE':
                          return bucketLabel;
                        case 'REVIEWER_RECOMMENDED_REJECT':
                          return t('researcher.submissions.action.awaitingDecision');
                        default:
                          return t('researcher.submissions.action.unknown');
                      }
                    })();

                    // Map bucket tone to the CSS data-tone attribute used by
                    // .nextAction (inline chip under the title).
                    const nextActionTone = (() => {
                      switch (bucketTone) {
                        case 'pending':    return 'submitted';
                        case 'verified':   return 'assigned';
                        case 'invalid':    return 'rejected';
                        case 'published':  return 'published';
                        case 'needRevision': return 'improvement';
                        case 'other':      return 'inactive';
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
                            {paperTypeLabel(paper.paperType) ? `${paperTypeLabel(paper.paperType)} · ` : ''}
                            {paper.version != null ? `v${paper.version}` : ''}
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
                            status={badgeVariant}
                            label={bucketLabel}
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
