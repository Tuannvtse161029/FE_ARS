import { useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { WithdrawalRequestItem } from '../../types/admin';
import styles from './AdminDialog.module.css';

interface Props {
  withdrawal: WithdrawalRequestItem | null;
  open: boolean;
  onClose: () => void;
}

const formatAmount = (amount: number, currency: string) =>
  `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
const formatTimestamp = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN') : '—';
const isValidReceiptUrl = (value?: string | null) => {
  if (!value) return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

export const WithdrawalDetailsModal = ({ withdrawal, open, onClose }: Props) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !withdrawal) return null;
  const currency = withdrawal.currency ?? 'VND';
  const hasReceipt = isValidReceiptUrl(withdrawal.proofReceiptUrl);
  // Reviewer's submission reason (Phase C defect 5). Service boundary
  // guarantees `requestReason` is set to either the reviewer's `note` value
  // or `null` — we never fall back to `note ?? reason ?? narrative` here.
  const trimmedRequestReason = withdrawal.requestReason?.trim() ?? '';
  const requestReasonText = trimmedRequestReason.length > 0
    ? trimmedRequestReason
    : 'No reason provided';

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="withdrawal-details-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.modal}>
        <header className={styles.header}>
          <div><h2 id="withdrawal-details-title" className={styles.title}>Withdrawal Details</h2><p className={styles.subtitle}>Transaction #{withdrawal.txId}</p></div>
          <button ref={closeRef} className={styles.iconButton} onClick={onClose} type="button" aria-label="Close withdrawal details"><X size={18} /></button>
        </header>
        <div className={styles.content}>
          <dl className={styles.detailsGrid}>
            <div><dt>Transaction ID</dt><dd>#{withdrawal.txId}</dd></div>
            <div><dt>Status</dt><dd>{withdrawal.status.replace('_', ' ')}</dd></div>
            <div><dt>Reviewer</dt><dd>{withdrawal.reviewerName}</dd></div>
            <div><dt>Reviewer ID</dt><dd>#{withdrawal.userId}</dd></div>
            <div><dt>Amount</dt><dd>{formatAmount(withdrawal.amountVnd, currency)}</dd></div>
            <div><dt>Currency</dt><dd>{currency}</dd></div>
            <div><dt>Bank</dt><dd>{withdrawal.bankName}</dd></div>
            <div><dt>Account number</dt><dd>{withdrawal.accountNumber}</dd></div>
            <div className={styles.fullWidth}><dt>Account holder</dt><dd>{withdrawal.accountName}</dd></div>
            <div><dt>Requested</dt><dd>{formatTimestamp(withdrawal.requestDate)}</dd></div>
            <div className={styles.fullWidth}>
              <dt>Request reason</dt>
              <dd>{requestReasonText}</dd>
            </div>
            <div><dt>Processing started</dt><dd>{formatTimestamp(withdrawal.processingAt)}</dd></div>
            <div><dt>Completed</dt><dd>{formatTimestamp(withdrawal.completedAt)}</dd></div>
            <div className={styles.fullWidth}><dt>Rejection reason</dt><dd>{withdrawal.rejectionReason ?? '—'}</dd></div>
            <div className={styles.fullWidth}>
              <dt>Transfer receipt</dt>
              <dd>{hasReceipt ? <a className={styles.textLink} href={withdrawal.proofReceiptUrl!} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} />View receipt</a> : '—'}</dd>
            </div>
          </dl>
        </div>
        <footer className={styles.footer}><button className={`${styles.button} ${styles.secondaryButton}`} onClick={onClose} type="button">Close</button></footer>
      </section>
    </div>
  );
};

export default WithdrawalDetailsModal;
