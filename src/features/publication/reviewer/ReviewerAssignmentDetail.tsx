import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, FileText, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { publicationToast } from '../utils/publicationToast';
import { statusLabel, reviewTypeLabel, paperTypeLabel, type PublicationPaper } from '../types/publication';
import reviewer from './reviewer.module.css';
import {
  REVIEWER_CRITERIA,
  REVIEWER_RECOMMENDATIONS,
  buildEmptyEvaluationDraft,
  isReviewerActionable,
  isAwaitingReviewerResponse,
  type ReviewerEvaluationDraft,
  type ReviewerRecommendationValue,
} from './reviewerCriteria';
import {
  resolveCriteriaForPaper,
  type SpecializedCriteriaBundle,
} from './evaluationCriteriaResolver';
import { fieldService } from '../../../services/field.service';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { Button } from '../../../components/Button/Button';
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
 * LAYOUT (two stacked zones, both responsive):
 *   1. Document zone — manuscript metadata + protected PDF iframe.
 *   2. Rubric zone — read-only context (abstract, authors) on the side,
 *      then the evaluation rubric below.
 *
 * PRIVACY GUARANTEES:
 *   - The reviewer can only see THEIR OWN scores, notes, comments, and
 *     recommendation (privateScores, privateComments, etc.). Other
 *     reviewers' bodies are never loaded.
 *   - Reviewer identity is not exposed in the UI; Admin identity is not
 *     exposed either. The author of the manuscript is shown when present.
 *   - The submission form does not pre-populate from a previous review
 *     attempt on the same paper (it is a fresh draft on each entry).
 *
 * UNSAVED-WORK PROTECTION:
 *   - beforeunload warns the reviewer if the draft has unsaved content.
 *   - A confirmation modal asks for explicit "Submit private review"
 *     confirmation before the API call.
 *
 * REQUIRED FIELDS:
 *   - Each criterion score is required (defaulted to min).
 *   - Private review feedback for Admin is required (no empty submission).
 *   - Editorial recommendation is required (no default — the reviewer
 *     must explicitly choose Accept / Revision / Reject before submitting;
 *     an absent recommendation is rendered as "No recommendation submitted"
 *     in every downstream view, never as Accept).
 *
 * I18N: All user-facing copy routes through `useT()` so the Reviewer
 * workspace reads correctly in en + vi.
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
  const [specializedCriteria, setSpecializedCriteria] = useState<SpecializedCriteriaBundle>({
    criteria1: '', expandedCriteria1: '', evaluationCriteria1: '',
    criteria2: '', expandedCriteria2: '', evaluationCriteria2: '',
    criteria3: '', expandedCriteria3: '', evaluationCriteria3: '',
  });
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
    return false;
  }, [draft]);

  /**
   * requiredFieldsComplete — true when every required field is filled.
   *
   * Recommendation must be an explicit ACCEPT / REVISION_REQUIRED / REJECT
   * value, not the empty placeholder — pre-2026-09 the form defaulted to
   * ACCEPT, which caused every Admin editorial record to display
   * "Recommendation: ACCEPT" before the reviewer had actually chosen
   * anything. We now block submission until the reviewer picks a real
   * value.
   */
  const requiredFieldsComplete = useMemo(() => {
    if (!draft.privateComments.trim()) return false;
    if (!draft.recommendation) return false;
    for (const criterion of REVIEWER_CRITERIA) {
      const value = draft.scores[criterion.key];
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      if (value < criterion.min || value > criterion.max) return false;
      if (!draft.perCriterionNotes[criterion.key].trim()) return false;
    }
    return true;
  }, [draft]);

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
      if (!cancelled) setSpecializedCriteria(resolveCriteriaForPaper(paper, subFieldData));
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
  }, [paper, reviewRequestId, canReview, hasPolicyAcceptance, draft, specializedCriteria, confirmSubmit, requiredFieldsComplete, navigate, t]);

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
      <div className={reviewer.pdfFrame} data-testid="pdf-frame">
        <div className={reviewer.pdfActions}>
          <span><FileText size={17} aria-hidden="true" /> {t('reviewer.detail.doc.protected')}</span>
          <div>
            <a href={fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" /> {t('reviewer.detail.doc.openLink')}</a>
            <a href={fileUrl} download><Download size={15} aria-hidden="true" /> {t('reviewer.detail.doc.download')}</a>
          </div>
        </div>
        <iframe src={fileUrl} title={t('reviewer.detail.doc.frameTitle', undefined, { title: paper?.title ?? 'manuscript' })} />
      </div>
    );
  };

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
          <div className={reviewer.criteriaList}>
            {REVIEWER_CRITERIA.map((criterion) => {
              const values = Array.from(
                { length: criterion.max - criterion.min + 1 },
                (_, index) => criterion.min + index,
              );
              const scoreValid = (() => {
                const value = draft.scores[criterion.key];
                return typeof value === 'number' && value >= criterion.min && value <= criterion.max;
              })();
              return (
                <fieldset key={criterion.key} className={reviewer.criterion}>
                  <legend>
                    {t(criterion.label)}
                    <span className={reviewer.requiredMark} aria-hidden="true">*</span>
                  </legend>
                  <p>{t(criterion.description)}</p>
                  <div className={reviewer.criterionInputs}>
                    <label htmlFor={`score-${criterion.key}`}>
                      {t('reviewer.detail.criterion.score')}
                      <span className={reviewer.requiredHint}>{t('reviewer.detail.criterion.required')}</span>
                      <select
                        id={`score-${criterion.key}`}
                        value={draft.scores[criterion.key]}
                        aria-invalid={!scoreValid}
                        onChange={(event) => handleScoreChange(criterion.key, Number(event.target.value))}
                      >
                        {values.map((value) => (
                          <option key={value} value={value}>{value} / {criterion.max}</option>
                        ))}
                      </select>
                    </label>
                    <label htmlFor={`note-${criterion.key}`}>
                      {t('reviewer.detail.criterion.notes')}
                      <span className={reviewer.requiredHint}>{t('reviewer.detail.criterion.required')}</span>
                      <textarea
                        id={`note-${criterion.key}`}
                        value={draft.perCriterionNotes[criterion.key]}
                        onChange={(event) => handleNoteChange(criterion.key, event.target.value)}
                        placeholder={t('reviewer.detail.criterion.notesPlaceholder', undefined, {
                          label: t(criterion.label).toLowerCase(),
                        })}
                        required
                      />
                    </label>
                  </div>
                </fieldset>
              );
            })}
          </div>
        </section>

        {/* ── Section: Discipline-specific guidance ──────────────── */}
        <section className={reviewer.specializedSection} aria-labelledby="specialized-criteria-title">
          <div>
            <h2 id="specialized-criteria-title">{t('reviewer.detail.specialized.title')}</h2>
            <p>{t('reviewer.detail.specialized.subtitle')}</p>
          </div>
          <div className={reviewer.specializedList}>
            {[1, 2, 3].map((index) => {
              const item = specializedCriteria[`criteria${index}` as keyof SpecializedCriteriaBundle] as string;
              const guidance = specializedCriteria[`expandedCriteria${index}` as keyof SpecializedCriteriaBundle] as string;
              const standard = specializedCriteria[`evaluationCriteria${index}` as keyof SpecializedCriteriaBundle] as string;
              return <article key={index} className={reviewer.specializedCard}><h3>{item}</h3><p>{guidance}</p><small>{standard}</small></article>;
            })}
          </div>
        </section>

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
            <label className={reviewer.reviewField} htmlFor="recommendation">
              {t('reviewer.detail.final.recommendation')}
              <span className={reviewer.requiredHint}>{t('reviewer.detail.criterion.required')}</span>
              <select
                id="recommendation"
                value={draft.recommendation}
                aria-invalid={!draft.recommendation}
                onChange={(event) => setDraft((current) => ({ ...current, recommendation: event.target.value as ReviewerRecommendationValue }))}
              >
                {REVIEWER_RECOMMENDATIONS.map((option) => {
                  if (!option.value) {
                    return (
                      <option key="placeholder" value="" disabled>
                        {t('reviewer.detail.final.recommendation.placeholder', 'Select recommendation')}
                      </option>
                    );
                  }
                  const label = option.value === 'ACCEPT'
                    ? t('reviewer.detail.final.recommendation.accept')
                    : option.value === 'REVISION_REQUIRED'
                      ? t('reviewer.detail.final.recommendation.revision')
                      : t('reviewer.detail.final.recommendation.reject');
                  return (
                    <option key={option.value} value={option.value}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <span>{t('reviewer.detail.final.recommendationHint')}</span>
            </label>
          </div>
        </section>

        {!requiredFieldsComplete && (
          <p className={reviewer.formValidation} role="status">
            {t('reviewer.detail.final.validation')}
          </p>
        )}
        {error && <ErrorBanner tone="error" title={t('reviewer.detail.final.errorTitle')} message={error} />}
        <footer className={reviewer.evaluationActions}>
          <div>
            <p>{t('reviewer.detail.final.privateNote')}</p>
            {hasDraftContent && !submitted && (
              <p className={reviewer.unsavedHint}>{t('reviewer.detail.final.unsaved')}</p>
            )}
          </div>
          <Button
            variant="primary"
            size="md"
            disabled={saving || !requiredFieldsComplete}
            type="submit"
          >
            {saving ? t('reviewer.detail.final.submitting') : t('reviewer.detail.final.submit')}
          </Button>
        </footer>
      </form>
    );
  };

  // Confirmation modal — shown after the user clicks Submit, before the
  // API call. This makes the final action intentional and recoverable.
  const renderSubmitConfirmation = () => {
    if (!confirmSubmit) return null;
    const recommendationLabel = REVIEWER_RECOMMENDATIONS.find((option) => option.value === draft.recommendation)?.value;
    const recommendationHuman = recommendationLabel
      ? recommendationLabel === 'ACCEPT'
        ? t('reviewer.detail.final.recommendation.accept')
        : recommendationLabel === 'REVISION_REQUIRED'
          ? t('reviewer.detail.final.recommendation.revision')
          : t('reviewer.detail.final.recommendation.reject')
      : '';
    // Render through createPortal so the dialog centres in the visible
    // viewport regardless of how far the page is scrolled, what
    // transforms/overflows are on the ancestor chain, or which
    // stacking context wins. The host element is <body>; if SSR /
    // test environments omit `document` we fall back to inline rendering.
    if (typeof document === 'undefined') {
      return (
        <div className={reviewer.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="confirm-submit-title">
          <div className={reviewer.confirmCard} data-testid="confirm-submit-dialog">
            <h2 id="confirm-submit-title">{t('reviewer.detail.final.confirmTitle')}</h2>
            <p>{t('reviewer.detail.final.confirmBody')}</p>
            <p className={reviewer.confirmSummary}>
              {t('reviewer.detail.final.confirmSummary', undefined, {
                recommendation: recommendationHuman,
              })}
            </p>
            <div className={reviewer.confirmActions}>
              <Button variant="outline" size="md" onClick={() => setConfirmSubmit(false)} disabled={saving}>
                {t('reviewer.detail.final.cancel')}
              </Button>
              <Button variant="primary" size="md" onClick={() => void submitEvaluation()} disabled={saving}>
                {saving ? t('reviewer.detail.final.submitting') : t('reviewer.detail.final.confirm')}
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return createPortal(
      <div className={reviewer.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="confirm-submit-title">
        <div className={reviewer.confirmCard} data-testid="confirm-submit-dialog">
          <h2 id="confirm-submit-title">{t('reviewer.detail.final.confirmTitle')}</h2>
          <p>{t('reviewer.detail.final.confirmBody')}</p>
          <p className={reviewer.confirmSummary}>
            {t('reviewer.detail.final.confirmSummary', undefined, {
              recommendation: recommendationHuman,
            })}
          </p>
          <div className={reviewer.confirmActions}>
            <Button variant="outline" size="md" onClick={() => setConfirmSubmit(false)} disabled={saving}>
              {t('reviewer.detail.final.cancel')}
            </Button>
            <Button variant="primary" size="md" onClick={() => void submitEvaluation()} disabled={saving}>
              {saving ? t('reviewer.detail.final.submitting') : t('reviewer.detail.final.confirm')}
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    );
  };

  // The shared modal overlay sits inside the section that may be scrolled
  // into view; render it through a portal so viewport centering is
  // independent of ancestor transforms, scroll position, or stacking
  // contexts. We mount it once via a stable container; React re-uses the
  // same DOM node across renders.

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
            <span className={reviewer.headerStatus}>
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
      <section className={reviewer.reviewGate} aria-label={t('reviewer.detail.evaluate.heading')}>
        <div className={reviewer.gateIcon}><ClipboardCheck size={22} aria-hidden="true" /></div>
        <div>
          <h2>{hasPolicyAcceptance ? t('reviewer.detail.policyAcknowledged', 'Responsibilities acknowledged') : t('reviewer.detail.gate.locked')}</h2>
          <p>{hasPolicyAcceptance ? t('reviewer.detail.policyAcknowledgedHint', 'Acknowledgement does not accept the assignment. Use Accept assignment when ready.') : t('reviewer.detail.gate.lockedDesc')}</p>
        </div>
        {!hasPolicyAcceptance && (
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
      {renderEvaluationForm()}
      {renderSubmitConfirmation()}
      <ReviewerPolicyModal
        isOpen={policyOpen}
        reviewRequestId={reviewRequestId ?? 0}
        policyVersion={POLICY_VERSION}
        paperTitle={paper.title}
        onCancel={() => setPolicyOpen(false)}
        onAccept={handlePolicyAccept}
      />
    </section>
  );
};

export default ReviewerAssignmentDetail;
