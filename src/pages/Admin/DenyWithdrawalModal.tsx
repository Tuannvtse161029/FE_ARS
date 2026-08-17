import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import type { WithdrawalRequestItem } from '../../types/admin';
import styles from './AdminDialog.module.css';

interface Props {
  withdrawal: WithdrawalRequestItem | null;
  open: boolean;
  onClose: () => void;
  onDenied: (updated: WithdrawalRequestItem) => void;
}

export const DenyWithdrawalModal = ({ withdrawal, open, onClose, onDenied }: Props) => {
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
  }, [open, withdrawal?.txId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open || !withdrawal) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = reason.trim();
    if (normalized.length < 10) {
      setValidationError('Denial reason must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setValidationError(null);
    setApiError(null);
    try {
      const updated = await adminService.denyWithdrawal(withdrawal.txId, normalized);
      onDenied(updated);
      onClose();
    } catch (submissionError) {
      setApiError(submissionError instanceof Error ? submissionError.message : 'Failed to deny withdrawal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="deny-withdrawal-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div><h2 id="deny-withdrawal-title" className={styles.title}>Deny Withdrawal</h2><p className={styles.subtitle}>Transaction #{withdrawal.txId}</p></div>
          <button className={styles.iconButton} onClick={onClose} disabled={submitting} type="button" aria-label="Close withdrawal denial"><X size={18} /></button>
        </header>
        <div className={styles.content}>
          <div className={styles.summaryBox}>
            <span>Reviewer</span><strong>{withdrawal.reviewerName} (ID #{withdrawal.userId})</strong>
            <span>Amount</span><strong>{new Intl.NumberFormat('vi-VN').format(withdrawal.amountVnd)} {withdrawal.currency ?? 'VND'}</strong>
            <span>Bank</span><strong>{withdrawal.bankName} · {withdrawal.accountNumber} · {withdrawal.accountName}</strong>
          </div>
          <label className={styles.fieldLabel} htmlFor="withdrawal-denial-reason">Reason for denial</label>
          <textarea ref={reasonRef} id="withdrawal-denial-reason" className={styles.textarea} rows={6} minLength={10} maxLength={1000} required value={reason} onChange={(event) => { setReason(event.target.value); setValidationError(null); }} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? 'withdrawal-denial-error' : undefined} disabled={submitting} />
          <div className={styles.counter}>{reason.length} / 1,000</div>
          {validationError ? <p id="withdrawal-denial-error" className={styles.error} role="alert"><AlertTriangle size={15} />{validationError}</p> : null}
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

export default DenyWithdrawalModal;
