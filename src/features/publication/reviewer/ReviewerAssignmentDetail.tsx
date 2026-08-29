import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { statusLabel, type PublicationPaper } from '../types/publication';
import reviewer from './reviewer.module.css';
import {
  REVIEWER_CRITERIA,
  REVIEWER_RECOMMENDATIONS,
  buildEmptyEvaluationDraft,
  isReviewerActionable,
  isReviewerSubmitted,
  isAwaitingReviewerResponse,
  shouldRenderPrivatePriorReview,
  type ReviewerEvaluationDraft,
  type ReviewerRecommendationValue,
} from './reviewerCriteria';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { StatusBadge } from '../../../components/lecturer/StatusBadge';
import { Button } from '../../../components/Button/Button';

// ReviewerAssignmentDetail — the Reviewer-only paper view.
//
// Coordinator authority:
//   - `docs/UI_PUBLICATION_FLOW_DECISIONS.md` §1, §3 (status semantics),
//     §7 (ownership — only this directory is mutable).
//   - `docs/PUBLICATION_FLOW_ARCHITECTURE_REVIEW.md` §3, §10 (reviewer
//     must not see publication actions; private review content stays
//     Admin + submitting researcher only).
//   - `docs/PUBLICATION_FLOW_API_BLOCKERS.md` §3.4 (backend gaps).
//
// The page:
//   1. Resolves the assignment via `publicationAdapter.getReviewerAssignments()`.
//      Anything not in that list is unauthorised (renders a notice,
//      never the paper body).
//   2. Renders required paper/assignment metadata (title, abstract,
//      authors, institutions, identifiers, version, verification
//      status, deadline chip, etc.) WITHOUT leaking any prior reviewer's
//      private review content. `shouldRenderPrivatePriorReview` is the
//      single source of truth for that gate.
//   3. Renders a PDF iframe + a download anchor when `fileUrl` is
//      present; otherwise renders an explicit "no file URL is
//      available" notice (no fake download).
//   4. Shows Accept / Decline ONLY for REVIEWER_ASSIGNED.
//   5. Shows the full Evaluate Paper form ONLY for UNDER_REVIEW
//      (actionable) — every REVIEWER_CRITERIA criterion (5), the
//      per-criterion note, the private comments textarea, and the
//      three recommendation options (Accept / Revision Required /
//      Reject).
//   6. After submit, transitions to "Review submitted / Awaiting Admin
//      decision" copy and hides the form. The form never reappears
//      for the same assignment.

const REVIEWER_ACCENT = 'var(--ars-reviewer)';

const formatDate = (iso: string | undefined): string => {
  if (!iso) return 'Not supplied';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not supplied';
  return parsed.toISOString().slice(0, 10);
};

const renderInlineStatus = (status: string): string =>
  statusLabel(status as never);

interface ResolvedAssignment {
  status: 'authorised' | 'unauthorised' | 'missing';
  paper?: PublicationPaper;
}

const statusTone = (
  paper: PublicationPaper | undefined,
): 'submitted' | 'evaluated' | 'waiting' | 'unknown' => {
  if (!paper) return 'unknown';
  if (isReviewerSubmitted(paper.status)) return 'submitted';
  if (isReviewerActionable(paper.status)) return 'evaluated';
  if (isAwaitingReviewerResponse(paper.status)) return 'waiting';
  return 'unknown';
};

