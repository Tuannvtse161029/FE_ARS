/**
 * AdminPublicationLists — Admin listing surface for reviewer assignments
 * and published papers. Both pages share the same toolbar/table/pagination
 * pattern; the only thing that differs is the status filter applied on top
 * of the API feed.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Inbox } from 'lucide-react';
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
  matchesStatus,
  matchesVerification,
  statusBadgeClass,
  verificationBadgeClass,
  type AdminPaperFilters,
} from './adminPublicationHelpers';
import adminStyles from './AdminPublication.module.css';
import { AdminPaperPreviewModal } from './AdminPaperPreviewModal';

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
  | 'verification'
  | 'reviewer'
  | 'submittedAt';

const REVIEWER_ASSIGNMENTS_CONFIG: AdminListConfig = {
  eyebrow: 'ADMIN · REVIEWER QUEUE',
  title: 'Reviewer Assignments',
  subtitle:
    'Papers currently routed to a reviewer or completed review. Status-valid actions live on the editorial record.',
  statusOptions: [
    'REVIEWER_ASSIGNED',
    'UNDER_REVIEW',
    'REVIEWER_RECOMMENDED_ACCEPT',
    'REVIEWER_RECOMMENDED_REJECT',
    'ADMIN_APPROVED',
    'PUBLISHED',
  ],
  defaultStatus: 'ALL',
  itemLabel: 'assignments',
};

const PUBLISHED_PAPERS_CONFIG: AdminListConfig = {
  eyebrow: 'ADMIN · PUBLISHED CATALOG',
  title: 'Published Papers',
  subtitle:
    'Admin-only view of the published catalog. The Home catalog enforces the same visibility predicate.',
  statusOptions: ['PUBLISHED'],
  defaultStatus: 'PUBLISHED',
  itemLabel: 'published papers',
};

const AdminList = ({ config }: { config: AdminListConfig }) => {
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminPaperFilters['status']>(
    config.defaultStatus,
  );
  const [verificationFilter, setVerificationFilter] =
    useState<AdminPaperFilters['verification']>('ALL');
  const [page, setPage] = useState(1);
  const [previewing, setPreviewing] = useState<PublicationPaper | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

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
      setPapers((prev) =>
        prev.map((p) => (p.id === paper.id ? { ...p, status: 'PUBLISHED' } : p)),
      );
      setActionFeedback({
        type: 'success',
        message: `Đã xuất bản bài báo "${paper.title}" lên Discover Research thành công! Tác giả đã nhận được thông báo.`,
      });
    } catch (e) {
      setActionFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Không thể xuất bản bài báo.',
      });
    } finally {
      setPublishingId(null);
    }
  };

  const handleReject = async (paper: PublicationPaper) => {
    if (publishingId || rejectingId) return;
    if (!window.confirm(`Bạn có chắc chắn muốn từ chối bài báo "${paper.title}"?`)) return;
    setRejectingId(paper.id);
    setActionFeedback(null);
    try {
      await publicationAdapter.rejectPaper(
        paper.id,
        'Ban biên tập đã từ chối xuất bản bài báo theo kết luận phản biện.',
      );
      setPapers((prev) =>
        prev.map((p) => (p.id === paper.id ? { ...p, status: 'ADMIN_REJECTED' } : p)),
      );
      setActionFeedback({
        type: 'success',
        message: `Đã từ chối bài báo "${paper.title}". Tác giả đã nhận được thông báo.`,
      });
    } catch (e) {
      setActionFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Không thể từ chối bài báo.',
      });
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
        e instanceof Error ? e.message : `${config.title} could not be loaded.`,
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

  // The published list is restricted to PUBLISHED; reviewer assignments
  // to REVIEWER_ASSIGNED + UNDER_REVIEW. The filter dropdown only
  // surfaces the statuses this view owns.
  const scoped = useMemo(
    () => papers.filter((paper) => config.statusOptions.includes(paper.status)),
    [papers, config.statusOptions],
  );

  const filters = useMemo<AdminPaperFilters>(
    () => ({
      search,
      status: statusFilter,
      verification: verificationFilter,
    }),
    [search, statusFilter, verificationFilter],
  );

  // Apply the search/status/verification filter and sort in two passes so
  // the column sort affects the full filtered set (not just the visible
  // page of rows). The published-list view pre-narrows `scoped` so a
  // paper outside its owned statuses never enters the result set.
  const sortedFiltered = useMemo(() => {
    const filtered = scoped.filter((paper) => {
      if (!matchesStatus(paper, statusFilter)) return false;
      if (!matchesVerification(paper, verificationFilter)) return false;
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
        case 'verification':
          return paper.researcherVerificationStatus ?? '';
        case 'reviewer':
          return paper.reviewer?.reviewerName ?? '';
        case 'submittedAt':
        default:
          return paper.submittedAt ?? paper.createdAt ?? null;
      }
    });
  }, [scoped, sort, statusFilter, verificationFilter, search]);

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
  }, [filters, sort.sortState]);

  return (
    <section className={`${shared.page} ${adminStyles.page}`}>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.subtitle}
        accent="var(--ars-admin)"
      />

      <TableToolbar
        search={search}
        onSearchChange={error ? () => undefined : setSearch}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        isRefreshing={refreshing}
        searchPlaceholder="Search title, author, DOI, reviewer, or topic"
        refreshLabel="Refresh"
        filters={
          <>
            <select
              className={adminStyles.filterSelect}
              aria-label={`Filter ${config.title} by status`}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as AdminPaperFilters['status'])
              }
              disabled={Boolean(error)}
            >
              <option value="ALL">All</option>
              {config.statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <select
              className={adminStyles.filterSelect}
              aria-label={`Filter ${config.title} by researcher verification`}
              value={verificationFilter}
              onChange={(event) =>
                setVerificationFilter(
                  event.target.value as AdminPaperFilters['verification'],
                )
              }
              disabled={Boolean(error)}
            >
              <option value="ALL">All verifications</option>
              <option value="VERIFIED">Verified</option>
              <option value="ALLOW">Allow</option>
              <option value="PENDING">Pending</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </>
        }
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => setActionFeedback(null)}
          >
            ✕
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
          title={`Could not load ${config.title.toLowerCase()}`}
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
              {loading || refreshing ? 'Retrying…' : 'Retry'}
            </Button>
          }
        />
      ) : paging.items.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} />}
          title={`No ${config.itemLabel} match the current filters.`}
          description="Adjust the search query or clear one of the status / verification filters."
        />
      ) : (
        <>
          <div className={adminStyles.tableWrap}>
            <table className={adminStyles.table} aria-label={config.title}>
              <thead>
                <tr>
                  <th scope="col">
                    <SortableHeader
                      column="title"
                      label="Paper"
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
                      filterOptions={[
                        { value: 'ALL', label: 'All' },
                        ...config.statusOptions.map((status) => ({
                          value: status,
                          label: statusLabel(status),
                        })),
                      ]}
                      activeFilter={statusFilter}
                      onFilterChange={(next) =>
                        setStatusFilter(
                          next as AdminPaperFilters['status'],
                        )
                      }
                    />
                  </th>
                  <th scope="col">
                    <SortableHeader
                      column="verification"
                      label="Verification"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                      filterOptions={[
                        { value: 'ALL', label: 'All verifications' },
                        { value: 'VERIFIED', label: 'Verified' },
                        { value: 'ALLOW', label: 'Allow' },
                        { value: 'PENDING', label: 'Pending' },
                        { value: 'UNVERIFIED', label: 'Unverified' },
                      ]}
                      activeFilter={verificationFilter}
                      onFilterChange={(next) =>
                        setVerificationFilter(
                          next as AdminPaperFilters['verification'],
                        )
                      }
                    />
                  </th>
                  <th scope="col">Identifiers</th>
                  <th scope="col">
                    <SortableHeader
                      column="reviewer"
                      label="Reviewer"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th scope="col">Manuscript</th>
                  <th scope="col" align="right">
                    Actions
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
                      <td data-label="Verification">
                        <span
                          className={`${adminStyles.verificationBadge} ${
                            adminStyles[verificationBadgeClass(paper.researcherVerificationStatus)] ??
                            ''
                          }`}
                        >
                          {paper.researcherVerificationStatus}
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
                      <td data-label="Actions" align="right">
                        <div className={shared.actions}>
                          {/* Nút Review */}
                          <Link
                            className={adminStyles.previewButton}
                            to={`/admin/paper-submissions/${paper.id}`}
                            title="Xem chi tiết biên tập và đánh giá phản biện"
                          >
                            <FileText size={13} aria-hidden="true" /> Review
                          </Link>

                          {/* Nút Public kế bên nút Review */}
                          {paper.status === 'PUBLISHED' ? (
                            <span className={adminStyles.publishedBadge}>
                              ✓ Đã đăng
                            </span>
                          ) : (paper.status === 'REVIEWER_RECOMMENDED_ACCEPT' ||
                              paper.status === 'ADMIN_APPROVED' ||
                              paper.reviewer?.recommendation === 'ACCEPT') ? (
                            <button
                              type="button"
                              className={adminStyles.publishButton}
                              disabled={publishingId === paper.id}
                              onClick={() => void handlePublish(paper)}
                              title="Xuất bản bài báo lên Discover Research"
                            >
                              {publishingId === paper.id ? (
                                'Đang đăng...'
                              ) : (
                                <>
                                  <ExternalLink size={13} aria-hidden="true" /> Public
                                </>
                              )}
                            </button>
                          ) : paper.status === 'REVIEWER_RECOMMENDED_REJECT' ||
                            paper.reviewer?.recommendation === 'REJECT' ? (
                            <button
                              type="button"
                              className={adminStyles.rejectActionButton}
                              disabled={rejectingId === paper.id}
                              onClick={() => void handleReject(paper)}
                              title="Từ chối xuất bản bài báo"
                            >
                              {rejectingId === paper.id ? 'Đang xử lý...' : 'Từ chối'}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className={shared.buttonGhost}
                            onClick={() => setPreviewing(paper)}
                            aria-label={`Preview ${paper.title}`}
                          >
                            <ExternalLink size={12} aria-hidden="true" /> Preview
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
            itemLabel={config.itemLabel}
          />
        </>
      )}

      {previewing ? (
        <AdminPaperPreviewModal
          paper={previewing}
          onClose={() => setPreviewing(null)}
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