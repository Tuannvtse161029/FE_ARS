import { useCallback, useState } from 'react';
import { AlertTriangle, FileText, Upload, X } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import type { WithdrawalRequestItem } from '../../types/admin';
import { useReceiptUpload } from '../../hooks/useReceiptUpload';
import styles from './ApprovePayoutModal.module.css';

interface Props {
  withdrawal: WithdrawalRequestItem | null;
  open: boolean;
  onClose: () => void;
  onCompleted?: (updated: WithdrawalRequestItem) => void;
}

const formatAmount = (amountVnd: number) =>
  new Intl.NumberFormat('vi-VN').format(amountVnd);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const ACCEPT_ATTR = 'application/pdf,image/png,image/jpeg';

export const ApprovePayoutModal = ({ withdrawal, open, onClose, onCompleted }: Props) => {
  const [step, setStep] = useState<'upload' | 'submitting' | 'done'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { draft, isUploading, progress, error: uploadError, selectFile, reset, upload } =
    useReceiptUpload();

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      selectFile(files[0]);
    },
    [selectFile],
  );

  const handleConfirm = async () => {
    if (!withdrawal) return;
    setStep('submitting');
    setError(null);
    try {
      const url = await upload();
      const updated = await adminService.completeWithdrawal(
        withdrawal.txId,
        url,
        withdrawal.userId,
        withdrawal.reviewerName,
        withdrawal.amountVnd,
      );
      setStep('done');
      onCompleted?.(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete payout.');
      setStep('upload');
    }
  };

  const closeAfter = () => {
    setStep('upload');
    setError(null);
    reset();
    onClose();
  };

  if (!open || !withdrawal) return null;

  return (
    <div
      className={styles.overlay}
      onClick={() => (step === 'submitting' ? undefined : closeAfter())}
      role="dialog"
      aria-modal="true"
      aria-label="Approve reviewer payout"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Approve & Pay Payout</span>
            <span className={styles.subtitle}>
              Transaction #{String(withdrawal.txId).padStart(4, '0')} · {withdrawal.bankName}
            </span>
          </div>
          <button
            className={styles.closeBtn}
            onClick={closeAfter}
            disabled={step === 'submitting'}
            type="button"
            aria-label="Close approve payout modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Beneficiary summary */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Beneficiary</span>
              <span className={styles.summaryValue}>{withdrawal.reviewerName}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Amount</span>
              <span className={`${styles.summaryValue} ${styles.amountHighlight}`}>
                {formatAmount(withdrawal.amountVnd)} VND
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Bank Account</span>
              <span className={styles.summaryValue}>
                {withdrawal.bankName} · {withdrawal.accountNumber}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Account Name</span>
              <span className={styles.summaryValue}>{withdrawal.accountName}</span>
            </div>
            <div className={styles.summaryItem} style={{ gridColumn: '1 / -1' }}>
              <span className={styles.summaryLabel}>Request Date</span>
              <span className={styles.summaryValue}>{formatDate(withdrawal.requestDate)}</span>
            </div>
          </div>

          {/* Receipt uploader */}
          <div>
            <span className={styles.uploadLabel}>Attach Bank Transfer Receipt</span>
            <p className={styles.uploadHint}>
              Required. Upload a screenshot or PDF of your bank's transfer confirmation.
              The receipt is sent to the reviewer and stored for audit.
            </p>
          </div>

          {!draft ? (
            <label
              className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              htmlFor="receipt-input"
            >
              <Upload size={28} className={styles.dropzoneIcon} />
              <span className={styles.dropzoneText}>
                Drag & drop a file, or <span style={{ color: '#2563eb' }}>browse</span>
              </span>
              <span className={styles.dropzoneSubtext}>
                PDF, PNG, or JPG · up to 10 MB
              </span>
              <input
                id="receipt-input"
                type="file"
                accept={ACCEPT_ATTR}
                onChange={(e) => handleFiles(e.target.files)}
                style={{ display: 'none' }}
              />
            </label>
          ) : (
            <div>
              <div className={styles.previewRow}>
                {draft.kind === 'image' ? (
                  <img
                    src={draft.previewUrl}
                    alt={draft.file.name}
                    className={styles.previewImage}
                  />
                ) : (
                  <div className={styles.previewPdf}>PDF</div>
                )}
                <div className={styles.previewMeta}>
                  <span className={styles.previewName}>{draft.file.name}</span>
                  <span className={styles.previewSize}>
                    {(draft.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button
                  className={styles.removeBtn}
                  onClick={() => reset()}
                  disabled={isUploading || step === 'submitting'}
                  type="button"
                  aria-label="Remove selected receipt"
                >
                  <X size={14} />
                </button>
              </div>
              {isUploading && (
                <div className={styles.progressBar} style={{ marginTop: 8 }}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {(uploadError || error) && (
            <div className={styles.errorBox}>
              <AlertTriangle size={14} />
              <span>{uploadError ?? error}</span>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.btn} ${styles.cancelBtn}`}
            onClick={closeAfter}
            disabled={step === 'submitting'}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.confirmBtn}`}
            onClick={() => void handleConfirm()}
            disabled={!draft || step === 'submitting'}
          >
            {step === 'submitting' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> Sending…
              </span>
            ) : (
              'Confirm Transfer & Send Proof'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovePayoutModal;
