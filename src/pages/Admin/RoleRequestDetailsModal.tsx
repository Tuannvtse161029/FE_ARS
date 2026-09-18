import { useEffect, useRef } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import LazyPdfViewer from '../../components/PdfViewer/LazyPdfViewer';
import { OrcidIdentityMarker } from '../../components/identity/OrcidIdentityMarker';
import type { RoleRequest, RoleRequestStatus } from '../../types/admin';
import { safeHref } from '../../utils/validationRules';
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
  const locale = useLocale();
  const intlTag = locale === 'en' ? 'en-US' : 'vi-VN';
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
    if (req.requestType === 'INITIAL_REGISTRATION') return t('admin.roleRequests.details.initialRegistration', 'Initial registration');
    if (req.requestType === 'ADDITIONAL_ROLE') return t('admin.roleRequests.details.additionalRole', 'Additional role');
    return t('admin.roleRequests.approve.unavailableApi', '—');
  };

  const rolesText = (roles?: string[]) =>
    roles ? (roles.length > 0 ? roles.join(', ') : t('admin.roleRequests.details.none')) : t('admin.roleRequests.approve.unavailableApi');

  /**
   * Resolve the requested-role display string for the "Requested role(s)"
   * row. The BE may surface the request in three different shapes:
   * `requestedAdditionalRoles` (array), `requestedRole` (singular
   * string for INITIAL_REGISTRATION rows), or the legacy `requestedRoles`
   * (array). Try each in order so an INITIAL_REGISTRATION row — e.g. a
   * freshly-registered Graduate Student — renders the role name instead
   * of an em-dash. Mirrors the helper used by the user-side
   * `roleRequest.service.ts::fetchPendingRequest` so the two views
   * never disagree about what role a row is asking for.
   */
  const requestedRolesForDisplay = (req: RoleRequest): string[] => {
    const additional = Array.isArray(req.requestedAdditionalRoles)
      ? req.requestedAdditionalRoles.filter((value) => typeof value === 'string' && value.length > 0)
      : [];
    if (additional.length > 0) return additional;
    if (typeof req.requestedRole === 'string' && req.requestedRole.trim().length > 0) {
      return [req.requestedRole];
    }
    const legacy = Array.isArray(req.requestedRoles)
      ? req.requestedRoles.filter((value) => typeof value === 'string' && value.length > 0)
      : [];
    return legacy;
  };

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
              {t('admin.roleRequests.details.submitted')} {request.submissionDate ? new Date(request.submissionDate).toLocaleString(intlTag) : t('admin.roleRequests.details.notSupplied')}
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
              <div><dt>{t('admin.roleRequests.details.initialCurrentRole')}</dt><dd>{rolesText(request.currentRoles)}</dd></div>
              <div><dt>{t('admin.roleRequests.details.requestedAdditionalRole')}</dt><dd>{rolesText(requestedRolesForDisplay(request))}</dd></div>
              <div><dt>{t('admin.roleRequests.details.requestType')}</dt><dd>{requestTypeLabel(request)}</dd></div>
              <div>
                <dt>{t('admin.roleRequests.details.status')}</dt>
                <dd><span className={`${styles.statusBadge} ${STATUS_CLASS[request.status]}`}>{t(`common.status.${request.status.toLowerCase()}`, request.status)}</span></dd>
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
                      <span>{t('admin.roleRequests.details.orcidLinked')} {new Date(request.orcidVerifiedAt).toLocaleDateString(intlTag)}</span>
                    ) : null}
                  </dd>
                ) : (
                  <dd className={styles.missing}>{t('admin.roleRequests.details.orcidMissing')}</dd>
                )}
                <p className={styles.identityDisclosure}>
                  {t('admin.roleRequests.details.orcidDisclosure')}
                </p>
              </div>
              {(request.openAlexId || request.semanticScholarId) ? (
                <div className={styles.fullWidth}>
                  <dt>{t('admin.roleRequests.details.academicIdentifier', 'Academic Scholarly Identifier')}</dt>
                  <dd style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    {request.openAlexId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink-secondary)' }}>{t('register.openAlexLabel', 'OpenAlex ID')}:</span>
                        <code>{request.openAlexId}</code>
                        {(() => {
                          const url = request.openAlexId.startsWith('http')
                            ? request.openAlexId
                            : `https://openalex.org/${request.openAlexId}`;
                          const safe = safeHref(url);
                          return safe ? (
                            <a
                              href={safe}
                              target="_blank"
                              rel="noreferrer noopener"
                              className={styles.textLink}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
                            >
                              <ExternalLink size={13} /> {t('admin.roleRequests.details.viewProfile', 'View Author Profile')}
                            </a>
                          ) : null;
                        })()}
                      </div>
                    ) : null}
                    {request.semanticScholarId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink-secondary)' }}>{t('register.semanticScholarLabel', 'Semantic Scholar ID')}:</span>
                        <code>{request.semanticScholarId}</code>
                        {(() => {
                          const url = request.semanticScholarId.startsWith('http')
                            ? request.semanticScholarId
                            : `https://www.semanticscholar.org/author/${request.semanticScholarId}`;
                          const safe = safeHref(url);
                          return safe ? (
                            <a
                              href={safe}
                              target="_blank"
                              rel="noreferrer noopener"
                              className={styles.textLink}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
                            >
                              <ExternalLink size={13} /> {t('admin.roleRequests.details.viewProfile', 'View Author Profile')}
                            </a>
                          ) : null;
                        })()}
                      </div>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {request.notes ? <div className={styles.fullWidth}><dt>{t('admin.roleRequests.details.decisionNotes')}</dt><dd>{request.notes}</dd></div> : null}
            </dl>
          </div>

          <div className={styles.documentPane}>
            <div className={styles.documentHeader}>
              <span>{t('admin.roleRequests.details.proofDocument')}</span>
              {request.proofDocumentUrl && safeHref(request.proofDocumentUrl) ? (
                <a href={safeHref(request.proofDocumentUrl) ?? '#'} target="_blank" rel="noreferrer noopener" className={styles.textLink}>
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
          <button className={`${styles.button} ${styles.secondaryButton}`} onClick={onClose} type="button">{t('common.close', 'Close')}</button>
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
