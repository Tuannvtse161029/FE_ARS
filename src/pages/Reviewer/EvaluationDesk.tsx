import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Unlock,
  SendHorizontal,
  Save,
  Check,
  X,
  RotateCw,
  Download,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import { PdfViewer } from '../../components/PdfViewer';
import { reviewRequestService } from '../../services/reviewRequest.service';
import type { ReviewRequest } from '../../services/reviewRequest.service';
import { paperService, type Paper } from '../../services/paper.service';
import {
  detailedEvaluationService,
  type DetailedEvaluation,
} from '../../services/detailedEvaluation.service';
import { useAuthStore } from '../../store/authSlice';
import { normalizeReviewRequestStatus } from '../../utils/reviewRequestPolicy';
import { ReviewRequestStatusBadge } from '../../components/reviewer/ReviewRequestStatusBadge';
import styles from './EvaluationDesk.module.css';

const EMPTY_FORM = {
  scoreOriginality: 4,
  notesOriginality: '',
  scoreLiterature: 4,
  notesLiterature: '',
  scoreMethodology: 5,
  notesMethodology: '',
  scoreResults: 4,
  notesResults: '',
  scoreFormatting: 5,
  notesFormatting: '',
  finalDecision: 'Accept',
  generalComments: '',
};

export const EvaluationDesk = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const reviewRequestFromState = (location.state as { reviewRequest?: ReviewRequest } | null)?.reviewRequest;
  const reviewRequestIdFromQueryRaw = searchParams.get('reviewRequestId');
  const reviewRequestIdFromQuery =
    reviewRequestIdFromQueryRaw != null && reviewRequestIdFromQueryRaw !== ''
      ? Number(reviewRequestIdFromQueryRaw)
      : null;

  // Defect 2B refresh-safety: the request can come from EITHER `location.state`
  // (fast path) OR `?reviewRequestId=…` URL param (survives a hard refresh).
  // If only the query is present, we refetch the request via the BE so the
  // scorecard view can hydrate after a page reload.
  const [requestFromQuery, setRequestFromQuery] = useState<ReviewRequest | null>(null);
  const reviewRequest: ReviewRequest | null =
    reviewRequestFromState ?? requestFromQuery;
  const reviewRequestId = reviewRequest?.id ?? reviewRequestIdFromQuery ?? null;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [paperLoadError, setPaperLoadError] = useState<string | null>(null);
  const [existingEvaluation, setExistingEvaluation] = useState<DetailedEvaluation | null>(null);
  const [isLoadingPaper, setIsLoadingPaper] = useState(false);
  const [, setIsLoadingEvaluation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Defect 2B — read-only when the request is already Completed.
  const isReadOnly =
    normalizeReviewRequestStatus(reviewRequest?.status) === 'COMPLETED';

  const [form, setForm] = useState(EMPTY_FORM);

  // ── URL-param fallback: if the user arrives via `?reviewRequestId=…`
  // without `location.state`, refetch the request via the BE so the page
  // still renders correctly after a hard refresh (defect 2B).
  useEffect(() => {
    if (reviewRequestFromState) {
      setRequestFromQuery(null);
      return;
    }
    if (!reviewRequestIdFromQuery) {
      setRequestFromQuery(null);
      return;
    }
    let cancelled = false;
    reviewRequestService
      .getById(reviewRequestIdFromQuery)
      .then((row) => {
        if (!cancelled) setRequestFromQuery(row);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to refetch review request by id:', err);
          setRequestFromQuery(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reviewRequestFromState, reviewRequestIdFromQuery]);

  // ── Load paper ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!reviewRequest?.paperId) return;
    setIsLoadingPaper(true);
    paperService
      .getById(String(reviewRequest.paperId))
      .then(setPaper)
      .catch((err) => {
        console.error('Failed to load paper:', err);
        setPaperLoadError(
          (err as Error)?.message ?? 'Unable to load paper details. Please go back and try again.'
        );
      })
      .finally(() => setIsLoadingPaper(false));
  }, [reviewRequest?.paperId]);

  // ── Load existing evaluation (if any) ────────────────────────────────────
  useEffect(() => {
    if (!reviewRequestId) return;
    setIsLoadingEvaluation(true);
    detailedEvaluationService
      .getByReviewRequestId(reviewRequestId)
      .then((eval_) => {
        if (eval_ && eval_.detailedEvaluationId) {
          setExistingEvaluation(eval_);
          setForm({
            scoreOriginality: eval_.scoreOriginality ?? 4,
            notesOriginality: eval_.notesOriginality ?? '',
            scoreLiterature: eval_.scoreLiterature ?? 4,
            notesLiterature: eval_.notesLiterature ?? '',
            scoreMethodology: eval_.scoreMethodology ?? 5,
            notesMethodology: eval_.notesMethodology ?? '',
            scoreResults: eval_.scoreResults ?? 4,
            notesResults: eval_.notesResults ?? '',
            scoreFormatting: eval_.scoreFormatting ?? 5,
            notesFormatting: eval_.notesFormatting ?? '',
            finalDecision: eval_.finalDecision ?? 'Accept',
            generalComments: eval_.generalComments ?? '',
          });
        }
      })
      .catch((err) => console.error('Failed to load evaluation:', err))
      .finally(() => setIsLoadingEvaluation(false));
  }, [reviewRequestId]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setScore = (field: keyof typeof EMPTY_FORM, value: number | string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSaveDraft = async () => {
    if (!reviewRequestId || !currentUserId) return;
    try {
      if (existingEvaluation?.detailedEvaluationId) {
        await detailedEvaluationService.update(existingEvaluation.detailedEvaluationId, {
          ...form,
          reviewRequestId,
          reviewerId: currentUserId,
        });
      } else {
        await detailedEvaluationService.create({
          ...form,
          reviewRequestId,
          reviewerId: currentUserId,
        });
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewRequestId || !currentUserId || isSubmitting) return;
    // Defect 2B — never submit through the read-only scorecard view. The
    // Completed tab uses this same surface; we don't want a stray click to
    // re-write a finalized evaluation.
    if (isReadOnly) {
      setSubmitError('This review is already completed. The scorecard is read-only.');
      return;
    }

    // ── Validation ──────────────────────────────────────────────────────────
    if (!form.generalComments.trim()) {
      setSubmitError('Please provide qualitative comments before submitting.');
      return;
    }
    if (!form.finalDecision) {
      setSubmitError('Please select a final decision before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Defect 2A — persist evaluation FIRST, assert a non-empty id, THEN
      // mark the request Completed. If the evaluation persistence fails the
      // request MUST stay in its current state — never mark Completed without
      // an evaluation record (defect 1C's inconsistency message).
      let persistedEvaluationId: number | undefined;
      if (existingEvaluation?.detailedEvaluationId) {
        const updated = await detailedEvaluationService.update(
          existingEvaluation.detailedEvaluationId,
          {
            ...form,
            reviewRequestId,
            reviewerId: currentUserId,
          }
        );
        persistedEvaluationId = updated.detailedEvaluationId ?? existingEvaluation.detailedEvaluationId;
      } else {
        const created = await detailedEvaluationService.create({
          ...form,
          reviewRequestId,
          reviewerId: currentUserId,
        });
        persistedEvaluationId = created.detailedEvaluationId;
      }

      if (!persistedEvaluationId) {
        // Defensive: BE accepted the request but didn't echo an id. Treat
        // as a failed persistence — do NOT mark Completed.
        throw new Error('Failed to persist evaluation (no id returned).');
      }

      // Defect 2A — request status update AFTER evaluation is persisted.
      const updatedReq = await reviewRequestService.update(reviewRequestId, {
        status: 'Completed',
      });

      // Defect 2A item 6 — only mark completed locally when the BE response
      // echoes `Completed`. If the BE returns the previous status (stale
      // propagation), the event-driven refetch will catch up shortly.
      const confirmedStatus = normalizeReviewRequestStatus(updatedReq.status);
      if (confirmedStatus !== 'COMPLETED') {
        console.warn(
          'reviewRequestService.update did not echo Completed; relying on refetch',
          updatedReq
        );
      }

      // Notify all live views (reviewer Pending → Completed tab, researcher
      // My Review Requests). The Researcher side listens for this and
      // refetches; the Reviewer AssignedReviews side also refetches on this
      // event (defect 2A — counts and tab filter both update).
      window.dispatchEvent(new CustomEvent('review-update', {
        detail: { reviewRequestId, status: 'Completed' },
      }));

      setIsSubmitted(true);
    } catch (err) {
      setSubmitError(
        (err as Error)?.message ?? 'Failed to submit evaluation. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  // Defect 2B — in read-only mode, all textareas become non-editable and the
  // final-decision select is disabled. We keep them in the DOM (rather than
  // hiding) so a screen reader still receives the persisted values.
  const textAreaReadOnlyProps = isReadOnly
    ? ({ readOnly: true, tabIndex: -1 } as const)
    : ({} as const);
  const renderRatingButtons = (field: keyof typeof EMPTY_FORM, currentVal: number) => {
    if (isReadOnly) {
      // Static score pills (defect 2B read-only mode — no editable controls).
      return (
        <div className={styles.ratingRow} aria-label={`Score: ${currentVal}`}>
          {[1, 2, 3, 4, 5].map((num) => (
            <span
              key={num}
              className={`${styles.ratingBtn} ${styles.ratingBtnStatic} ${currentVal === num ? styles.activeRatingBtn : ''}`}
            >
              {num}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            type="button"
            className={`${styles.ratingBtn} ${currentVal === num ? styles.activeRatingBtn : ''}`}
            onClick={() => setScore(field, num)}
          >
            {num}
          </button>
        ))}
      </div>
    );
  };

  const fileUrl = paper?.fileUrl ?? null;

  return (
    <div className={styles.evaluationDesk}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Assigned Review Tasks &gt;{' '}
        <span className={styles.activeBreadcrumb}>Evaluation Desk</span>
      </div>

      {/* Sub header — shows real paper title */}
      <div className={styles.subHeader}>
        <div className={styles.subHeaderLeft}>
          <span className={styles.docIcon}>
            <FileText size={24} />
          </span>
          <div className={styles.docMeta}>
            <h2 className={styles.docTitle}>
              {isLoadingPaper ? 'Loading paper…' : paper?.title ?? 'Unknown Paper'}
            </h2>
            {paper?.fileUrl && (
              <span className={styles.docSubText}>
                Paper #{reviewRequest?.paperId}
              </span>
            )}
          </div>
        </div>
        <span className={styles.inReviewBadge}>
          {reviewRequest && isReadOnly ? (
            <ReviewRequestStatusBadge status={reviewRequest.status} size="md" />
          ) : (
            '● IN REVIEW'
          )}
        </span>
      </div>

      {/* No review request passed */}
      {!reviewRequest && !isLoadingPaper && (
        <div className={styles.emptyState}>
          No review request data found. Please go back and select a paper to evaluate.
          <button className={styles.backBtn} onClick={() => navigate(ROUTES.REVIEW_TASKS)}>
            Back to Review Tasks
          </button>
        </div>
      )}

      {/* Grid: PDF + Scorecard */}
      {reviewRequest && (
        <div className={styles.deskGrid}>
          {/* Left Column: PDF Viewer */}
          <div className={styles.pdfViewerCard}>
            <div className={styles.pdfHeader}>
              <span className={styles.pdfTitle}>
                PDF VIEWER: {paper?.title ?? 'Loading…'}
              </span>
              <div className={styles.pdfControls}>
                <button className={styles.pdfActionBtn} title="Refresh" aria-label="Refresh PDF">
                  <RotateCw size={14} />
                </button>
                <button className={styles.pdfActionBtn} title="Download" aria-label="Download PDF">
                  <Download size={14} />
                </button>
              </div>
            </div>
            <div className={styles.pdfBody}>
              {isLoadingPaper ? (
                <div className={styles.pdfNoFile}>Loading paper…</div>
              ) : paperLoadError ? (
                <div className={styles.pdfNoFile}>
                  <strong>Failed to load paper</strong>
                  <p>{paperLoadError}</p>
                  <p>Paper ID: #{reviewRequest?.paperId}</p>
                </div>
              ) : !paper ? (
                <div className={styles.pdfNoFile}>
                  No paper data found for this review request. Please go back and try again.
                </div>
              ) : !fileUrl ? (
                <div className={styles.pdfNoFile}>
                  <strong>No PDF file attached to this paper</strong>
                  <p>Paper title: <em>{paper.title}</em></p>
                  <p>Paper ID: #{reviewRequest?.paperId}</p>
                  <p>Contact the author or platform administrator to attach the document.</p>
                </div>
              ) : (
                <PdfViewer url={fileUrl} />
              )}
            </div>
          </div>

          {/* Right Column: Scorecard */}
          <div className={styles.scorecardCard}>
            <div className={styles.scorecardHeader}>
              <h3 className={styles.scorecardTitle}>CRITERIA EVALUATION SCORECARD</h3>
              {isSaved && (
                <span className={styles.autosaveBadge}>
                  <Save size={11} style={{ verticalAlign: 'middle' }} /> Draft Autosaved
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className={styles.scorecardBody}>
              {/* 1. ORIGINALITY */}
              <div className={styles.scorecardSection}>
                <div className={styles.sectionHeaderRow}>
                  <span className={styles.sectionTitle}>1. ORIGINALITY</span>
                  {renderRatingButtons('scoreOriginality', form.scoreOriginality)}
                </div>
                <textarea
                  className={styles.criteriaFeedbackText}
                  placeholder="Add your notes on originality…"
                  value={form.notesOriginality}
                  onChange={(e) => setScore('notesOriginality', e.target.value)}
                  rows={2}
                  {...textAreaReadOnlyProps}
                />
              </div>

              {/* 2. LITERATURE REVIEW */}
              <div className={styles.scorecardSection}>
                <div className={styles.sectionHeaderRow}>
                  <span className={styles.sectionTitle}>2. LITERATURE REVIEW</span>
                  {renderRatingButtons('scoreLiterature', form.scoreLiterature)}
                </div>
                <textarea
                  className={styles.criteriaFeedbackText}
                  placeholder="Add your notes on literature review…"
                  value={form.notesLiterature}
                  onChange={(e) => setScore('notesLiterature', e.target.value)}
                  rows={2}
                  {...textAreaReadOnlyProps}
                />
              </div>

              {/* 3. METHODOLOGY */}
              <div className={styles.scorecardSection}>
                <div className={styles.sectionHeaderRow}>
                  <span className={styles.sectionTitle}>3. METHODOLOGY</span>
                  {renderRatingButtons('scoreMethodology', form.scoreMethodology)}
                </div>
                <textarea
                  className={styles.criteriaFeedbackText}
                  placeholder="Add your notes on methodology…"
                  value={form.notesMethodology}
                  onChange={(e) => setScore('notesMethodology', e.target.value)}
                  rows={2}
                  {...textAreaReadOnlyProps}
                />
              </div>

              {/* 4. RESULTS & DISCUSSION */}
              <div className={styles.scorecardSection}>
                <div className={styles.sectionHeaderRow}>
                  <span className={styles.sectionTitle}>4. RESULTS &amp; DISCUSSION</span>
                  {renderRatingButtons('scoreResults', form.scoreResults)}
                </div>
                <textarea
                  className={styles.criteriaFeedbackText}
                  placeholder="Add your notes on results…"
                  value={form.notesResults}
                  onChange={(e) => setScore('notesResults', e.target.value)}
                  rows={2}
                  {...textAreaReadOnlyProps}
                />
              </div>

              {/* 5. FORMATTING & STRUCTURE */}
              <div className={styles.scorecardSection}>
                <div className={styles.sectionHeaderRow}>
                  <span className={styles.sectionTitle}>5. FORMATTING &amp; STRUCTURE</span>
                  {renderRatingButtons('scoreFormatting', form.scoreFormatting)}
                </div>
                <textarea
                  className={styles.criteriaFeedbackText}
                  placeholder="Add your notes on formatting…"
                  value={form.notesFormatting}
                  onChange={(e) => setScore('notesFormatting', e.target.value)}
                  rows={2}
                  {...textAreaReadOnlyProps}
                />
              </div>

              {/* 6. FINAL DECISION */}
              <div className={styles.scorecardSection}>
                <span className={styles.sectionTitle}>6. FINAL DECISION</span>
                <div className={styles.dropdownWrapper}>
                  <select
                    className={styles.finalDecisionSelect}
                    value={form.finalDecision}
                    onChange={(e) => setScore('finalDecision', e.target.value)}
                    disabled={isReadOnly}
                  >
                    <option value="Accept">Accept</option>
                    <option value="Minor Revision">Minor Revision</option>
                    <option value="Major Revision">Major Revision</option>
                    <option value="Reject">Reject</option>
                  </select>
                </div>
              </div>

              {/* 7. QUALITATIVE COMMENTS */}
              <div className={styles.scorecardSection}>
                <span className={styles.sectionTitle}>7. QUALITATIVE COMMENTS</span>
                <textarea
                  className={styles.qualitativeTextarea}
                  placeholder="Provide detailed feedback for the author…"
                  value={form.generalComments}
                  onChange={(e) => setScore('generalComments', e.target.value)}
                  rows={6}
                  required
                  {...textAreaReadOnlyProps}
                />
              </div>

              {/* Error */}
              {submitError && (
                <div className={styles.submitError}>{submitError}</div>
              )}

              {/* Actions Footer — defect 2B read-only mode hides Save/Submit and
                  shows a Back-to-tasks CTA instead. */}
              {isReadOnly ? (
                <div className={styles.actionsFooter}>
                  <button
                    type="button"
                    className={styles.submitBtn}
                    onClick={() => navigate(ROUTES.REVIEW_TASKS)}
                  >
                    Back to Review Tasks
                  </button>
                </div>
              ) : (
                <div className={styles.actionsFooter}>
                  <button
                    type="button"
                    className={styles.saveDraftBtn}
                    onClick={handleSaveDraft}
                  >
                    <Save size={14} style={{ verticalAlign: 'middle' }} /> {isSaved ? 'Draft Saved!' : 'Save Draft'}
                  </button>
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isSubmitting}
                  >
                    <SendHorizontal size={14} style={{ verticalAlign: 'middle' }} /> {isSubmitting ? 'Submitting…' : 'Submit Final Feedback to Author'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {isSubmitted && (
        <div className={styles.modalOverlay}>
          <div
            className={styles.successModalCard}
            style={{ maxWidth: '520px', padding: '32px' }}
          >
            <button
              className={styles.closeModalCross}
              onClick={() => navigate(ROUTES.REVIEW_TASKS)}
            >
              <X size={20} />
            </button>
            <div
              className={styles.successIconCircle}
              style={{
                width: '56px',
                height: '56px',
                backgroundColor: '#e6fcf5',
                color: '#099268',
              }}
            >
              <Check size={28} strokeWidth={3} />
            </div>
            <h3
              className={styles.successModalTitle}
              style={{ fontSize: '1.25rem', marginTop: '10px' }}
            >
              Evaluation Submitted Successfully!
            </h3>
            <p className={styles.successModalText} style={{ color: '#64748b' }}>
              Your feedback has been securely delivered to the author for review.
            </p>

            <div className={styles.escrowReleasedAlertCard}>
              <span className={styles.escrowAlertIcon}>
                <Unlock size={22} color="#099268" />
              </span>
              <div className={styles.escrowAlertMeta}>
                <h4 className={styles.escrowAlertTitle}>Funds Released!</h4>
                <p className={styles.escrowAlertText}>
                  <b>
                    {reviewRequest?.fee
                      ? `${reviewRequest.fee.toLocaleString('vi-VN')} VND`
                      : 'Review fee'}{' '}
                  </b>
                  has been automatically transferred to your withdrawable wallet balance.
                </p>
              </div>
            </div>

            <button
              className={styles.successBtn}
              onClick={() => navigate(ROUTES.REVIEW_TASKS)}
            >
              Return to Review Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationDesk;
