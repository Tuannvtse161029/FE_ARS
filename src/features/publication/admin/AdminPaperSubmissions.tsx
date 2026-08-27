import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import { statusLabel, type PublicationPaper, type PublicationStatus } from '../types/publication';
import {
  ADMIN_PAGE_SIZE,
  DEFAULT_ADMIN_FILTERS,
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

/**
 * Admin-only editorial intake. Every record returned by the demo
 * adapter is rendered (Admin can see drafts / private / withdrawn
 * records that the public catalog never sees). Demo actions on this
 * page are explicitly labeled — they are NOT persisted publication
 * decisions (see `PublicationDemoBanner`).
 */
export const AdminPaperSubmissions = () => {
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminPaperFilters>(DEFAULT_ADMIN_FILTERS);
  const [page, setPage] = useState(1);
  const [previewing, setPreviewing] = useState<PublicationPaper | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    publicationAdapter
      .getAdminSubmissions()
      .then((items) => { if (active) setPapers(items); })
      .catch(() => { if (active) setError('The admin submission list could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const paging = useMemo(
    () => paginateAdminPapers(papers, { page, pageSize: ADMIN_PAGE_SIZE, filters }),
    [papers, page, filters],
  );

  // Reset to page 1 whenever filters change.
  useEffect(() => { setPage(1); }, [filters]);

  const updateFilters = (patch: Partial<AdminPaperFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const startIndex = paging.totalCount === 0 ? 0 : (paging.page - 1) * paging.pageSize + 1;
  const endIndex = Math.min(paging.totalCount, startIndex + paging.pageSize - 1);

  return (
    <section className={`${shared.page} ${adminStyles.page}`}>
      <header className={shared.header}>
        <div>
          <h1>Paper Submissions</h1>
          <p>Screen submissions, verify researcher identity, and prepare reviewer assignments.</p>
        </div>
      </header>
      <PublicationDemoBanner />

      <div className={adminStyles.toolbar} role="search">
        <div className={adminStyles.toolbarGroup}>
          <label className={adminStyles.search}>
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Search admin paper submissions"
              value={filters.search}
              placeholder="Search title, author, DOI, reviewer, or topic"
              onChange={(event) => updateFilters({ search: event.target.value })}
            />
          </label>
          <label className={adminStyles.filter}>
            <span>Status</span>
            <select
              aria-label="Filter admin submissions by status"
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value as AdminPaperFilters['status'] })}
            >
              <option value="ALL">All statuses</option>
              {[
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
              ].map((item) => (
                <option key={item} value={item}>{item === 'ALL' ? 'All statuses' : statusLabel(item as PublicationStatus)}</option>
              ))}
            </select>
          </label>
          <label className={adminStyles.filter}>
            <span>Researcher</span>
            <select
              aria-label="Filter admin submissions by researcher verification"
              value={filters.verification}
              onChange={(event) => updateFilters({ verification: event.target.value as AdminPaperFilters['verification'] })}
            >
              <option value="ALL">All verifications</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </label>
        </div>
      </div>

      {loading
        ? <div className={shared.loading} role="status">Loading admin submission list...</div>
        : error
          ? <div className={shared.error} role="alert">{error}</div>
          : paging.items.length === 0
            ? <div className={adminStyles.emptyInline}>No admin submissions match the current filters.</div>
            : (
              <>
                <div className={adminStyles.tableWrap}>
                  <table className={adminStyles.table} role="table" aria-label="Admin paper submissions">
                    <thead>
                      <tr>
                        <th scope="col">Submission</th>
                        <th scope="col">Status</th>
                        <th scope="col">Verification</th>
                        <th scope="col">Identifiers</th>
                        <th scope="col">Reviewer</th>
                        <th scope="col">Manuscript</th>
                        <th scope="col" align="right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paging.items.map((paper) => {
                        const identifiers = resolveIdentifiers(paper);
                        const reviewer = publicReviewerName(paper) ?? paper.reviewer?.reviewerName ?? null;
                        const fileHref = paper.fileUrl?.trim();
                        return (
                          <tr key={paper.id}>
                            <td data-label="Submission">
                              <div className={adminStyles.titleCell}>
                                <strong>{paper.title}</strong>
                                <small>{paper.paperType} · v{paper.version} · {paper.authors.map((author) => author.name).join(', ')}</small>
                              </div>
                            </td>
                            <td data-label="Status">
                              <span className={`${adminStyles.statusBadge} ${adminStyles[statusBadgeClass(paper.status)] ?? ''}`}>
                                {statusLabel(paper.status)}
                              </span>
                            </td>
                            <td data-label="Verification">
                              <span className={`${adminStyles.verificationBadge} ${adminStyles[verificationBadgeClass(paper.researcherVerificationStatus)] ?? ''}`}>
                                {paper.researcherVerificationStatus}
                              </span>
                            </td>
                            <td data-label="Identifiers">
                              <div className={adminStyles.identifierList}>
                                {identifiers.doi && (
                                  <span className={adminStyles.identifierChip}>
                                    DOI: {doiHref(identifiers.doi)
                                      ? <a href={doiHref(identifiers.doi)!} target="_blank" rel="noreferrer">{identifiers.doi}</a>
                                      : identifiers.doi}
                                  </span>
                                )}
                                {identifiers.openAlexId && (
                                  <span className={adminStyles.identifierChip}>OpenAlex: {identifiers.openAlexId}</span>
                                )}
                                {identifiers.externalIdentifier && (
                                  <span className={adminStyles.identifierChip}>External: {identifiers.externalIdentifier}</span>
                                )}
                                {!identifiers.doi && !identifiers.openAlexId && !identifiers.externalIdentifier && (
                                  <span className={adminStyles.fileMissing}>No identifier supplied</span>
                                )}
                              </div>
                            </td>
                            <td data-label="Reviewer">
                              {reviewer
                                ? <span>{reviewer}</span>
                                : <span className={adminStyles.fileMissing}>Not assigned</span>}
                            </td>
                            <td data-label="Manuscript">
                              {fileHref
                                ? (
                                  <a className={adminStyles.fileLink} href={fileHref} target="_blank" rel="noreferrer">
                                    <FileText size={14} aria-hidden="true" /> Open
                                  </a>
                                )
                                : <span className={adminStyles.fileMissing}>No file URL</span>}
                            </td>
                            <td data-label="Actions" align="right">
                              <div className={shared.actions} style={{ justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className={adminStyles.previewButton}
                                  onClick={() => setPreviewing(paper)}
                                  aria-label={`Preview ${paper.title}`}
                                >
                                  <ExternalLink size={12} aria-hidden="true" /> Preview
                                </button>
                                <Link className={shared.buttonGhost} to={`/admin/paper-submissions/${paper.id}`}>
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
                <footer className={adminStyles.pagination}>
                  <span className={adminStyles.paginationInfo}>
                    {paging.totalCount === 0
                      ? '0 records'
                      : `Showing ${startIndex}–${endIndex} of ${paging.totalCount} records`}
                  </span>
                  <div className={adminStyles.paginationControls}>
                    <button
                      type="button"
                      className={adminStyles.pageButton}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={paging.page <= 1}
                      aria-label="Previous admin submissions page"
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                    <span aria-live="polite">Page {paging.page} of {paging.totalPages}</span>
                    <button
                      type="button"
                      className={adminStyles.pageButton}
                      onClick={() => setPage((current) => Math.min(paging.totalPages, current + 1))}
                      disabled={paging.page >= paging.totalPages}
                      aria-label="Next admin submissions page"
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </footer>
              </>
            )}

      {previewing && (
        <AdminPaperPreviewModal paper={previewing} onClose={() => setPreviewing(null)} />
      )}
    </section>
  );
};

export default AdminPaperSubmissions;
