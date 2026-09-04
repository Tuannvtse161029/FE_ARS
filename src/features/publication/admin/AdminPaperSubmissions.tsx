/**
 * AdminPaperSubmissions — Admin editorial intake.
 *
 * Every record returned by the live API adapter is rendered (Admin can see
 * drafts / private / withdrawn records that the public catalog never sees).
 * PageHeader at the top, toolbar with search + verification tab filters,
 * shared TablePagination, and AdminPaperPreviewModal for quick lookups.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, CircleX, ExternalLink, FileText, Inbox } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { useTableSort } from '../../../hooks/useTableSort';
import shared from '../components/PublicationShared.module.css';
import { PageHeader } from '../../../components/PageHeader';
import { TableToolbar } from '../../../components/table/TableToolbar';
import { TablePagination } from '../../../components/table/TablePagination';
import { SortableHeader } from '../../../components/table/SortableHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { OpenAlexBrandLogo } from '../../../components/openalex/OpenAlexBrandLogo';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { Button } from '../../../components/Button/Button';
import { DEFAULT_PAGE_SIZE } from '../../../utils/tableConstants';
import { isAuthorshipAllowed, type PublicationPaper } from '../types/publication';
import {
  doiHref,
  publicReviewerName,
  resolveIdentifiers,
} from './adminPublicationHelpers';
import { useListShortcuts } from '../../../hooks/useListShortcuts';
import adminStyles from './AdminPublication.module.css';
import { AdminPaperPreviewModal } from './AdminPaperPreviewModal';
import { RejectPaperModal } from './RejectPaperModal';

/** Sortable column ids for the Admin Paper Submissions table. */
type SortColumn = 'title' | 'verification' | 'reviewer' | 'submittedAt';

const ROLE_ACCENT = 'var(--ars-admin)';

// Verification filter tabs - Primary filter for the table
type VerificationTab = 'ALL' | 'PENDING' | 'VERIFIED' | 'UNVERIFIED';

const VERIFICATION_TABS: Array<{
  value: VerificationTab;
  label: string;
}> = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'UNVERIFIED', label: 'Unverified' },
];

// Helper to get verification badge CSS class
const getVerificationBadgeClass = (status: string | undefined): string => {
  if (!status) return adminStyles.verificationUnverified;
  switch (status.toUpperCase()) {
    case 'VERIFIED':
      return adminStyles.verificationVerified;
    case 'PENDING':
      return adminStyles.verificationPending;
    default:
      return adminStyles.verificationUnverified;
  }
};

// Helper to format verification label
const formatVerification = (status: string | undefined): string => {
  return status ?? 'UNVERIFIED';
};

