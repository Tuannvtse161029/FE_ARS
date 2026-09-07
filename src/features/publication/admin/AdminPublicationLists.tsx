/**
 * AdminPublicationLists — Admin listing surface for reviewer assignments
 * and published papers. Both pages share the same toolbar/table/pagination
 * pattern; the only thing that differs is the status filter applied on top
 * of the API feed.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Inbox, X } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { publicationAdapter } from '../api/publication.adapter';
import { useTableSort } from '../../../hooks/useTableSort';
import shared from '../components/PublicationShared.module.css';
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

interface StatusTabOption {
  value: PublicationStatus | 'ALL';
  label: string;
}

interface AdminListConfig {
  eyebrow: string;
  title: string;
  subtitle: string;
  statusOptions: readonly PublicationStatus[];
  defaultStatus: PublicationStatus | 'ALL';
  /** Human-friendly item label used by the pagination control. */
  itemLabel: string;
}

type AdminListSortColumn =
  | 'title'
  | 'status'
  | 'reviewer'
  | 'submittedAt';

const REVIEWER_ASSIGNMENTS_CONFIG: Omit<AdminListConfig, 'eyebrow' | 'title' | 'subtitle'> & {
  eyebrowKey: string;
  titleKey: string;
  subtitleKey: string;
} = {
  eyebrowKey: 'admin.publicationLists.assignmentsEyebrow',
  titleKey: 'admin.publicationLists.assignmentsTitle',
  subtitleKey: 'admin.publicationLists.assignmentsSubtitle',
  statusOptions: [
    'REVIEWER_ASSIGNED',
    'UNDER_REVIEW',
    'REVIEWER_RECOMMENDED_ACCEPT',
    'REVIEWER_RECOMMENDED_REJECT',
    'ADMIN_APPROVED',
    // PUBLISHED is intentionally excluded — once Admin publishes a paper it
    // moves to the Published Papers tab. The Publish button no longer renders
    // for published rows in that tab, so the lifecycle stays predictable.
  ],
  defaultStatus: 'ALL',
  itemLabel: 'assignments',
};

const PUBLISHED_PAPERS_CONFIG: Omit<AdminListConfig, 'eyebrow' | 'title' | 'subtitle'> & {
  eyebrowKey: string;
  titleKey: string;
  subtitleKey: string;
} = {
  eyebrowKey: 'admin.publicationLists.publishedEyebrow',
  titleKey: 'admin.publicationLists.publishedTitle',
  subtitleKey: 'admin.publicationLists.publishedSubtitle',
  statusOptions: ['PUBLISHED', 'INACTIVE'],
  defaultStatus: 'ALL',
  itemLabel: 'published papers',
};

// Build tab options from status options
const buildTabOptions = (
  config: Omit<AdminListConfig, 'eyebrow' | 'title' | 'subtitle'> & {
    eyebrowKey: string;
    titleKey: string;
    subtitleKey: string;
  },
): StatusTabOption[] => {
  return [
    { value: 'ALL', label: 'All' },
    ...config.statusOptions.map((status) => ({
      value: status as PublicationStatus | 'ALL',
      label: statusLabel(status),
    })),
  ];
};

