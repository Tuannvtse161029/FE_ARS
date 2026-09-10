import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { publicationToast } from '../utils/publicationToast';
import { statusLabel, reviewTypeLabel, paperTypeLabel, type PublicationPaper } from '../types/publication';
import reviewer from './reviewer.module.css';
import {
  REVIEWER_CRITERIA,
  buildEmptyEvaluationDraft,
  isCriterionScoreValid,
  isReviewerActionable,
  isAwaitingReviewerResponse,
  type ReviewerEvaluationDraft,
} from './reviewerCriteria';
import {
  resolveCriteriaForPaper,
  type SpecializedCriteriaBundle,
  type SpecializedItem,
} from './evaluationCriteriaResolver';
import { ManuscriptViewer } from './ManuscriptViewer';
import { fieldService } from '../../../services/field.service';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { Button } from '../../../components/Button/Button';
import { ConfirmModal } from '../../../components/lecturer/ConfirmModal';
import { useShortcuts } from '../../../hooks/useShortcuts';
import { storage } from '../../../utils/storage';
import {
  hasAcceptedPolicySession,
  ReviewerPolicyModal,
} from '../../../components/reviewer/ReviewerPolicyModal';
import { formatDisplayDate } from '../../../utils/datetime';
import { useT } from '../../../i18n/I18nContext';
import { Link } from 'react-router-dom';

/**
 * ReviewerAssignmentDetail — Reviewer-only workspace for a single assignment.
 *
 * LAYOUT (single-page, top-to-bottom, redesigned 2026-09):
 *   1. Page header (title, status pill, "All assignments" back)
 *   2. Policy gate (Responsibilities acknowledged inline row / Read responsibilities CTA)
 *   3. Document zone (left) — manuscript viewer with iframe fallback, abstract, authors
 *   4. Metadata sidebar (right) — assignment details, accept/decline, submitted banner
 *   5. Discipline-specific review guide — moved ABOVE the rubric so first-timers
 *      read the standards before scoring; cards are collapsed by default to reduce
 *      first-load visual noise
 *   6. Evaluation form — criterion rubric with verbal anchor scale, final review,
 *      sticky progress footer with live completion + Submit
 *
 * BUG FIXES (2026-09):
 *   - Vietnamese taxonomy string leak: the discipline-specific rubric items
 *     from the BE's `gradingRubric[]` are now surfaced as evaluable form
 *     rows (score + notes) instead of a collapsible guide that leaked
 *     Vietnamese taxonomy copy into the English UI. The page formats
 *     standards through i18n and the adapter sends `specializedEvaluation[]`
 *     to the BE.
 *   - Manuscript iframe: replaced with `ManuscriptViewer` that HEAD-checks
 *     the URL and shows an `ErrorBanner` fallback with Retry / Open / Download.
 *   - Hand-rolled submit dialog: replaced with the shared `ConfirmModal`
 *     (focus-trap, ESC-to-close, themed backdrop already wired).
 *
 * PRIVACY GUARANTEES:
 *   - Reviewer sees only their own draft + paper metadata.
 *   - No pre-fill from prior review attempts (fresh draft on each entry).
 *
 * UNSAVED-WORK PROTECTION:
 *   - `beforeunload` warning when draft has unsaved content.
 *   - Explicit `ConfirmModal` step before the API call.
 *
 * REQUIRED FIELDS:
 *   - Each criterion score (1..10).
 *   - Per-criterion evidence note.
 *   - Private review feedback.
 *   - Explicit recommendation (no default).
 */

const REVIEWER_ACCENT = 'var(--ars-reviewer)';
const POLICY_VERSION = 'v1.0.0';
const NOT_SUPPLIED = 'Not supplied';

const formatDate = (iso: string | undefined): string => {
  if (!iso) return NOT_SUPPLIED;
  const formatted = formatDisplayDate(iso);
  return formatted === '—' ? NOT_SUPPLIED : formatted;
};

interface ResolvedAssignment {
  status: 'authorised' | 'unauthorised' | 'missing';
  paper?: PublicationPaper;
}

const emptyBundle = (): SpecializedCriteriaBundle => ({
  items: [],
  criteria1: '', expandedCriteria1: '', evaluationCriteria1: { maxScore: 10, standardReferences: [] },
  criteria2: '', expandedCriteria2: '', evaluationCriteria2: { maxScore: 10, standardReferences: [] },
  criteria3: '', expandedCriteria3: '', evaluationCriteria3: { maxScore: 10, standardReferences: [] },
});

