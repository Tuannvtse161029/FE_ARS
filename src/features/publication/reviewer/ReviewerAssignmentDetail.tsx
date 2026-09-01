import { useEffect, useRef, useState } from 'react';
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

const DOCUMENT_ACCESS_MESSAGE =
  'Manuscript access is unavailable until the editorial service confirms this assignment\'s policy acceptance and returns a protected document link.';

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
  const [specializedCriteria, setSpecializedCriteria] = useState<SpecializedCriteriaBundle>({
    criteria1: '',
    expandedCriteria1: '',
    evaluationCriteria1: '',
    criteria2: '',
    expandedCriteria2: '',
    evaluationCriteria2: '',
    criteria3: '',
    expandedCriteria3: '',
    evaluationCriteria3: '',
  });

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
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'The review assignment could not be loaded.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Reset the form draft and load specialized criteria whenever we transition to a different paper
  const assignedPaperId =
    resolved.status === 'authorised' ? resolved.paper?.id : null;
  useEffect(() => {
    setDraft(buildEmptyEvaluationDraft());
    setError(null);
    if (!resolved.paper) return;
    const currentPaper = resolved.paper;
    (async () => {
      let subFieldData = null;
      if (currentPaper.subFieldId) {
        try {
          subFieldData = await fieldService.getSubFieldById(currentPaper.subFieldId);
        } catch {
          // ignore, preset will be used
        }
      }
      const bundle = resolveCriteriaForPaper(currentPaper, subFieldData);
      setSpecializedCriteria(bundle);
    })();
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
        specializedCriteria,
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

  // Part 5 — keyboard shortcuts for the reviewer detail page.
  // `a` accepts the focused assignment, `d` declines it, Ctrl/Cmd+Enter
  // submits the evaluation form. Shortcuts are only registered when the
  // paper is in the appropriate status (REVIEWER_ASSIGNED for a/d,
  // UNDER_REVIEW for submit).
  const handleAcceptRef = useRef<() => void>(() => undefined);
  handleAcceptRef.current = () => void handleAccept(true);
  const handleDeclineRef = useRef<() => void>(() => undefined);
  handleDeclineRef.current = () => void handleAccept(false);
  const submitRef = useRef<() => void>(() => undefined);
  submitRef.current = () => {
    if (!canReview || submitted) return;
    void submitEvaluation({
      preventDefault: () => undefined,
    } as unknown as React.FormEvent<HTMLFormElement>);
  };
  useShortcuts([
    ...(awaitingResponse
      ? [
          {
            key: 'a',
            label: 'Accept assignment',
            description: 'Accept the review assignment (a).',
            group: 'reviewer' as const,
            handler: () => handleAcceptRef.current(),
          },
          {
            key: 'd',
            label: 'Decline assignment',
            description: 'Decline the review assignment (d).',
            group: 'reviewer' as const,
            handler: () => handleDeclineRef.current(),
          },
        ]
      : []),
    {
      key: 'Enter',
      modifier: 'mod' as const,
      label: 'Submit evaluation',
      description: 'Submit the review evaluation (Ctrl/Cmd + Enter).',
      group: 'reviewer',
      allowInInputs: true,
      handler: () => submitRef.current(),
    },
  ]);

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

  const renderPdf = () => (
    <p className={reviewer.pdfUnavailable} role="status">
      {DOCUMENT_ACCESS_MESSAGE}
    </p>
  );

  const renderEvaluationForm = () => {
    if (!canReview) return null;
    return (
      <form
        onSubmit={submitEvaluation}
        className={reviewer.formCard}
        aria-label="Evaluate Paper"
        data-testid="evaluate-form"
      >
        <div className={`${shared.field} ${shared.full}`}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            1. Bảng chấm điểm 5 tiêu chí cốt lõi (Core Rubric Evaluation)
          </h3>
          <p style={{ margin: '0 0 10px', color: '#4a5568', fontSize: 13 }}>
            Đánh giá điểm số (1 đến 10) và cung cấp nhận xét/chứng minh tương ứng cho từng tiêu chí chuẩn.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className={reviewer.rubricTable}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Tiêu chí đánh giá</th>
                  <th style={{ width: '36%' }}>Mô tả chuẩn học thuật</th>
                  <th style={{ width: '16%' }}>Điểm (1 - 10)</th>
                  <th style={{ width: '26%' }}>Nhận xét / Ghi chú (Note)</th>
                </tr>
              </thead>
              <tbody>
                {REVIEWER_CRITERIA.map((criterion) => {
                  const score = draft.scores[criterion.key];
                  const note = draft.perCriterionNotes[criterion.key];
                  const optionValues = Array.from(
                    { length: criterion.max - criterion.min + 1 },
                    (_, index) => criterion.min + index,
                  );
                  return (
                    <tr key={criterion.key}>
                      <td>
                        <strong style={{ color: '#1e293b' }}>{criterion.label}</strong>
                      </td>
                      <td style={{ color: '#475569', fontSize: 12 }}>
                        {criterion.description}
                      </td>
                      <td>
                        <select
                          id={`score-${criterion.key}`}
                          value={score}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 4,
                            border: '1px solid #cbd5e1',
                            fontSize: 13,
                          }}
                          onChange={(event) =>
                            handleScoreChange(criterion.key, Number(event.target.value))
                          }
                        >
                          {optionValues.map((value) => (
                            <option key={value} value={value}>
                              {value} / 10
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <textarea
                          id={`note-${criterion.key}`}
                          className={reviewer.criterionNote}
                          style={{
                            width: '100%',
                            minHeight: 46,
                            fontSize: 12,
                            padding: '6px 8px',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                          }}
                          value={note}
                          onChange={(event) =>
                            handleNoteChange(criterion.key, event.target.value)
                          }
                          placeholder={`Ghi chú cho ${criterion.label}...`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${shared.field} ${shared.full}`} style={{ marginTop: 8 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            2. Tiêu chí chuyên môn & Mở rộng theo chuyên ngành (Subfield Specialized & Expanded Criteria)
          </h3>
          <p style={{ margin: '0 0 12px', color: '#4a5568', fontSize: 13 }}>
            Các tiêu chí được đọc từ cơ sở dữ liệu chuyên ngành hoặc hệ thống tự động sinh tiêu chí học thuật quốc tế phù hợp với bài báo. Bạn có thể xem và điều chỉnh nội dung:
          </p>

          <div className={reviewer.specializedCard}>
            <div className={reviewer.specializedCardHeader}>
              <span className={reviewer.specializedBadge}>Tiêu chí chuyên ngành 1</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>Criteria 1 & Expanded Criteria 1</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Tên tiêu chí (Criteria 1):
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #cbd5e1' }}
                  value={specializedCriteria.criteria1}
                  onChange={(e) => setSpecializedCriteria({ ...specializedCriteria, criteria1: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Quy chuẩn đánh giá (Evaluation Criteria 1):
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #cbd5e1' }}
                  value={specializedCriteria.evaluationCriteria1}
                  onChange={(e) => setSpecializedCriteria({ ...specializedCriteria, evaluationCriteria1: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#334155' }}>
                Tiêu chí mở rộng & Hướng dẫn (Expanded Criteria 1):
              </label>
              <textarea
                rows={2}
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1' }}
                value={specializedCriteria.expandedCriteria1}
                onChange={(e) => setSpecializedCriteria({ ...specializedCriteria, expandedCriteria1: e.target.value })}
              />
            </div>
          </div>

          <div className={reviewer.specializedCard}>
            <div className={reviewer.specializedCardHeader}>
              <span className={reviewer.specializedBadge}>Tiêu chí chuyên ngành 2</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>Criteria 2 & Expanded Criteria 2</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Tên tiêu chí (Criteria 2):
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #cbd5e1' }}
                  value={specializedCriteria.criteria2}
                  onChange={(e) => setSpecializedCriteria({ ...specializedCriteria, criteria2: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Quy chuẩn đánh giá (Evaluation Criteria 2):
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #cbd5e1' }}
                  value={specializedCriteria.evaluationCriteria2}
                  onChange={(e) => setSpecializedCriteria({ ...specializedCriteria, evaluationCriteria2: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#334155' }}>
                Tiêu chí mở rộng & Hướng dẫn (Expanded Criteria 2):
              </label>
              <textarea
                rows={2}
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1' }}
                value={specializedCriteria.expandedCriteria2}
                onChange={(e) => setSpecializedCriteria({ ...specializedCriteria, expandedCriteria2: e.target.value })}
              />
            </div>
          </div>

          <div className={reviewer.specializedCard}>
            <div className={reviewer.specializedCardHeader}>
              <span className={reviewer.specializedBadge}>Tiêu chí chuyên ngành 3</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>Criteria 3 & Expanded Criteria 3</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Tên tiêu chí (Criteria 3):
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #cbd5e1' }}
                  value={specializedCriteria.criteria3}
                  onChange={(e) => setSpecializedCriteria({ ...specializedCriteria, criteria3: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Quy chuẩn đánh giá (Evaluation Criteria 3):
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #cbd5e1' }}
                  value={specializedCriteria.evaluationCriteria3}
                  onChange={(e) => setSpecializedCriteria({ ...specializedCriteria, evaluationCriteria3: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#334155' }}>
                Tiêu chí mở rộng & Hướng dẫn (Expanded Criteria 3):
              </label>
              <textarea
                rows={2}
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1' }}
                value={specializedCriteria.expandedCriteria3}
                onChange={(e) => setSpecializedCriteria({ ...specializedCriteria, expandedCriteria3: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className={`${shared.field} ${shared.full}`}>
          <label htmlFor="private-comments">
            Nhận xét phản biện tổng quát cho Ban biên tập (Private review feedback for Admin)
          </label>
          <textarea
            id="private-comments"
            rows={5}
            value={draft.privateComments}
            onChange={(event) =>
              handlePrivateCommentsChange(event.target.value)
            }
            placeholder="Tóm tắt nội dung, ưu điểm nổi bật, các điểm hạn chế cần bổ sung. Ban biên tập sẽ đọc nhận xét này để ra quyết định xuất bản."
          />
        </div>
        <div className={`${shared.field} ${shared.full}`}>
          <label htmlFor="recommendation">Quyết định đề xuất (Final Recommendation)</label>
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
                {option.label === 'Accept'
                  ? 'Chấp thuận (Accept for Publication)'
                  : option.label === 'Reject'
                    ? 'Từ chối (Reject / Deny Publication)'
                    : 'Yêu cầu sửa đổi (Revision Required)'}
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
        <div className={`${reviewer.evaluationActions} ${shared.full}`}>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Sau khi nộp, phiếu đánh giá sẽ được chuyển lên Ban biên tập Admin để xem xét xuất bản.
          </p>
          <Button
            variant="primary"
            size="md"
            disabled={saving}
            type="submit"
          >
            {saving ? 'Đang gửi...' : 'Nộp phiếu đánh giá cho Admin'}
          </Button>
        </div>
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

  if (error) {
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
              Back to assignments
            </Button>
          }
        />
        <ErrorBanner
          tone="error"
          title="Could not load assignment"
          message={error}
          retry={
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
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
            {renderPdf()}
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