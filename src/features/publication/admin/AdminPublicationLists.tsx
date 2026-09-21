/**
 * AdminPublicationLists — Admin listing surface for reviewer assignments
 * and published papers. Both pages share the same toolbar/table/pagination
 * pattern; the only thing that differs is the status filter applied on top
 * of the API feed.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Inbox, X } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { publicationAdapter } from '../api/publication.adapter';
import { useTableSort } from '../../../hooks/useTableSort';
import shared from '../components/PublicationShared.module.css';
import { formatDate } from '../../../utils/formatDate';
import { PageHeader } from '../../../components/PageHeader';
import { TableToolbar } from '../../../components/table/TableToolbar';
import { TablePagination } from '../../../components/table/TablePagination';
import { SortableHeader } from '../../../components/table/SortableHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { Button } from '../../../components/Button/Button';
import { DEFAULT_PAGE_SIZE } from '../../../utils/tableConstants';
import {
  statusLabel,
  paperTypeLabel,
  type PublicationPaper,
  type PublicationStatus,
} from '../types/publication';
import {
  doiHref,
  publicReviewerName,
  resolveIdentifiers,
  matchesSearch,
  statusBadgeClass,
} from './adminPublicationHelpers';
import adminStyles from './AdminPublication.module.css';
import { AdminPaperPreviewModal } from './AdminPaperPreviewModal';
import { RejectPaperModal } from './RejectPaperModal';
import { PublicationConfirmation } from './PublicationConfirmation';

interface StatusTabOption {
  value: string;
  label: string;
}

interface AdminListConfig {
  eyebrowKey: string;
  titleKey: string;
  subtitleKey: string;
  statusOptions: readonly string[];
  defaultStatus: string;
  /** Human-friendly item label used by the pagination control. */
  itemLabel: string;
  /** Optional map of status → custom display label for the filter tabs. */
  customLabels?: Partial<Record<string, string>>;
  scopeFilter?: (paper: PublicationPaper) => boolean;
  getBucket?: (paper: PublicationPaper) => string;
  /**
   * Path prefix for the detail page this list links to. When undefined the
   * list falls back to `/admin/paper-submissions/:id` so the
   * `Paper Submissions` sidebar item stays highlighted. Lists whose
   * sidebar item is *not* `Paper Submissions` (e.g. Reviewer
   * Assignments) override this so the user is taken to a sibling
   * detail route whose own sidebar item remains highlighted.
   */
  detailPathBase?: string;
}

type AdminListSortColumn =
  | 'title'
  | 'status'
  | 'reviewer'
  | 'submittedAt';

const isReviewerAssignedPaper = (paper: PublicationPaper): boolean =>
  Boolean(
    paper.reviewRequestId != null ||
    paper.reviewer != null ||
    (paper.assignedReviewers && paper.assignedReviewers.length > 0) ||
    [
      'REVIEWER_ASSIGNED',
      'UNDER_REVIEW',
      'REVISION_REQUIRED',
      'RESUBMITTED',
      'REVIEWER_RECOMMENDED_ACCEPT',
      'REVIEWER_RECOMMENDED_REJECT',
    ].includes(paper.status)
  );

const getReviewerAssignmentBucket = (paper: PublicationPaper): string => {
  const reqStatus = (paper.reviewRequestStatus ?? '').toUpperCase();
  if (
    reqStatus === 'COMPLETED' ||
    paper.status === 'REVIEWER_RECOMMENDED_ACCEPT' ||
    paper.status === 'REVIEWER_RECOMMENDED_REJECT' ||
    Boolean(paper.reviewer?.recommendation)
  ) {
    return 'REVIEWER_RECOMMENDED_ACCEPT';
  }
  if (
    reqStatus === 'IN_PROGRESS' ||
    reqStatus === 'INPROGRESS' ||
    reqStatus === 'IN PROGRESS' ||
    paper.status === 'UNDER_REVIEW'
  ) {
    return 'UNDER_REVIEW';
  }
  if (reqStatus === 'PENDING' || paper.status === 'REVIEWER_ASSIGNED') {
    return 'REVIEWER_ASSIGNED';
  }
  return paper.status;
};

