import {
  AlertCircle,
  Check,
  Loader,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  detailedEvaluationService,
  type DetailedEvaluation,
} from '../../../services/detailedEvaluation.service';
import { type ReviewRequest } from '../../../services/reviewRequest.service';
import { type Paper } from '../../../services/paper.service';
import { getReviewerDisplayName, ensureReviewerDisplayName } from '../../../services/reviewerLookup.service';
import styles from './ScorecardModal.module.css';

interface CriteriaItem {
  number: number;
  title: string;
  score: number;
  comment: string;
}

interface ScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided, fetches the evaluation by review request id. */
  reviewRequest?: Pick<ReviewRequest, 'id' | 'paperId' | 'reviewerId'> | null;
  /** When the caller already has the evaluation loaded, pass it in to skip
   *  the BE round-trip. */
  evaluation?: DetailedEvaluation | null;
  /** Optional paper to display the title above the scorecard. */
  paper?: Paper | null;
  /** Reviewer user id — used to fetch the reviewer's display name when
   *  the reviewerId is available on the review request. */
  reviewerId?: number | null;
}

interface ScorecardData {
  fileName: string;
  decision: 'Accept' | 'Reject' | 'Other';
  reviewerName: string;
  date: string;
  criteria: CriteriaItem[];
}

const decisionToClass = (decision: string | null | undefined): 'Accept' | 'Reject' | 'Other' => {
  if (!decision) return 'Other';
  const d = decision.toLowerCase();
  if (d === 'accept' || d === 'accepted') return 'Accept';
  if (d === 'reject' || d === 'rejected') return 'Reject';
  return 'Other';
};

const buildCriteria = (evaluation: DetailedEvaluation): CriteriaItem[] => {
  return [
    {
      number: 1,
      title: 'ORIGINALITY',
      score: evaluation.scoreOriginality ?? 0,
      comment: evaluation.notesOriginality ?? '',
    },
    {
      number: 2,
      title: 'LITERATURE REVIEW',
      score: evaluation.scoreLiterature ?? 0,
      comment: evaluation.notesLiterature ?? '',
    },
    {
      number: 3,
      title: 'METHODOLOGY',
      score: evaluation.scoreMethodology ?? 0,
      comment: evaluation.notesMethodology ?? '',
    },
    {
      number: 4,
      title: 'RESULTS & DISCUSSION',
      score: evaluation.scoreResults ?? 0,
      comment: evaluation.notesResults ?? '',
    },
    {
      number: 5,
      title: 'FORMATTING & STRUCTURE',
      score: evaluation.scoreFormatting ?? 0,
      comment: evaluation.notesFormatting ?? '',
    },
  ];
};

/**
 * Read-only review scorecard. Replaces the previous mock-data implementation.
 *
 * If `evaluation` is passed directly, the modal renders it immediately.
 * Otherwise the modal uses `reviewRequest.id` to fetch
 * `detailedEvaluationService.getByReviewRequestId(...)` — the same path the
 * EvaluationDesk read-only branch uses. Never fabricates scores.
 */
