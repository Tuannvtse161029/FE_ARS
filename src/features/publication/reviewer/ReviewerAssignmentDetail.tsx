import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Download, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
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
import { StatusBadge } from '../../../components/lecturer/StatusBadge';
import { Button } from '../../../components/Button/Button';
import { useShortcuts } from '../../../hooks/useShortcuts';
import { storage } from '../../../utils/storage';
import {
  hasAcceptedPolicySession,
  ReviewerPolicyModal,
} from '../../../components/reviewer/ReviewerPolicyModal';

const REVIEWER_ACCENT = 'var(--ars-reviewer)';
const POLICY_VERSION = 'v1.0.0';

const formatDate = (iso: string | undefined): string => {
  if (!iso) return 'Not supplied';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? 'Not supplied' : parsed.toISOString().slice(0, 10);
};

const statusTone = (
  paper: PublicationPaper | undefined,
): 'submitted' | 'evaluated' | 'waiting' | 'unknown' => {
  if (!paper) return 'unknown';
  if (isReviewerSubmitted(paper.status)) return 'submitted';
  if (isReviewerActionable(paper.status)) return 'evaluated';
  if (isAwaitingReviewerResponse(paper.status)) return 'waiting';
  return 'unknown';
};

interface ResolvedAssignment {
  status: 'authorised' | 'unauthorised' | 'missing';
  paper?: PublicationPaper;
}

const DOCUMENT_ACCESS_MESSAGE =
  'The manuscript cannot be opened until you accept the reviewer responsibilities for this assignment.';

