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
import shared from '../components/PublicationShared.module.css';
import { PageHeader } from '../../../components/PageHeader';
import { TableToolbar } from '../../../components/table/TableToolbar';
import { TablePagination } from '../../../components/table/TablePagination';
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
  paginateAdminPapers,
  publicReviewerName,
  resolveIdentifiers,
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

const REVIEWER_ASSIGNMENTS_CONFIG: AdminListConfig = {
  eyebrow: 'ADMIN · REVIEWER QUEUE',
  title: 'Reviewer Assignments',
  subtitle:
    'Papers currently routed to a reviewer. Status-valid actions live on the editorial record.',
  statusOptions: ['REVIEWER_ASSIGNED', 'UNDER_REVIEW'],
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

  const paging = useMemo(
    () => paginateAdminPapers(scoped, { page, pageSize: DEFAULT_PAGE_SIZE, filters }),
    [scoped, page, filters],
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

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
              <option value="PENDING">Pending</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </>
        }
      />

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
                  <th scope="col">Paper</th>
                  <th scope="col">Status</th>
                  <th scope="col">Verification</th>
                  <th scope="col">Identifiers</th>
                  <th scope="col">Reviewer</th>
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
                          <button
                            type="button"
                            className={adminStyles.previewButton}
                            onClick={() => setPreviewing(paper)}
                            aria-label={`Preview ${paper.title}`}
                          >
                            <ExternalLink size={12} aria-hidden="true" /> Preview
                          </button>
                          <Link
                            className={shared.buttonGhost}
                            to={`/admin/paper-submissions/${paper.id}`}
                          >
                            Open editorial record
                          </Link>
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