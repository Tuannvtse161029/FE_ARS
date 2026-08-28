import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import type { RoleRequest } from '../../types/admin';
import styles from './AdminDialog.module.css';

interface Props {
  request: RoleRequest | null;
  open: boolean;
  onClose: () => void;
  onActioned: (updated: RoleRequest) => void;
}

export const ApproveRoleRequestModal = ({ request, open, onClose, onActioned }: Props) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setNotes('');
    setError(null);
    setSubmitting(false);
    window.setTimeout(() => notesRef.current?.focus(), 0);
  }, [open, request?.id]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open || !request) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updated = await adminService.decideRoleRequest(
        request.id,
        {
          status: 'APPROVED',
          notes: notes.trim() || 'Hồ sơ hợp lệ',
        },
        request.email,
      );
      onActioned(updated);
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Failed to approve request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="approve-role-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="approve-role-title" className={styles.title}>Approve Role Request</h2>
            <p className={styles.subtitle}>Request #{request.id} · {request.userName}</p>
          </div>
          <button className={styles.iconButton} onClick={onClose} disabled={submitting} type="button" aria-label="Close approval dialog"><X size={18} /></button>
        </header>
        <div className={styles.content}>
          <div className={styles.summaryBox}>
            <span>Requested additional role</span>
            <strong>{request.requestedAdditionalRoles?.join(', ') || 'Unavailable from API'}</strong>
          </div>
          <label className={styles.fieldLabel} htmlFor="role-approval-notes">Internal verification notes (optional)</label>
          <textarea ref={notesRef} id="role-approval-notes" className={styles.textarea} rows={5} maxLength={1500} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={submitting} />
          <div className={styles.counter}>{notes.length} / 1,500</div>
          {error ? <p className={styles.error} role="alert"><AlertTriangle size={15} />{error}</p> : null}
        </div>
        <footer className={styles.footer}>
          <button className={`${styles.button} ${styles.secondaryButton}`} onClick={onClose} disabled={submitting} type="button">Cancel</button>
          <button className={`${styles.button} ${styles.primaryButton}`} disabled={submitting} type="submit"><Check size={16} />{submitting ? 'Approving…' : 'Confirm Approval'}</button>
        </footer>
      </form>
    </div>
  );
};

export default ApproveRoleRequestModal;
