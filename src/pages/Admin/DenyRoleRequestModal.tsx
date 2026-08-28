import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import type { RoleRequest } from '../../types/admin';
import styles from './AdminDialog.module.css';

interface Props {
  request: RoleRequest | null;
  open: boolean;
  onClose: () => void;
  onActioned: (updated: RoleRequest) => void;
}

export const DenyRoleRequestModal = ({ request, open, onClose, onActioned }: Props) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setValidationError(null);
    setApiError(null);
    setSubmitting(false);
    window.setTimeout(() => reasonRef.current?.focus(), 0);
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
    const normalized = reason.trim();
    if (normalized.length < 10) {
      setValidationError('Denial reason must be at least 10 characters.');
      return;
    }
    setValidationError(null);
    setApiError(null);
    setSubmitting(true);
    try {
      const updated = await adminService.decideRoleRequest(
        request.id,
        { status: 'DENIED', notes: normalized },
        request.email,
      );
      onActioned(updated);
      onClose();
    } catch (submissionError) {
      setApiError(submissionError instanceof Error ? submissionError.message : 'Failed to deny request.');
    } finally {
      setSubmitting(false);
    }
  };

  const errorId = validationError ? 'deny-role-reason-error' : undefined;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="deny-role-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div><h2 id="deny-role-title" className={styles.title}>Deny Role Request</h2><p className={styles.subtitle}>Request #{request.id} · {request.userName}</p></div>
          <button className={styles.iconButton} onClick={onClose} disabled={submitting} type="button" aria-label="Close denial dialog"><X size={18} /></button>
        </header>
        <div className={styles.content}>
          <label className={styles.fieldLabel} htmlFor="role-denial-reason">Reason for denial</label>
          <textarea ref={reasonRef} id="role-denial-reason" className={styles.textarea} rows={6} minLength={10} maxLength={1000} required value={reason} onChange={(event) => { setReason(event.target.value); setValidationError(null); }} aria-invalid={Boolean(validationError)} aria-describedby={errorId} disabled={submitting} />
          <div className={styles.counter}>{reason.length} / 1,000</div>
          {validationError ? <p id={errorId} className={styles.error} role="alert"><AlertTriangle size={15} />{validationError}</p> : null}
          {apiError ? <p className={styles.error} role="alert"><AlertTriangle size={15} />{apiError}</p> : null}
        </div>
        <footer className={styles.footer}>
          <button className={`${styles.button} ${styles.secondaryButton}`} onClick={onClose} disabled={submitting} type="button">Cancel</button>
          <button className={`${styles.button} ${styles.dangerButton}`} disabled={submitting} type="submit"><X size={16} />{submitting ? 'Denying…' : 'Confirm Denial'}</button>
        </footer>
      </form>
    </div>
  );
};

export default DenyRoleRequestModal;