const AdminList = ({
  config,
}: {
  config: Omit<AdminListConfig, 'eyebrow' | 'title' | 'subtitle'> & {
    eyebrowKey: string;
    titleKey: string;
    subtitleKey: string;
  };
}) => {
  const { t } = useI18n();
  const localizedConfig: AdminListConfig = {
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
  const [statusTab, setStatusTab] = useState<PublicationStatus | 'ALL'>(
    config.defaultStatus,
  );
  const [page, setPage] = useState(1);
  const [previewing, setPreviewing] = useState<PublicationPaper | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectingPaper, setRejectingPaper] = useState<PublicationPaper | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Build tab options for this config
  const tabOptions = useMemo(() => buildTabOptions(config), [config]);

  // Count papers per status tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 };
    tabOptions.forEach((tab) => {
      if (tab.value !== 'ALL') counts[tab.value] = 0;
    });

    papers.forEach((paper) => {
      counts.ALL++;
      if (counts[paper.status] !== undefined) {
        counts[paper.status]++;
      }
    });
    return counts;
  }, [papers, tabOptions]);

  // Default sort by submittedAt (newest first) so recently submitted papers
  // surface at the top. The user can override per column header click.
  const sort = useTableSort<PublicationPaper, AdminListSortColumn>(
    'submittedAt',
    'desc',
  );

  const handlePublish = async (paper: PublicationPaper) => {
    if (publishingId || rejectingId) return;
    setPublishingId(paper.id);
    setActionFeedback(null);
    try {
      await publicationAdapter.publishPaper(paper.id);
      await load();
      setActionFeedback({
        type: 'success',
        message: t(
          'admin.publicationLists.successPublished',
          'The paper "{title}" was published successfully and its author was notified.'
        ).replace('{title}', paper.title),
      });
    } catch (e) {
      setActionFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : t('admin.publicationLists.errorPublish', 'The paper could not be published.'),
      });
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeactivate = async (paper: PublicationPaper) => {
    if (deactivatingId || rejectingId) return;
    if (!window.confirm(t('admin.publicationLists.confirmDeactivate', 'Deactivate the published paper "{title}"? It will be hidden from the public catalog.').replace('{title}', paper.title))) return;
    setDeactivatingId(paper.id);
    setActionFeedback(null);
    try {
      await publicationAdapter.deactivatePublishedPaper(paper.id);
      setPapers((prev) => prev.map((p) => (p.id === paper.id ? { ...p, status: 'INACTIVE' } : p)));
      setActionFeedback({ type: 'success', message: t('admin.publicationLists.successDeactivated', 'The paper "{title}" is now inactive.').replace('{title}', paper.title) });
    } catch (e) {
      setActionFeedback({ type: 'error', message: e instanceof Error ? e.message : t('admin.publicationLists.errorDeactivate', 'The paper could not be deactivated.') });
    } finally {
      setDeactivatingId(null);
    }
  };


  const handleReject = async (paper: PublicationPaper, reason: string) => {
    if (publishingId || rejectingId) return;
    setRejectingPaper(null);
    setRejectingId(paper.id);
    setActionFeedback(null);
    try {
      await publicationAdapter.rejectPaper(paper.id, reason);
      setPapers((prev) => prev.map((p) => (p.id === paper.id ? { ...p, status: 'ADMIN_REJECTED' } : p)));
      setActionFeedback({ type: 'success', message: t('admin.publicationLists.successRejected', 'The paper "{title}" was rejected and its author was notified.').replace('{title}', paper.title) });
    } catch (e) {
      setActionFeedback({ type: 'error', message: e instanceof Error ? e.message : t('admin.publicationLists.errorReject', 'The paper could not be rejected.') });
    } finally {
      setRejectingId(null);
    }
  };

  const load = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const items = await publicationAdapter.getAdminSubmissions();
      setPapers(items);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `${localizedConfig.title} could not be loaded.`,
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The published-list view includes both active and deactivated published records.
  const scoped = useMemo(
    () => papers.filter((paper) => config.statusOptions.includes(paper.status)),
    [papers, config.statusOptions],
  );

  // Apply the search and status filters before sorting the full result set.
  const sortedFiltered = useMemo(() => {
    const filtered = scoped.filter((paper) => {
      // Apply status tab filter
      if (statusTab !== 'ALL' && paper.status !== statusTab) return false;
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
        case 'reviewer':
          return paper.reviewer?.reviewerName ?? '';
        case 'submittedAt':
        default:
          return paper.submittedAt ?? paper.createdAt ?? null;
      }
    });
  }, [scoped, sort, statusTab, search]);

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
        eyebrow={localizedConfig.eyebrow}
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
                            {paper.paperType}
                            {paper.version != null ? ` · v${paper.version}` : ''} ·{' '}
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
                        {reviewer ? (
                          <span>
                            {reviewer}
                            <br />
                            <small className={shared.fieldHint}>
                              Public:{' '}
                              {paper.reviewerIdentityPublic ? 'Yes' : 'No (private)'}
                            </small>
                          </span>
                        ) : (
                          <span className={adminStyles.fileMissing}>
                            Not assigned
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
                            to={`/admin/paper-submissions/${paper.id}`}
                            title={t('admin.publicationLists.recordTooltip', 'Open the editorial and reviewer record')}
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
                          {paper.status === 'PUBLISHED' ? (
                            <button type="button" className={adminStyles.publishButton} onClick={() => void handleDeactivate(paper)} disabled={deactivatingId === paper.id} title={t('admin.publicationLists.deactivateTooltip', 'Deactivate this published paper')}>
                              {deactivatingId === paper.id ? t('admin.publicationLists.deactivating', 'Deactivating…') : <><FileText size={13} aria-hidden="true" /> {t('admin.publicationLists.deactivatePaper', 'Deactivate')}</>}
                            </button>
                          ) : paper.status === 'REVIEWER_RECOMMENDED_ACCEPT' ||
                              paper.status === 'ADMIN_APPROVED' ? (
                            <button
                              type="button"
                              className={adminStyles.publishButton}
                              disabled={publishingId === paper.id}
                              onClick={() => void handlePublish(paper)}
                              title={t('admin.publicationLists.publishTooltip', 'Publish this paper — only available after the reviewer recommended acceptance.')}
                            >
                              {publishingId === paper.id ? t('admin.publicationLists.publishing', 'Publishing…') : <><ExternalLink size={13} aria-hidden="true" /> {t('admin.publicationLists.publishPaper', 'Publish')}</>}
                            </button>
                          ) : paper.status === 'REVIEWER_RECOMMENDED_REJECT' ? (
                            <button
                              type="button"
                              className={adminStyles.rejectActionButton}
                              disabled={rejectingId === paper.id}
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
          paperTitle={rejectingPaper.title}
          isSubmitting={rejectingId === rejectingPaper.id}
          onClose={() => setRejectingPaper(null)}
          onConfirm={(reason) => void handleReject(rejectingPaper, reason)}
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
