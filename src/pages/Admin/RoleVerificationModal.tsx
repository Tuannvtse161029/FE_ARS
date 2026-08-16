import { useEffect, useState } from 'react';
import { X, AlertTriangle, FileText } from 'lucide-react';
import PdfViewer from '../../components/PdfViewer';
import { adminService } from '../../services/admin.service';
import type { RoleRequest, RoleRequestStatus } from '../../types/admin';
import styles from './RoleVerificationModal.module.css';

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

const STATUS_CLASS: Record<RoleRequestStatus, string> = {
  PENDING: styles.badgePENDING,
  APPROVED: styles.badgeAPPROVED,
  DENIED: styles.badgeDENIED,
};

interface Props {
  request: RoleRequest | null;
  open: boolean;
  onClose: () => void;
  onActioned?: (updated: RoleRequest) => void;
}

export const RoleVerificationModal = ({ request, open, onClose, onActioned }: Props) => {
  const [notes, setNotes] = useState('');
  const [denyReason, setDenyReason] = useState('');
  const [showDeny, setShowDeny] = useState(false);
  const [submitting, setSubmitting] = useState<null | 'approve' | 'deny'>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when the modal opens for a new request.
  useEffect(() => {
    if (open) {
      setNotes('');
      setDenyReason('');
      setShowDeny(false);
      setError(null);
      setSubmitting(null);
    }
  }, [open, request?.id]);

  if (!open || !request) return null;

  const closeAfter = (updated: RoleRequest) => {
    onActioned?.(updated);
    onClose();
  };

  const handleApprove = async () => {
    setSubmitting('approve');
    setError(null);
    try {
      const updated = await adminService.decideRoleRequest(request.id, {
        status: 'APPROVED',
        notes: notes.trim() || undefined,
      });
      closeAfter(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve request.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleDeny = async () => {
    if (denyReason.trim().length < 10) {
      setError('Denial reason must be at least 10 characters.');
      return;
    }
    setSubmitting('deny');
    setError(null);
    try {
      const updated = await adminService.decideRoleRequest(request.id, {
        status: 'DENIED',
        notes: `${denyReason.trim()}${notes.trim() ? `\n\nInternal notes: ${notes.trim()}` : ''}`,
      });
      closeAfter(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deny request.');
    } finally {
      setSubmitting(null);
    }
  };

  const closeOnOverlay = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <div
      className={styles.overlay}
      onClick={closeOnOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Role request verification"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Role Request #{request.id}</span>
            <span className={styles.subtitle}>
              Submitted {new Date(request.submissionDate).toLocaleString('vi-VN')}
            </span>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            disabled={!!submitting}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Left pane — metadata + admin notes */}
          <div className={styles.left}>
            <div className={styles.userBlock}>
              <div className={styles.avatar}>{initialsOf(request.userName)}</div>
              <div>
                <div className={styles.userName}>{request.userName}</div>
                <div className={styles.userEmail}>{request.email}</div>
              </div>
            </div>

            <div className={styles.fields}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Account ID</span>
                <span className={styles.fieldValue}>{request.userId}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Phone</span>
                <span className={styles.fieldValue}>{request.phone ?? '—'}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Affiliation</span>
                <span className={styles.fieldValue}>{request.affiliation}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Department</span>
                <span className={styles.fieldValue}>{request.department}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Requested Roles</span>
                <div className={styles.rolesList}>
                  {request.requestedRoles.map((r) => (
                    <span key={r} className={styles.roleTag}>{r}</span>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Status</span>
                <div className={styles.statusRow}>
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[request.status]}`}>
                    {request.status}
                  </span>
                </div>
              </div>
              {request.notes && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Previous Notes</span>
                  <span className={styles.fieldValue}>{request.notes}</span>
                </div>
              )}
            </div>

            <div className={styles.notesBlock}>
              <label className={styles.notesLabel} htmlFor="verification-notes">
                Internal verification notes
              </label>
              <textarea
                id="verification-notes"
                className={styles.notesArea}
                placeholder="Optional: document your decision criteria, cross-checks, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1500}
                rows={4}
                disabled={!!submitting}
              />
            </div>
          </div>

          {/* Right pane — PDF viewer */}
          <div className={styles.right}>
            <div className={styles.docHeader}>
              <span className={styles.docLabel}>Proof Document</span>
              <a
                href={request.proofDocumentUrl}
                target="_blank"
                rel="noreferrer noopener"
                style={{ fontSize: '0.78rem', color: '#2563eb' }}
              >
                Open in new tab
              </a>
            </div>
            {request.proofDocumentUrl ? (
              <div className={styles.docViewer}>
                <PdfViewer url={request.proofDocumentUrl} />
              </div>
            ) : (
              <div className={styles.docError}>
                <FileText size={18} />
                <span>No proof document attached to this request.</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          {error && (
            <div className={styles.actionError}>
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}
          <button
            className={`${styles.btn} ${styles.cancelBtn}`}
            onClick={onClose}
            disabled={!!submitting}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`${styles.btn} ${styles.denyBtn}`}
            onClick={() => setShowDeny(true)}
            disabled={!!submitting || request.status !== 'PENDING'}
            type="button"
          >
            {submitting === 'deny' ? 'Denying…' : 'Deny Request'}
          </button>
          <button
            className={`${styles.btn} ${styles.approveBtn}`}
            onClick={() => void handleApprove()}
            disabled={!!submitting || request.status !== 'PENDING'}
            type="button"
          >
            {submitting === 'approve' ? 'Approving…' : 'Approve Role Request'}
          </button>
        </div>

        {showDeny && (
          <div
            className={styles.denyPrompt}
            onClick={() => (submitting ? undefined : setShowDeny(false))}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.denyCard} onClick={(e) => e.stopPropagation()}>
              <span className={styles.denyTitle}>Deny Role Request</span>
              <span className={styles.denyHint}>
                Tell the applicant why this request can't be approved. The reason is
                shared with them via notification.
              </span>
              <textarea
                className={styles.denyTextarea}
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Reason (min 10 characters)…"
                maxLength={1000}
                disabled={!!submitting}
              />
              <div className={styles.denyActions}>
                <button
                  className={`${styles.btn} ${styles.cancelBtn}`}
                  onClick={() => setShowDeny(false)}
                  disabled={!!submitting}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={`${styles.btn} ${styles.denyBtn}`}
                  onClick={() => void handleDeny()}
                  disabled={!!submitting || denyReason.trim().length < 10}
                  type="button"
                >
                  {submitting === 'deny' ? 'Denying…' : 'Confirm Deny'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleVerificationModal;
