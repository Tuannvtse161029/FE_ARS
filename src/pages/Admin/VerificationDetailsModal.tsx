import { useEffect, useRef } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import LazyPdfViewer from '../../components/PdfViewer/LazyPdfViewer';
import type { User } from '../../types/auth';
import { displayAccountTier } from '../../services/user.service';
import styles from './AdminDialog.module.css';

interface Props {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

// Read-only details modal for the User-driven Role Requests page (Agent 40).
// The original `RoleRequestDetailsModal` rendered `RoleRequest`-shaped rows
// from the now-removed `/api/RoleRequest` endpoint. This version reads
// from the live `/api/User` response and shows the proof document via the
// existing `PdfViewer`. Accept / Reject buttons are intentionally absent —
// the BE does not yet expose a verification mutation (BTR-AGENT29-C).
export const VerificationDetailsModal = ({
  user,
  open,
  onClose,
}: Props) => {
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

  if (!open || !user) return null;

  const proofUrl = user.proofDocumentUrl ?? null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="verification-details-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={`${styles.modal} ${styles.wideModal}`}>
        <header className={styles.header}>
          <div>
            <h2 id="verification-details-title" className={styles.title}>
              {t('admin.roleRequests.details.title').replace('{id}', String(user.id))}
            </h2>
            <p className={styles.subtitle}>
              {t('admin.roleRequests.details.submitted')} {user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : '—'}
            </p>
          </div>
          <button ref={closeRef} className={styles.iconButton} onClick={onClose} type="button" aria-label={t('admin.roleRequests.details.closeLabel')}>
            <X size={18} />
          </button>
        </header>

        <div className={styles.splitBody}>
          <div className={styles.content}>
            <dl className={styles.detailsGrid}>
              <div><dt>{t('admin.roleRequests.details.fullName')}</dt><dd>{user.fullName || '—'}</dd></div>
              <div><dt>{t('admin.roleRequests.details.email')}</dt><dd>{user.email}</dd></div>
              <div><dt>{t('admin.roleRequests.details.emailVerified')}</dt><dd>{user.isEmailVerified ? t('admin.roleRequests.table.emailVerified') : t('admin.roleRequests.table.emailNotVerified')}</dd></div>
              <div><dt>{t('admin.roleRequests.details.businessRole')}</dt><dd>{user.roleName ?? t('admin.roleRequests.table.pendingRole')}</dd></div>
              <div><dt>{t('admin.roleRequests.details.accountTier')}</dt><dd>{displayAccountTier(user.accountTier)}</dd></div>
              <div><dt>{t('admin.roleRequests.details.verificationStatus')}</dt><dd>{user.verificationStatus ? t(`common.status.${user.verificationStatus.toLowerCase()}`) : t('common.status.pending')}</dd></div>
              <div><dt>{t('admin.roleRequests.details.accountActive')}</dt><dd>{user.isActive ? t('admin.accounts.filter.status.active') : t('admin.accounts.filter.status.suspended')}</dd></div>
              <div className={styles.fullWidth}>
                <dt>{t('admin.roleRequests.details.orcid')}</dt>
                <dd className={styles.missing}>{t('admin.roleRequests.details.orcidMissing')}</dd>
                <p className={styles.identityDisclosure}>
                  {t('admin.roleRequests.details.orcidDisclosure')}
                </p>
              </div>
              <div><dt>{t('admin.roleRequests.details.created')}</dt><dd>{user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : '—'}</dd></div>
            </dl>
          </div>

          <div className={styles.documentPane}>
            <div className={styles.documentHeader}>
              <span>{t('admin.roleRequests.details.proofDocument')}</span>
              {proofUrl ? (
                <a href={proofUrl} target="_blank" rel="noreferrer noopener" className={styles.textLink}>
                  <ExternalLink size={14} /> {t('admin.roleRequests.details.openNewTab')}
                </a>
              ) : null}
            </div>
            {proofUrl ? (
              <div className={styles.documentViewer}>
                <LazyPdfViewer url={proofUrl} />
              </div>
            ) : (
              <div className={styles.emptyDocument}>
                <FileText size={22} />
                <span>{t('admin.roleRequests.details.noProofDocument')}</span>
              </div>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <button className={`${styles.button} ${styles.secondaryButton}`} onClick={onClose} type="button">
            {t('common.cancel')}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default VerificationDetailsModal;