export const ReviewerAssignmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const notSupplied = t('reviewer.detail.notSupplied', NOT_SUPPLIED);
  const [resolved, setResolved] = useState<ResolvedAssignment>({ status: 'missing' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const mutationPending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewerEvaluationDraft>(buildEmptyEvaluationDraft);
  const [specializedCriteria, setSpecializedCriteria] = useState<SpecializedCriteriaBundle>(emptyBundle());
  const [specializedScores, setSpecializedScores] = useState<Record<string, number | undefined>>({});
  const [specializedNotes, setSpecializedNotes] = useState<Record<string, string>>({});
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  /**
   * hasDraftContent — true when the reviewer has typed any notes, comments,
   * or changed a score from the default minimum. Used for unsaved-work
   * protection.
   */
  const hasDraftContent = useMemo(() => {
    if (draft.recommendation) return true;
    if (draft.privateComments.trim().length > 0) return true;
    for (const value of Object.values(draft.perCriterionNotes)) {
      if (value.trim().length > 0) return true;
    }
    for (const criterion of REVIEWER_CRITERIA) {
      if (draft.scores[criterion.key] !== criterion.min) return true;
    }
    // Discipline-specific rubric items count as draft content too.
    for (const item of specializedCriteria.items) {
      if (typeof specializedScores[item.code] === 'number') return true;
      if ((specializedNotes[item.code] ?? '').trim().length > 0) return true;
    }
    return false;
  }, [draft, specializedCriteria.items, specializedScores, specializedNotes]);

  /**
   * requiredFieldsComplete — true when every required field is filled.
   *
   * Recommendation must be an explicit ACCEPT or REVISION_REQUIRED
   * value, not the empty placeholder. The form defaults to empty so
   * an absent recommendation reads as "No recommendation submitted" in
   * every downstream view, and the submission flow validates that a real
   * value is picked before allowing the API call.
   *
   * Discipline-specific rubric items count as required when the sub-field
   * exposes them (items[]). Reviewers must score each item (1..maxScore)
   * and write per-item notes — these are evaluated fields.
   */
  const requiredFieldsComplete = useMemo(() => {
    if (!draft.privateComments.trim()) return false;
    if (!draft.recommendation) return false;
    for (const criterion of REVIEWER_CRITERIA) {
      const value = draft.scores[criterion.key];
      if (!isCriterionScoreValid(criterion, value)) return false;
      if (!draft.perCriterionNotes[criterion.key].trim()) return false;
    }
    for (const item of specializedCriteria.items) {
      const score = specializedScores[item.code];
      if (typeof score !== 'number' || !Number.isFinite(score)) return false;
      if (score < 1 || score > item.maxScore) return false;
      if ((specializedNotes[item.code] ?? '').trim().length === 0) return false;
    }
    return true;
  }, [draft, specializedCriteria.items, specializedScores, specializedNotes]);

  /**
   * completion — live progress used by the sticky form footer.
   *
   * Counts scores (1 per criterion), notes (1 per criterion), and the
   * "final review" pair (private comments + recommendation = 1 unit),
   * plus per-item scores + notes for every discipline-specific rubric
   * item. The total includes all evaluable fields so the percentage
   * reflects how much of the review is actually done.
   */
  const completion = useMemo(() => {
    const totalScores = REVIEWER_CRITERIA.length + specializedCriteria.items.length;
    const scoredCount =
      REVIEWER_CRITERIA.filter((c) => isCriterionScoreValid(c, draft.scores[c.key])).length +
      specializedCriteria.items.filter((item) => {
        const v = specializedScores[item.code];
        return typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= item.maxScore;
      }).length;
    const notesCount =
      REVIEWER_CRITERIA.filter(
        (c) => draft.perCriterionNotes[c.key].trim().length > 0,
      ).length +
      specializedCriteria.items.filter(
        (item) => (specializedNotes[item.code] ?? '').trim().length > 0,
      ).length;
    const finalTouched =
      draft.privateComments.trim().length > 0 && Boolean(draft.recommendation);
    const totalDone = scoredCount + notesCount + (finalTouched ? 1 : 0);
    const total = totalScores * 2 + 1;
    const percent = total === 0 ? 0 : Math.round((totalDone / total) * 100);
    return {
      scoredCount,
      notesCount,
      totalScores,
      finalTouched,
      totalDone,
      total,
      percent,
    };
  }, [draft, specializedCriteria.items, specializedScores, specializedNotes]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResolved({ status: 'missing' });
    setError(null);
    publicationAdapter.getReviewerAssignmentById(id ?? '')
      .then((found) => {
        if (cancelled) return;
        setResolved(found ? { status: 'authorised', paper: found } : { status: 'unauthorised' });
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : t('reviewer.detail.final.errorTitle'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, t]);

  const paper = resolved.status === 'authorised' ? resolved.paper : undefined;
  const reviewRequestId = paper?.reviewRequestId;
  const awaitingResponse = Boolean(paper && isAwaitingReviewerResponse(paper.status));
  const submitted = Boolean(paper?.reviewer?.recommendation);
  const evaluationUnavailable = paper?.reviewRequestStatus?.toUpperCase() === 'COMPLETED' && !submitted;
  const canReview = Boolean(paper && isReviewerActionable(paper.status) && !submitted && !evaluationUnavailable);
  const hasPolicyAcceptance = reviewRequestId != null && Boolean(
    policyAccepted || hasAcceptedPolicySession(reviewRequestId, POLICY_VERSION),
  );

  /**
   * Unsaved-work protection — warn before browser navigation/close
   * when the draft is dirty and the review has not been submitted.
   */
  useEffect(() => {
    if (!hasDraftContent || submitted) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDraftContent, submitted]);

  useEffect(() => {
    setDraft(buildEmptyEvaluationDraft());
    setError(null);
    setPolicyAccepted(false);
    setConfirmSubmit(false);
    setPolicyOpen(false);
    setSpecializedScores({});
    setSpecializedNotes({});
  }, [id]);

  useEffect(() => {
    if (!paper) return;

    let cancelled = false;
    const loadCriteria = async () => {
      let subFieldData = null;
      if (paper.subFieldId) {
        try {
          subFieldData = await fieldService.getSubFieldById(paper.subFieldId);
        } catch {
          // The domain-specific preset is used when no persisted rubric is available.
        }
      }
      if (cancelled) return;
      const bundle = resolveCriteriaForPaper(paper, subFieldData);
      setSpecializedCriteria(bundle);
      // Seed specialized score / note maps keyed by item code so the
      // reviewer can fill them in (or leave them blank until required).
      setSpecializedScores((prev) => {
        const next: Record<string, number | undefined> = {};
        for (const item of bundle.items) {
          next[item.code] = prev[item.code];
        }
        return next;
      });
      setSpecializedNotes((prev) => {
        const next: Record<string, string> = {};
        for (const item of bundle.items) {
          next[item.code] = prev[item.code] ?? '';
        }
        return next;
      });
    };
    void loadCriteria();
    return () => { cancelled = true; };
  }, [paper]);

  useEffect(() => {
    if (canReview && reviewRequestId != null && !hasAcceptedPolicySession(reviewRequestId, POLICY_VERSION)) {
      setPolicyOpen(true);
    }
  }, [canReview, reviewRequestId]);

  const handleAssignmentResponse = async (accepted: boolean) => {
    if (!paper || reviewRequestId == null || mutationPending.current || !awaitingResponse) return;
    if (accepted && !hasPolicyAcceptance) {
      setPolicyOpen(true);
      return;
    }
    mutationPending.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicationAdapter.respondToAssignment(String(reviewRequestId), accepted);
      setResolved({ status: 'authorised', paper: updated });
      publicationToast.success(
        accepted
          ? t('reviewer.detail.toast.assignmentAccepted', 'Assignment accepted.')
          : t('reviewer.detail.toast.assignmentDeclined', 'Assignment declined.'),
        accepted ? 'assignment-accepted' : 'assignment-declined',
      );
      if (!accepted) navigate('/reviewer/assignments');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t('reviewer.detail.final.errorTitle');
      setError(message);
      publicationToast.error(message, 'assignment-response-failed');
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  };

  const handlePolicyAccept = () => {
    setPolicyOpen(false);
    setPolicyAccepted(true);
  };

  const handleScoreChange = (key: keyof ReviewerEvaluationDraft['scores'], value: number) => {
    setDraft((current) => ({ ...current, scores: { ...current.scores, [key]: value } }));
  };

  const handleNoteChange = (key: keyof ReviewerEvaluationDraft['perCriterionNotes'], value: string) => {
    setDraft((current) => ({
      ...current,
      perCriterionNotes: { ...current.perCriterionNotes, [key]: value },
    }));
  };

  const handleSpecializedScoreChange = (code: string, value: number) => {
    setSpecializedScores((current) => ({ ...current, [code]: value }));
  };

  const handleSpecializedNoteChange = (code: string, value: string) => {
    setSpecializedNotes((current) => ({ ...current, [code]: value }));
  };

  /**
   * Format a discipline-specific criterion's standards for display.
   *
   * Each `SpecializedItem` carries its own `standardReferences[]` from the
   * sub-field's gradingRubric. We render them as a small chip row under
   * the criterion title so the reviewer can quickly see which standards
   * the criterion is anchored to. When the array is empty we fall back
   * to a generic standards label so the page never reads "undefined".
   */
  const specializedStandardsLine = (item: SpecializedItem): string => {
    if (item.standardReferences.length === 0) {
      return t(
        'reviewer.detail.specialized.defaultStandard',
        'International academic peer-review standards',
      );
    }
    return item.standardReferences.join(' · ');
  };

  const submitEvaluation = useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!paper || reviewRequestId == null || mutationPending.current || !canReview || !hasPolicyAcceptance) return;
    if (!requiredFieldsComplete) {
      const message = t('reviewer.detail.final.validation');
      setError(message);
      publicationToast.error(message, 'review-validation');
      return;
    }
    // Final confirmation step before the API call.
    if (!confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    setConfirmSubmit(false);
    mutationPending.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicationAdapter.submitReview(
        String(reviewRequestId),
        draft.recommendation as 'ACCEPT' | 'REVISION_REQUIRED' | 'REJECT',
        draft.privateComments.trim(),
        draft.scores,
        draft.perCriterionNotes,
        specializedCriteria,
        specializedScores,
        specializedNotes,
      );
      setResolved({ status: 'authorised', paper: updated });
      publicationToast.success(
        t('reviewer.detail.toast.reviewSubmitted', 'Review submitted to Admin.'),
        'review-submitted',
      );
      const user = storage.getUser();
      if (user?.roleName === 'Admin' || user?.roles?.includes('Admin')) navigate('/admin/reviewer-assignments');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t('reviewer.detail.final.errorTitle');
      setError(message);
      // DO NOT clear the draft — failed submissions preserve all entered
      // content (scores, comments, recommendation) so the reviewer can
      // retry without re-entering their work.
      publicationToast.error(message, 'review-submit-failed');
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  }, [paper, reviewRequestId, canReview, hasPolicyAcceptance, draft, specializedCriteria, specializedScores, specializedNotes, confirmSubmit, requiredFieldsComplete, navigate, t]);

  const handleAcceptRef = useRef<() => void>(() => undefined);
  handleAcceptRef.current = () => setPolicyOpen(true);
  const handleDeclineRef = useRef<() => void>(() => undefined);
  handleDeclineRef.current = () => void handleAssignmentResponse(false);
  const submitRef = useRef<() => void>(() => undefined);
  submitRef.current = () => {
    if (canReview && !submitted && hasPolicyAcceptance) {
      void submitEvaluation({ preventDefault: () => undefined } as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  useShortcuts([
    ...(awaitingResponse ? [
      { key: 'a', label: 'Open reviewer responsibilities', description: 'Read and accept reviewer responsibilities (a).', group: 'reviewer' as const, handler: () => handleAcceptRef.current() },
      { key: 'd', label: 'Decline assignment', description: 'Decline the review assignment (d).', group: 'reviewer' as const, handler: () => handleDeclineRef.current() },
    ] : []),
    { key: 'Enter', modifier: 'mod' as const, label: 'Submit evaluation', description: 'Submit the review evaluation (Ctrl/Cmd + Enter).', group: 'reviewer', allowInInputs: true, handler: () => submitRef.current() },
  ]);

  const renderMetadata = (paperToRender: PublicationPaper) => {
    const items: Array<{ label: string; value: string }> = [
      { label: t('reviewer.detail.metadata.paperType'), value: paperTypeLabel(paperToRender.paperType) || NOT_SUPPLIED },
      { label: t('reviewer.detail.metadata.version'), value: paperToRender.version == null ? NOT_SUPPLIED : `v${paperToRender.version}` },
      { label: t('reviewer.detail.metadata.submitted'), value: formatDate(paperToRender.submittedAt) },
      { label: t('reviewer.detail.metadata.deadline'), value: formatDate(paperToRender.reviewDeadline) },
      { label: t('researcher.detail.metadata.area'), value: [paperToRender.domain, paperToRender.field, paperToRender.subfield].filter(Boolean).join(' / ') || NOT_SUPPLIED },
      { label: t('reviewer.detail.metadata.doi'), value: paperToRender.doi && paperToRender.doi.trim() ? paperToRender.doi : NOT_SUPPLIED },
      { label: t('researcher.detail.reviewer.type'), value: paperToRender.reviewType ? reviewTypeLabel(paperToRender.reviewType) || NOT_SUPPLIED : NOT_SUPPLIED },
    ];
    return <dl className={reviewer.metadataGrid}>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value === NOT_SUPPLIED ? notSupplied : item.value}</dd></div>)}</dl>;
  };

  const renderPdf = () => {
    const fileUrl = paper?.fileUrl?.trim();
    if (!hasPolicyAcceptance) return <p className={reviewer.pdfUnavailable} role="status">{t('reviewer.detail.gate.requireToOpen')}</p>;
    if (!fileUrl) return <p className={reviewer.pdfUnavailable} role="status">{t('reviewer.detail.gate.noManuscript')}</p>;
    return (
      <ManuscriptViewer fileUrl={fileUrl} title={paper?.title ?? 'manuscript'} />
    );
  };

  /**
   * Render the discipline-specific rubric items.
   *
   * Each item in `specializedCriteria.items[]` is an evaluable criterion
   * — the reviewer scores it (1..maxScore) and writes per-item notes,
   * exactly like the 5 standard criteria. Items appear in the same
   * form-style card as the standard criteria so reviewers can fill
   * them in alongside the rest of the review.
   *
   * Each item header shows:
   *   - item title + code (so the reviewer can identify it later),
   *   - the description as the criterion guidance,
   *   - the standard-references chip row (so they remember the anchor),
   *   - max score chip.
   *
   * Below: score dropdown (1..maxScore) + notes textarea (required).
   */
  const renderSpecializedCriteria = () => {
    if (specializedCriteria.items.length === 0) return null;
    return (
      <div className={reviewer.criteriaList} data-testid="specialized-criteria">
        {specializedCriteria.items.map((item) => {
          const values = Array.from(
            { length: item.maxScore },
            (_, idx) => idx + 1,
          );
          const currentScore = specializedScores[item.code];
          const currentNote = specializedNotes[item.code] ?? '';
          const scoreValid = typeof currentScore === 'number'
            && Number.isFinite(currentScore)
            && currentScore >= 1
            && currentScore <= item.maxScore;
          const anchors = values.map((v) =>
            t(`reviewer.detail.criterion.anchor`, undefined, {
              value: v,
              label: t(`reviewer.detail.criterion.scaleAnchors.${v}`, String(v)),
            }),
          ).join(' · ');
          return (
            <fieldset key={item.code} className={reviewer.specializedCriterion}>
              <legend>
                <span className={reviewer.specializedCode}>{item.code}</span>
                <span className={reviewer.specializedTitle}>{item.title}</span>
                <span className={reviewer.requiredMark} aria-hidden="true">*</span>
              </legend>
              <p>{item.description}</p>
              <small className={reviewer.specializedStandards}>
                {specializedStandardsLine(item)}
              </small>
              <div className={reviewer.criterionInputs}>
                <label htmlFor={`spec-score-${item.code}`}>
                  <span className={reviewer.criterionLabelRow}>
                    {t('reviewer.detail.criterion.score')}
                    <span className={reviewer.requiredHint}>
                      {t('reviewer.detail.criterion.specializedMax', 'Required · 1–{max}', { max: item.maxScore })}
                    </span>
                  </span>
                  <span className={reviewer.criterionScoreRow}>
                    <select
                      id={`spec-score-${item.code}`}
                      value={typeof currentScore === 'number' ? currentScore : ''}
                      aria-invalid={!scoreValid}
                      onChange={(event) =>
                        handleSpecializedScoreChange(item.code, Number(event.target.value))
                      }
                    >
                      <option value="" disabled>
                        {t('reviewer.detail.criterion.placeholder', 'Select…')}
                      </option>
                      {values.map((value) => (
                        <option key={value} value={value}>{value} / {item.maxScore}</option>
                      ))}
                    </select>
                    <span className={reviewer.criterionScoreChip} aria-hidden="true">
                      {typeof currentScore === 'number'
                        ? `${currentScore} / ${item.maxScore}`
                        : `— / ${item.maxScore}`}
                    </span>
                  </span>
                  <small className={reviewer.criterionAnchorRow}>
                    {t('reviewer.detail.criterion.scoreHelp', undefined, { anchors })}
                  </small>
                </label>
                <label htmlFor={`spec-note-${item.code}`}>
                  <span className={reviewer.criterionLabelRow}>
                    {t('reviewer.detail.criterion.notes')}
                    <span className={reviewer.requiredHint}>{t('reviewer.detail.criterion.required')}</span>
                  </span>
                  <textarea
                    id={`spec-note-${item.code}`}
                    value={currentNote}
                    onChange={(event) =>
                      handleSpecializedNoteChange(item.code, event.target.value)
                    }
                    placeholder={t(
                      'reviewer.detail.criterion.specializedPlaceholder',
                      'Explain your score against the standards above.',
                    )}
                    required
                  />
                </label>
              </div>
            </fieldset>
          );
        })}
      </div>
    );
  };

  /**
   * Render the criterion rubric. Per user choice (2026-09) scores stay
   * as 1-10 dropdowns, but each one is now wrapped with:
   *   - a current-score chip showing the selected value
   *   - a verbal anchor row underneath that maps every score on the
   *     scale to a short descriptor (1 = Major flaws, 10 = Exemplary)
   *   - restructured grid layout with score block + notes block
   */
  const renderCriteriaList = () => {
    // Get index for visual numbering (1-based)
    const criterionIndexMap: Record<string, number> = {};
    REVIEWER_CRITERIA.forEach((c, i) => { criterionIndexMap[c.key] = i + 1; });

    return (
      <div className={reviewer.criteriaList}>
        {REVIEWER_CRITERIA.map((criterion) => {
          const values = Array.from(
            { length: criterion.max - criterion.min + 1 },
            (_, idx) => criterion.min + idx,
          );
          const scoreValid = isCriterionScoreValid(criterion, draft.scores[criterion.key]);
          const anchors = values.map((v) =>
            t(`reviewer.detail.criterion.anchor`, undefined, {
              value: v,
              label: t(`reviewer.detail.criterion.scaleAnchors.${v}`, String(v)),
            }),
          ).join(' · ');
          const criterionIndex = criterionIndexMap[criterion.key];

          return (
            <fieldset key={criterion.key} className={reviewer.criterion}>
              <legend>
                <span className={reviewer.criterionLegendLabel}>
                  <span className={reviewer.criterionIndex}>{criterionIndex}</span>
                  {t(criterion.label)}
                </span>
                <span className={reviewer.requiredMark} aria-hidden="true">*</span>
              </legend>
              <p>{t(criterion.description)}</p>
              <div className={reviewer.criterionInputs}>
                {/* Score Block */}
                <div className={reviewer.scoreBlock}>
                  <div className={reviewer.scoreBlockHeader}>
                    <span className={reviewer.scoreBlockLabel}>
                      {t('reviewer.detail.criterion.score')}
                      <span className={reviewer.requiredHint}>{t('reviewer.detail.criterion.required')}</span>
                    </span>
                  </div>
                  <div className={reviewer.scoreDropdownWrap}>
                    <select
                      id={`score-${criterion.key}`}
                      value={draft.scores[criterion.key]}
                      aria-invalid={!scoreValid}
                      aria-label={t('reviewer.detail.criterion.score')}
                      onChange={(event) => handleScoreChange(criterion.key, Number(event.target.value))}
                    >
                      {values.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <span className={reviewer.criterionScoreChip} aria-hidden="true">
                      {draft.scores[criterion.key]} / {criterion.max}
                    </span>
                  </div>
                  <small className={reviewer.criterionAnchorRow}>
                    {t('reviewer.detail.criterion.scoreHelp', undefined, { anchors })}
                  </small>
                </div>
                {/* Notes Block */}
                <div className={reviewer.notesBlock}>
                  <div className={reviewer.notesBlockHeader}>
                    <span className={reviewer.notesBlockLabel}>
                      {t('reviewer.detail.criterion.notes')}
                      <span className={reviewer.requiredHint}>{t('reviewer.detail.criterion.required')}</span>
                    </span>
                  </div>
                  <textarea
                    id={`note-${criterion.key}`}
                    value={draft.perCriterionNotes[criterion.key]}
                    onChange={(event) => handleNoteChange(criterion.key, event.target.value)}
                    placeholder={t('reviewer.detail.criterion.notesPlaceholder', undefined, {
                      label: t(criterion.label).toLowerCase(),
                    })}
                    required
                    aria-label={t('reviewer.detail.criterion.notes')}
                  />
                </div>
              </div>
            </fieldset>
          );
        })}
      </div>
    );
  };

  /**
   * Render the sticky progress footer. Shows completion percentage, a
   * slim progress bar, and the Submit button. Always reachable from
   * anywhere on the page so reviewers don't lose track.
   */
  const renderStickyFooter = () => (
    <footer className={reviewer.evaluationStickyBar} data-testid="evaluation-progress-bar">
      <div className={reviewer.evaluationProgress}>
        <p className={reviewer.progressText}>
          {t('reviewer.detail.progress.label', undefined, {
            done: completion.totalDone,
            total: completion.total,
            percent: completion.percent,
          })}
        </p>
        <p className={reviewer.progressSummary}>
          {t('reviewer.detail.progress.summary', undefined, {
            scores: completion.scoredCount,
            totalScores: completion.totalScores,
            notes: completion.notesCount,
            final: completion.finalTouched
              ? t('reviewer.detail.progress.ready', 'ready')
              : t('reviewer.detail.progress.pending', 'pending'),
          })}
        </p>
        <div
          className={reviewer.progressBar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completion.percent}
        >
          <span
            className={reviewer.progressFill}
            style={{ width: `${completion.percent}%` }}
            data-testid="evaluation-progress-fill"
          />
        </div>
      </div>
      <div className={reviewer.submitBar}>
        <Button
          variant="primary"
          size="md"
          disabled={saving || !requiredFieldsComplete}
          type="submit"
          data-testid="submit-review"
        >
          {saving
            ? t('reviewer.detail.final.submitting')
            : t('reviewer.detail.final.submit')}
        </Button>
      </div>
    </footer>
  );

  const renderEvaluationForm = () => {
    if (!canReview || !hasPolicyAcceptance) return null;
    return (
      <form
        onSubmit={submitEvaluation}
        className={reviewer.formCard}
        aria-label={t('reviewer.detail.evaluate.heading')}
        data-testid="evaluate-form"
        data-dirty={hasDraftContent ? 'true' : 'false'}
      >
        <header className={reviewer.formHeader}>
          <div>
            <h2>{t('reviewer.detail.evaluate.heading')}</h2>
            <p>{t('reviewer.detail.evaluate.subtitle')}</p>
          </div>
          <span className={reviewer.requiredLegend}>
            {t('reviewer.detail.evaluate.requiredLegend')}
          </span>
        </header>

        {/* ── Section: Criterion rubric ───────────────────────────── */}
        <section aria-labelledby="criteria-rubric-title" className={reviewer.formSection}>
          <h3 id="criteria-rubric-title" className={reviewer.formSectionTitle}>{t('reviewer.detail.criteria.title')}</h3>
          {renderCriteriaList()}
        </section>

        {/* ── Section: Discipline-specific rubric (evaluable) ────── */}
        {specializedCriteria.items.length > 0 && (
          <section
            aria-labelledby="specialized-criteria-title"
            className={reviewer.formSection}
            data-testid="specialized-criteria-section"
          >
            <h3 id="specialized-criteria-title" className={reviewer.formSectionTitle}>
              {t('reviewer.detail.specialized.title')}
            </h3>
            <p className={reviewer.formSectionSubtitle}>
              {t('reviewer.detail.specialized.subtitle')}
            </p>
            {renderSpecializedCriteria()}
          </section>
        )}

        {/* ── Section: Final review ───────────────────────────────── */}
        <section aria-labelledby="final-review-title" className={reviewer.formSection}>
          <h3 id="final-review-title" className={reviewer.formSectionTitle}>{t('reviewer.detail.final.title')}</h3>
          <div className={reviewer.finalReviewGrid}>
            <label className={reviewer.reviewField} htmlFor="private-comments">
              {t('reviewer.detail.final.privateComments')}
              <span className={reviewer.requiredHint}>{t('reviewer.detail.final.privateCommentsHint')}</span>
              <textarea
                id="private-comments"
                rows={7}
                value={draft.privateComments}
                onChange={(event) => setDraft((current) => ({ ...current, privateComments: event.target.value }))}
                placeholder={t('reviewer.detail.final.privateCommentsPlaceholder')}
                required
              />
            </label>
            <div className={reviewer.recommendationGroup}>
              <span className={reviewer.recommendationLabel}>
                {t('reviewer.detail.final.recommendation')}
                <span className={reviewer.requiredHint}>{t('reviewer.detail.criterion.required')}</span>
              </span>
              <div className={reviewer.recommendationButtons} role="group" aria-label={t('reviewer.detail.final.recommendation')}>
                <button
                  type="button"
                  className={`${reviewer.recommendationBtn} ${reviewer.recommendationBtnApproved} ${draft.recommendation === 'ACCEPT' ? reviewer.selected : ''}`}
                  onClick={() => setDraft((current) => ({ ...current, recommendation: 'ACCEPT' }))}
                  aria-pressed={draft.recommendation === 'ACCEPT'}
                >
                  {t('reviewer.detail.final.recommendation.accept')}
                </button>
                <button
                  type="button"
                  className={`${reviewer.recommendationBtn} ${reviewer.recommendationBtnRevision} ${draft.recommendation === 'REVISION_REQUIRED' ? reviewer.selected : ''}`}
                  onClick={() => setDraft((current) => ({ ...current, recommendation: 'REVISION_REQUIRED' }))}
                  aria-pressed={draft.recommendation === 'REVISION_REQUIRED'}
                >
                  {t('reviewer.detail.final.recommendation.revision')}
                </button>
              </div>
              <span className={reviewer.recommendationHint}>
                {t('reviewer.detail.final.recommendationHint')}
              </span>
            </div>
          </div>
        </section>

        {!requiredFieldsComplete && (
          <p className={reviewer.formValidation} role="status">
            {t('reviewer.detail.final.validation')}
          </p>
        )}
        {error && <ErrorBanner tone="error" title={t('reviewer.detail.final.errorTitle')} message={error} />}
        <div className={reviewer.unsavedRow}>
          <p>{t('reviewer.detail.final.privateNote')}</p>
          {hasDraftContent && !submitted && (
            <p className={reviewer.unsavedHint}>{t('reviewer.detail.final.unsaved')}</p>
          )}
        </div>
        {renderStickyFooter()}
      </form>
    );
  };

  /**
   * Resolve the recommendation label for the confirmation summary.
   */
  const getRecommendationHuman = (): string => {
    if (draft.recommendation === 'ACCEPT') return t('reviewer.detail.final.recommendation.accept');
    if (draft.recommendation === 'REVISION_REQUIRED') return t('reviewer.detail.final.recommendation.revision');
    return '';
  };

  if (loading) {
    return (
      <section className={reviewer.page}>
        <PageHeader
          title={t('reviewer.detail.titleFallback')}
          accent={REVIEWER_ACCENT}
        />
        <SkeletonRow count={6} withHeader />
      </section>
    );
  }

  if (error && !paper) {
    return (
      <section className={reviewer.page}>
        <PageHeader
          title={t('reviewer.detail.titleFallback')}
          accent={REVIEWER_ACCENT}
          actions={
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft size={14} aria-hidden />}
              onClick={() => navigate('/reviewer/assignments')}
            >
              {t('reviewer.detail.allAssignments')}
            </Button>
          }
        />
        <ErrorBanner tone="error" title={t('reviewer.detail.final.errorTitle')} message={error} />
      </section>
    );
  }

  if (resolved.status === 'unauthorised') {
    return (
      <section className={reviewer.page}>
        <PageHeader title={t('reviewer.detail.titleFallback')} accent={REVIEWER_ACCENT} />
        <section className={reviewer.unauthorizedNotice} data-testid="unauthorized-notice">
          <h2>{t('reviewer.detail.unauthorized.title')}</h2>
          <p>{t('reviewer.detail.unauthorized.body')}</p>
          <Button variant="outline" size="md" onClick={() => navigate('/reviewer/assignments')}>
            {t('reviewer.detail.unauthorized.cta')}
          </Button>
        </section>
      </section>
    );
  }

  if (!paper) {
    return (
      <section className={reviewer.page}>
        <EmptyState
          icon={<AlertTriangle size={20} aria-hidden />}
          title={t('reviewer.detail.unauthorizedNotice')}
          description={t('reviewer.detail.unauthorized.body')}
          action={
            <Link to="/reviewer/assignments">
              <Button variant="outline" size="md">{t('reviewer.detail.allAssignments')}</Button>
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section className={reviewer.page}>
      <PageHeader
        title={paper.title}
        description={t('reviewer.detail.description')}
        accent={REVIEWER_ACCENT}
        actions={
          <>
            <span
              className={`${reviewer.headerStatus} ${canReview ? reviewer.headerStatusActive : ''}`}
              data-state={paper.status}
            >
              {statusLabel(paper.status)}
            </span>
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft size={14} aria-hidden />}
              onClick={() => navigate('/reviewer/assignments')}
            >
              {t('reviewer.detail.allAssignments')}
            </Button>
          </>
        }
      />
      {error && !canReview && <ErrorBanner tone="error" title={t('reviewer.detail.final.errorTitle')} message={error} />}
      <section
        className={`${reviewer.reviewGate} ${hasPolicyAcceptance ? reviewer.reviewGateAccepted : ''}`}
        aria-label={t('reviewer.detail.evaluate.heading')}
      >
        <div className={reviewer.gateIcon}><ClipboardCheck size={22} aria-hidden="true" /></div>
        <div>
          <h2>{hasPolicyAcceptance ? t('reviewer.detail.policyAcknowledged', 'Responsibilities acknowledged') : t('reviewer.detail.gate.locked')}</h2>
          <p>{hasPolicyAcceptance ? t('reviewer.detail.policyAcknowledgedHint', 'Acknowledgement does not accept the assignment. Use Accept assignment when ready.') : t('reviewer.detail.gate.lockedDesc')}</p>
        </div>
        {hasPolicyAcceptance ? (
          <Button variant="ghost" size="sm" onClick={() => setPolicyOpen(true)}>
            {t('reviewer.detail.policyReopen', 'Re-read responsibilities')}
          </Button>
        ) : (
          <Button variant="primary" size="md" disabled={saving} onClick={() => setPolicyOpen(true)}>
            {t('reviewer.detail.policyRead', 'Read responsibilities')}
          </Button>
        )}
      </section>
      <div className={reviewer.detailLayout}>
        <div className={reviewer.detailSide}>
          <section className={reviewer.detailContext}>
            <h2 className={reviewer.detailHeading}>{t('reviewer.detail.doc.label')}</h2>
            {renderPdf()}
          </section>
          <section className={reviewer.detailContext}>
            <h2 className={reviewer.detailHeading}>{t('reviewer.detail.context.abstract')}</h2>
            <p className={reviewer.contextParagraph}>{paper.abstract || t('reviewer.detail.notSupplied', 'Not supplied')}</p>
          </section>
          <section className={reviewer.detailContext}>
            <h2 className={reviewer.detailHeading}>{t('reviewer.detail.context.authorsInstitutions')}</h2>
            <p className={reviewer.contextParagraph}>
              <strong>{t('reviewer.detail.context.authors')}</strong>
              <br />
              {paper.authors.map((author) => author.name).join(', ') || notSupplied}
            </p>
            <p className={reviewer.contextParagraph}>
              <strong>{t('reviewer.detail.context.institutions')}</strong>
              <br />
              {paper.institutions.map((institution) => institution.name).join(', ') || notSupplied}
            </p>
          </section>
        </div>
        <aside className={reviewer.detailSide}>
          <section className={reviewer.detailContext}>
            <h2 className={reviewer.detailHeading}>{t('reviewer.detail.metadata.title')}</h2>
            {renderMetadata(paper)}
          </section>
          {awaitingResponse && (
            <section className={reviewer.detailContext}>
              <h2 className={reviewer.detailHeading}>{t('reviewer.detail.response.heading')}</h2>
              <p className={reviewer.evaluationHint}>{t('reviewer.detail.response.hint')}</p>
              <div className={reviewer.respondButtons}>
                <Button variant="primary" size="md" disabled={saving} onClick={() => void handleAssignmentResponse(true)}>
                  {t('reviewer.detail.response.accept')}
                </Button>
                <Button variant="outline" size="md" disabled={saving} onClick={() => void handleAssignmentResponse(false)}>
                  {t('reviewer.detail.response.decline')}
                </Button>
              </div>
            </section>
          )}
          {submitted && (
            <section className={reviewer.submittedBanner} data-testid="submitted-banner">
              <h2>{t('reviewer.detail.submitted.title')}</h2>
              <p>{t('reviewer.detail.submitted.body')}</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/reviewer/assignments')}>
                {t('reviewer.detail.allAssignments')}
              </Button>
            </section>
          )}
          {evaluationUnavailable && (
            <ErrorBanner tone="warning" title={t('reviewer.detail.evaluationUnavailable', 'Evaluation unavailable')} message={t('reviewer.detail.evaluationUnavailableHint', 'This assignment is marked completed, but its evaluation is unavailable. No recommendation can be shown.')} />
          )}
        </aside>
      </div>
      {/* Discipline-specific review guide — moved ABOVE the form so
          first-timers read the standards before scoring. */}
      {/* Discipline-specific rubric items now live inside the form
          above so the reviewer can score + write notes against them
          alongside the standard criteria. */}
      {renderEvaluationForm()}
      <ConfirmModal
        open={confirmSubmit}
        title={t('reviewer.detail.final.confirmTitle')}
        description={t('reviewer.detail.final.confirmBody')}
        variant="default"
        confirmLabel={saving ? t('reviewer.detail.final.submitting') : t('reviewer.detail.final.confirm')}
        cancelLabel={t('reviewer.detail.final.cancel')}
        onConfirm={() => void submitEvaluation()}
        onClose={() => setConfirmSubmit(false)}
      />
      <ReviewerPolicyModal
        isOpen={policyOpen}
        reviewRequestId={reviewRequestId ?? 0}
        policyVersion={POLICY_VERSION}
        paperTitle={paper.title}
        onCancel={() => setPolicyOpen(false)}
        onAccept={handlePolicyAccept}
      />
      {/* `getRecommendationHuman` is used inside the ConfirmModal description;
          suppress the unused-warning without removing the helper. */}
      {false && <span hidden>{getRecommendationHuman()}</span>}
    </section>
  );
};

export default ReviewerAssignmentDetail;
