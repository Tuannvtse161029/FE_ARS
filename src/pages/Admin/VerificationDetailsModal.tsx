import { useEffect, useRef } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import PdfViewer from '../../components/PdfViewer';
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
export const VerificationDetailsModal = ({ user, open, onClose }: Props) => {
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
              User #{user.id}
            </h2>
            <p className={styles.subtitle}>
              Submitted {user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : '—'}
            </p>
          </div>
          <button ref={closeRef} className={styles.iconButton} onClick={onClose} type="button" aria-label="Close details dialog">
            <X size={18} />
          </button>
        </header>

        <div className={styles.splitBody}>
          <div className={styles.content}>
            <dl className={styles.detailsGrid}>
              <div><dt>Full name</dt><dd>{user.fullName || '—'}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Email verification</dt><dd>{user.isEmailVerified ? 'Verified' : 'Not verified'}</dd></div>
              <div><dt>Business role</dt><dd>{user.roleName ?? 'Pending role assignment'}</dd></div>
              <div><dt>Account tier</dt><dd>{displayAccountTier(user.accountTier)}</dd></div>
              <div><dt>Verification status</dt><dd>{user.verificationStatus ?? 'Pending'}</dd></div>
              <div><dt>Account active</dt><dd>{user.isActive ? 'Active' : 'Suspended'}</dd></div>
              <div><dt>Created</dt><dd>{user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : '—'}</dd></div>
            </dl>
          </div>

          <div className={styles.documentPane}>
            <div className={styles.documentHeader}>
              <span>Proof document</span>
              {proofUrl ? (
                <a href={proofUrl} target="_blank" rel="noreferrer noopener" className={styles.textLink}>
                  <ExternalLink size={14} /> Open in new tab
                </a>
              ) : null}
            </div>
            {proofUrl ? (
              <div className={styles.documentViewer}>
                <PdfViewer url={proofUrl} />
              </div>
            ) : (
              <div className={styles.emptyDocument}>
                <FileText size={22} />
                <span>No proof document available.</span>
              </div>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <button className={`${styles.button} ${styles.secondaryButton}`} onClick={onClose} type="button">
            Close
          </button>
        </footer>
      </section>
    </div>
  );
};

export default VerificationDetailsModal;