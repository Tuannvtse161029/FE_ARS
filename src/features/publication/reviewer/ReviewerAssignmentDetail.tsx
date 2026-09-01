import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import shared from '../components/PublicationShared.module.css';
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
        className={shared.formGrid}
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
          <div
            className={`${reviewer.evaluationError} ${shared.full}`}
            role="alert"
          >
            {error}
          </div>
        )}
        <div className={`${reviewer.evaluationActions} ${shared.full}`}>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Sau khi nộp, phiếu đánh giá sẽ được chuyển lên Ban biên tập Admin để xem xét xuất bản.
          </p>
          <button className={shared.button} disabled={saving} type="submit">
            {saving ? 'Đang gửi...' : 'Nộp phiếu đánh giá cho Admin'}
          </button>
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
    <div className={shared.actions}>
      <button
        className={shared.button}
        disabled={saving}
        onClick={() => void handleAccept(true)}
      >
        Accept assignment
      </button>
      <button
        className={shared.buttonSecondary}
        disabled={saving}
        onClick={() => void handleAccept(false)}
      >
        Decline assignment
      </button>
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
      <button
        className={shared.buttonSecondary}
        onClick={() => navigate('/reviewer/assignments')}
      >
        Back to my assignments
      </button>
    </section>
  );

  const renderBody = () => {
    if (loading) {
      return <div className={shared.loading}>Loading assignment...</div>;
    }
    if (resolved.status === 'missing') {
      return <div className={shared.loading}>Resolving assignment...</div>;
    }
    if (resolved.status === 'unauthorised') {
      return renderUnauthorized();
    }
    const paperToRender = resolved.paper;
    if (!paperToRender) {
      return <div className={shared.loading}>Loading assignment...</div>;
    }
    return (
      <>
        <header className={shared.header}>
          <div>
            <h1>{paperToRender.title}</h1>
            <p>
              Assigned by Admin. Your recommendation is private to Admin and
              does not publish this paper.
            </p>
          </div>
          <span className={shared.status}>
            {renderInlineStatus(paperToRender.status)}
          </span>
        </header>
        <div className={shared.panel}>
          {renderMetadata(paperToRender)}
          <h2 style={{ fontSize: 17, margin: '12px 0 6px' }}>Abstract</h2>
          <p>{paperToRender.abstract}</p>
          <h2 style={{ fontSize: 17, margin: '12px 0 6px' }}>
            Authors & institutions
          </h2>
          <p>
            <strong>Authors:</strong>{' '}
            {paperToRender.authors.map((author) => author.name).join(', ') ||
              'Not supplied'}
          </p>
          <p>
            <strong>Institutions:</strong>{' '}
            {paperToRender.institutions
              .map((institution) => institution.name)
              .join(', ') || 'Not supplied'}
          </p>
          <h2 style={{ fontSize: 17, margin: '12px 0 6px' }}>
            Manuscript PDF
          </h2>
          {renderPdf(paperToRender)}
          {awaitingResponse && (
            <>
              <h2 style={{ fontSize: 17, margin: '18px 0 6px' }}>
                Respond to assignment
              </h2>
              {renderResponseActions()}
            </>
          )}
          {canReview && (
            <>
              <h2 style={{ fontSize: 17, margin: '18px 0 6px' }}>
                Evaluate Paper
              </h2>
              {renderEvaluationForm()}
            </>
          )}
          {submitted && renderSubmitted(paperToRender)}
          {!shouldRenderPrivatePriorReview(paperToRender.status) && !canReview &&
            !submitted &&
            !awaitingResponse && (
              <div className={shared.empty}>
                This assignment is not actionable for review. Awaiting Admin
                or researcher activity.
              </div>
            )}
        </div>
      </>
    );
  };

  return <section className={shared.page}>{renderBody()}</section>;
};

export default ReviewerAssignmentDetail;
