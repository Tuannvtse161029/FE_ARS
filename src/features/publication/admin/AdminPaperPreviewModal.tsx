import { useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import shared from '../components/PublicationShared.module.css';
import type { PublicationPaper } from '../types/publication';
import {
  doiHref,
  publicReviewerName,
  resolveIdentifiers,
  statusBadgeClass,
  verificationBadgeClass,
} from './adminPublicationHelpers';
import adminStyles from './AdminPublication.module.css';

interface AdminPaperPreviewModalProps {
  paper: PublicationPaper;
  onClose: () => void;
}

/**
 * Quick-look modal that surfaces enough metadata for an Admin to
 * decide whether to open the full editorial record. Reviewer private
 * content is intentionally omitted here — only the full detail page
 * may render private review fields (see `AdminPaperSubmissionDetail`).
 */
export const AdminPaperPreviewModal = ({ paper, onClose }: AdminPaperPreviewModalProps) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const identifiers = resolveIdentifiers(paper);
  // The preview modal MUST honor the reviewer identity public policy —
  // it never surfaces a private reviewer name. The full editorial detail
  // page is the only Admin surface that exposes private review content.
  const reviewerName = publicReviewerName(paper);
  const fileHref = paper.fileUrl?.trim();

  return (
    <div className={adminStyles.previewModalBackdrop} role="dialog" aria-modal="true" aria-label={`Preview ${paper.title}`} onClick={onClose}>
      <div className={adminStyles.previewModal} onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>{paper.title}</h2>
            <p className={shared.panelSubtitle}>{paper.paperType} · v{paper.version}</p>
          </div>
          <button
            type="button"
            className={shared.buttonGhost}
            aria-label="Close preview"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" /> Close
          </button>
        </header>

        <div className={adminStyles.previewBody}>
          <div>
            <span className={`${adminStyles.statusBadge} ${adminStyles[statusBadgeClass(paper.status)] ?? ''}`}>
              {paper.status.replace(/_/g, ' ').toUpperCase()}
            </span>
            {' '}
            <span className={`${adminStyles.verificationBadge} ${adminStyles[verificationBadgeClass(paper.researcherVerificationStatus)] ?? ''}`}>
              {paper.researcherVerificationStatus}
            </span>
          </div>
          <p>{paper.abstract}</p>
          <dl>
            <dt>Authors</dt>
            <dd>{paper.authors.sort((a, b) => a.order - b.order).map((author) => author.name).join(', ')}</dd>
            <dt>Institutions</dt>
            <dd>{paper.institutions.map((institution) => institution.name).join(', ') || '—'}</dd>
            <dt>DOI</dt>
            <dd>{identifiers.doi
              ? (doiHref(identifiers.doi)
                ? <a href={doiHref(identifiers.doi)!} target="_blank" rel="noreferrer">{identifiers.doi}</a>
                : identifiers.doi)
              : '—'}</dd>
            <dt>OpenAlex</dt>
            <dd>{identifiers.openAlexId ?? '—'}</dd>
            <dt>External</dt>
            <dd>{identifiers.externalIdentifier ?? '—'}</dd>
            <dt>Topics</dt>
            <dd>{paper.topics.join(', ') || '—'}</dd>
            <dt>Keywords</dt>
            <dd>{paper.keywords.join(', ') || '—'}</dd>
            <dt>Assigned reviewer</dt>
            <dd>{reviewerName ?? 'Not assigned'}</dd>
            <dt>Reviewer identity public</dt>
            <dd>{paper.reviewerIdentityPublic ? 'Yes' : 'No (private)'}</dd>
            <dt>Submitted</dt>
            <dd>{paper.submittedAt ? paper.submittedAt.slice(0, 10) : '—'}</dd>
            <dt>Published</dt>
            <dd>{paper.publishedAt ? paper.publishedAt.slice(0, 10) : '—'}</dd>
            <dt>Manuscript</dt>
            <dd>
              {fileHref
                ? <a className={adminStyles.fileLink} href={fileHref} target="_blank" rel="noreferrer"><FileText size={14} aria-hidden="true" /> Open in new tab</a>
                : '— (no file URL on this record)'}
            </dd>
          </dl>
          <p className={shared.fieldHint}>
            Preview only — private review content is not surfaced here. Open the editorial record for full review material.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPaperPreviewModal;