export const AdminPaperSubmissions = () => {
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Tab filter for verification - primary way to filter papers
  const [verificationTab, setVerificationTab] = useState<VerificationTab>('ALL');
  const [page, setPage] = useState(1);
  const [previewing, setPreviewing] = useState<PublicationPaper | null>(null);
  const [rejectingPaper, setRejectingPaper] = useState<PublicationPaper | null>(null);
  const [rejecting, setRejecting] = useState(false);

  // Default sort by submittedAt (newest first) so recently submitted papers
  // surface at the top. The user can override per column header click.
  const sort = useTableSort<PublicationPaper, SortColumn>('submittedAt', 'desc');

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

  // Filter papers based on search and verification tab
  const filteredPapers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return papers.filter((paper) => {
      // Apply verification tab filter
      if (verificationTab !== 'ALL') {
        const verification = paper.researcherVerificationStatus?.toUpperCase() ?? 'UNVERIFIED';
        if (verificationTab === 'PENDING' && verification !== 'PENDING') return false;
        if (verificationTab === 'VERIFIED' && verification !== 'VERIFIED') return false;
        if (verificationTab === 'UNVERIFIED' && verification !== 'UNVERIFIED') return false;
      }

      // Apply search filter
      if (term) {
        const haystack = [
          paper.title ?? '',
          paper.abstract ?? '',
          paper.paperType ?? '',
          paper.domain ?? '',
          paper.field ?? '',
          paper.subfield ?? '',
          ...paper.authors.map((a) => a.name),
          ...paper.institutions.map((i) => i.name),
          paper.doi ?? '',
          paper.openAlexId ?? '',
          paper.reviewer?.reviewerName ?? '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      }
      return true;
    });
  }, [papers, search, verificationTab]);

  // Count papers per verification tab for display
  const tabCounts = useMemo(() => {
    const counts: Record<VerificationTab, number> = {
      ALL: papers.length,
      PENDING: 0,
      VERIFIED: 0,
      UNVERIFIED: 0,
    };
    papers.forEach((paper) => {
      const verification = paper.researcherVerificationStatus?.toUpperCase() ?? 'UNVERIFIED';
      if (verification === 'PENDING') counts.PENDING++;
      else if (verification === 'VERIFIED') counts.VERIFIED++;
      else counts.UNVERIFIED++;
    });
    return counts;
  }, [papers]);

  // Apply column sort on top of the filtered papers.
  const sortedItems = useMemo(
    () =>
      sort.sortedItemsBy(filteredPapers, (paper) => {
        switch (sort.sortState.column) {
          case 'title':
            return paper.title ?? '';
          case 'verification':
            return paper.researcherVerificationStatus ?? '';
          case 'reviewer':
            return paper.reviewer?.reviewerName ?? '';
          case 'submittedAt':
          default:
            return paper.submittedAt ?? paper.createdAt ?? null;
        }
      }),
    [filteredPapers, sort],
  );

  // Pagination
  const totalCount = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * DEFAULT_PAGE_SIZE;
  const pageItems = sortedItems.slice(start, start + DEFAULT_PAGE_SIZE);

  // Part 5 — keyboard shortcuts for the admin submissions table.
  // j/k navigate rows, Enter opens the editorial record for the focused
  // row, f focuses the toolbar search input.
  const { selectedIndex } = useListShortcuts({
    itemCount: pageItems.length,
    onOpen: (index) => {
      const paper = pageItems[index];
      if (!paper?.id) return;
      window.open(`/admin/paper-submissions/${paper.id}`, '_blank', 'noopener,noreferrer');
    },
  });

  // Reset to page 1 whenever filters or sort change.
  useEffect(() => {
    setPage(1);
  }, [search, verificationTab, sort.sortState]);

  return (
    <section className={`${shared.page} ${adminStyles.page}`}>
      <PageHeader
        eyebrow="ADMIN · EDITORIAL INTAKE"
        title="Paper Submissions"
        description="Screen submissions, verify researcher identity, and prepare reviewer assignments."
        accent={ROLE_ACCENT}
      />

      {/* Tab filter for verification status */}
      <div className={adminStyles.tabFilterBar} role="tablist" aria-label="Filter by verification status">
        {VERIFICATION_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={verificationTab === tab.value}
            className={`${adminStyles.tabButton} ${verificationTab === tab.value ? adminStyles.tabButtonActive : ''}`}
            onClick={() => setVerificationTab(tab.value)}
            type="button"
          >
            {tab.label}
            <span className={adminStyles.tabCount}>{tabCounts[tab.value]}</span>
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
        searchPlaceholder="Search title, author, DOI, reviewer, or topic"
        refreshLabel="Refresh"
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
      ) : pageItems.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} />}
          title="No admin submissions match the current filters."
          description="Adjust the search query or select a different verification tab."
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
                  <th scope="col">
                    <SortableHeader
                      column="title"
                      label="Submission"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th scope="col">
                    <SortableHeader
                      column="verification"
                      label="Verification"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
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
                {pageItems.map((paper, index) => {
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
                      <td data-label="Verification">
                        <div className={adminStyles.verificationActions}>
                          <span
                            className={`${adminStyles.verificationBadge} ${
                              getVerificationBadgeClass(paper.researcherVerificationStatus)
                            }`}
                          >
                            {formatVerification(paper.researcherVerificationStatus)}
                          </span>
                          {!isAuthorshipAllowed(paper) && (
                            <div className={adminStyles.rowActionGroup}>
                              <button
                                type="button"
                                className={adminStyles.verifyActionButton}
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  await publicationAdapter.verifyAuthorship(paper.id, true);
                                  void load();
                                }}
                              >
                                <CircleCheck size={13} aria-hidden="true" /> Accept
                              </button>
                              <button
                                type="button"
                                className={adminStyles.rejectActionButton}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setRejectingPaper(paper);
                                }}
                              >
                                <CircleX size={13} aria-hidden="true" /> Reject
                              </button>
                            </div>
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
                              <OpenAlexBrandLogo
                                variant="mark"
                                ariaLabel="OpenAlex"
                              />
                              <span className={adminStyles.identifierChipOpenAlex}>
                                OpenAlex
                              </span>
                              <span>{identifiers.openAlexId}</span>
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
            page={safePage}
            totalPages={totalPages}
            totalItems={totalCount}
            startIndex={start + 1}
            endIndex={Math.min(totalCount, start + DEFAULT_PAGE_SIZE)}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
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
      {rejectingPaper ? (
        <RejectPaperModal
          paperTitle={rejectingPaper.title}
          isSubmitting={rejecting}
          onClose={() => setRejectingPaper(null)}
          onConfirm={(reason) => {
            setRejecting(true);
            void publicationAdapter.rejectPaper(rejectingPaper.id, reason)
              .then(() => {
                setRejectingPaper(null);
                return load();
              })
              .finally(() => setRejecting(false));
          }}
        />
      ) : null}
    </section>
  );
};

export default AdminPaperSubmissions;
