/**
 * AdminPaperSubmissions — Admin editorial intake.
 *
 * Every record returned by the live API adapter is rendered (Admin can see
 * drafts / private / withdrawn records that the public catalog never sees).
 * PageHeader at the top, toolbar with search + status + verification filters,
 * shared TablePagination, and AdminPaperPreviewModal for quick lookups.
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
import { isAuthorshipAllowed, statusLabel, type PublicationPaper, type PublicationStatus } from '../types/publication';
import {
  doiHref,
  paginateAdminPapers,
  publicReviewerName,
  resolveIdentifiers,
  statusBadgeClass,
  verificationBadgeClass,
  type AdminPaperFilters,
} from './adminPublicationHelpers';
import { useListShortcuts } from '../../../hooks/useListShortcuts';
import adminStyles from './AdminPublication.module.css';
import { AdminPaperPreviewModal } from './AdminPaperPreviewModal';

const ROLE_ACCENT = 'var(--ars-admin)';

const STATUS_OPTIONS: Array<{
  value: PublicationStatus | 'ALL';
  label: string;
}> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'SUBMITTED', label: statusLabel('SUBMITTED') },
  { value: 'ADMIN_SCREENING', label: statusLabel('ADMIN_SCREENING') },
  { value: 'RESEARCHER_VERIFICATION_REQUIRED', label: statusLabel('RESEARCHER_VERIFICATION_REQUIRED') },
  { value: 'READY_FOR_REVIEWER', label: statusLabel('READY_FOR_REVIEWER') },
  { value: 'REVIEWER_ASSIGNED', label: statusLabel('REVIEWER_ASSIGNED') },
  { value: 'UNDER_REVIEW', label: statusLabel('UNDER_REVIEW') },
  { value: 'REVISION_REQUIRED', label: statusLabel('REVISION_REQUIRED') },
  { value: 'RESUBMITTED', label: statusLabel('RESUBMITTED') },
  { value: 'REVIEWER_RECOMMENDED_ACCEPT', label: statusLabel('REVIEWER_RECOMMENDED_ACCEPT') },
  { value: 'REVIEWER_RECOMMENDED_REJECT', label: statusLabel('REVIEWER_RECOMMENDED_REJECT') },
  { value: 'ADMIN_APPROVED', label: statusLabel('ADMIN_APPROVED') },
  { value: 'PUBLISHED', label: statusLabel('PUBLISHED') },
  { value: 'ADMIN_REJECTED', label: statusLabel('ADMIN_REJECTED') },
  { value: 'WITHDRAWN', label: statusLabel('WITHDRAWN') },
];

export const AdminPaperSubmissions = () => {
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminPaperFilters['status']>('ALL');
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
        e instanceof Error
          ? e.message
          : 'The admin submission list could not be loaded.',
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

  const filters = useMemo<AdminPaperFilters>(
    () => ({
      search,
      status: statusFilter,
      verification: verificationFilter,
    }),
    [search, statusFilter, verificationFilter],
  );

  const paging = useMemo(
    () => paginateAdminPapers(papers, { page, pageSize: DEFAULT_PAGE_SIZE, filters }),
    [papers, page, filters],
  );

  // Part 5 — keyboard shortcuts for the admin submissions table.
  // j/k navigate rows, Enter opens the editorial record for the focused
  // row, f focuses the toolbar search input. The `a/d/r/x` approve-deny-
  // reject-export shortcuts target the detail page (see
  // AdminPaperSubmissionDetail), so this list stays scoped to navigation.
  const { selectedIndex } = useListShortcuts({
    itemCount: paging.items.length,
    onOpen: (index) => {
      const paper = paging.items[index];
      if (!paper?.id) return;
      window.open(`/admin/paper-submissions/${paper.id}`, '_blank', 'noopener,noreferrer');
    },
  });

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  return (
    <section className={`${shared.page} ${adminStyles.page}`}>
      <PageHeader
        eyebrow="ADMIN · EDITORIAL INTAKE"
        title="Paper Submissions"
        description="Screen submissions, verify researcher identity, and prepare reviewer assignments."
        accent={ROLE_ACCENT}
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
              aria-label="Filter admin submissions by status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as AdminPaperFilters['status'])
              }
              disabled={Boolean(error)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className={adminStyles.filterSelect}
              aria-label="Filter admin submissions by researcher verification"
              value={verificationFilter}
              onChange={(event) =>
                setVerificationFilter(
                  event.target.value as AdminPaperFilters['verification'],
                )
              }
              disabled={Boolean(error)}
            >
              <option value="ALL">All verifications</option>
              <option value="ALLOW">Allow (Đã xác minh)</option>
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
          title="Could not load admin submissions"
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
          title="No admin submissions match the current filters."
          description="Adjust the search query or clear one of the status / verification filters."
        />
      ) : (
        <>
          <div className={adminStyles.tableWrap}>
            <table
              className={adminStyles.table}
              role="table"
              aria-label="Admin paper submissions"
            >
              <thead>
                <tr>
                  <th scope="col">Submission</th>
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
                {paging.items.map((paper, index) => {
                  const identifiers = resolveIdentifiers(paper);
                  const reviewer =
                    publicReviewerName(paper) ?? paper.reviewer?.reviewerName ?? null;
                  const fileHref = paper.fileUrl?.trim();
                  return (
                    <tr key={paper.id} className={selectedIndex === index ? adminStyles.selectedRow : ''}>
                      <td data-label="Submission">
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          <span
                            className={`${adminStyles.verificationBadge} ${
                              adminStyles[verificationBadgeClass(paper.researcherVerificationStatus)] ??
                              ''
                            }`}
                          >
                            {paper.researcherVerificationStatus}
                          </span>
                          {!isAuthorshipAllowed(paper) && (
                            <button
                              type="button"
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                background: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await publicationAdapter.verifyAuthorship(paper.id, true);
                                void load();
                              }}
                            >
                              ✓ Accept (Allow)
                            </button>
                          )}
                        </div>
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
                          <span>{reviewer}</span>
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
            itemLabel="submissions"
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

export default AdminPaperSubmissions;