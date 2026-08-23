import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  FileText,
  Loader,
  User,
  X,
} from 'lucide-react';
import LazyPdfViewer from '../PdfViewer/LazyPdfViewer';
import { ReviewRequestStatusBadge } from './ReviewRequestStatusBadge';
import {
  detailedEvaluationService,
  type DetailedEvaluation,
} from '../../services/detailedEvaluation.service';
import type { ReviewRequest } from '../../services/reviewRequest.service';
import type { Paper } from '../../services/paper.service';
import { resolvePaperTitle } from '../../utils/reviewRequestDisplay';
import styles from './ReviewRequestDetailsModal.module.css';

export interface ReviewRequestDetailsModalProps {
  isOpen: boolean;
  request: ReviewRequest | null;
  papersById: ReadonlyMap<string, Paper>;
  extraPapersById?: ReadonlyMap<string, Paper>;
  reviewerLookup: (req: Pick<ReviewRequest, 'reviewerId' | 'reviewerName'>) => {
    name: string;
    initials: string;
    avatarBg: string;
  } | null;
  onClose: () => void;
}

/**
 * Researcher "View Details" modal — defect 1C.
 *
 * Renders manuscript title, reviewer name, request id, submission date,
 * completion date, fee, status, evaluation scores, category notes, general
 * comments, final decision, paper link/PDF. Fetches the Detailed Evaluation
 * by Review Request ID. Visible loading + error states. NEVER fabricates a
 * scorecard — if the BE omits evaluation data, the user sees a truthful
 * message. If the request is marked Completed but no evaluation can be
 * loaded, the modal surfaces a clear inconsistency warning rather than a
 * fake score.
 */
