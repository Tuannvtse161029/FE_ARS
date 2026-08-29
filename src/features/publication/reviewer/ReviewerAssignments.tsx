import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import shared from '../components/PublicationShared.module.css';
import reviewer from './reviewer.module.css';
import { statusLabel, type PublicationPaper } from '../types/publication';
import {
  isAwaitingReviewerResponse,
  isReviewerActionable,
  isReviewerSubmitted,
} from './reviewerCriteria';

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

const formatDate = (iso: string | undefined): string => {
  if (!iso) return 'No submitted date on record';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'No submitted date on record';
  return parsed.toISOString().slice(0, 10);
};

const actionableLabel = (paper: PublicationPaper): string => {
  if (isReviewerSubmitted(paper.status)) return 'Review submitted · awaiting Admin';
  if (isReviewerActionable(paper.status)) return 'Ready for evaluation';
  if (isAwaitingReviewerResponse(paper.status)) return 'Awaiting your response';
  return 'Not actionable yet';
};

export const ReviewerAssignments = () => {
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const rows = useMemo(
    () =>
      papers.map((paper) => ({
        paper,
        actionable: actionableLabel(paper),
        submittedAt: formatDate(paper.submittedAt),
      })),
    [papers],
  );

  return (
    <section className={`${shared.page} ${reviewer.pageSpacing}`}>
      <header className={shared.header}>
        <div>
          <h1>Review Assignments</h1>
          <p>
            Accept or decline Admin assignments, then submit a private recommendation to Admin.
            Your review content is never published to the catalog.
          </p>
        </div>
      </header>
      {loading ? (
        <div className={shared.loading}>Loading assignments...</div>
      ) : error ? (
        <div className={shared.error} role="alert">{error}</div>
      ) : rows.length === 0 ? (
        <div className={shared.empty} data-testid="empty-assignments">
          No reviewer assignments are ready.
        </div>
      ) : (
        <div className={shared.panel}>
          {rows.map(({ paper, actionable, submittedAt }) => (
            <article
              key={paper.id}
              data-testid="assignment-row"
              data-paper-id={paper.id}
              style={{ borderBottom: '1px solid #e4e9f0', padding: '14px 0' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 6,
                }}
              >
                <span className={shared.status}>{statusLabel(paper.status)}</span>
                <span className={reviewer.deadlineChip} aria-label="Submitted">
                  Submitted: {submittedAt}
                </span>
                <span className={reviewer.deadlineChip} aria-label="Actionability">
                  {actionable}
                </span>
              </div>
              <h2 style={{ fontSize: 18, margin: '4px 0 6px' }}>{paper.title}</h2>
              <p style={{ margin: '0 0 8px', color: '#5f6b7a' }}>{paper.abstract}</p>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#324158' }}>
                <strong>Paper type:</strong> {paper.paperType || 'Not supplied'} ·{' '}
                <strong>Version:</strong> {paper.version}
              </p>
              <Link
                className={reviewer.openAssignmentButton}
                to={`/reviewer/assignments/${paper.id}`}
              >
                Open assignment
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default ReviewerAssignments;
