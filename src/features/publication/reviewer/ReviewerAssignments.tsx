import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import reviewer from './reviewer.module.css';
import { statusLabel, type PublicationPaper } from '../types/publication';
import {
  isAwaitingReviewerResponse,
  isReviewerActionable,
  isReviewerSubmitted,
} from './reviewerCriteria';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { StatusBadge } from '../../../components/lecturer/StatusBadge';
import { Button } from '../../../components/Button/Button';

// ReviewerAssignments — Reviewer-only list of Admin-assigned papers.
//
// Coordinator authority:
//   - `docs/UI_PUBLICATION_FLOW_DECISIONS.md` §1, §3 (route is fixed at
//     /reviewer/assignments; the list is filtered by status), §6 (API
//     banner remains).
//   - `docs/PUBLICATION_FLOW_ARCHITECTURE_REVIEW.md` §10 (no reviewer
//     review bodies leak into the list rendering — even when the paper
//     already has a `PublicationReview` attached).
//
// Privacy: this page never renders `PublicationReview.privateComments`
// or `PublicationReview.privateScores`. The reviewer can only see their
// own work product from inside the detail page after they submit.

const REVIEWER_ACCENT = 'var(--ars-reviewer)';

const formatDate = (iso: string | undefined): string => {
  if (!iso) return 'Not supplied';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not supplied';
  return parsed.toISOString().slice(0, 10);
};

const formatFee = (fee: number | null | undefined): string =>
  typeof fee === 'number' && Number.isFinite(fee)
    ? `${fee.toLocaleString('vi-VN')} VND`
    : 'Not supplied';

const actionableLabel = (paper: PublicationPaper): string => {
  if (isReviewerSubmitted(paper.status)) return 'Review submitted · awaiting Admin';
  if (isReviewerActionable(paper.status)) return 'Ready for evaluation';
  if (isAwaitingReviewerResponse(paper.status)) return 'Awaiting your response';
  return 'Not actionable yet';
};

const actionableTone = (paper: PublicationPaper): 'submitted' | 'evaluated' | 'waiting' | 'unknown' => {
  if (isReviewerSubmitted(paper.status)) return 'submitted';
  if (isReviewerActionable(paper.status)) return 'evaluated';
  if (isAwaitingReviewerResponse(paper.status)) return 'waiting';
  return 'unknown';
};

export const ReviewerAssignments = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    publicationAdapter
      .getReviewerAssignments()
      .then((items) => {
        if (cancelled) return;
        setPapers(items);
      })
      .catch(() => {
        if (!cancelled) setError('Review assignments could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePapers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return papers;
    return papers.filter((paper) => {
      const haystack = [
        paper.title,
        paper.abstract,
        paper.paperType,
        paper.domain,
        paper.field,
        paper.subfield,
        ...paper.authors.map((author) => author.name),
        ...paper.institutions.map((institution) => institution.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [papers, search]);

  const rows = useMemo(
    () =>
      visiblePapers.map((paper) => ({
        paper,
        actionable: actionableLabel(paper),
        actionableTone: actionableTone(paper),
        assignedAt: formatDate(paper.assignmentCreatedAt ?? paper.submittedAt),
        deadline: formatDate(paper.reviewDeadline),
      })),
    [visiblePapers],
  );

  return (
    <section className={reviewer.page}>
      <PageHeader
        eyebrow="REVIEWER WORKSPACE"
        title="Review Assignments"
        description="Accept or decline Admin assignments, then submit a private recommendation to Admin. Your review content is never published to the catalog."
        accent={REVIEWER_ACCENT}
      />

      {loading ? (
        <SkeletonRow count={5} withHeader />
      ) : error ? (
        <ErrorBanner
          tone="error"
          title="Could not load assignments"
          message={error}
        />
      ) : (
        <>
          {papers.length > 0 && (
            <div className={reviewer.toolbar} role="search">
              <label className={reviewer.searchField}>
                <span className={reviewer.searchLabel} id="reviewer-search-label">
                  Search assignments
                </span>
                <input
                  type="search"
                  className={reviewer.searchInput}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, author, or institution…"
                  aria-labelledby="reviewer-search-label"
                />
              </label>
              <span className={reviewer.count} aria-live="polite">
                {visiblePapers.length} of {papers.length} assignment{papers.length === 1 ? '' : 's'}
              </span>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} aria-hidden />}
              title={search ? 'No assignments match your search' : 'No reviewer assignments are ready'}
              description={
                search
                  ? 'Try a different keyword, or clear the search to see every assignment.'
                  : 'New Admin assignments appear here automatically. Accept or decline them from the row.'
              }
              data-testid="empty-assignments"
            />
          ) : (
            <div className={reviewer.tableWrap}>
              <table className={reviewer.table}>
                <thead>
                  <tr>
                    <th scope="col" className={reviewer.thTitle}>Title</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actionability</th>
                    <th scope="col">Assigned</th>
                    <th scope="col">Deadline</th>
                    <th scope="col">Fee</th>
                    <th scope="col" className={reviewer.thActions}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ paper, actionable, actionableTone, assignedAt, deadline }) => (
                    <tr
                      key={`${paper.id}-${paper.reviewRequestId ?? 'assignment'}`}
                      data-testid="assignment-row"
                      data-paper-id={paper.id}
                    >
                      <td className={reviewer.tdTitle}>
                        <Link
                          to={`/reviewer/assignments/${paper.id}`}
                          className={reviewer.titleLink}
                        >
                          {paper.title}
                        </Link>
                        <span className={reviewer.titleMeta}>
                          {paper.paperType || 'Not supplied'}
                          {paper.reviewType ? ` · ${paper.reviewType}` : ''}
                          {paper.aiRecommended != null
                            ? ` · AI recommended: ${paper.aiRecommended ? 'Yes' : 'No'}`
                            : ''}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={paper.status} label={statusLabel(paper.status)} size="sm" />
                      </td>
                      <td>
                        <StatusBadge status={actionableTone} label={actionable} size="sm" />
                      </td>
                      <td>
                        <span className={reviewer.mono}>{assignedAt}</span>
                      </td>
                      <td>
                        <span className={reviewer.mono}>{deadline}</span>
                      </td>
                      <td className={reviewer.tdNumeric}>{formatFee(paper.reviewFee)}</td>
                      <td className={reviewer.tdActions}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/reviewer/assignments/${paper.id}`)}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ReviewerAssignments;