export const ReviewerAssignmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resolved, setResolved] = useState<ResolvedAssignment>({ status: 'missing' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewerEvaluationDraft>(buildEmptyEvaluationDraft);
  const [specializedCriteria, setSpecializedCriteria] = useState<SpecializedCriteriaBundle>({
    criteria1: '', expandedCriteria1: '', evaluationCriteria1: '',
    criteria2: '', expandedCriteria2: '', evaluationCriteria2: '',
    criteria3: '', expandedCriteria3: '', evaluationCriteria3: '',
  });
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResolved({ status: 'missing' });
    setError(null);
    publicationAdapter.getReviewerAssignments()
      .then((assignments) => {
        if (cancelled) return;
        const found = assignments.find((paper) => paper.id === id);
        setResolved(found ? { status: 'authorised', paper: found } : { status: 'unauthorised' });
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'The review assignment could not be loaded.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const paper = resolved.status === 'authorised' ? resolved.paper : undefined;
  const assignedPaperId = paper?.id ?? null;
  const reviewRequestId = paper?.reviewRequestId;
  const awaitingResponse = Boolean(paper && isAwaitingReviewerResponse(paper.status));
  const canReview = Boolean(paper && isReviewerActionable(paper.status));
  const submitted = Boolean(paper && isReviewerSubmitted(paper.status));
  const policyRequired = reviewRequestId != null;
  const hasPolicyAcceptance = !policyRequired || Boolean(
    policyAccepted || hasAcceptedPolicySession(reviewRequestId, POLICY_VERSION),
  );

  useEffect(() => {
    setDraft(buildEmptyEvaluationDraft());
    setError(null);
    setPolicyAccepted(false);
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
  }, [assignedPaperId]);

  useEffect(() => {
    if (canReview && reviewRequestId != null && !hasAcceptedPolicySession(reviewRequestId, POLICY_VERSION)) {
      setPolicyOpen(true);
    }
  }, [canReview, reviewRequestId]);

  const handleAssignmentResponse = async (accepted: boolean) => {
    if (!paper) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicationAdapter.respondToAssignment(paper.id, accepted);
      setResolved({ status: 'authorised', paper: updated });
      if (!accepted) navigate('/reviewer/assignments');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not respond to assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handlePolicyAccept = () => {
    setPolicyOpen(false);
    setPolicyAccepted(true);
    if (awaitingResponse) void handleAssignmentResponse(true);
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

  const submitEvaluation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paper) return;
    if (!draft.privateComments.trim()) {
      setError('Private review feedback for Admin is required before submitting a review.');
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
        specializedCriteria,
      );
      setResolved({ status: 'authorised', paper: updated });
      const user = storage.getUser();
      if (user?.roleName === 'Admin' || user?.roles?.includes('Admin')) navigate('/admin/reviewer-assignments');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit review.');
    } finally {
      setSaving(false);
    }
  };

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
      { label: 'Paper type', value: paperToRender.paperType || 'Not supplied' },
      { label: 'Version', value: paperToRender.version == null ? 'Not supplied' : `v${paperToRender.version}` },
      { label: 'Submitted', value: formatDate(paperToRender.submittedAt) },
      { label: 'Review deadline', value: formatDate(paperToRender.reviewDeadline) },
      { label: 'Research area', value: [paperToRender.domain, paperToRender.field, paperToRender.subfield].filter(Boolean).join(' / ') || 'Not supplied' },
      { label: 'DOI', value: paperToRender.doi ?? 'Not supplied' },
    ];
    return <dl className={reviewer.metadataGrid}>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
  };

  const renderPdf = () => {
    const fileUrl = paper?.fileUrl?.trim();
    if (!hasPolicyAcceptance) return <p className={reviewer.pdfUnavailable} role="status">{DOCUMENT_ACCESS_MESSAGE}</p>;
    if (!fileUrl) return <p className={reviewer.pdfUnavailable} role="status">No manuscript file is attached to this assignment. Contact the editorial Admin.</p>;
    return (
      <div className={reviewer.pdfFrame} data-testid="pdf-frame">
        <div className={reviewer.pdfActions}>
          <span><FileText size={17} aria-hidden="true" /> Protected manuscript</span>
          <div>
            <a href={fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" /> Open</a>
            <a href={fileUrl} download><Download size={15} aria-hidden="true" /> Download</a>
          </div>
        </div>
        <iframe src={fileUrl} title={`PDF preview: ${paper?.title ?? 'manuscript'}`} />
      </div>
    );
  };

  const renderEvaluationForm = () => {
    if (!canReview || !hasPolicyAcceptance) return null;
    return (
      <form onSubmit={submitEvaluation} className={reviewer.formCard} aria-label="Evaluate Paper" data-testid="evaluate-form">
        <header className={reviewer.formHeader}>
          <div><h2>Editorial evaluation</h2><p>Score each publication criterion and record concise evidence for the editorial decision.</p></div>
          <span className={reviewer.requiredLegend}>All criterion notes are visible only to Admin.</span>
        </header>
        <div className={reviewer.criteriaList}>
          {REVIEWER_CRITERIA.map((criterion) => {
            const values = Array.from({ length: criterion.max - criterion.min + 1 }, (_, index) => criterion.min + index);
            return (
              <fieldset key={criterion.key} className={reviewer.criterion}>
                <legend>{criterion.label}</legend>
                <p>{criterion.description}</p>
                <div className={reviewer.criterionInputs}>
                  <label htmlFor={`score-${criterion.key}`}>Score <select id={`score-${criterion.key}`} value={draft.scores[criterion.key]} onChange={(event) => handleScoreChange(criterion.key, Number(event.target.value))}>{values.map((value) => <option key={value} value={value}>{value} / 10</option>)}</select></label>
                  <label htmlFor={`note-${criterion.key}`}>Evidence and notes<textarea id={`note-${criterion.key}`} value={draft.perCriterionNotes[criterion.key]} onChange={(event) => handleNoteChange(criterion.key, event.target.value)} placeholder={`Explain the ${criterion.label.toLowerCase()} score.`} /></label>
                </div>
              </fieldset>
            );
          })}
        </div>
        <section className={reviewer.specializedSection} aria-labelledby="specialized-criteria-title">
          <div><h2 id="specialized-criteria-title">Discipline-specific review guide</h2><p>Use these standards to assess the manuscript in its research context. They are provided by the subject taxonomy and are not editable in a review.</p></div>
          <div className={reviewer.specializedList}>
            {[1, 2, 3].map((index) => {
              const item = specializedCriteria[`criteria${index}` as keyof SpecializedCriteriaBundle] as string;
              const guidance = specializedCriteria[`expandedCriteria${index}` as keyof SpecializedCriteriaBundle] as string;
              const standard = specializedCriteria[`evaluationCriteria${index}` as keyof SpecializedCriteriaBundle] as string;
              return <article key={index} className={reviewer.specializedCard}><h3>{item}</h3><p>{guidance}</p><small>{standard}</small></article>;
            })}
          </div>
        </section>
        <div className={reviewer.finalReviewGrid}>
          <label className={reviewer.reviewField} htmlFor="private-comments">Private review feedback for Admin<textarea id="private-comments" rows={7} value={draft.privateComments} onChange={(event) => setDraft((current) => ({ ...current, privateComments: event.target.value }))} placeholder="Summarize the manuscript's contribution, material concerns, required revisions, and evidence supporting your recommendation." required /></label>
          <label className={reviewer.reviewField} htmlFor="recommendation">Editorial recommendation<select id="recommendation" value={draft.recommendation} onChange={(event) => setDraft((current) => ({ ...current, recommendation: event.target.value as ReviewerRecommendationValue }))}>{REVIEWER_RECOMMENDATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span>Admin makes the final publication decision.</span></label>
        </div>
        {error && <ErrorBanner tone="error" title="Could not submit review" message={error} />}
        <footer className={reviewer.evaluationActions}><p>Your scores, notes, and recommendation remain private to the editorial team.</p><Button variant="primary" size="md" disabled={saving} type="submit">{saving ? 'Submitting review…' : 'Submit private review to Admin'}</Button></footer>
      </form>
    );
  };

  if (loading || resolved.status === 'missing') return <section className={reviewer.page}><PageHeader title="Review assignment" accent={REVIEWER_ACCENT} /><SkeletonRow count={6} withHeader /></section>;
  if (error && !paper) return <section className={reviewer.page}><PageHeader title="Review assignment" accent={REVIEWER_ACCENT} actions={<Button variant="outline" size="md" onClick={() => navigate('/reviewer/assignments')}>Back to assignments</Button>} /><ErrorBanner tone="error" title="Could not load assignment" message={error} /></section>;
  if (resolved.status === 'unauthorised') return <section className={reviewer.page}><PageHeader title="Review assignment" accent={REVIEWER_ACCENT} /><section className={reviewer.unauthorizedNotice} data-testid="unauthorized-notice"><h2>This assignment is not available to you</h2><p>The reviewer workspace only opens assignments made to your account. Contact the editorial Admin if this appears to be incorrect.</p><Button variant="outline" size="md" onClick={() => navigate('/reviewer/assignments')}>Back to my assignments</Button></section></section>;
  if (!paper) return <section className={reviewer.page}><EmptyState icon={<AlertTriangle size={20} aria-hidden />} title="Assignment could not be loaded" description="Return to your assignments and try again." /></section>;

  const tone = statusTone(paper);
  return (
    <section className={reviewer.page}>
      <PageHeader title={paper.title} description="Your assessment is private to the editorial team and does not publish this manuscript." accent={REVIEWER_ACCENT} actions={<><StatusBadge status={tone} label={statusLabel(paper.status)} size="sm" /><Button variant="outline" size="md" onClick={() => navigate('/reviewer/assignments')}>All assignments</Button></>} />
      {error && !canReview && <ErrorBanner tone="error" title="Assignment action failed" message={error} />}
      <section className={reviewer.reviewGate} aria-label="Reviewer responsibilities and manuscript access">
        <div className={reviewer.gateIcon}><ShieldCheck size={22} aria-hidden="true" /></div>
        <div><h2>{hasPolicyAcceptance ? 'Reviewer responsibilities accepted' : 'Read responsibilities before opening the manuscript'}</h2><p>{hasPolicyAcceptance ? 'You may review the protected manuscript and submit your private editorial assessment.' : 'Confidential handling, conflict disclosure, and evidence-based feedback are required for every assignment.'}</p></div>
        {!hasPolicyAcceptance && <Button variant="primary" size="md" disabled={saving} onClick={() => setPolicyOpen(true)}>{awaitingResponse ? 'Read and accept responsibilities' : 'Read responsibilities'}</Button>}
      </section>
      <div className={reviewer.detailLayout}>
        <div className={reviewer.detailSide}>
          <section className={reviewer.detailContext}><h2 className={reviewer.detailHeading}>Manuscript</h2>{renderPdf()}</section>
          <section className={reviewer.detailContext}><h2 className={reviewer.detailHeading}>Abstract</h2><p className={reviewer.contextParagraph}>{paper.abstract}</p></section>
          <section className={reviewer.detailContext}><h2 className={reviewer.detailHeading}>Authors and institutions</h2><p className={reviewer.contextParagraph}><strong>Authors</strong><br />{paper.authors.map((author) => author.name).join(', ') || 'Not supplied'}</p><p className={reviewer.contextParagraph}><strong>Institutions</strong><br />{paper.institutions.map((institution) => institution.name).join(', ') || 'Not supplied'}</p></section>
        </div>
        <aside className={reviewer.detailSide}>
          <section className={reviewer.detailContext}><h2 className={reviewer.detailHeading}>Assignment details</h2>{renderMetadata(paper)}</section>
          {awaitingResponse && <section className={reviewer.detailContext}><h2 className={reviewer.detailHeading}>Assignment response</h2><p className={reviewer.evaluationHint}>Read and accept reviewer responsibilities to begin. Declining returns this assignment to the editorial queue.</p><div className={reviewer.respondButtons}><Button variant="primary" size="md" disabled={saving} onClick={() => setPolicyOpen(true)}>Accept assignment</Button><Button variant="outline" size="md" disabled={saving} onClick={() => void handleAssignmentResponse(false)}>Decline assignment</Button></div></section>}
          {submitted && <section className={reviewer.submittedBanner} data-testid="submitted-banner"><h2>Review submitted</h2><p>Your private recommendation is awaiting an editorial decision. This assignment is now read-only.</p><Button variant="outline" size="sm" onClick={() => navigate('/reviewer/assignments')}>Back to assignments</Button></section>}
        </aside>
      </div>
      {renderEvaluationForm()}
      <ReviewerPolicyModal isOpen={policyOpen} reviewRequestId={reviewRequestId ?? 0} policyVersion={POLICY_VERSION} paperTitle={paper.title} onCancel={() => setPolicyOpen(false)} onAccept={handlePolicyAccept} />
    </section>
  );
};

export default ReviewerAssignmentDetail;
