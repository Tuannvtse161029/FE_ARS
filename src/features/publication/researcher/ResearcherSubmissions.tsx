import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Plus } from 'lucide-react';
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
  publicReviewerName,
  statusLabel,
  type PublicationPaper,
  type PublicationStatus,
} from '../types/publication';
import { formatDisplayDate } from '../../../utils/datetime';
import { useT } from '../../../i18n/I18nContext';
import styles from './researcher.module.css';

/** Sortable column ids for the Researcher Submissions table. */
type SortColumn = 'title' | 'status' | 'submittedAt';

// ResearcherSubmissions — Researcher-only list of manuscripts the
// current author owns. Coordinator authority: the route /researcher/
// submissions is rendered only when RoleRouteGuard admits the Researcher
// role; the API adapter filters by authorId server-side.
//
// Visual: status-first table. Status badge is the leading scannable
// column; the rest is plain metadata. No decorative patterns. All
// tokens come from ars-tokens.css and the shared PageHeader /
// StatusBadge / Button / Input family.
//
// The toolbar exposes two filters that work together:
//   1. Stage groups — visual buckets that map the 16 BE statuses into a
//      handful of meaningful editorial stages (Draft / In review / Decision /
//      Closed). Selecting a stage filters the table to all statuses that
//      belong to that stage.
//   2. Status tabs — every PUBLICATION_STATUSES value is represented as a
//      tab so the author can pivot to a precise status without losing the
//      totals. Every visible row is counted; unknown / orphan statuses are
//      preserved under the "Other" tab so totals never drift.
//
// Stage → status mapping is documented in `STAGE_GROUPS`. Adding a new
// status requires only adding it to `PUBLICATION_STATUSES` and to the
// relevant stage group; the tabs are auto-generated from
// `STAGE_GROUPS.flatMap(...)`.

const RESEARCHER_ACCENT = 'var(--ars-researcher)';

type StageTab = 'ALL' | 'DRAFT' | 'IN_REVIEW' | 'DECISION' | 'CLOSED' | 'OTHER';
type StatusTab = PublicationStatus | 'ALL';

const STAGE_GROUPS: ReadonlyArray<{
  value: StageTab;
  i18nKey: string;
  statuses: ReadonlySet<PublicationStatus>;
}> = [
  {
    value: 'DRAFT',
    i18nKey: 'researcher.submissions.stage.draft',
    statuses: new Set<PublicationStatus>(['DRAFT']),
  },
  {
    value: 'IN_REVIEW',
    i18nKey: 'researcher.submissions.stage.inReview',
    statuses: new Set<PublicationStatus>([
      'SUBMITTED',
      'ADMIN_SCREENING',
      'RESEARCHER_VERIFICATION_REQUIRED',
      'READY_FOR_REVIEWER',
      'REVIEWER_ASSIGNED',
      'UNDER_REVIEW',
      'REVISION_REQUIRED',
      'RESUBMITTED',
    ]),
  },
  {
    value: 'DECISION',
    i18nKey: 'researcher.submissions.stage.decision',
    statuses: new Set<PublicationStatus>([
      'REVIEWER_RECOMMENDED_ACCEPT',
      'REVIEWER_RECOMMENDED_REJECT',
      'ADMIN_APPROVED',
      'PUBLISHED',
    ]),
  },
  {
    value: 'CLOSED',
    i18nKey: 'researcher.submissions.stage.closed',
    statuses: new Set<PublicationStatus>(['ADMIN_REJECTED', 'WITHDRAWN', 'INACTIVE']),
  },
];

/** Returns the stage tab a status belongs to. Unknown statuses fall under
 *  "OTHER" so they still surface in totals. */
const stageForStatus = (status: PublicationStatus): StageTab => {
  for (const group of STAGE_GROUPS) {
    if (group.statuses.has(status)) return group.value;
  }
  return 'OTHER';
};

