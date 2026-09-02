import { useEffect, useRef } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import LazyPdfViewer from '../../components/PdfViewer/LazyPdfViewer';
import { OrcidIdentityMarker } from '../../components/identity/OrcidIdentityMarker';
import type { RoleRequest, RoleRequestStatus } from '../../types/admin';
import styles from './AdminDialog.module.css';

interface Props {
  request: RoleRequest | null;
  open: boolean;
  onClose: () => void;
  onOpenOrcidCheck?: () => void;
}

const STATUS_CLASS: Record<RoleRequestStatus, string> = {
  PENDING: styles.statusPending,
  APPROVED: styles.statusApproved,
  DENIED: styles.statusDenied,
};

const requestTypeLabel = (request: RoleRequest) => {
  if (request.requestType === 'INITIAL_REGISTRATION') return 'Initial registration';
  if (request.requestType === 'ADDITIONAL_ROLE') return 'Additional role';
  return 'Unavailable from API';
};

const rolesText = (roles?: string[]) =>
  roles ? (roles.length > 0 ? roles.join(', ') : 'None') : 'Unavailable from API';

export const RoleRequestDetailsModal = ({ request, open, onClose, onOpenOrcidCheck }: Props) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !request) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-details-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={`${styles.modal} ${styles.wideModal}`}>
        <header className={styles.header}>
          <div>
            <h2 id="role-details-title" className={styles.title}>
              Role Request #{request.id}
            </h2>
            <p className={styles.subtitle}>
              Submitted {request.submissionDate ? new Date(request.submissionDate).toLocaleString('vi-VN') : 'Not supplied'}
            </p>
          </div>
          <button ref={closeRef} className={styles.iconButton} onClick={onClose} type="button" aria-label="Close role request details">
            <X size={18} />
          </button>
        </header>

        <div className={styles.splitBody}>
          <div className={styles.content}>
            <dl className={styles.detailsGrid}>
              <div><dt>User</dt><dd>{request.userName}</dd></div>
              <div><dt>User ID</dt><dd>#{request.userId}</dd></div>
              <div><dt>Email</dt><dd>{request.email}</dd></div>
              <div><dt>Phone</dt><dd>{request.phone ?? '—'}</dd></div>
              <div><dt>Affiliation</dt><dd>{request.affiliation}</dd></div>
              <div><dt>Department</dt><dd>{request.department}</dd></div>
              <div><dt>Initial / current role</dt><dd>{rolesText(request.currentRoles)}</dd></div>
              <div><dt>Requested additional role</dt><dd>{rolesText(request.requestedAdditionalRoles)}</dd></div>
              <div><dt>Request type</dt><dd>{requestTypeLabel(request)}</dd></div>
              <div>
                <dt>Status</dt>
                <dd><span className={`${styles.statusBadge} ${STATUS_CLASS[request.status]}`}>{request.status}</span></dd>
              </div>
              <div className={styles.fullWidth}>
                <dt>ORCID identity connection</dt>
                {request.isOrcidVerified === true ? (
                  <dd className={styles.orcidIdentity}>
                    <span>Connected</span>
                    <OrcidIdentityMarker
                      orcidId={request.orcidId}
                      isOrcidVerified={request.isOrcidVerified}
                    />
                    {request.orcidVerifiedAt ? (
                      <span>Linked {new Date(request.orcidVerifiedAt).toLocaleDateString('vi-VN')}</span>
                    ) : null}
                  </dd>
                ) : (
                  <dd className={styles.missing}>No confirmed ORCID connection</dd>
                )}
                <p className={styles.identityDisclosure}>
                  An ORCID connection is an identity signal; approving this request remains an ARS role decision.
                </p>
              </div>
              {request.notes ? <div className={styles.fullWidth}><dt>Decision notes</dt><dd>{request.notes}</dd></div> : null}
            </dl>
          </div>

          <div className={styles.documentPane}>
            <div className={styles.documentHeader}>
              <span>Proof document</span>
              {request.proofDocumentUrl ? (
                <a href={request.proofDocumentUrl} target="_blank" rel="noreferrer noopener" className={styles.textLink}>
                  <ExternalLink size={14} /> Open in new tab
                </a>
              ) : null}
            </div>
            {request.proofDocumentUrl ? (
              <div className={styles.documentViewer}><LazyPdfViewer url={request.proofDocumentUrl} /></div>
            ) : (
              <div className={styles.emptyDocument}><FileText size={22} /><span>No proof document supplied.</span></div>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <button className={`${styles.button} ${styles.secondaryButton}`} onClick={onClose} type="button">Close</button>
          {request.isOrcidVerified === true && request.orcidId && onOpenOrcidCheck ? (
            <button className={`${styles.button} ${styles.orcidButton}`} onClick={onOpenOrcidCheck} type="button">
              Check ORCID
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
};

export default RoleRequestDetailsModal;