export const ReviewRequestDetailsModal = ({
  isOpen,
  request,
  papersById,
  extraPapersById,
  reviewerLookup,
  onClose,
}: ReviewRequestDetailsModalProps) => {
  const [evaluation, setEvaluation] = useState<DetailedEvaluation | null>(null);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !request?.id) {
      setEvaluation(null);
      setEvaluationError(null);
      return;
    }
    setIsLoadingEvaluation(true);
    setEvaluationError(null);
    setEvaluation(null);
    detailedEvaluationService
      .getByReviewRequestId(request.id)
      .then((eval_) => {
        if (eval_ && (eval_.detailedEvaluationId || eval_.generalComments)) {
          setEvaluation(eval_);
        }
      })
      .catch((err) => {
        setEvaluationError(
          (err as Error)?.message ?? 'Failed to load the evaluation.'
        );
      })
      .finally(() => setIsLoadingEvaluation(false));
  }, [isOpen, request?.id]);

  // Close on Escape (defect 2B UX nicety; works for both Researcher modal and
  // a future Reviewer-side use of the same component).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !request) return null;

  // Paper title via progressive hydration.
  const resolution = resolvePaperTitle({
    req: request,
    papersById,
    extraPapersById,
  });
  const paperTitle =
    resolution.kind === 'title'
      ? resolution.title
      : resolution.kind === 'id'
        ? `Paper #${resolution.paperId}`
        : 'Details unavailable';

  // Reviewer display info (uses parent's lookup so we share the same hydration).
  const reviewer = reviewerLookup(request);

  const submissionDate = request.createdAt
    ? new Date(request.createdAt).toISOString().split('T')[0]
    : '—';
  // BE doesn't ship a dedicated `completedAt` field today — fall back to
  // `updatedAt`. Both surface to the BE gap ticket.
  const completionDate = request.updatedAt
    ? new Date(request.updatedAt).toISOString().split('T')[0]
    : '—';

  // Inconsistency guard — request is Completed but no evaluation was loaded.
  // Surfaces a truthful message rather than a fabricated scorecard.
  const isStatusCompleted = request.status?.toUpperCase() === 'COMPLETED';
  const evaluationMissing =
    isStatusCompleted && !isLoadingEvaluation && !evaluation;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={18} />
        </button>

        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>Review Request Details</h2>
            <span className={styles.subtitle}>
              Review Request ID: <code>#{request.id ?? '—'}</code>
            </span>
          </div>
          <ReviewRequestStatusBadge status={request.status} size="md" />
        </header>

        <div className={styles.body}>
          {/* Manuscript + Reviewer summary */}
          <section className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <FileText size={16} className={styles.summaryIcon} aria-hidden="true" />
              <div className={styles.summaryMeta}>
                <span className={styles.summaryLabel}>Manuscript</span>
                <span className={styles.summaryValue}>{paperTitle}</span>
              </div>
            </div>
            <div className={styles.summaryItem}>
              <User size={16} className={styles.summaryIcon} aria-hidden="true" />
              <div className={styles.summaryMeta}>
                <span className={styles.summaryLabel}>Reviewer</span>
                <span className={styles.summaryValue}>
                  {reviewer?.name ??
                    (request.reviewerId != null
                      ? 'Reviewer (profile not yet completed)'
                      : 'Reviewer details unavailable')}
                </span>
              </div>
            </div>
            <div className={styles.summaryItem}>
              <Calendar size={16} className={styles.summaryIcon} aria-hidden="true" />
              <div className={styles.summaryMeta}>
                <span className={styles.summaryLabel}>Submission date</span>
                <span className={styles.summaryValue}>{submissionDate}</span>
              </div>
            </div>
            <div className={styles.summaryItem}>
              <CheckCircle2
                size={16}
                className={styles.summaryIcon}
                aria-hidden="true"
              />
              <div className={styles.summaryMeta}>
                <span className={styles.summaryLabel}>Completion date</span>
                <span className={styles.summaryValue}>{completionDate}</span>
              </div>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryIcon} aria-hidden="true">
                ₫
              </span>
              <div className={styles.summaryMeta}>
                <span className={styles.summaryLabel}>Review fee</span>
                <span className={styles.summaryValue}>
                  {(request.fee ?? 0).toLocaleString('vi-VN')} VND
                </span>
              </div>
            </div>
          </section>

          {/* Evaluation section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Detailed Evaluation</h3>

            {isLoadingEvaluation ? (
              <div className={styles.loading}>
                <Loader size={14} className={styles.spinner} aria-hidden="true" />
                <span>Loading evaluation…</span>
              </div>
            ) : evaluationError ? (
              <div className={styles.errorBanner} role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{evaluationError}</span>
              </div>
            ) : evaluationMissing ? (
              <div className={styles.warningBanner} role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <div>
                  <strong>This review is marked Completed but the associated
                    Detailed Evaluation could not be loaded.</strong>
                  <p>
                    Please refresh, or contact support if this persists. See{' '}
                    <code>docs/local-only/backend-gap-request-review-request-joins.md</code>{' '}
                    for the BE join-fields ticket.
                  </p>
                </div>
              </div>
            ) : !evaluation ? (
              <div className={styles.emptyHint}>
                The Reviewer has not submitted an evaluation yet.
              </div>
            ) : (
              <EvaluationReadOnly evaluation={evaluation} />
            )}
          </section>

          {/* Paper PDF link */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Paper PDF</h3>
            {resolution.kind === 'title' && resolution.paper.fileUrl ? (
              <div className={styles.pdfFrame}>
                <LazyPdfViewer url={resolution.paper.fileUrl} />
              </div>
            ) : (
              <div className={styles.emptyHint}>PDF not available.</div>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.footerCloseBtn} onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

// ── Internal: read-only evaluation scorecard ────────────────────────────────
//
// Defect 2B's read-only mode is implemented inline here so the Researcher
// modal never edits or submits. The Reviewer-side EvaluationDesk has its own
// read-only branch (no Save/Submit, static pills) — both call sites go
// through `DetailedEvaluation` props so we never fabricate scores.
interface EvaluationReadOnlyProps {
  evaluation: DetailedEvaluation;
}

const EvaluationReadOnly = ({ evaluation }: EvaluationReadOnlyProps) => {
  const rows: Array<{
    label: string;
    score?: number | null;
    notes?: string | null;
  }> = [
    { label: '1. Originality', score: evaluation.scoreOriginality, notes: evaluation.notesOriginality },
    { label: '2. Literature Review', score: evaluation.scoreLiterature, notes: evaluation.notesLiterature },
    { label: '3. Methodology', score: evaluation.scoreMethodology, notes: evaluation.notesMethodology },
    { label: '4. Results & Discussion', score: evaluation.scoreResults, notes: evaluation.notesResults },
    { label: '5. Formatting & Structure', score: evaluation.scoreFormatting, notes: evaluation.notesFormatting },
  ];
  return (
    <div className={styles.scorecardReadOnly}>
      {rows.map((row) => (
        <div key={row.label} className={styles.scorecardRow}>
          <div className={styles.scorecardRowHeader}>
            <span className={styles.scorecardRowTitle}>{row.label}</span>
            <ScorePills active={row.score ?? null} />
          </div>
          {row.notes && row.notes.trim() ? (
            <p className={styles.scorecardNotes}>{row.notes}</p>
          ) : null}
        </div>
      ))}
      <div className={styles.scorecardRow}>
        <div className={styles.scorecardRowHeader}>
          <span className={styles.scorecardRowTitle}>6. Final Decision</span>
          <span
            className={`${styles.decisionBadge} ${
              evaluation.finalDecision === 'Accept'
                ? styles.decisionAccept
                : evaluation.finalDecision === 'Reject'
                  ? styles.decisionReject
                  : styles.decisionNeutral
            }`}
          >
            {evaluation.finalDecision ?? '—'}
          </span>
        </div>
      </div>
      {evaluation.generalComments && evaluation.generalComments.trim() ? (
        <div className={styles.generalComments}>
          <span className={styles.generalCommentsLabel}>General Comments</span>
          <p>{evaluation.generalComments}</p>
        </div>
      ) : null}
    </div>
  );
};

const ScorePills = ({ active }: { active: number | null }) => {
  return (
    <div className={styles.scorePills} aria-label="Score">
      {[1, 2, 3, 4, 5].map((num) => (
        <span
          key={num}
          className={`${styles.scorePill} ${active === num ? styles.scorePillActive : ''}`}
        >
          {num}
        </span>
      ))}
    </div>
  );
};

export default ReviewRequestDetailsModal;