const ALL_STATUS_TABS: ReadonlyArray<{ value: StatusTab; i18nKey: string }> = [
  { value: 'ALL', i18nKey: 'reviewer.assignments.tab.all' },
  { value: 'DRAFT', i18nKey: 'paperStatus.DRAFT' },
  { value: 'SUBMITTED', i18nKey: 'paperStatus.SUBMITTED' },
  { value: 'ADMIN_SCREENING', i18nKey: 'paperStatus.ADMIN_SCREENING' },
  { value: 'RESEARCHER_VERIFICATION_REQUIRED', i18nKey: 'paperStatus.RESEARCHER_VERIFICATION_REQUIRED' },
  { value: 'READY_FOR_REVIEWER', i18nKey: 'paperStatus.READY_FOR_REVIEWER' },
  { value: 'REVIEWER_ASSIGNED', i18nKey: 'paperStatus.REVIEWER_ASSIGNED' },
  { value: 'UNDER_REVIEW', i18nKey: 'paperStatus.UNDER_REVIEW' },
  { value: 'REVISION_REQUIRED', i18nKey: 'paperStatus.REVISION_REQUIRED' },
  { value: 'RESUBMITTED', i18nKey: 'paperStatus.RESUBMITTED' },
  { value: 'REVIEWER_RECOMMENDED_ACCEPT', i18nKey: 'paperStatus.REVIEWER_RECOMMENDED_ACCEPT' },
  { value: 'REVIEWER_RECOMMENDED_REJECT', i18nKey: 'paperStatus.REVIEWER_RECOMMENDED_REJECT' },
  { value: 'ADMIN_APPROVED', i18nKey: 'paperStatus.ADMIN_APPROVED' },
  { value: 'PUBLISHED', i18nKey: 'paperStatus.PUBLISHED' },
  { value: 'ADMIN_REJECTED', i18nKey: 'paperStatus.ADMIN_REJECTED' },
  { value: 'WITHDRAWN', i18nKey: 'paperStatus.WITHDRAWN' },
  { value: 'INACTIVE', i18nKey: 'paperStatus.INACTIVE' },
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
  // Stage + status filters operate together — selecting a stage narrows
  // the status tabs to statuses in that stage.
  const [stageTab, setStageTab] = useState<StageTab>('ALL');
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL');

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

  // Count papers per stage tab — ALL papers are counted; no status is hidden.
  const stageCounts = useMemo(() => {
    const counts: Record<StageTab, number> = {
      ALL: papers.length,
      DRAFT: 0,
      IN_REVIEW: 0,
      DECISION: 0,
      CLOSED: 0,
      OTHER: 0,
    };
    papers.forEach((paper) => {
      const stage = stageForStatus(paper.status);
      counts[stage] = (counts[stage] ?? 0) + 1;
    });
    return counts;
  }, [papers]);

  // Status tabs visible under the active stage. "ALL" stays available so
  // a researcher can pivot between the broad and narrow views.
  const visibleStatusTabs = useMemo(() => {
    if (stageTab === 'ALL' || stageTab === 'OTHER') {
      return ALL_STATUS_TABS;
    }
    const stage = STAGE_GROUPS.find((group) => group.value === stageTab);
    if (!stage) return ALL_STATUS_TABS;
    const stageStatuses = new Set(stage.statuses);
    return ALL_STATUS_TABS.filter(
      (tab) => tab.value === 'ALL' || stageStatuses.has(tab.value),
    );
  }, [stageTab]);

  // Count papers per status tab — only statuses in the active stage set
  // are counted, so the "All" status tab mirrors the stage total.
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 };
    const stageStatuses =
      stageTab === 'ALL' || stageTab === 'OTHER'
        ? null
        : STAGE_GROUPS.find((group) => group.value === stageTab)?.statuses ?? null;
    visibleStatusTabs.forEach((tab) => {
      if (tab.value !== 'ALL') counts[tab.value] = 0;
    });
    papers.forEach((paper) => {
      if (stageStatuses && !stageStatuses.has(paper.status)) return;
      counts.ALL = (counts.ALL ?? 0) + 1;
      if (counts[paper.status] !== undefined) {
        counts[paper.status] = (counts[paper.status] ?? 0) + 1;
      }
    });
    return counts;
  }, [papers, stageTab, visibleStatusTabs]);

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
    const stageStatuses =
      stageTab === 'ALL' || stageTab === 'OTHER'
        ? null
        : STAGE_GROUPS.find((group) => group.value === stageTab)?.statuses ?? null;
    return papers.filter((paper) => {
      if (stageStatuses && !stageStatuses.has(paper.status)) return false;
      // Apply status tab filter
      if (statusTab !== 'ALL' && paper.status !== statusTab) return false;
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
  }, [papers, search, statusTab, stageTab]);

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

  const stageLabel = (stage: StageTab): string => {
    if (stage === 'ALL') return t('reviewer.assignments.tab.all');
    if (stage === 'OTHER') return t('researcher.submissions.stage.other');
    return t(STAGE_GROUPS.find((group) => group.value === stage)?.i18nKey ?? stage);
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

          {/* Stage filter — selects an editorial stage group, which narrows
              the status tabs below it. Every paper is counted in exactly
              one stage; the "Other" stage preserves unknown/orphan states
              so the totals never drift. */}
          <div className={styles.tabFilterBar} role="tablist" aria-label={t('researcher.submissions.stage.aria')}>
            {(
              [
                { value: 'ALL' as StageTab },
                ...STAGE_GROUPS,
                { value: 'OTHER' as const, i18nKey: 'researcher.submissions.stage.other', statuses: new Set<PublicationStatus>() },
              ]
            ).map((stage) => (
              <button
                key={stage.value}
                role="tab"
                aria-selected={stageTab === stage.value}
                className={`${styles.tabButton} ${stageTab === stage.value ? styles.tabButtonActive : ''}`}
                onClick={() => {
                  setStageTab(stage.value as StageTab);
                  setStatusTab('ALL');
                }}
                type="button"
              >
                {stageLabel(stage.value as StageTab)}
                <span className={styles.tabCount}>{stageCounts[stage.value as StageTab] ?? 0}</span>
              </button>
            ))}
          </div>

          {/* Status filter — auto-narrows when a stage is active. Every
              status from PUBLICATION_STATUSES is represented here so no
              row is hidden from totals. */}
          <div className={styles.subTabFilterBar} role="tablist" aria-label={t('researcher.submissions.status.aria')}>
            {visibleStatusTabs.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={statusTab === tab.value}
                className={`${styles.subTabButton} ${statusTab === tab.value ? styles.subTabButtonActive : ''}`}
                onClick={() => setStatusTab(tab.value)}
                type="button"
              >
                {t(tab.i18nKey)}
                <span className={styles.tabCount}>{tabCounts[tab.value] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className={styles.toolbar} role="search">
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
            <span className={styles.count} aria-live="polite">
              {search
                ? t('researcher.submissions.count', undefined, {
                    visible: visiblePapers.length,
                    total: papers.length,
                  })
                : t('researcher.submissions.count_noChange', undefined, { total: papers.length })}
            </span>
          </div>

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
                    <th scope="col">{t('researcher.submissions.column.reviewer')}</th>
                    <th scope="col">{t('researcher.submissions.column.nextAction')}</th>
                    <th scope="col">
                      <SortableHeader
                        column="submittedAt"
                        label={t('researcher.submissions.column.updated')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th scope="col" className={styles.thActions}>{t('researcher.submissions.column.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPapers.map((paper) => {
                    // Determine what action the researcher needs to take, if any.
                    const researcherAction = (() => {
                      switch (paper.status) {
                        case 'DRAFT':
                          return { label: t('researcher.submissions.action.completeDraft'), tone: 'attention' as const };
                        case 'REVISION_REQUIRED':
                          return { label: t('researcher.submissions.action.submitRevision'), tone: 'attention' as const };
                        case 'RESEARCHER_VERIFICATION_REQUIRED':
                          return { label: t('researcher.submissions.action.verifyAuthorship'), tone: 'attention' as const };
                        case 'RESUBMITTED':
                        case 'SUBMITTED':
                        case 'ADMIN_SCREENING':
                        case 'READY_FOR_REVIEWER':
                        case 'REVIEWER_ASSIGNED':
                          return { label: t('researcher.submissions.action.awaitingAdmin'), tone: 'waiting' as const };
                        case 'UNDER_REVIEW':
                        case 'REVIEWER_RECOMMENDED_ACCEPT':
                        case 'REVIEWER_RECOMMENDED_REJECT':
                          return { label: t('researcher.submissions.action.awaitingDecision'), tone: 'waiting' as const };
                        case 'ADMIN_APPROVED':
                          return { label: t('researcher.submissions.action.awaitingPublication'), tone: 'waiting' as const };
                        case 'PUBLISHED':
                          return { label: t('researcher.submissions.action.published'), tone: 'success' as const };
                        case 'ADMIN_REJECTED':
                        case 'WITHDRAWN':
                        case 'INACTIVE':
                          return { label: statusLabel(paper.status), tone: 'inactive' as const };
                        default:
                          return { label: t('researcher.submissions.action.unknown'), tone: 'unknown' as const };
                      }
                    })();

                    // Reviewer display respects the shared identity-release rule.
                    const reviewerInfo = (() => {
                      if (!paper.reviewer) {
                        return { label: '—', hint: '' };
                      }
                      const publicName = publicReviewerName(paper);
                      if (publicName) {
                        return {
                          label: publicName,
                          hint: t('researcher.submissions.reviewer.public'),
                        };
                      }
                      return {
                        label: t('researcher.submissions.reviewer.assigned'),
                        hint: t('researcher.submissions.reviewer.confidential'),
                      };
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
                        </td>
                        <td>
                          <StatusBadge
                            status={paper.status}
                            label={statusLabel(paper.status)}
                            size="sm"
                          />
                        </td>
                        <td>
                          <div className={styles.reviewerCell}>
                            <span className={reviewerInfo.label === '—' ? styles.reviewerHint : styles.reviewerName}>
                              {reviewerInfo.label}
                            </span>
                            {reviewerInfo.hint && (
                              <span className={styles.reviewerHint}>{reviewerInfo.hint}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={styles.nextAction}
                            data-tone={researcherAction.tone}
                          >
                            {researcherAction.label}
                          </span>
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