export const ReviewerAssignmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resolved, setResolved] = useState<ResolvedAssignment>({
    status: 'missing',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewerEvaluationDraft>(() =>
    buildEmptyEvaluationDraft(),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResolved({ status: 'missing' });
    (async () => {
      try {
        // Use the reviewer-scoped list as the authorisation source. If
        // the requested id is not in the list, we render an
        // unauthorised notice instead of the paper body.
        const assignments = await publicationAdapter.getReviewerAssignments();
        if (cancelled) return;
        const found = assignments.find((paper) => paper.id === id);
        if (found) {
          setResolved({ status: 'authorised', paper: found });
        } else {
          setResolved({ status: 'unauthorised' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Reset the form draft whenever we transition to a different paper so
  // a stale Accept/ACCEPT from a prior assignment can't leak into the
  // new one.
  const assignedPaperId =
    resolved.status === 'authorised' ? resolved.paper?.id : null;
  useEffect(() => {
    setDraft(buildEmptyEvaluationDraft());
    setError(null);
  }, [assignedPaperId]);

  const paper = resolved.status === 'authorised' ? resolved.paper : undefined;
  const awaitingResponse = paper ? isAwaitingReviewerResponse(paper.status) : false;
  const canReview = paper ? isReviewerActionable(paper.status) : false;
  const submitted = paper ? isReviewerSubmitted(paper.status) : false;

  const handleAccept = async (accepted: boolean) => {
    if (!paper) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicationAdapter.respondToAssignment(
        paper.id,
        accepted,
      );
      setResolved({ status: 'authorised', paper: updated });
      if (!accepted) navigate('/reviewer/assignments');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not respond to assignment.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleScoreChange = (
    key: keyof ReviewerEvaluationDraft['scores'],
    value: number,
  ) => {
    setDraft((current) => ({
      ...current,
      scores: { ...current.scores, [key]: value },
    }));
  };

  const handleNoteChange = (
    key: keyof ReviewerEvaluationDraft['perCriterionNotes'],
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      perCriterionNotes: { ...current.perCriterionNotes, [key]: value },
    }));
  };

  const handleRecommendationChange = (value: ReviewerRecommendationValue) => {
    setDraft((current) => ({ ...current, recommendation: value }));
  };

  const handlePrivateCommentsChange = (value: string) => {
    setDraft((current) => ({ ...current, privateComments: value }));
  };

  const submitEvaluation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paper) return;
    if (!draft.privateComments.trim()) {
      setError('Private comments for Admin are required before submitting a review.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await publicationAdapter.submitReview(
        paper.id,
        draft.recommendation,
        draft.privateComments.trim(),
        draft.scores,
        draft.perCriterionNotes,
      );
      setResolved({ status: 'authorised', paper: updated });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not submit review.',
      );
    } finally {
      setSaving(false);
    }
  };

  const renderMetadata = (paperToRender: PublicationPaper) => {
    const items: Array<{ label: string; value: string }> = [
      { label: 'Status', value: renderInlineStatus(paperToRender.status) },
      { label: 'Paper type', value: paperToRender.paperType || 'Not supplied' },
      { label: 'Version', value: String(paperToRender.version) },
      {
        label: 'Researcher verification',
        value: paperToRender.researcherVerificationStatus,
      },
      { label: 'Visibility', value: paperToRender.visibility },
      { label: 'Submitted', value: formatDate(paperToRender.submittedAt) },
      { label: 'Published', value: formatDate(paperToRender.publishedAt) },
      { label: 'DOI', value: paperToRender.doi ?? 'Not supplied' },
      {
        label: 'OpenAlex ID',
        value: paperToRender.openAlexId ?? 'Not supplied',
      },
      {
        label: 'External identifier',
        value: paperToRender.externalIdentifier ?? 'Not supplied',
      },
      { label: 'Domain', value: paperToRender.domain ?? 'Not supplied' },
      { label: 'Field', value: paperToRender.field ?? 'Not supplied' },
      { label: 'Subfield', value: paperToRender.subfield ?? 'Not supplied' },
    ];
    return (
      <dl className={reviewer.metadataGrid}>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const renderPdf = (paperToRender: PublicationPaper) => {
    if (!paperToRender.fileUrl) {
      return (
        <p className={reviewer.pdfUnavailable}>
          No manuscript file URL is available for this assignment yet.
        </p>
      );
    }
    return (
      <div className={reviewer.pdfFrame} data-testid="pdf-frame">
        <iframe
          title={`PDF preview for ${paperToRender.title}`}
          src={paperToRender.fileUrl}
          loading="lazy"
        />
        <a
          className={reviewer.pdfLink}
          href={paperToRender.fileUrl}
          target="_blank"
          rel="noreferrer"
          download
        >
          Download manuscript (PDF)
        </a>
      </div>
    );
  };

  const renderEvaluationForm = () => {
    if (!canReview) return null;
    return (
      <form
        onSubmit={submitEvaluation}
        className={reviewer.formCard}
        aria-label="Evaluate Paper"
        data-testid="evaluate-form"
      >
        <p className={reviewer.formIntro}>
          Score every criterion from {REVIEWER_CRITERIA[0]?.min ?? 1} to{' '}
          {REVIEWER_CRITERIA[0]?.max ?? 5} and add a short private note per
          criterion. Your recommendation is private to Admin and does not
          publish this paper.
        </p>
        {REVIEWER_CRITERIA.map((criterion) => {
          const score = draft.scores[criterion.key];
          const note = draft.perCriterionNotes[criterion.key];
          const optionValues = Array.from(
            { length: criterion.max - criterion.min + 1 },
            (_, index) => criterion.min + index,
          );
          return (
            <fieldset
              key={criterion.key}
              className={reviewer.criterion}
              aria-label={criterion.label}
            >
              <legend className={reviewer.criterionLegend}>
                {criterion.label}
              </legend>
              <p className={reviewer.criterionDescription}>
                {criterion.description}
              </p>
              <div className={reviewer.criterionScoreRow}>
                <label htmlFor={`score-${criterion.key}`}>Score</label>
                <select
                  id={`score-${criterion.key}`}
                  value={score}
                  onChange={(event) =>
                    handleScoreChange(criterion.key, Number(event.target.value))
                  }
                >
                  {optionValues.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <span className={reviewer.criterionRange}>
                  ({criterion.min}–{criterion.max})
                </span>
              </div>
              <label
                htmlFor={`note-${criterion.key}`}
                className={reviewer.criterionNoteLabel}
              >
                Private note for Admin (optional)
              </label>
              <textarea
                id={`note-${criterion.key}`}
                className={reviewer.criterionNote}
                value={note}
                onChange={(event) =>
                  handleNoteChange(criterion.key, event.target.value)
                }
                placeholder={`Brief note on ${criterion.label.toLowerCase()}`}
              />
            </fieldset>
          );
        })}
        <div className={reviewer.formField}>
          <label htmlFor="private-comments">
            Private review feedback for Admin
          </label>
          <textarea
            id="private-comments"
            rows={7}
            value={draft.privateComments}
            onChange={(event) =>
              handlePrivateCommentsChange(event.target.value)
            }
            placeholder="Summary, key concerns, and revision requests. Admin reads this; the author never sees it directly."
          />
        </div>
        <div className={reviewer.formField}>
          <label htmlFor="recommendation">Recommendation</label>
          <select
            id="recommendation"
            value={draft.recommendation}
            onChange={(event) =>
              handleRecommendationChange(
                event.target.value as ReviewerRecommendationValue,
              )
            }
          >
            {REVIEWER_RECOMMENDATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <ErrorBanner
            tone="error"
            title="Could not submit review"
            message={error}
          />
        )}
        <div className={reviewer.evaluationActions}>
          <p className={reviewer.evaluationHint}>
            Submitting sends your recommendation to Admin. You will not be
            able to edit it afterwards.
          </p>
          <Button
            variant="secondary"
            size="md"
            disabled={saving}
            type="submit"
          >
            Submit private review to Admin
          </Button>
        </div>
      </form>
    );
  };

  const renderSubmitted = (paperToRender: PublicationPaper) => (
    <section
      className={reviewer.submittedBanner}
      aria-live="polite"
      data-testid="submitted-banner"
    >
      <h2>Review submitted</h2>
      <p>
        Awaiting Admin decision on{' '}
        <strong>{renderInlineStatus(paperToRender.status)}</strong>. The form
        is closed for this assignment.
      </p>
    </section>
  );

  const renderResponseActions = () => (
    <div className={reviewer.evaluationActions}>
      <p className={reviewer.evaluationHint}>
        Accept to begin evaluation, or decline and the assignment returns to
        Admin's queue.
      </p>
      <div className={reviewer.respondButtons}>
        <Button
          variant="secondary"
          size="md"
          disabled={saving}
          onClick={() => void handleAccept(true)}
        >
          Accept assignment
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={saving}
          onClick={() => void handleAccept(false)}
        >
          Decline assignment
        </Button>
      </div>
    </div>
  );

  const renderUnauthorized = () => (
    <section
      className={reviewer.unauthorizedNotice}
      data-testid="unauthorized-notice"
    >
      <h2>This assignment is not available to you</h2>
      <p>
        The reviewer workspace only lists assignments Admin assigned to your
        account. If you believe this is a mistake, contact the editorial
        Admin.
      </p>
      <div>
        <Button
          variant="outline"
          size="md"
          onClick={() => navigate('/reviewer/assignments')}
        >
          Back to my assignments
        </Button>
      </div>
    </section>
  );

  if (loading || resolved.status === 'missing') {
    return (
      <section className={reviewer.page}>
        <PageHeader
          eyebrow="REVIEWER WORKSPACE"
          title="Review Assignment"
          accent={REVIEWER_ACCENT}
        />
        <SkeletonRow count={6} withHeader />
      </section>
    );
  }

  if (resolved.status === 'unauthorised') {
    return (
      <section className={reviewer.page}>
        <PageHeader
          eyebrow="REVIEWER WORKSPACE"
          title="Review Assignment"
          accent={REVIEWER_ACCENT}
          actions={
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/reviewer/assignments')}
            >
              ← All assignments
            </Button>
          }
        />
        {renderUnauthorized()}
      </section>
    );
  }

  const paperToRender = resolved.paper;
  if (!paperToRender) {
    return (
      <section className={reviewer.page}>
        <PageHeader
          eyebrow="REVIEWER WORKSPACE"
          title="Review Assignment"
          accent={REVIEWER_ACCENT}
        />
        <EmptyState
          icon={<AlertTriangle size={20} aria-hidden />}
          title="Assignment could not be loaded"
          description="The paper for this assignment is unavailable. Try refreshing from the assignments list."
          action={
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/reviewer/assignments')}
            >
              Back to my assignments
            </Button>
          }
        />
      </section>
    );
  }

  const tone = statusTone(paperToRender);

  return (
    <section className={reviewer.page}>
      <PageHeader
        eyebrow="REVIEWER WORKSPACE"
        title={paperToRender.title}
        description="Assigned by Admin. Your recommendation is private to Admin and does not publish this paper."
        accent={REVIEWER_ACCENT}
        actions={
          <>
            <StatusBadge status={tone} label={renderInlineStatus(paperToRender.status)} size="sm" />
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/reviewer/assignments')}
            >
              ← All assignments
            </Button>
          </>
        }
      />

      <div className={reviewer.detailLayout}>
        <div className={reviewer.detailSide}>
          <section className={reviewer.detailContext} aria-labelledby="paper-metadata-title">
            <h2 className={reviewer.detailHeading} id="paper-metadata-title">
              Paper metadata
            </h2>
            {renderMetadata(paperToRender)}
          </section>

          <section className={reviewer.detailContext} aria-labelledby="paper-abstract-title">
            <h2 className={reviewer.detailHeading} id="paper-abstract-title">
              Abstract
            </h2>
            <p className={reviewer.contextParagraph}>{paperToRender.abstract}</p>
          </section>

          <section className={reviewer.detailContext} aria-labelledby="paper-authors-title">
            <h2 className={reviewer.detailHeading} id="paper-authors-title">
              Authors &amp; institutions
            </h2>
            <p className={reviewer.contextParagraph}>
              <span className={reviewer.contextLabel}>Authors</span>
              <span className={reviewer.contextValue}>
                {paperToRender.authors.map((author) => author.name).join(', ') ||
                  'Not supplied'}
              </span>
            </p>
            <p className={reviewer.contextParagraph}>
              <span className={reviewer.contextLabel}>Institutions</span>
              <span className={reviewer.contextValue}>
                {paperToRender.institutions
                  .map((institution) => institution.name)
                  .join(', ') || 'Not supplied'}
              </span>
            </p>
          </section>

          <section className={reviewer.detailContext} aria-labelledby="paper-pdf-title">
            <h2 className={reviewer.detailHeading} id="paper-pdf-title">
              Manuscript PDF
            </h2>
            {renderPdf(paperToRender)}
          </section>
        </div>

        <div className={reviewer.detailSide}>
          {awaitingResponse && (
            <section className={reviewer.detailContext} aria-labelledby="respond-title">
              <h2 className={reviewer.detailHeading} id="respond-title">
                Respond to assignment
              </h2>
              {renderResponseActions()}
            </section>
          )}
          {canReview && (
            <>
              <h2 className={reviewer.detailHeading}>Evaluate Paper</h2>
              {renderEvaluationForm()}
            </>
          )}
          {submitted && renderSubmitted(paperToRender)}
          {!shouldRenderPrivatePriorReview(paperToRender.status) &&
            !canReview &&
            !submitted &&
            !awaitingResponse && (
              <EmptyState
                icon={<AlertTriangle size={20} aria-hidden />}
                title="Assignment is not actionable"
                description="This assignment is not actionable for review. Awaiting Admin or researcher activity."
              />
            )}
        </div>
      </div>
    </section>
  );
};

export default ReviewerAssignmentDetail;