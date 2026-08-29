import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, FileText } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import shared from '../components/PublicationShared.module.css';
import { statusLabel, type PublicationPaper } from '../types/publication';
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

/**
 * Admin editorial record. This is the ONE Admin-only surface that may
 * render private review content (reviewer private comments, criterion
 * scores). Every other admin surface must hide those fields.
 *
 * Unsupported actions (`assignReviewer`, `publishPaper`) are exposed
 * exactly when the live adapter contract permits them for the current status.
 * Unsupported transitions remain visibly unavailable until the backend ticket
 * is implemented.
 */
export const AdminPaperSubmissionDetail = () => {
  const { id } = useParams();
  const [paper, setPaper] = useState<PublicationPaper | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reviewerId, setReviewerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setNotFound(false);
    publicationAdapter
      .getAdminSubmissions()
      .then((items) => {
        if (!active) return;
        const match = items.find((item) => item.id === id) ?? null;
        if (!match) {
          setNotFound(true);
          return;
        }
        setPaper(match);
        setReviewerId(match.reviewerId ? String(match.reviewerId) : '');
      })
      .catch(() => { if (active) setError('The editorial record could not be loaded.'); });
    return () => { active = false; };
  }, [id]);

  const actions = useMemo(() => (paper ? adminActionsForStatus(paper) : []), [paper]);

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

  if (notFound) {
    return (
      <section className={`${shared.page} ${adminStyles.page}`}>
        <header className={shared.header}>
          <div>
            <h1>Editorial record not found</h1>
            <p>The Admin submission record you requested is unavailable.</p>
          </div>
        </header>
        <div className={shared.empty}>
          <p>No paper matches id <code>{id}</code>.</p>
          <Link className={shared.buttonGhost} to="/admin/paper-submissions"><ChevronLeft size={14} aria-hidden="true" /> Back to submissions</Link>
        </div>
      </section>
    );
  }

  if (error && !paper) {
    return <div className={shared.error} role="alert">{error}</div>;
  }

  if (!paper) {
    return <div className={shared.loading}>Loading editorial record...</div>;
  }

  const identifiers = resolveIdentifiers(paper);
  const showPrivateReview = isPrivateReview(paper) || paper.status !== 'PUBLISHED';
  const hasActions = actions.length > 0;
  const fileHref = paper.fileUrl?.trim();

  return (
    <section className={`${shared.page} ${adminStyles.page}`}>
      <header className={`${shared.header} ${adminStyles.detailHeader}`}>
        <div>
          <Link className={shared.buttonGhost} to="/admin/paper-submissions" aria-label="Back to admin submissions">
            <ChevronLeft size={14} aria-hidden="true" /> All submissions
          </Link>
          <h1>{paper.title}</h1>
          <p>Admin editorial record. Private review material is only rendered here.</p>
        </div>
        <div className={adminStyles.detailHeaderMeta}>
          <span className={`${adminStyles.statusBadge} ${adminStyles[statusBadgeClass(paper.status)] ?? ''}`}>
            {statusLabel(paper.status)}
          </span>
          <span className={`${adminStyles.verificationBadge} ${adminStyles[verificationBadgeClass(paper.researcherVerificationStatus)] ?? ''}`}>
            {paper.researcherVerificationStatus}
          </span>
        </div>
      </header>
      {error && <div className={shared.error} role="alert">{error}</div>}

      <div className={shared.panel}>
        <h2 className={shared.panelTitle}>Metadata</h2>
        <p className={shared.panelSubtitle}>Author, institution, taxonomy, and identifiers as supplied by the researcher.</p>
        <dl className={shared.detailList}>
          <dt>Paper type</dt><dd>{paper.paperType}</dd>
          <dt>Version</dt><dd>{paper.version != null ? `v${paper.version}` : 'Not supplied'}</dd>
          <dt>Visibility</dt><dd>{paper.visibility}</dd>
          <dt>Submitted</dt><dd>{paper.submittedAt?.slice(0, 10) ?? '—'}</dd>
          <dt>Published</dt><dd>{paper.publishedAt?.slice(0, 10) ?? '—'}</dd>
          <dt>Authors</dt><dd>{paper.authors.sort((a, b) => a.order - b.order).map((author) => author.name).join(', ')}</dd>
          <dt>Institutions</dt><dd>{paper.institutions.map((institution) => institution.name).join(', ')}</dd>
          <dt>Topic</dt><dd>{[paper.domain, paper.field, paper.subfield].filter(Boolean).join(' / ') || '—'}</dd>
          <dt>Keywords</dt><dd>{paper.keywords.join(', ') || '—'}</dd>
          <dt>DOI</dt>
          <dd>
            {identifiers.doi
              ? (doiHref(identifiers.doi)
                ? <a className={adminStyles.fileLink} href={doiHref(identifiers.doi)!} target="_blank" rel="noreferrer">{identifiers.doi}</a>
                : identifiers.doi)
              : '—'}
          </dd>
          <dt>OpenAlex</dt><dd>{identifiers.openAlexId ?? '—'}</dd>
          <dt>External</dt><dd>{identifiers.externalIdentifier ?? '—'}</dd>
        </dl>
      </div>

      <div className={shared.panel}>
        <h2 className={shared.panelTitle}>Manuscript file</h2>
        <p className={shared.panelSubtitle}>Open or download the supplied manuscript. The Admin surface never modifies the file.</p>
        {fileHref
          ? (
            <div className={shared.actions}>
              <a className={shared.button} href={fileHref} target="_blank" rel="noreferrer">
                <FileText size={16} aria-hidden="true" /> Open manuscript
              </a>
              <a className={shared.buttonSecondary} href={fileHref} download aria-label="Download manuscript">
                Download
              </a>
            </div>
          )
          : <div className={shared.empty}>No file URL is attached to this record.</div>}
      </div>

      {showPrivateReview && paper.reviewer && (
        <div className={adminStyles.reviewBlock} role="region" aria-label="Private reviewer record">
          <h3>Private reviewer record</h3>
          <p className={adminStyles.reviewNote}>
            Admin-only. This block MUST NOT appear on the public catalog, the researcher detail page, or any other surface.
          </p>
          <dl className={shared.detailList}>
            <dt>Reviewer</dt>
            <dd>
              {paper.reviewer.reviewerName}
              <br />
              <small className={shared.fieldHint}>
                Identity-public flag: {paper.reviewerIdentityPublic ? 'Yes (visible on catalog)' : 'No (private — never shown on the public catalog)'}
              </small>
            </dd>
            <dt>Recommendation</dt>
            <dd>
              <span className={`${adminStyles.statusBadge} ${adminStyles[
                paper.reviewer.recommendation === 'ACCEPT' ? 'statusRecommendAccept'
                  : paper.reviewer.recommendation === 'REJECT' ? 'statusRecommendReject'
                  : 'statusRevision'
              ] ?? ''}`}>
                {paper.reviewer.recommendation.replace(/_/g, ' ')}
              </span>
            </dd>
            <dt>Submitted</dt>
            <dd>{paper.reviewer.submittedAt?.slice(0, 10) ?? '—'}</dd>
            <dt>Private comments</dt>
            <dd>{paper.reviewer.privateComments || '—'}</dd>
          </dl>
          {Object.keys(paper.reviewer.privateScores).length > 0 && (
            <table className={adminStyles.reviewScoresTable}>
              <thead>
                <tr><th>Criterion</th><th align="right">Score</th></tr>
              </thead>
              <tbody>
                {Object.entries(paper.reviewer.privateScores).map(([criterion, score]) => (
                  <tr key={criterion}>
                    <td>{criterion}</td>
                    <td align="right">{score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {hasActions && (
        <div className={shared.panel}>
          <h2 className={shared.panelTitle}>Editorial actions</h2>
          <p className={shared.panelSubtitle}>Each action is gated by the current status and persisted through a documented backend operation.</p>
          <div className={shared.actionsStack}>
            {canAssignReviewer(paper) && (
              <div className={adminStyles.actionZone}>
                <h3 className={adminStyles.actionZoneTitle}>Assign / reassign reviewer</h3>
                <p className={adminStyles.actionZoneHint}>{actions.find((action) => action.id === 'assign')?.hint}</p>
                <div className={adminStyles.assignForm}>
                  <label className={shared.field}>
                    <span>Reviewer account ID</span>
                    <input
                      aria-label="Reviewer account ID"
                      inputMode="numeric"
                      placeholder="Reviewer ID"
                      value={reviewerId}
                      onChange={(event) => setReviewerId(event.target.value.replace(/\D/g, ''))}
                    />
                  </label>
                  <button
                    type="button"
                    className={shared.button}
                    disabled={saving || !Number.isInteger(Number(reviewerId)) || Number(reviewerId) <= 0}
                    onClick={() => void assign()}
                  >
                    {saving ? 'Saving...' : 'Assign reviewer'}
                  </button>
                </div>
              </div>
            )}
            {canPublish(paper) && (
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
                    {saving ? 'Publishing...' : 'Approve and publish'}
                  </button>
                </div>
              </div>
            )}
            {canRequestRevision(paper) && (
              <div className={adminStyles.actionZone}>
                <h3 className={adminStyles.actionZoneTitle}>Request revision</h3>
                <p className={adminStyles.actionZoneHint}>{actions.find((action) => action.id === 'requestRevision')?.hint}</p>
                <p className={shared.fieldHint}>Unavailable until the backend exposes a revision transition endpoint. See the backend publication ticket.</p>
              </div>
            )}
            {canReject(paper) && (
              <div className={adminStyles.actionZone}>
                <h3 className={adminStyles.actionZoneTitle}>Reject</h3>
                <p className={adminStyles.actionZoneHint}>{actions.find((action) => action.id === 'reject')?.hint}</p>
                <p className={shared.fieldHint}>Unavailable until the backend exposes an Admin rejection endpoint. See the backend publication ticket.</p>
              </div>
            )}
            {canWithdraw(paper) && (
              <div className={adminStyles.actionZone}>
                <h3 className={adminStyles.actionZoneTitle}>{actions.find((action) => action.id === 'withdraw')?.label}</h3>
                <p className={adminStyles.actionZoneHint}>{actions.find((action) => action.id === 'withdraw')?.hint}</p>
                <p className={shared.fieldHint}>Unavailable until the backend exposes a publication withdrawal endpoint. See the backend publication ticket.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!hasActions && (
        <div className={shared.empty}>
          <p>No editorial actions are valid for the current status ({statusLabel(paper.status)}).</p>
          <p className={shared.fieldHint}>Status-valid action areas appear automatically when the lifecycle state changes.</p>
        </div>
      )}
    </section>
  );
};

export default AdminPaperSubmissionDetail;