const REVIEWER_ASSIGNMENTS_CONFIG: AdminListConfig = {
  eyebrowKey: 'admin.publicationLists.assignmentsEyebrow',
  titleKey: 'admin.publicationLists.assignmentsTitle',
  subtitleKey: 'admin.publicationLists.assignmentsSubtitle',
  statusOptions: [
    'UNDER_REVIEW',
    'REVIEWER_ASSIGNED',
    'REVIEWER_RECOMMENDED_ACCEPT',
  ],
  defaultStatus: 'ALL',
  itemLabel: 'assignments',
  scopeFilter: isReviewerAssignedPaper,
  getBucket: getReviewerAssignmentBucket,
  // Reviewer Assignments list links to a sibling detail route so the
  // "Reviewer Assignments" sidebar item remains highlighted in the
  // nav after the click.
  detailPathBase: '/admin/reviewer-assignments',
  customLabels: {
    UNDER_REVIEW: 'Under Review',
    REVIEWER_ASSIGNED: 'Assigned',
    REVIEWER_RECOMMENDED_ACCEPT: 'Completed',
  },
};

const PUBLISHED_PAPERS_CONFIG: AdminListConfig = {
  eyebrowKey: 'admin.publicationLists.publishedEyebrow',
  titleKey: 'admin.publicationLists.publishedTitle',
  subtitleKey: 'admin.publicationLists.publishedSubtitle',
  statusOptions: ['PUBLISHED', 'INACTIVE'],
  defaultStatus: 'ALL',
  itemLabel: 'published papers',
};

// Build tab options from status options with i18n support
const buildTabOptions = (
  config: AdminListConfig,
  t: (key: string, fallback?: string) => string,
): StatusTabOption[] => {
  const customLabels = config.customLabels ?? {};
  return [
    { value: 'ALL', label: t('admin.publicationLists.tabAll', 'All') },
    ...config.statusOptions.map((status) => {
      let label = customLabels[status] ?? (statusLabel as (s: string) => string)(status as PublicationStatus);
      if (status === 'UNDER_REVIEW') label = t('admin.publicationLists.tabUnderReview', customLabels[status] ?? 'Under Review');
      else if (status === 'REVIEWER_ASSIGNED') label = t('admin.publicationLists.tabAssigned', customLabels[status] ?? 'Assigned');
      else if (status === 'REVIEWER_RECOMMENDED_ACCEPT') label = t('admin.publicationLists.tabCompleted', customLabels[status] ?? 'Completed');
      return {
        value: status,
        label,
      };
    }),
  ];
};