export const ScorecardModal = ({
  isOpen,
  onClose,
  reviewRequest,
  evaluation: evaluationProp,
  paper,
  reviewerId: reviewerIdProp,
}: ScorecardModalProps) => {
  const [fetchedEvaluation, setFetchedEvaluation] = useState<DetailedEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reviewer name — prefer the explicit prop, fall back to the reviewRequest, fall back to null.
  const effectiveReviewerId = reviewerIdProp ?? reviewRequest?.reviewerId ?? null;

  // Resolve the reviewer display name. The reviewerLookup service probes GET /api/User/{id}
  // asynchronously and dispatches 'ars:reviewer-name-resolved' on success; we use a
  // refresh-key so the component re-renders with the resolved name.
  const [, setReviewerNameRefresh] = useState(0);
  useEffect(() => {
    if (effectiveReviewerId == null) return;
    ensureReviewerDisplayName(effectiveReviewerId);
    const handler = () => setReviewerNameRefresh((k) => k + 1);
    window.addEventListener('ars:reviewer-name-resolved', handler);
    return () => window.removeEventListener('ars:reviewer-name-resolved', handler);
  }, [effectiveReviewerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewerDisplayName = effectiveReviewerId != null
    ? getReviewerDisplayName(effectiveReviewerId)
    : 'Reviewer';

  // Fetch only when the caller didn't pre-supply `evaluation` AND we have a
  // valid `reviewRequest.id`.
  const evaluation = evaluationProp ?? fetchedEvaluation;
  const shouldFetch = !evaluationProp && reviewRequest?.id != null;

  useEffect(() => {
    if (!isOpen || !shouldFetch) return;
    const id = reviewRequest?.id;
    if (id == null) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    detailedEvaluationService
      .getByReviewRequestId(id)
      .then((row) => {
        if (cancelled) return;
        if (row && (row.detailedEvaluationId || row.generalComments)) {
          setFetchedEvaluation(row);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as Error)?.message ?? 'Failed to load evaluation.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, shouldFetch, reviewRequest?.id]);

  if (!isOpen) return null;

  // ── Render states ────────────────────────────────────────────────────────
  if (shouldFetch && isLoading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.header}>
            <div className={styles.headerTitleArea}>
              <h2 className={styles.title}>CRITERIA EVALUATION SCORECARD</h2>
              <span className={styles.fileName}>{paper?.title ?? 'Loading…'}</span>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className={styles.body}>
            <div className={styles.loading}>
              <Loader size={14} className={styles.spinner} aria-hidden="true" />
              <span>Loading evaluation…</span>
            </div>
          </div>
          <div className={styles.footer}>
            <button className={styles.footerCloseBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (shouldFetch && error) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.header}>
            <div className={styles.headerTitleArea}>
              <h2 className={styles.title}>CRITERIA EVALUATION SCORECARD</h2>
              <span className={styles.fileName}>{paper?.title ?? '—'}</span>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className={styles.body}>
            <div className={styles.errorBanner} role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          </div>
          <div className={styles.footer}>
            <button className={styles.footerCloseBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.header}>
            <div className={styles.headerTitleArea}>
              <h2 className={styles.title}>CRITERIA EVALUATION SCORECARD</h2>
              <span className={styles.fileName}>{paper?.title ?? '—'}</span>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className={styles.body}>
            <div className={styles.emptyHint}>
              The Reviewer has not submitted an evaluation for this review request yet.
            </div>
          </div>
          <div className={styles.footer}>
            <button className={styles.footerCloseBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const data: ScorecardData = {
    fileName: paper?.title ?? 'Untitled',
    decision: decisionToClass(evaluation.finalDecision),
    reviewerName: reviewerDisplayName,
    date: evaluation.createdAt
      ? new Date(evaluation.createdAt).toISOString().split('T')[0]
      : '',
    criteria: buildCriteria(evaluation),
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleArea}>
            <h2 className={styles.title}>CRITERIA EVALUATION SCORECARD</h2>
            <span className={styles.fileName}>{data.fileName}</span>
          </div>
          <div className={styles.headerActions}>
            <span
              className={`${styles.badge} ${
                data.decision === 'Accept'
                  ? styles.badgeAccept
                  : data.decision === 'Reject'
                    ? styles.badgeReject
                    : styles.badgeNeutral
              }`}
            >
              {data.decision === 'Accept' ? (
                <>
                  <Check size={12} strokeWidth={3} style={{ verticalAlign: 'middle' }} /> Accept
                </>
              ) : data.decision === 'Reject' ? (
                <>
                  <X size={12} strokeWidth={3} style={{ verticalAlign: 'middle' }} /> Reject
                </>
              ) : (
                <span style={{ verticalAlign: 'middle' }}>{evaluation.finalDecision ?? '—'}</span>
              )}
            </span>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className={styles.body}>
          {data.criteria.map((item) => (
            <div key={item.number} className={styles.criteriaCard}>
              <div className={styles.criteriaHeader}>
                <h3 className={styles.criteriaTitle}>
                  {item.number}. {item.title}
                </h3>
                {/* Score Pills 1 to 5 */}
                <div className={styles.scorePills}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <span
                      key={num}
                      className={`${styles.scorePill} ${
                        item.score === num ? styles.scorePillActive : ''
                      }`}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>
              {item.comment && item.comment.trim() ? (
                <p className={styles.commentText}>{item.comment}</p>
              ) : null}
            </div>
          ))}

          {/* Final Decision row */}
          <div className={styles.criteriaCard}>
            <div className={styles.criteriaHeader}>
              <h3 className={styles.criteriaTitle}>6. FINAL DECISION</h3>
              <span
                className={`${styles.decisionText} ${
                  data.decision === 'Accept'
                    ? styles.textAccept
                    : data.decision === 'Reject'
                      ? styles.textReject
                      : styles.textNeutral
                }`}
              >
                {(evaluation.finalDecision ?? '—').toString().toUpperCase()}
              </span>
            </div>
          </div>

          {evaluation.generalComments && evaluation.generalComments.trim() ? (
            <div className={styles.criteriaCard}>
              <div className={styles.criteriaHeader}>
                <h3 className={styles.criteriaTitle}>7. GENERAL COMMENTS</h3>
              </div>
              <p className={styles.commentText}>{evaluation.generalComments}</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.reviewerInfo}>
            ● Submitted {data.date || '—'}
          </span>
          <button className={styles.footerCloseBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ScorecardModal;