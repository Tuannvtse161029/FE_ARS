import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { paperService, type Paper } from '../../services/paper.service';
import { detailedEvaluationService, type DetailedEvaluation } from '../../services/detailedEvaluation.service';
import { useAuthStore } from '../../store/authSlice';
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
  const currentUserId = useAuthStore((s) => s.user?.id);

  const reviewRequest = (location.state as { reviewRequest?: { id?: number; paperId?: number } })?.reviewRequest;
  const reviewRequestId = reviewRequest?.id;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [existingEvaluation, setExistingEvaluation] = useState<DetailedEvaluation | null>(null);
  const [isLoadingPaper, setIsLoadingPaper] = useState(false);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  // ── Load paper ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!reviewRequest?.paperId) return;
    setIsLoadingPaper(true);
    paperService
      .getById(String(reviewRequest.paperId))
      .then(setPaper)
      .catch((err) => console.error('Failed to load paper:', err))
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
    if (!reviewRequestId || !currentUserId) return;
    setIsSubmitting(true);
    setSubmitError(null);
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
      // Mark review request as completed
      await reviewRequestService.update(reviewRequestId, { status: 'Completed' });
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
  const renderRatingButtons = (field: keyof typeof EMPTY_FORM, currentVal: number) => (
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
        <span className={styles.inReviewBadge}>● IN REVIEW</span>
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
              {fileUrl ? (
                <PdfViewer url={fileUrl} />
              ) : (
                <div className={styles.pdfNoFile}>
                  {isLoadingPaper
                    ? 'Loading paper…'
                    : 'No PDF file available for this paper.'}
                </div>
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
                />
              </div>

              {/* Error */}
              {submitError && (
                <div className={styles.submitError}>{submitError}</div>
              )}

              {/* Actions Footer */}
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
                <h4 className={styles.escrowAlertTitle}>Escrow Funds Released!</h4>
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