const AdminList = ({
  config,
}: {
  config: AdminListConfig;
}) => {
  const { t } = useI18n();
  const localizedConfig = {
    ...config,
    eyebrow: t(config.eyebrowKey, config.eyebrowKey),
    title: t(config.titleKey, config.titleKey),
    subtitle: t(config.subtitleKey, config.subtitleKey),
  };
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<string>(
    config.defaultStatus,
  );
  const [page, setPage] = useState(1);
  const [previewing, setPreviewing] = useState<PublicationPaper | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectingPaper, setRejectingPaper] = useState<PublicationPaper | null>(null);
  const [visibilityPaper, setVisibilityPaper] = useState<PublicationPaper | null>(null);
  const mutationBusy = useRef(false);
  const busy = Boolean(publishingId || deactivatingId || rejectingId);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Build tab options for this config
  const tabOptions = useMemo(() => buildTabOptions(config, t), [config, t]);

  // Scoped papers: either custom scopeFilter (for Reviewer Assignments) or statusOptions (for Published Papers)
  const scoped = useMemo(
    () => (config.scopeFilter ? papers.filter(config.scopeFilter) : papers.filter((paper) => config.statusOptions.includes(paper.status))),
    [papers, config],
  );

  // Count papers per status tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 };
    tabOptions.forEach((tab) => {
      if (tab.value !== 'ALL') counts[tab.value] = 0;
    });

    scoped.forEach((paper) => {
      counts.ALL++;
      const bucket = config.getBucket ? config.getBucket(paper) : paper.status;
      if (counts[bucket] !== undefined) {
        counts[bucket]++;
      }
    });
    return counts;
  }, [scoped, tabOptions, config]);

  // Default sort by submittedAt (newest first) so recently submitted papers
  // surface at the top. The user can override per column header click.
  const sort = useTableSort<PublicationPaper, AdminListSortColumn>(
    'submittedAt',
    'desc',
  );

  const handlePublish = async (paper: PublicationPaper) => {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    setPublishingId(paper.id);
    setActionFeedback(null);
    try {
      const updated = await publicationAdapter.publishPaper(paper.id);
      setPapers((items) => items.map((item) => item.id === updated.id ? updated : item));
      await load(true);

      // Best-effort reward notification. We surface the secondary
      // toast only when the BE actually delivered one, so admins are
      // not told a reward fired when it didn't.
      let rewardToast: string | null = null;
      try {
        const reward = await publicationAdapter.notifyAuthorOfPublishedPaperReward(
          paper.id,
          t,
        );
        if (reward.delivered) {
          rewardToast = t(
            'admin.publicationLists.publishWithRewardToast',
            'The researcher has been notified of the reward.',
          );
        }
      } catch (rewardErr) {
        // Swallow — the publish already succeeded; never block on the
        // reward side-effect.
        console.warn('Reward notification flow failed:', rewardErr);
      }

      const baseMessage = t(
        'admin.publicationLists.successPublished',
        `The paper "${paper.title}" was published successfully and its author was notified.`,
        { title: paper.title },
      );
      setActionFeedback({
        type: 'success',
        message: rewardToast
          ? `${baseMessage} ${rewardToast}`
          : baseMessage,
      });
    } catch (e) {
      setActionFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : t('admin.publicationLists.errorPublish', 'The paper could not be published.'),
      });
    } finally {
      setPublishingId(null);
      mutationBusy.current = false;
    }
  };

  const handleDeactivate = async (paper: PublicationPaper) => {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    setDeactivatingId(paper.id);
    setActionFeedback(null);
    try {
      const updated = paper.status === 'INACTIVE'
        ? await publicationAdapter.reactivatePublishedPaper(paper.id)
        : await publicationAdapter.deactivatePublishedPaper(paper.id);
      setPapers((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      await load(true);
      setVisibilityPaper(null);
      setActionFeedback({ type: 'success', message: `The paper "${paper.title}" is now ${updated.status === 'INACTIVE' ? 'inactive' : 'active'}.` });
    } catch (e) {
      setActionFeedback({ type: 'error', message: e instanceof Error ? e.message : t('admin.publicationLists.errorDeactivate', 'The paper could not be deactivated.') });
    } finally {
      setDeactivatingId(null);
      mutationBusy.current = false;
    }
  };


  const handleReject = async (paper: PublicationPaper, reason: string) => {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    setRejectingId(paper.id);
    setActionFeedback(null);
    try {
      const updated = await publicationAdapter.rejectPaper(paper.id, reason);
      setPapers((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      await load(true);
      setRejectingPaper(null);
      setActionFeedback({ type: 'success', message: `The paper "${paper.title}" was rejected.` });
    } catch (e) {
      setActionFeedback({ type: 'error', message: e instanceof Error ? e.message : t('admin.publicationLists.errorReject', 'The paper could not be rejected.') });
    } finally {
      setRejectingId(null);
      mutationBusy.current = false;
    }
  };

  const load = async (propagateError = false): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const items = await publicationAdapter.getAdminSubmissions();
      setPapers(items);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `${localizedConfig.title} could not be loaded.`,
      );
      if (propagateError) throw e;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the search and status filters before sorting the full result set.
  const sortedFiltered = useMemo(() => {
    const filtered = scoped.filter((paper) => {
      // Apply status tab filter
      if (statusTab !== 'ALL') {
        const bucket = config.getBucket ? config.getBucket(paper) : paper.status;
        if (bucket !== statusTab) return false;
      }
      // Apply search filter
      if (search.trim() && !matchesSearch(paper, search.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
    return sort.sortedItemsBy(filtered, (paper) => {
      switch (sort.sortState.column) {
        case 'title':
          return paper.title ?? '';
        case 'status':
          return paper.status;
        case 'reviewer': {
          const firstRev = paper.assignedReviewers?.[0]?.reviewerName;
          return firstRev ?? paper.reviewer?.reviewerName ?? '';
        }
        case 'submittedAt':
        default:
          return paper.submittedAt ?? paper.createdAt ?? null;
      }
    });
  }, [scoped, sort, statusTab, search, config]);

  const totalCount = sortedFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * DEFAULT_PAGE_SIZE;
  const pagedItems = sortedFiltered.slice(start, start + DEFAULT_PAGE_SIZE);
  const paging = useMemo(
    () => ({
      items: pagedItems,
      totalCount,
      page: safePage,
      pageSize: DEFAULT_PAGE_SIZE,
      totalPages,
    }),
    [pagedItems, totalCount, safePage, totalPages],
  );

  useEffect(() => {
    setPage(1);
  }, [statusTab, search, sort.sortState]);

  return (
    <section className={`${shared.page} ${adminStyles.page}`}>
      <PageHeader
        title={localizedConfig.title}
        description={localizedConfig.subtitle}
        accent="var(--ars-admin)"
      />

      {/* Tab filter for status */}
      <div className={adminStyles.tabFilterBar} role="tablist" aria-label="Filter by status">
        {tabOptions.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={statusTab === tab.value}
            className={`${adminStyles.tabButton} ${statusTab === tab.value ? adminStyles.tabButtonActive : ''}`}
            onClick={() => setStatusTab(tab.value)}
            type="button"
          >
            {tab.label}
            <span className={adminStyles.tabCount}>{tabCounts[tab.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <TableToolbar
        search={search}
        onSearchChange={error ? () => undefined : setSearch}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        isRefreshing={refreshing}
        searchPlaceholder={t('admin.publicationLists.searchPlaceholder', 'Search title, author, DOI, reviewer, or topic')}
        refreshLabel={t('admin.publicationLists.refresh', 'Refresh')}
      />

      {actionFeedback ? (
        <div
          className={`${adminStyles.feedbackBanner} ${
            actionFeedback.type === 'success'
              ? adminStyles.feedbackSuccess
              : adminStyles.feedbackError
          }`}
          role="alert"
        >
          <span>{actionFeedback.message}</span>
          <button
            type="button"
            className={adminStyles.feedbackCloseButton}
            aria-label={t('admin.publicationLists.dismissMessage', 'Dismiss message')}
            onClick={() => setActionFeedback(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className={adminStyles.tableWrap}>
          <div className={shared.loading} role="status">
            <SkeletonRow count={8} rowHeight={28} withHeader />
          </div>
        </div>
      ) : error ? (
        <ErrorBanner
          tone="error"
          title={t('admin.publicationLists.loadFailed', 'Could not load {title}').replace('{title}', localizedConfig.title.toLowerCase())}
          message={error}
          retry={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRefreshing(true);
                void load();
              }}
              disabled={loading || refreshing}
            >
              {loading || refreshing ? t('admin.publicationLists.retrying', 'Retrying…') : t('admin.publicationLists.retry', 'Retry')}
            </Button>
          }
        />
      ) : paging.items.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} />}
          title={t('admin.publicationLists.emptyTitle', 'No {itemLabel} match the current filters.').replace('{itemLabel}', localizedConfig.itemLabel)}
          description={t('admin.publicationLists.emptyDesc', 'Adjust the search query or select a different status tab.')}
        />
      ) : (
        <>
          <div className={adminStyles.tableWrap}>
            <table className={adminStyles.table} aria-label={localizedConfig.title}>
              <thead>
                <tr>
                  <th scope="col">
                    <SortableHeader
                      column="title"
                      label={t('admin.publicationLists.paperColumn', 'Paper')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th scope="col">
                    <SortableHeader
                      column="status"
                      label={t('admin.publicationLists.statusColumn', 'Status')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th scope="col">{t('admin.publicationLists.identifiersColumn', 'Identifiers')}</th>
                  <th scope="col">
                    <SortableHeader
                      column="reviewer"
                      label={t('admin.publicationLists.reviewerColumn', 'Reviewer')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th scope="col">{t('admin.publicationLists.manuscriptColumn', 'Manuscript')}</th>
                  <th scope="col" align="right">
                    {t('admin.publicationLists.actionsColumn', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paging.items.map((paper) => {
                  const identifiers = resolveIdentifiers(paper);
                  const reviewer =
                    publicReviewerName(paper) ?? paper.reviewer?.reviewerName ?? null;
                  const fileHref = paper.fileUrl?.trim();
                  return (
                    <tr key={paper.id}>
                      <td data-label="Paper">
                        <div className={adminStyles.titleCell}>
                          <strong>{paper.title}</strong>
                          <small>
                            {paperTypeLabel(paper.paperType) ? `${paperTypeLabel(paper.paperType)} · ` : ''}
                            {paper.version != null ? `v${paper.version}` : ''} ·{' '}
                            {paper.authors.map((author) => author.name).join(', ')}
                          </small>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`${adminStyles.statusBadge} ${
                            adminStyles[statusBadgeClass(paper.status)] ?? ''
                          }`}
                        >
                          {statusLabel(paper.status)}
                        </span>
                      </td>
                      <td data-label="Identifiers">
                        <div className={adminStyles.identifierList}>
                          {identifiers.doi ? (
                            <span className={adminStyles.identifierChip}>
                              DOI:{' '}
                              {doiHref(identifiers.doi) ? (
                                <a
                                  href={doiHref(identifiers.doi)!}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {identifiers.doi}
                                </a>
                              ) : (
                                identifiers.doi
                              )}
                            </span>
                          ) : null}
                          {identifiers.openAlexId ? (
                            <span className={adminStyles.identifierChip}>
                              OpenAlex: {identifiers.openAlexId}
                            </span>
                          ) : null}
                          {identifiers.externalIdentifier ? (
                            <span className={adminStyles.identifierChip}>
                              External: {identifiers.externalIdentifier}
                            </span>
                          ) : null}
                          {!identifiers.doi &&
                          !identifiers.openAlexId &&
                          !identifiers.externalIdentifier ? (
                            <span className={adminStyles.fileMissing}>
                              No identifier supplied
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Reviewer">
                        {paper.assignedReviewers && paper.assignedReviewers.length > 0 ? (
                          <div className={adminStyles.reviewerCell}>
                            {paper.assignedReviewers.map((rev, rIdx) => {
                              const revStatus = (rev.status ?? '').toLowerCase();
                              const statusClass =
                                revStatus === 'completed'
                                  ? adminStyles.reviewerStatusCompleted
                                  : revStatus === 'in progress' || revStatus === 'in_progress'
                                    ? adminStyles.reviewerStatusInProgress
                                    : adminStyles.reviewerStatusPending;
                              return (
                                <div key={rev.reviewRequestId ?? rIdx} className={adminStyles.reviewerRow}>
                                  <span className={adminStyles.reviewerName}>{rev.reviewerName}</span>
                                  {rev.reviewerEmail ? (
                                    <span className={adminStyles.reviewerEmail}>{rev.reviewerEmail}</span>
                                  ) : null}
                                  <div className={adminStyles.reviewerMeta}>
                                    <span className={`${adminStyles.reviewerStatusBadge} ${statusClass}`}>
                                      {rev.status || t('admin.publicationLists.assignedBadge', 'Assigned')}
                                    </span>
                                    {rev.deadline ? (
                                      <small className={shared.fieldHint}>
                                        {formatDate(rev.deadline)}
                                      </small>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : reviewer ? (
                          <span>
                            <strong>{reviewer}</strong>
                            <br />
                            <small className={shared.fieldHint}>
                              Public:{' '}
                              {paper.reviewerIdentityPublic ? 'Yes' : 'No (private)'}
                            </small>
                          </span>
                        ) : (
                          <span className={adminStyles.fileMissing}>
                            {t('admin.publicationLists.notAssigned', 'Not assigned')}
                          </span>
                        )}
                      </td>
                      <td data-label="Manuscript">
                        {fileHref ? (
                          <a
                            className={adminStyles.fileLink}
                            href={fileHref}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FileText size={14} aria-hidden="true" /> Open
                          </a>
                        ) : (
                          <span className={adminStyles.fileMissing}>
                            No file URL
                          </span>
                        )}
                      </td>
                      <td data-label={t('admin.publicationLists.actionsColumn', 'Actions')} align="right">
                        <div className={shared.actions}>
                          {/* Review record */}
                          <Link
                            className={adminStyles.previewButton}
                            to={`${config.detailPathBase ?? '/admin/paper-submissions'}/${paper.id}`}
                            title={t('admin.publicationLists.recordTooltip', 'Open the submission and reviewer record')}
                          >
                            <FileText size={13} aria-hidden="true" /> {t('admin.publicationLists.viewEvaluation', 'View evaluation')}
                          </Link>

                          {/*
                            Publication actions are gated STRICTLY on the paper's
                            editorial `status` — never on
                            `paper.reviewer?.recommendation` alone. A reviewer
                            may have recommended ACCEPT for an earlier review
                            round, but until Admin returns the paper to a
                            post-recommendation state, the Publish button must
                            remain disabled. This matches the lifecycle the
                            admin detail page enforces via
                            `adminActionsForStatus()` — see
                            adminPublicationHelpers.ts.
                          */}
                          {paper.status === 'PUBLISHED' || paper.status === 'INACTIVE' ? (
                            <button
                              type="button"
                              className={
                                paper.status === 'INACTIVE'
                                  ? adminStyles.publishButton
                                  : adminStyles.deactivateButton
                              }
                              onClick={() => setVisibilityPaper(paper)}
                              disabled={busy}
                            >
                              <FileText size={13} aria-hidden="true" /> {paper.status === 'INACTIVE' ? 'Reactivate' : 'Deactivate'}
                            </button>
                          ) : paper.status === 'REVIEWER_RECOMMENDED_ACCEPT' ||
                              paper.status === 'ADMIN_APPROVED' ? (
                            <button
                              type="button"
                              className={adminStyles.publishButton}
                              disabled={busy}
                              onClick={() => void handlePublish(paper)}
                              title={t('admin.publicationLists.publishTooltip', 'Publish this paper — only available after the reviewer recommended acceptance.')}
                            >
                              {publishingId === paper.id ? t('admin.publicationLists.publishing', 'Publishing…') : <><ExternalLink size={13} aria-hidden="true" /> {t('admin.publicationLists.publishPaper', 'Publish')}</>}
                            </button>
                          ) : paper.status === 'REVIEWER_RECOMMENDED_REJECT' ? (
                            <button
                              type="button"
                              className={adminStyles.rejectActionButton}
                              disabled={busy}
                              onClick={() => setRejectingPaper(paper)}
                              title={t('admin.publicationLists.rejectTooltip', 'Reject this paper')}
                            >
                              {t('admin.publicationLists.rejectPaper', 'Reject')}
                            </button>
                          ) : (
                            // REVIEWER_ASSIGNED / UNDER_REVIEW / DRAFT /
                            // SUBMITTED / READY_FOR_REVIEWER / etc.: render
                            // a disabled placeholder so the Admin sees the
                            // row still needs the reviewer to submit a
                            // recommendation before Publish becomes
                            // available.
                            <button
                              type="button"
                              className={adminStyles.publishButton}
                              disabled
                              title={t(
                                'admin.publicationLists.publishDisabledTooltip',
                                'Publish is unlocked after the assigned reviewer submits a recommendation.',
                              )}
                              aria-disabled="true"
                            >
                              <ExternalLink size={13} aria-hidden="true" /> {t('admin.publicationLists.publishPaper', 'Publish')}
                            </button>
                          )}

                          <button
                            type="button"
                            className={shared.buttonGhost}
                            onClick={() => setPreviewing(paper)}
                            aria-label={t('admin.publicationLists.previewAria', 'Preview {title}').replace('{title}', paper.title)}
                          >
                            <ExternalLink size={12} aria-hidden="true" /> {t('admin.publicationLists.previewButton', 'Preview')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={paging.page}
            totalPages={paging.totalPages}
            totalItems={paging.totalCount}
            startIndex={(paging.page - 1) * paging.pageSize + 1}
            endIndex={Math.min(
              paging.totalCount,
              paging.page * paging.pageSize,
            )}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(paging.totalPages, p + 1))}
            onPage={setPage}
            itemLabel={localizedConfig.itemLabel}
          />
        </>
      )}

      {previewing ? (
        <AdminPaperPreviewModal
          paper={previewing}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
      {rejectingPaper ? (
        <RejectPaperModal
          error={actionFeedback?.type === 'error' ? actionFeedback.message : undefined}
          paperTitle={rejectingPaper.title}
          isSubmitting={rejectingId === rejectingPaper.id}
          onClose={() => setRejectingPaper(null)}
          onConfirm={(reason) => void handleReject(rejectingPaper, reason)}
        />
      ) : null}
      {visibilityPaper ? (
        <PublicationConfirmation
          title={visibilityPaper.status === 'INACTIVE' ? 'Reactivate paper' : 'Deactivate paper'}
          message={visibilityPaper.status === 'INACTIVE' ? `Restore "${visibilityPaper.title}" to the public catalog?` : `Hide "${visibilityPaper.title}" from the public catalog? The Admin record will remain available.`}
          busy={busy}
          error={actionFeedback?.type === 'error' ? actionFeedback.message : undefined}
          onClose={() => setVisibilityPaper(null)}
          onConfirm={() => void handleDeactivate(visibilityPaper)}
        />
      ) : null}
    </section>
  );
};

export const AdminReviewerAssignments = () => (
  <AdminList config={REVIEWER_ASSIGNMENTS_CONFIG} />
);
export const AdminPublishedPapers = () => (
  <AdminList config={PUBLISHED_PAPERS_CONFIG} />
);
