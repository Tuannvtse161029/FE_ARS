import { useEffect, useRef } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
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

export const RoleRequestDetailsModal = ({ request, open, onClose, onOpenOrcidCheck }: Props) => {
  const { t } = useI18n();
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

  const requestTypeLabel = (req: RoleRequest) => {
    if (req.requestType === 'INITIAL_REGISTRATION') return t('admin.roleRequests.details.initialRegistration');
    if (req.requestType === 'ADDITIONAL_ROLE') return t('admin.roleRequests.details.additionalRole');
    return t('admin.roleRequests.approve.unavailableApi');
  };

  const rolesText = (roles?: string[]) =>
    roles ? (roles.length > 0 ? roles.join(', ') : t('admin.roleRequests.details.none')) : t('admin.roleRequests.approve.unavailableApi');

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
              {t('admin.roleRequests.details.titleReq').replace('{id}', String(request.id))}
            </h2>
            <p className={styles.subtitle}>
              {t('admin.roleRequests.details.submitted')} {request.submissionDate ? new Date(request.submissionDate).toLocaleString('vi-VN') : t('admin.roleRequests.details.notSupplied')}
            </p>
          </div>
          <button ref={closeRef} className={styles.iconButton} onClick={onClose} type="button" aria-label={t('admin.roleRequests.details.closeLabel')}>
            <X size={18} />
          </button>
        </header>

        <div className={styles.splitBody}>
          <div className={styles.content}>
            <dl className={styles.detailsGrid}>
              <div><dt>{t('admin.roleRequests.details.user')}</dt><dd>{request.userName}</dd></div>
              <div><dt>{t('admin.roleRequests.details.userId')}</dt><dd>#{request.userId}</dd></div>
              <div><dt>{t('admin.roleRequests.details.email')}</dt><dd>{request.email}</dd></div>
              <div><dt>{t('admin.roleRequests.details.phone')}</dt><dd>{request.phone ?? '—'}</dd></div>
              <div><dt>{t('admin.roleRequests.details.affiliation')}</dt><dd>{request.affiliation}</dd></div>
              <div><dt>{t('admin.roleRequests.details.department')}</dt><dd>{request.department}</dd></div>
              <div><dt>{t('admin.roleRequests.details.initialCurrentRole')}</dt><dd>{rolesText(request.currentRoles)}</dd></div>
              <div><dt>{t('admin.roleRequests.details.requestedAdditionalRole')}</dt><dd>{rolesText(request.requestedAdditionalRoles)}</dd></div>
              <div><dt>{t('admin.roleRequests.details.requestType')}</dt><dd>{requestTypeLabel(request)}</dd></div>
              <div>
                <dt>{t('admin.roleRequests.details.status')}</dt>
                <dd><span className={`${styles.statusBadge} ${STATUS_CLASS[request.status]}`}>{t(`common.status.${request.status.toLowerCase()}`)}</span></dd>
              </div>
              <div className={styles.fullWidth}>
                <dt>{t('admin.roleRequests.details.orcid')}</dt>
                {request.isOrcidVerified === true ? (
                  <dd className={styles.orcidIdentity}>
                    <span>{t('admin.roleRequests.details.orcidConnected')}</span>
                    <OrcidIdentityMarker
                      orcidId={request.orcidId}
                      isOrcidVerified={request.isOrcidVerified}
                    />
                    {request.orcidVerifiedAt ? (
                      <span>{t('admin.roleRequests.details.orcidLinked')} {new Date(request.orcidVerifiedAt).toLocaleDateString('vi-VN')}</span>
                    ) : null}
                  </dd>
                ) : (
                  <dd className={styles.missing}>{t('admin.roleRequests.details.orcidMissing')}</dd>
                )}
                <p className={styles.identityDisclosure}>
                  {t('admin.roleRequests.details.orcidDisclosure')}
                </p>
              </div>
              {request.notes ? <div className={styles.fullWidth}><dt>{t('admin.roleRequests.details.decisionNotes')}</dt><dd>{request.notes}</dd></div> : null}
            </dl>
          </div>

          <div className={styles.documentPane}>
            <div className={styles.documentHeader}>
              <span>{t('admin.roleRequests.details.proofDocument')}</span>
              {request.proofDocumentUrl ? (
                <a href={request.proofDocumentUrl} target="_blank" rel="noreferrer noopener" className={styles.textLink}>
                  <ExternalLink size={14} /> {t('admin.roleRequests.details.openNewTab')}
                </a>
              ) : null}
            </div>
            {request.proofDocumentUrl ? (
              <div className={styles.documentViewer}><LazyPdfViewer url={request.proofDocumentUrl} /></div>
            ) : (
              <div className={styles.emptyDocument}><FileText size={22} /><span>{t('admin.roleRequests.details.noProofDocument')}</span></div>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <button className={`${styles.button} ${styles.secondaryButton}`} onClick={onClose} type="button">{t('common.cancel')}</button>
          {request.isOrcidVerified === true && request.orcidId && onOpenOrcidCheck ? (
            <button className={`${styles.button} ${styles.orcidButton}`} onClick={onOpenOrcidCheck} type="button">
              {t('admin.roleRequests.details.checkOrcid')}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
};

export default RoleRequestDetailsModal;
