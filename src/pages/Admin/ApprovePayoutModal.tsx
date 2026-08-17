import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileText, Upload, X } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import type { WithdrawalRequestItem, WithdrawalStatus } from '../../types/admin';
import { useReceiptUpload } from '../../hooks/useReceiptUpload';
import styles from './ApprovePayoutModal.module.css';

interface Props {
  withdrawal: WithdrawalRequestItem | null;
  open: boolean;
  onClose: () => void;
  onCompleted?: (updated: WithdrawalRequestItem) => void;
}

const ACCEPT_ATTR = 'application/pdf,image/png,image/jpeg';
const formatAmount = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);
const formatDate = (iso: string) => new Date(iso).toLocaleString('vi-VN');

export const ApprovePayoutModal = ({ withdrawal, open, onClose, onCompleted }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [serverStatus, setServerStatus] = useState<WithdrawalStatus>('PENDING');
  const closeRef = useRef<HTMLButtonElement>(null);
  const { draft, isUploading, progress, error: uploadError, uploadedUrl, selectFile, reset, upload } = useReceiptUpload();

  useEffect(() => {
    if (!open || !withdrawal) return;
    setError(null);
    setSubmitting(false);
    setServerStatus(withdrawal.status);
    window.setTimeout(() => closeRef.current?.focus(), 0);
  }, [open, withdrawal?.txId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && !isUploading) handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  const handleFiles = useCallback((files: FileList | null) => {
    if (files?.[0]) selectFile(files[0]);
  }, [selectFile]);

  const handleClose = () => {
    if (submitting || isUploading) return;
    setError(null);
    setIsDragging(false);
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    if (!withdrawal) return;
    setSubmitting(true);
    setError(null);
    let receiptUrl = uploadedUrl;
    try {
      receiptUrl ??= await upload();
      let effectiveStatus = serverStatus;
      if (effectiveStatus === 'PENDING') {
        const processing = await adminService.markWithdrawalProcessing(withdrawal.txId);
        effectiveStatus = processing.status;
        setServerStatus(processing.status);
        onCompleted?.(processing);
      }
      if (effectiveStatus !== 'ACCEPTED_PROCESSING') {
        throw new Error(`Cannot complete a withdrawal with status ${effectiveStatus}. Refresh and try again.`);
      }
      const completed = await adminService.completeWithdrawal(
        withdrawal.txId,
        receiptUrl,
        withdrawal.userId,
        withdrawal.reviewerName,
        withdrawal.amountVnd,
      );
      setServerStatus(completed.status);
      onCompleted?.(completed);
      reset();
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? `${submissionError.message}${receiptUrl ? ' The receipt is already uploaded; retry will reuse it.' : ''}`
          : 'Failed to complete payout. No completed status was recorded.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !withdrawal) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="approve-payout-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget) handleClose();
    }}>
      <section className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 id="approve-payout-title" className={styles.title}>{withdrawal.status === 'PENDING' ? 'Approve & Pay Payout' : 'Complete Transfer'}</h2>
            <span className={styles.subtitle}>Transaction #{String(withdrawal.txId).padStart(4, '0')} · {withdrawal.bankName}</span>
          </div>
          <button ref={closeRef} className={styles.closeBtn} onClick={handleClose} disabled={submitting || isUploading} type="button" aria-label="Close approve payout modal"><X size={16} /></button>
        </header>

        <div className={styles.body}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryItem}><span className={styles.summaryLabel}>Beneficiary</span><span className={styles.summaryValue}>{withdrawal.reviewerName}</span></div>
            <div className={styles.summaryItem}><span className={styles.summaryLabel}>Amount</span><span className={`${styles.summaryValue} ${styles.amountHighlight}`}>{formatAmount(withdrawal.amountVnd)} {withdrawal.currency ?? 'VND'}</span></div>
            <div className={styles.summaryItem}><span className={styles.summaryLabel}>Bank Account</span><span className={styles.summaryValue}>{withdrawal.bankName} · {withdrawal.accountNumber}</span></div>
            <div className={styles.summaryItem}><span className={styles.summaryLabel}>Account Name</span><span className={styles.summaryValue}>{withdrawal.accountName}</span></div>
            <div className={`${styles.summaryItem} ${styles.summaryItemFull}`}><span className={styles.summaryLabel}>Request Date</span><span className={styles.summaryValue}>{formatDate(withdrawal.requestDate)}</span></div>
          </div>

          <div><label className={styles.uploadLabel} htmlFor="receipt-input">Bank transfer receipt</label><p className={styles.uploadHint}>Required. Upload a PDF, PNG, or JPG bank transfer confirmation, then confirm the final operation.</p></div>
          {!draft ? (
            <label className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleFiles(event.dataTransfer.files); }} htmlFor="receipt-input">
              <Upload size={28} className={styles.dropzoneIcon} />
              <span className={styles.dropzoneText}>Drag and drop a file, or <span className={styles.browseText}>browse</span></span>
              <span className={styles.dropzoneSubtext}>PDF, PNG, or JPG · up to 10 MB</span>
              <input id="receipt-input" className={styles.fileInput} type="file" accept={ACCEPT_ATTR} onChange={(event) => handleFiles(event.target.files)} />
            </label>
          ) : (
            <div>
              <div className={styles.previewRow}>
                {draft.kind === 'image' ? <img src={draft.previewUrl} alt={`Preview of ${draft.file.name}`} className={styles.previewImage} /> : <div className={styles.previewPdf}>PDF</div>}
                <div className={styles.previewMeta}><span className={styles.previewName}>{draft.file.name}</span><span className={styles.previewSize}>{(draft.sizeBytes / 1024).toFixed(1)} KB{uploadedUrl ? ' · Uploaded' : ''}</span></div>
                <button className={styles.removeBtn} onClick={reset} disabled={isUploading || submitting} type="button" aria-label="Remove selected receipt"><X size={14} /></button>
              </div>
              {isUploading ? <progress className={`${styles.progressBar} ${styles.progressSpacing}`} value={progress} max={100} aria-label="Receipt upload progress" /> : null}
            </div>
          )}
          {(uploadError || error) ? <div className={styles.errorBox} role="alert"><AlertTriangle size={14} /><span>{uploadError ?? error}</span></div> : null}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={`${styles.btn} ${styles.cancelBtn}`} onClick={handleClose} disabled={submitting || isUploading}>Cancel</button>
          <button type="button" className={`${styles.btn} ${styles.confirmBtn}`} onClick={() => void handleConfirm()} disabled={!draft || submitting || isUploading}>
            {submitting ? <span className={styles.sendingLabel}><FileText size={14} />Completing…</span> : 'Confirm Transfer & Send Proof'}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default ApprovePayoutModal;
