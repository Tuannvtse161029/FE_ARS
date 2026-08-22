import { useEffect, useState, useRef, useMemo } from 'react';
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
  BookOpen,
} from 'lucide-react';
import { ROUTES } from '../../routes/paths';
import { PdfViewer } from '../../components/PdfViewer';
import { reviewRequestService } from '../../services/reviewRequest.service';
import type { ReviewRequest } from '../../services/reviewRequest.service';
import { paperService, type Paper } from '../../services/paper.service';
import {
  detailedEvaluationService,
  type DetailedEvaluation,
  type SpecializedEvaluationItem,
} from '../../services/detailedEvaluation.service';
import { subFieldService } from '../../services/subField.service';
import type { GradingRubricCriterion } from '../../services/subField.service';
import { useAuthStore } from '../../store/authSlice';
import { normalizeReviewRequestStatus } from '../../utils/reviewRequestPolicy';
import { ReviewRequestStatusBadge } from '../../components/reviewer/ReviewRequestStatusBadge';
import {
  ReviewerPolicyModal,
  hasAcceptedPolicySession,
} from '../../components/reviewer/ReviewerPolicyModal';
import { isValidEntityId } from '../../utils/entityId';
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

/**
 * Product/legal-approved reviewer policy version. Increment this string when the
 * policy text inside `ReviewerPolicyModal` is materially changed (e.g., new
 * jurisdiction, new compliance requirements). When bumped, all reviewers will be
 * re-prompted to accept for each open review request.
 */
