/**
 * AdminPaperSubmissionDetail — Admin editorial record.
 *
 * The ONE Admin-only surface that may render private review content
 * (reviewer private comments, criterion scores). Every other admin surface
 * hides those fields. Unsupported actions are exposed as honest
 * unavailable placeholders.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, FileText, Inbox, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import shared from '../components/PublicationShared.module.css';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { useAdminGuard } from '../../../hooks/useAdminGuard';
import {
  statusLabel,
  isAuthorshipAllowed,
  type PublicationPaper,
  type PublicationStatus,
} from '../types/publication';
import {
  adminActionsForStatus,
  canAssignReviewer,
  canPublish,
  canReject,
  canRequestRevision,
  canWithdraw,
  doiHref,
  isPrivateReview,
  resolveIdentifiers,
  statusBadgeClass,
  verificationBadgeClass,
} from './adminPublicationHelpers';
import adminStyles from './AdminPublication.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';

const STATUS_LABEL: Record<PublicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  ADMIN_SCREENING: 'Admin screening',
  RESEARCHER_VERIFICATION_REQUIRED: 'Verification required',
  READY_FOR_REVIEWER: 'Ready for reviewer',
  REVIEWER_ASSIGNED: 'Reviewer assigned',
  UNDER_REVIEW: 'Under review',
  REVISION_REQUIRED: 'Revision required',
  RESUBMITTED: 'Resubmitted',
  REVIEWER_RECOMMENDED_ACCEPT: 'Recommend accept',
  REVIEWER_RECOMMENDED_REJECT: 'Recommend reject',
  ADMIN_APPROVED: 'Admin approved',
  PUBLISHED: 'Published',
  ADMIN_REJECTED: 'Admin rejected',
  WITHDRAWN: 'Withdrawn',
};

export const AdminPaperSubmissionDetail = () => {
  useAdminGuard();

  const { id } = useParams();
  const [paper, setPaper] = useState<PublicationPaper | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reviewerId, setReviewerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setNotFound(false);
    setLoading(true);
    publicationAdapter
      .getAdminSubmissions()
      .then((items) => {
        if (!active) return;
        const match = items.find((item) => item.id === id) ?? null;
        if (!match) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setPaper(match);
        setReviewerId(match.reviewerId ? String(match.reviewerId) : '');
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('The editorial record could not be loaded.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const actions = paper ? adminActionsForStatus(paper) : [];

  const assign = async () => {
    const parsedReviewerId = Number(reviewerId);
    if (!paper || !Number.isInteger(parsedReviewerId) || parsedReviewerId <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicationAdapter.assignReviewer(paper.id, parsedReviewerId);
      setPaper(updated);
      setReviewerId(updated.reviewerId ? String(updated.reviewerId) : '');
    } catch {
      setError('The reviewer assignment could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const assignAuto = async () => {
    if (!paper) return;
    setSaving(true);
    setError(null);
    try {
      await publicationAdapter.assignReviewersAuto(paper.id, 3);
      const items = await publicationAdapter.getAdminSubmissions();
      const match = items.find((item) => item.id === id) ?? null;
      if (match) {
        setPaper(match);
        setReviewerId(match.reviewerId ? String(match.reviewerId) : '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The auto-assignment could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!paper) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicationAdapter.publishPaper(paper.id);
      setPaper(updated);
    } catch {
      setError('The publish action could not be performed.');
    } finally {
      setSaving(false);
    }
  };

  const reject = async (reason?: string) => {
    if (!paper) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publicationAdapter.rejectPaper(paper.id, reason);
      setPaper(updated);
    } catch {
      setError('The reject action could not be performed.');
    } finally {
      setSaving(false);
    }
  };

  const handleAllowVerification = async () => {
    if (!paper) return;
    setVerifying(true);
    setError(null);
    setVerificationSuccess(null);
    try {
      const updated = await publicationAdapter.verifyAuthorship(paper.id, true);
      setPaper(updated);
      setVerificationSuccess('Authorship was verified successfully. The status is now ALLOW.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorship could not be verified.');
    } finally {
      setVerifying(false);
    }
  };

  if (notFound) {
    return (
      <section className={`${shared.page} ${adminStyles.page}`}>
        <PageHeader
          eyebrow="ADMIN · EDITORIAL RECORD"
          title="Editorial record not found"
          description="The Admin submission record you requested is unavailable."
          accent={ROLE_ACCENT}
        />
        <div className={shared.empty}>
          <p>No paper matches id <code>{id}</code>.</p>
          <Link
            className={shared.buttonGhost}
            to="/admin/paper-submissions"
          >
            <ChevronLeft size={14} aria-hidden="true" /> Back to submissions
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={`${shared.page} ${adminStyles.page}`}>
        <PageHeader
          eyebrow="ADMIN · EDITORIAL RECORD"
          title="Loading editorial record…"
          description="Fetching the selected paper from the backend."
          accent={ROLE_ACCENT}
        />
        <div className={shared.loading} role="status">
          <RefreshCw size={14} aria-hidden="true" /> Loading editorial record…
        </div>
      </section>
    );
  }

  if (error && !paper) {
    return (
      <section className={`${shared.page} ${adminStyles.page}`}>
        <PageHeader
          eyebrow="ADMIN · EDITORIAL RECORD"
          title="Editorial record"
          accent={ROLE_ACCENT}
        />
        <ErrorBanner tone="error" title="Could not load record" message={error} />
      </section>
    );
  }

  if (!paper) {
    return (
      <section className={`${shared.page} ${adminStyles.page}`}>
        <div className={shared.empty} role="status">
          <Inbox size={20} />
          <span>No paper to display.</span>
        </div>
      </section>
    );
  }

  const identifiers = resolveIdentifiers(paper);
  const showPrivateReview = isPrivateReview(paper) || paper.status !== 'PUBLISHED';
  const hasActions = actions.length > 0;
  const fileHref = paper.fileUrl?.trim();

  return (
    <section className={`${shared.page} ${adminStyles.page}`}>
      <PageHeader
        eyebrow="ADMIN · EDITORIAL RECORD"
        title={paper.title}
        description="Admin editorial record. Private review material is only rendered here."
        accent={ROLE_ACCENT}
        actions={
          <Link className={shared.buttonGhost} to="/admin/paper-submissions">
            <ChevronLeft size={14} aria-hidden="true" /> All submissions
          </Link>
        }
      />

      {error ? (
        <ErrorBanner tone="error" title="Action failed" message={error} />
      ) : null}

      <div className={shared.panel}>
        <header className={shared.panelHeader}>
          <div>
            <h2 className={shared.panelTitle}>Status & verification</h2>
            <p className={shared.panelSubtitle}>
              Lifecycle position and researcher-verification state.
            </p>
          </div>
          <div className={adminStyles.detailHeaderMeta}>
            <span
              className={`${adminStyles.statusBadge} ${
                adminStyles[statusBadgeClass(paper.status)] ?? ''
              }`}
            >
              {STATUS_LABEL[paper.status] ?? statusLabel(paper.status)}
            </span>
            <span
              className={`${adminStyles.verificationBadge} ${
                adminStyles[verificationBadgeClass(paper.researcherVerificationStatus)] ??
                ''
              }`}
            >
              {paper.researcherVerificationStatus}
            </span>
          </div>
        </header>
      </div>

      <div className={shared.panel}>
        <h2 className={shared.panelTitle}>Metadata</h2>
        <p className={shared.panelSubtitle}>
          Author, institution, taxonomy, and identifiers as supplied by the researcher.
        </p>
        <dl className={shared.detailList}>
          <dt>Paper type</dt>
          <dd>{paper.paperType}</dd>
          <dt>Version</dt>
          <dd>{paper.version != null ? `v${paper.version}` : 'Not supplied'}</dd>
          <dt>Visibility</dt>
          <dd>{paper.visibility}</dd>
          <dt>Submitted</dt>
          <dd>{paper.submittedAt?.slice(0, 10) ?? '—'}</dd>
          <dt>Published</dt>
          <dd>{paper.publishedAt?.slice(0, 10) ?? '—'}</dd>
          <dt>Authors</dt>
          <dd>
            {paper.authors
              .sort((a, b) => a.order - b.order)
              .map((author) => author.name)
              .join(', ')}
          </dd>
          <dt>Institutions</dt>
          <dd>{paper.institutions.map((institution) => institution.name).join(', ')}</dd>
          <dt>Field / Subfield</dt>
          <dd>
            {[paper.domain, paper.field, paper.subfield].filter(Boolean).join(' / ') ||
              (paper.subFieldId ? `Subfield #${paper.subFieldId}` : '—')}
          </dd>
          <dt>Keywords</dt>
          <dd>{paper.keywords.join(', ') || '—'}</dd>
          <dt>DOI</dt>
          <dd>
            {identifiers.doi ? (
              doiHref(identifiers.doi) ? (
                <a
                  className={adminStyles.fileLink}
                  href={doiHref(identifiers.doi)!}
                  target="_blank"
                  rel="noreferrer"
                >
                  {identifiers.doi}
                </a>
              ) : (
                identifiers.doi
              )
            ) : (
              '—'
            )}
          </dd>
          <dt>OpenAlex</dt>
          <dd>{identifiers.openAlexId ?? '—'}</dd>
          <dt>External</dt>
          <dd>{identifiers.externalIdentifier ?? '—'}</dd>
        </dl>
      </div>

      <div className={shared.panel}>
        <h2 className={shared.panelTitle}>Manuscript file</h2>
        <p className={shared.panelSubtitle}>
          Open or download the supplied manuscript. The Admin surface never modifies the file.
        </p>
        {fileHref ? (
          <div className={shared.actions}>
            <a className={shared.button} href={fileHref} target="_blank" rel="noreferrer">
              <FileText size={16} aria-hidden="true" /> Open manuscript
            </a>
            <a
              className={shared.buttonSecondary}
              href={fileHref}
              download
              aria-label="Download manuscript"
            >
              Download
            </a>
          </div>
        ) : (
          <div className={shared.empty}>No file URL is attached to this record.</div>
        )}
      </div>

      {showPrivateReview && paper.reviewer ? (
        <div
          className={adminStyles.reviewBlock}
          role="region"
          aria-label="Private reviewer record"
        >
          <h3>Private reviewer record</h3>
          <p className={adminStyles.reviewNote}>
            Admin-only. This block MUST NOT appear on the public catalog, the
            researcher detail page, or any other surface.
          </p>
          <dl className={shared.detailList}>
            <dt>Reviewer</dt>
            <dd>
              {paper.reviewer.reviewerName}
              <br />
              <small className={shared.fieldHint}>
                Identity-public flag:{' '}
                {paper.reviewerIdentityPublic
                  ? 'Yes (visible on catalog)'
                  : 'No (private — never shown on the public catalog)'}
              </small>
            </dd>
            <dt>Recommendation</dt>
            <dd>
              <span
                className={`${adminStyles.statusBadge} ${
                  adminStyles[
                    paper.reviewer.recommendation === 'ACCEPT'
                      ? 'statusRecommendAccept'
                      : paper.reviewer.recommendation === 'REJECT'
                        ? 'statusRecommendReject'
                        : 'statusRevision'
                  ] ?? ''
                }`}
              >
                {paper.reviewer.recommendation.replace(/_/g, ' ')}
              </span>
            </dd>
            <dt>Submitted</dt>
            <dd>{paper.reviewer.submittedAt?.slice(0, 10) ?? '—'}</dd>
            <dt>Private comments</dt>
            <dd>{paper.reviewer.privateComments || '—'}</dd>
          </dl>
          {Object.keys(paper.reviewer.privateScores).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#334155' }}>
                Core criteria scores
              </h4>
              <table className={adminStyles.reviewScoresTable}>
                <thead>
                  <tr>
                    <th>Criterion</th>
                    <th align="right">Score (1-10)</th>
                    <th>Private Note</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(paper.reviewer.privateScores).map(([criterion, score]) => (
                    <tr key={criterion}>
                      <td><strong style={{ textTransform: 'capitalize' }}>{criterion}</strong></td>
                      <td align="right"><strong>{score}</strong> / 10</td>
                      <td style={{ color: '#64748b', fontSize: 12 }}>
                        {paper.reviewer?.privateNotes?.[criterion] || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(paper.reviewer.criteria1 || paper.reviewer.criteria2 || paper.reviewer.criteria3) && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#334155' }}>
                Specialized and expanded criteria
              </h4>
              <div style={{ display: 'grid', gap: 10 }}>
                {paper.reviewer.criteria1 && (
                  <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
                      1. {paper.reviewer.criteria1}
                    </div>
                    {paper.reviewer.expandedCriteria1 && (
                      <div style={{ color: '#475569', fontSize: 12, margin: '2px 0' }}>
                        {paper.reviewer.expandedCriteria1}
                      </div>
                    )}
                    {paper.reviewer.evaluationCriteria1 && (
                      <div style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>
                        {paper.reviewer.evaluationCriteria1}
                      </div>
                    )}
                  </div>
                )}
                {paper.reviewer.criteria2 && (
                  <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
                      2. {paper.reviewer.criteria2}
                    </div>
                    {paper.reviewer.expandedCriteria2 && (
                      <div style={{ color: '#475569', fontSize: 12, margin: '2px 0' }}>
                        {paper.reviewer.expandedCriteria2}
                      </div>
                    )}
                    {paper.reviewer.evaluationCriteria2 && (
                      <div style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>
                        {paper.reviewer.evaluationCriteria2}
                      </div>
                    )}
                  </div>
                )}
                {paper.reviewer.criteria3 && (
                  <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
                      3. {paper.reviewer.criteria3}
                    </div>
                    {paper.reviewer.expandedCriteria3 && (
                      <div style={{ color: '#475569', fontSize: 12, margin: '2px 0' }}>
                        {paper.reviewer.expandedCriteria3}
                      </div>
                    )}
                    {paper.reviewer.evaluationCriteria3 && (
                      <div style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>
                        {paper.reviewer.evaluationCriteria3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {hasActions ? (
        <div className={shared.panel}>
          <h2 className={shared.panelTitle}>Editorial actions</h2>
          <p className={shared.panelSubtitle}>
            Each action is gated by the current status and persisted through a
            documented backend operation.
          </p>
          {verificationSuccess && (
            <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 8, color: '#065f46', marginBottom: 12 }}>
              {verificationSuccess}
            </div>
          )}
          <div className={shared.actionsStack}>
            {/* Author Verification Zone */}
            <div
              className={adminStyles.actionZone}
              style={{
                border: '1px solid ' + (isAuthorshipAllowed(paper) ? '#10b981' : '#3b82f6'),
                background: isAuthorshipAllowed(paper) ? '#f0fdf4' : '#eff6ff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isAuthorshipAllowed(paper) ? <CheckCircle2 size={20} color="#059669" /> : <ShieldCheck size={20} color="#2563eb" />}
                  <h3 className={adminStyles.actionZoneTitle} style={{ margin: 0, color: isAuthorshipAllowed(paper) ? '#065f46' : '#1e40af' }}>
                    Researcher authorship verification
                  </h3>
                </div>
                <span
                  className={`${adminStyles.verificationBadge} ${adminStyles[verificationBadgeClass(paper.researcherVerificationStatus)] ?? ''}`}
                  style={{ fontSize: 12, padding: '3px 10px', fontWeight: 700 }}
                >
                  Status: {paper.researcherVerificationStatus}
                </span>
              </div>

              {isAuthorshipAllowed(paper) ? (
                <p style={{ color: '#047857', fontSize: 13, margin: '6px 0 0' }}>
                  Authorship has been officially verified (ALLOW). This paper is eligible for reviewer assignment.
                </p>
              ) : (
                <>
                  <p className={adminStyles.actionZoneHint} style={{ color: '#1e3a8a', marginBottom: 12 }}>
                    Verify authorship so the system can unlock reviewer assignment for this paper.
                  </p>
                  <div className={shared.actions}>
                    <button
                      type="button"
                      className={shared.button}
                      style={{ background: '#2563eb' }}
                      disabled={verifying || saving}
                      onClick={() => void handleAllowVerification()}
                    >
                      {verifying ? 'Verifying…' : 'Verify authorship'}
                    </button>
                  </div>
                </>
              )}
            </div>

            {canAssignReviewer(paper) ? (
              !isAuthorshipAllowed(paper) ? (
                <div className={adminStyles.actionZone} style={{ opacity: 0.8, background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Lock size={18} color="#94a3b8" />
                    <h3 className={adminStyles.actionZoneTitle} style={{ margin: 0, color: '#64748b' }}>
                      Reviewer assignment is locked
                    </h3>
                  </div>
                  <p style={{ color: '#dc2626', fontSize: 13, margin: '6px 0 0', fontWeight: 600 }}>
                    Reviewer assignment requires authorship verification. Verify authorship above to continue.
                  </p>
                </div>
              ) : (
                <div className={adminStyles.actionZone}>
                  <h3 className={adminStyles.actionZoneTitle}>Assign / reassign reviewer</h3>
                  <p className={adminStyles.actionZoneHint}>{actions.find((action) => action.id === 'assign')?.hint}</p>

                  <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px dashed #e2e8f0' }}>
                    <button
                      type="button"
                      className={shared.button}
                      style={{ background: '#0284c7' }}
                      disabled={saving}
                      onClick={() => void assignAuto()}
                    >
                      {saving ? 'Assigning…' : 'Automatically assign 3 reviewers'}
                    </button>
                    <p className={shared.fieldHint} style={{ marginTop: 4 }}>
                      The API automatically matches subject expertise and workload.
                    </p>
                  </div>

                  <div className={adminStyles.assignForm}>
                    <label className={shared.field}>
                      <span>Or enter a reviewer ID manually</span>
                      <input
                        aria-label="Reviewer account ID"
                        inputMode="numeric"
                        placeholder="Reviewer ID"
                        value={reviewerId}
                        onChange={(event) =>
                          setReviewerId(event.target.value.replace(/\D/g, ''))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className={shared.buttonSecondary}
                      disabled={
                        saving ||
                        !Number.isInteger(Number(reviewerId)) ||
                        Number(reviewerId) <= 0
                      }
                      onClick={() => void assign()}
                    >
                      {saving ? 'Saving…' : 'Assign reviewer manually'}
                    </button>
                  </div>
                </div>
              )
            ) : null}
            {canPublish(paper) ? (
              <div className={adminStyles.actionZone}>
                <h3 className={adminStyles.actionZoneTitle}>Publish</h3>
                <p className={adminStyles.actionZoneHint}>{actions.find((action) => action.id === 'publish')?.hint}</p>
                <div className={shared.actions}>
                  <button
                    type="button"
                    className={shared.button}
                    disabled={saving}
                    onClick={() => void publish()}
                  >
                    {saving ? 'Publishing…' : 'Approve and publish'}
                  </button>
                </div>
              </div>
            ) : null}
            {canRequestRevision(paper) ? (
              <div className={adminStyles.actionZone}>
                <h3 className={adminStyles.actionZoneTitle}>Request revision</h3>
                <p className={adminStyles.actionZoneHint}>
                  {actions.find((action) => action.id === 'requestRevision')?.hint}
                </p>
                <p className={shared.fieldHint}>
                  Unavailable until the backend exposes a revision transition
                  endpoint. See the backend publication ticket.
                </p>
              </div>
            ) : null}
            {canReject(paper) ? (
              <div className={adminStyles.actionZone}>
                <h3 className={adminStyles.actionZoneTitle}>Reject paper</h3>
                <p className={adminStyles.actionZoneHint}>{actions.find((action) => action.id === 'reject')?.hint}</p>
                <div className={shared.actions}>
                  <button
                    type="button"
                    className={shared.buttonSecondary}
                    style={{ color: '#dc2626', borderColor: '#fca5a5', fontWeight: 600 }}
                    disabled={saving}
                    onClick={() => void reject('The submission does not meet the editorial review standard.')}
                  >
                    {saving ? 'Processing…' : 'Confirm rejection and notify author'}
                  </button>
                </div>
              </div>
            ) : null}
            {canWithdraw(paper) ? (
              <div className={adminStyles.actionZone}>
                <h3 className={adminStyles.actionZoneTitle}>
                  {actions.find((action) => action.id === 'withdraw')?.label}
                </h3>
                <p className={adminStyles.actionZoneHint}>
                  {actions.find((action) => action.id === 'withdraw')?.hint}
                </p>
                <p className={shared.fieldHint}>
                  Unavailable until the backend exposes a publication withdrawal
                  endpoint. See the backend publication ticket.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={shared.empty}>
          <p>
            No editorial actions are valid for the current status (
            {statusLabel(paper.status)}).
          </p>
          <p className={shared.fieldHint}>
            Status-valid action areas appear automatically when the lifecycle state changes.
          </p>
        </div>
      )}
    </section>
  );
};

export default AdminPaperSubmissionDetail;