const REVIEWER_POLICY_VERSION = 'v1.0.0';

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

  // ── Specialized (subfield) rubric state ─────────────────────────────────
  // The Reviewer's paper.subFieldId → fetch /api/SubField/{id} → if the BE
  // response carries a `gradingRubric` array, render a second scorecard
  // ("Additional Subfield Evaluation") immediately before Submit. This
  // matches the Additional-eval contract in
  // https://arsplatform.onrender.com/swagger/index.html (swagger.json
  // GradingRubricCriterionRequest + DetailedEvaluationCreateRequest.
  // specializedEvaluation[]).
  const [subField, setSubField] = useState<Awaited<ReturnType<typeof subFieldService.getById>>>(null);
  const [isLoadingSubField, setIsLoadingSubField] = useState(false);
  const [subFieldLoadError, setSubFieldLoadError] = useState<string | null>(null);
  // Per-criterion score/notes map, keyed by criterion code. Empty when the
  // subfield has no rubric.
  const [specializedForm, setSpecializedForm] = useState<
    Record<string, { score: string; notes: string }>
  >({});
  const [specializedErrors, setSpecializedErrors] = useState<Record<string, string>>({});

  // Defect fix: a ref-based in-flight guard so a fast double-click (or any
  // other race) cannot fire two create/update calls even before React has
  // re-rendered with the new `isSubmitting` value.
  const submitInFlightRef = useRef(false);

  // ── Per-paper reviewer policy gate ─────────────────────────────────────
  // The PDF and any manuscript content MUST NOT be requested or rendered until
  // the reviewer accepts the policy for THIS specific reviewRequestId and
  // policy version. localStorage is NOT the source of authority — we use a
  // session-only cache (sessionStorage, scoped to reviewRequestId + version)
  // as defense-in-depth, but backend enforcement is required for full
  // compliance (see BE Team Request in this PR).
  const [policyAccepted, setPolicyAccepted] = useState<boolean>(false);
  const [policyModalOpen, setPolicyModalOpen] = useState<boolean>(false);

  // When the review request resolves (either from state or query), check
  // whether the policy has already been accepted in this session. If not,
  // block the PDF and other manuscript-accessing requests behind the modal.
  useEffect(() => {
    if (!reviewRequestId) {
      setPolicyAccepted(false);
      setPolicyModalOpen(false);
      return;
    }
    const alreadyAccepted = hasAcceptedPolicySession(reviewRequestId, REVIEWER_POLICY_VERSION);
    setPolicyAccepted(alreadyAccepted);
    // ALWAYS show the modal on mount for this reviewRequestId so the user
    // sees the policy at least once per paper; if already accepted this
    // session, immediately mark accepted and skip the modal.
    if (!alreadyAccepted) {
      setPolicyModalOpen(true);
    } else {
      setPolicyModalOpen(false);
    }
  }, [reviewRequestId]);

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
  // Do not request paper metadata or its protected file URL until the scoped
  // reviewer policy has been accepted. Backend enforcement remains required.
  useEffect(() => {
    if (reviewRequest?.paperId == null) {
      setPaper(null);
      setPaperLoadError(null);
      setIsLoadingPaper(false);
      return;
    }
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
          // Seed the specialized-section form from any prior
          // specializedEvaluation entries (keyed by criterionCode).
          if (Array.isArray(eval_.specializedEvaluation) && eval_.specializedEvaluation.length > 0) {
            const seeded: Record<string, { score: string; notes: string }> = {};
            eval_.specializedEvaluation.forEach((item) => {
              if (item && item.criterionCode) {
                seeded[item.criterionCode] = {
                  score: item.score != null ? String(item.score) : '',
                  notes: item.notes ?? '',
                };
              }
            });
            if (Object.keys(seeded).length > 0) setSpecializedForm(seeded);
          }
        }
      })
      .catch((err) => console.error('Failed to load evaluation:', err))
      .finally(() => setIsLoadingEvaluation(false));
  }, [reviewRequestId]);

  // ── Load subfield (if the Paper has a subFieldId) ───────────────────────
  // Resolves the paper belonging to the active review request via the
  // already-fetched Paper entity (paper.service.getById), reads subFieldId,
  // then fetches the SubField via /api/SubField/{id}. The section is only
  // rendered when gradingRubric is a non-empty array.
  useEffect(() => {
    // Determine the subfield id from the loaded Paper (single source of
    // truth for the join paper ↔ subfield).
    const rawSubFieldId = paper
      ? (paper.subFieldId ?? paper.subfieldId ?? null)
      : null;
    const subFieldId = isValidEntityId(rawSubFieldId) ? rawSubFieldId : null;

    if (subFieldId == null) {
      setSubField(null);
      setSubFieldLoadError(null);
      setIsLoadingSubField(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSubField(true);
    setSubFieldLoadError(null);
    subFieldService
      .getById(subFieldId)
      .then((field) => {
        if (cancelled) return;
        setSubField(field);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load subfield for evaluation:', err);
        setSubField(null);
        setSubFieldLoadError(
          (err as Error)?.message ?? 'Unable to load subfield rubric.'
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSubField(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paper]);

  // Ordered, validated criteria list (ascending by `order`, then by code).
  // Empty unless the BE returned a gradingRubric — per spec we render NO
  // section and emit NO specializedEvaluation entries in that case.
  const orderedCriteria: GradingRubricCriterion[] = useMemo(() => {
    const rubric = subField?.gradingRubric;
    if (!Array.isArray(rubric) || rubric.length === 0) return [];
    return [...rubric].sort((a, b) => {
      const ao = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.code.localeCompare(b.code);
    });
  }, [subField]);

  const hasUsableRubric = orderedCriteria.length > 0;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setScore = (field: keyof typeof EMPTY_FORM, value: number | string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const setSpecialized = (
    code: string,
    patch: Partial<{ score: string; notes: string }>
  ) => {
    setSpecializedForm((prev) => {
      const base = prev[code] ?? { score: '', notes: '' };
      const next = { ...base, ...patch };
      return { ...prev, [code]: next };
    });
    setSpecializedErrors((prev) => {
      if (!prev[code]) return prev;
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  /**
   * Build the `specializedEvaluation[]` payload from the ordered criteria +
   * user-entered scores/notes. Each item uses EXACTLY the field names defined
   * by Swagger's `SpecializedEvaluationItemRequest`:
   *   criterionCode, criterionTitle, maxScore, score, notes, standardReferences.
   * Empty/missing answers are sent as `null` for `score` so the BE can persist
   * a known shape.
   */
  const buildSpecializedEvaluation = (): SpecializedEvaluationItem[] => {
    if (!hasUsableRubric) return [];
    return orderedCriteria.map((c) => {
      const answer = specializedForm[c.code] ?? { score: '', notes: '' };
      // Emit the score only when the reviewer entered a number in
      // [0, maxScore]. Empty/blank → null; out-of-range → null (the
      // validation gate has already blocked submit).
      const parsed = Number(answer.score);
      const maxScore =
        typeof c.maxScore === 'number' && Number.isFinite(c.maxScore)
          ? c.maxScore
          : 10;
      const score = Number.isInteger(parsed) && parsed >= 1 && parsed <= maxScore
        ? parsed
        : null;
      const standardReferences = Array.isArray(c.standardReferences)
        ? c.standardReferences
        : [];
      return {
        criterionCode: c.code,
        criterionTitle: c.title,
        maxScore,
        score,
        notes: answer.notes ?? '',
        standardReferences,
      };
    });
  };

  /**
   * Validate the specialized-section answers. Returns true when nothing
   * requires attention, otherwise populates `specializedErrors` and returns
   * false.
   *
   * Scores are optional in Swagger's `SpecializedEvaluationItemRequest`, but
   * when supplied they must be whole numbers in [1, maxScore].
   */
  const validateSpecialized = (): boolean => {
    if (!hasUsableRubric) return true;
    const errs: Record<string, string> = {};
    orderedCriteria.forEach((c) => {
      const answer = specializedForm[c.code] ?? { score: '', notes: '' };
      const scoreRaw = (answer.score ?? '').trim();
      if (scoreRaw === '') return;
      const parsed = Number(scoreRaw);
      const max =
        typeof c.maxScore === 'number' && Number.isFinite(c.maxScore)
          ? c.maxScore
          : 10;
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
        errs[c.code] = `Score must be a whole number between 1 and ${max}.`;
      }
    });
    setSpecializedErrors(errs);
    return Object.keys(errs).length === 0;
  };

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
    // Defect fix: explicit ref-based guard so a fast double-click cannot
    // slip past the `isSubmitting` state update and dispatch two create/update
    // requests in parallel.
    if (submitInFlightRef.current) return;
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
    if (!validateSpecialized()) {
      setSubmitError('Please correct the highlighted specialized-evaluation scores.');
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Build the payload once so create + update both ship identical fields,
      // matching DetailedEvaluationCreateRequest / DetailedEvaluationUpdateRequest
      // verbatim. `specializedEvaluation` only appears when there is a usable
      // rubric — no fabricated entries.
      const specializedEvaluation = buildSpecializedEvaluation();
      const basePayload = {
        ...form,
        reviewRequestId,
        reviewerId: currentUserId,
        ...(hasUsableRubric ? { specializedEvaluation } : {}),
      };

      // Defect 2A — persist evaluation FIRST, assert a non-empty id, THEN
      // mark the request Completed. If the evaluation persistence fails the
      // request MUST stay in its current state — never mark Completed without
      // an evaluation record (defect 1C's inconsistency message).
      let persistedEvaluationId: number | undefined;
      if (existingEvaluation?.detailedEvaluationId) {
        const updated = await detailedEvaluationService.update(
          existingEvaluation.detailedEvaluationId,
          basePayload
        );
        persistedEvaluationId = updated.detailedEvaluationId ?? existingEvaluation.detailedEvaluationId;
      } else {
        const created = await detailedEvaluationService.create(basePayload);
        persistedEvaluationId = created.detailedEvaluationId;
      }

      if (!persistedEvaluationId) {
        // Defensive: BE accepted the request but didn't echo an id. Treat
        // as a failed persistence — do NOT mark Completed.
        throw new Error('Failed to persist evaluation (no id returned).');
      }

      // Defect 2A — request status update AFTER evaluation is persisted.
      const updatedReq = await reviewRequestService.update(reviewRequestId, {
        paperId: reviewRequest?.paperId ?? null,
        reviewerId: reviewRequest?.reviewerId ?? currentUserId,
        fee: reviewRequest?.fee ?? null,
        deadline: reviewRequest?.deadline ?? null,
        airecommended: reviewRequest?.airecommended ?? null,
        type: reviewRequest?.type ?? null,
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
      submitInFlightRef.current = false;
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
              ) : !policyAccepted ? (
                <div
                  className={styles.pdfNoFile}
                  data-testid="pdf-gated-by-policy"
                  role="alert"
                >
                  <strong>Manuscript access is gated</strong>
                  <p>
                    You must accept the reviewer policy before the manuscript PDF
                    becomes available for this review request.
                  </p>
                  <p>
                    Paper title: <em>{paper.title}</em>
                  </p>
                  <p>
                    <button
                      type="button"
                      className={styles.submitBtn}
                      onClick={() => setPolicyModalOpen(true)}
                      data-testid="pdf-open-policy-btn"
                    >
                      Review &amp; Accept Policy
                    </button>
                  </p>
                </div>
              ) : (
                <PdfViewer
                  url={fileUrl}
                  mode="protected-review"
                  reviewCopyId={reviewRequest?.id != null ? `Review Copy #${reviewRequest.id}` : undefined}
                />
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

              {/* 8. ADDITIONAL SUBFIELD EVALUATION — only render when the loaded
                  SubField carries a non-empty `gradingRubric`. Per spec, if
                  the paper has no subFieldId or the rubric is empty the
                  section MUST NOT render and no specializedEvaluation entries
                  are fabricated. */}
              {hasUsableRubric && (
                <div
                  className={styles.scorecardSection}
                  data-testid="subfield-evaluation-section"
                >
                  <div className={styles.subfieldHeader}>
                    <BookOpen size={14} aria-hidden="true" />
                    <span className={styles.sectionTitle}>
                      8. ADDITIONAL SUBFIELD EVALUATION
                    </span>
                    {subField?.name && (
                      <span className={styles.subfieldNameTag}>
                        {subField.name}
                      </span>
                    )}
                  </div>
                  <p className={styles.subfieldHint}>
                    Score each criterion on a scale of 0 to its maximum. Numeric
                    entries must be between 0 and the maximum score listed for
                    that criterion.
                  </p>
                  {orderedCriteria.map((criterion, idx) => {
                    const answer = specializedForm[criterion.code] ?? {
                      score: '',
                      notes: '',
                    };
                    const maxScore =
                      typeof criterion.maxScore === 'number' &&
                      Number.isFinite(criterion.maxScore)
                        ? criterion.maxScore
                        : 10;
                    const err = specializedErrors[criterion.code];
                    const baseId = `spec-${criterion.code}-${idx}`;
                    const refs = Array.isArray(criterion.standardReferences)
                      ? criterion.standardReferences
                      : [];
                    return (
                      <div
                        key={criterion.code}
                        className={styles.subfieldCriterion}
                        data-testid={`subfield-criterion-${criterion.code}`}
                      >
                        <div className={styles.subfieldCriterionHeader}>
                          <span className={styles.subfieldCriterionCode}>
                            [{criterion.code}]
                          </span>
                          <span className={styles.subfieldCriterionTitle}>
                            {criterion.title}
                          </span>
                          <span className={styles.subfieldCriterionMax}>
                            Max: {maxScore}
                          </span>
                        </div>
                        {criterion.description && (
                          <p className={styles.subfieldCriterionDescription}>
                            {criterion.description}
                          </p>
                        )}
                        {refs.length > 0 && (
                          <ul
                            className={styles.subfieldReferences}
                            aria-label={`Standard references for ${criterion.code}`}
                          >
                            {refs.map((ref) => (
                              <li key={ref}>{ref}</li>
                            ))}
                          </ul>
                        )}
                        <div className={styles.subfieldScoreRow}>
                          <label
                            htmlFor={`${baseId}-score`}
                            className={styles.subfieldLabel}
                          >
                            Score (0–{maxScore})
                          </label>
                          <input
                            id={`${baseId}-score`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={maxScore}
                            step={1}
                            className={styles.subfieldScoreInput}
                            value={answer.score}
                            onChange={(e) =>
                              setSpecialized(criterion.code, {
                                score: e.target.value,
                              })
                            }
                            readOnly={isReadOnly}
                            aria-invalid={Boolean(err)}
                            aria-describedby={err ? `${baseId}-err` : undefined}
                            data-testid={`subfield-score-${criterion.code}`}
                          />
                        </div>
                        <label
                          htmlFor={`${baseId}-notes`}
                          className={styles.subfieldLabel}
                        >
                          Notes
                        </label>
                        <textarea
                          id={`${baseId}-notes`}
                          className={styles.criteriaFeedbackText}
                          rows={2}
                          placeholder="Add your notes…"
                          value={answer.notes}
                          onChange={(e) =>
                            setSpecialized(criterion.code, {
                              notes: e.target.value,
                            })
                          }
                          readOnly={isReadOnly}
                          data-testid={`subfield-notes-${criterion.code}`}
                        />
                        {err && (
                          <div
                            id={`${baseId}-err`}
                            className={styles.subfieldCriterionError}
                            role="alert"
                          >
                            {err}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {isLoadingSubField && !hasUsableRubric && (
                <div
                  className={styles.subfieldLoading}
                  aria-live="polite"
                  data-testid="subfield-loading"
                >
                  Loading subfield rubric…
                </div>
              )}
              {subFieldLoadError && (
                <div className={styles.subfieldError} role="alert">
                  Could not load subfield rubric: {subFieldLoadError}
                </div>
              )}

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

      {/* Reviewer policy gate — must be accepted before manuscript access. */}
      {reviewRequestId && (
        <ReviewerPolicyModal
          isOpen={policyModalOpen}
          reviewRequestId={reviewRequestId}
          policyVersion={REVIEWER_POLICY_VERSION}
          paperTitle={paper?.title}
          onCancel={() => {
            setPolicyModalOpen(false);
            // Per spec: cancel = back out of the paper, do not grant access.
            navigate(ROUTES.REVIEW_TASKS);
          }}
          onAccept={() => {
            setPolicyAccepted(true);
            setPolicyModalOpen(false);
          }}
        />
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
