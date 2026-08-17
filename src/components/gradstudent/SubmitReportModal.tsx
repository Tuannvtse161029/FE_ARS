import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import { useSubmitPhasedReport } from '../../hooks/useSubmitPhasedReport';
import styles from './SubmitReportModal.module.css';

// One modal for both fresh submissions and resubmissions; the caller picks
// the mode via `mode` (or the `resubmittingReport` prop). The state machine
// inside the hook handles every combination — the modal is just a renderer.

export interface SubmitReportModalProps {
  isOpen: boolean;
  // The target group + phase the student is submitting against.
  researchGroupId: number;
  groupMemberId?: number;
  // Phase identifier used in the Firebase folder path
  // (research-groups/{groupId}/phased-reports/{phaseKey}/{ts}_{name}).
  phaseKey: string;
  // Display title for the modal header (e.g. "Phase 2: Literature Review").
  phaseTitle: string;
  // Lecturer display name shown in the header subtitle.
  lecturerName?: string;
  // Resubmission context — when present, the modal is in "resubmit" mode.
  resubmittingReport?: SubmittedPhasedReport | null;
  isSubmitting: boolean;
  // Latest server-confirmed report after a successful submit/resubmit.
  // The page watches this to refresh the workspace table.
  lastSubmitted: SubmittedPhasedReport | null;
  onClose: () => void;
  onSubmitted: (report: SubmittedPhasedReport) => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,application/pdf';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export function SubmitReportModal({
  isOpen,
  researchGroupId,
  groupMemberId,
  phaseKey,
  phaseTitle,
  lecturerName,
  resubmittingReport,
  isSubmitting,
  lastSubmitted,
  onClose,
  onSubmitted,
}: SubmitReportModalProps): JSX.Element | null {
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedSize, setPickedSize] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const submitState = useSubmitPhasedReport();

  // Reset local state on every open AND on every mode switch.
  useEffect(() => {
    if (isOpen) {
      setPickedFile(null);
      setPickedSize(0);
      setValidationError(null);
      setShowSuccess(false);
      submitState.reset();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    // We intentionally re-key on the modal's open/mode so a stale file
    // picker from a previous milestone doesn't bleed into the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resubmittingReport?.id ?? null]);

  // Promote the hook's "successful submit" into the success view + parent.
  useEffect(() => {
    if (!isOpen) return;
    if (lastSubmitted && lastSubmitted.id > 0) {
      setShowSuccess(true);
      onSubmitted(lastSubmitted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSubmitted?.id ?? null]);

  if (!isOpen) return null;

  const handlePickFile = (file: File): void => {
    setValidationError(null);
    if (file.type !== 'application/pdf') {
      setValidationError('Only PDF files are accepted.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError('File exceeds the 10 MB limit.');
      return;
    }
    setPickedFile(file);
    setPickedSize(file.size);
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0];
    if (file) handlePickFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handlePickFile(file);
  };

  const handleRemoveFile = (): void => {
    setPickedFile(null);
    setPickedSize(0);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (): Promise<void> => {
    if (!pickedFile) {
      setValidationError('Please attach a PDF before submitting.');
      return;
    }
    const result = await submitState.submit(pickedFile, {
      researchGroupId,
      phaseKey,
      isResubmission: Boolean(resubmittingReport),
      previousReportId: resubmittingReport?.id,
      ...(typeof groupMemberId === 'number' ? { groupMemberId } : {}),
    });
    if (result) {
      // Success path is handled via the lastSubmitted effect above.
      setPickedFile(null);
      setPickedSize(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRetry = async (): Promise<void> => {
    if (!pickedFile) {
      setValidationError(
        'Please re-attach your PDF — the previous file is no longer available.',
      );
      return;
    }
    await handleSubmit();
  };

  const handleOverlayClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ): void => {
    if (event.target === event.currentTarget && !isSubmitting) onClose();
  };

  const isBusy =
    submitState.isUploading ||
    submitState.isSubmittingToServer ||
    isSubmitting;

  const errorMessage =
    validationError ??
    submitState.submitError?.message ??
    null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-report-title"
      onClick={handleOverlayClick}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="submit-report-title" className={styles.title}>
              {resubmittingReport
                ? `Resubmit revised report — ${phaseTitle}`
                : `Submit report — ${phaseTitle}`}
            </h2>
            <p className={styles.subtitle}>
              {lecturerName ? `Assigned by ${lecturerName} · ` : ''}
              Group #{researchGroupId} · {phaseKey}
              {resubmittingReport ? (
                <>
                  {' '}· Previous report #{resubmittingReport.id} (rejected)
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close"
            onClick={onClose}
            disabled={isBusy}
          >
            <X size={18} />
          </button>
        </header>

        {showSuccess ? (
          <div className={styles.successCard} role="status">
            <span className={styles.successIcon} aria-hidden>
              <CheckCircle2 size={28} />
            </span>
            <h3 className={styles.successTitle}>
              {resubmittingReport
                ? 'Resubmission recorded'
                : 'Submission recorded'}
            </h3>
            <p className={styles.successText}>
              Your report has been uploaded and submitted to the lecturer for
              review. You can close this dialog.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div
              className={styles.dropzone}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                onChange={handleInputChange}
                style={{ display: 'none' }}
                disabled={isBusy}
              />
              {!pickedFile ? (
                <div className={styles.dropzoneInner}>
                  <span className={styles.uploadIcon} aria-hidden>
                    <UploadCloud size={28} />
                  </span>
                  <span className={styles.dropzoneMain}>
                    Drag & drop your PDF here, or{' '}
                    <span className={styles.browseLink}>browse files</span>
                  </span>
                  <span className={styles.dropzoneSub}>
                    PDF only · Max 10 MB
                  </span>
                </div>
              ) : (
                <div className={styles.fileCard}>
                  <span className={styles.fileIcon} aria-hidden>
                    <FileText size={24} />
                  </span>
                  <div className={styles.fileMeta}>
                    <span className={styles.fileName}>{pickedFile.name}</span>
                    <span className={styles.fileSize}>
                      {formatBytes(pickedSize)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    aria-label="Remove attached file"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    disabled={isBusy}
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>

            {submitState.isUploading ? (
              <div className={styles.progressWrap} aria-live="polite">
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressBar}
                    style={{
                      width: `${Math.min(100, Math.max(0, submitState.uploadProgress))}%`,
                    }}
                  />
                </div>
                <span className={styles.progressLabel}>
                  <Loader2 size={14} className={styles.spin} />
                  Uploading to secure storage… {submitState.uploadProgress}%
                </span>
              </div>
            ) : null}

            {submitState.postUploadFailure ? (
              <div className={styles.recoverableError} role="alert">
                <span className={styles.recoverableIcon} aria-hidden>
                  <AlertCircle size={18} />
                </span>
                <div>
                  <p className={styles.recoverableTitle}>
                    Upload saved, but server submission failed
                  </p>
                  <p className={styles.recoverableBody}>
                    {submitState.postUploadFailure.errorMessage}. The PDF has
                    been kept in storage; click <strong>Retry</strong> to send
                    the metadata to the server without re-uploading the file.
                  </p>
                </div>
              </div>
            ) : null}

            {errorMessage && !submitState.postUploadFailure ? (
              <p className={styles.error} role="alert">
                <AlertCircle size={14} />
                <span>{errorMessage}</span>
              </p>
            ) : null}

            <footer className={styles.footer}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={isBusy}
              >
                Cancel
              </button>
              {submitState.postUploadFailure ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleRetry}
                  disabled={isBusy || !pickedFile}
                >
                  {submitState.isSubmittingToServer ? (
                    <>
                      <Loader2 size={14} className={styles.spin} />
                      Retrying…
                    </>
                  ) : (
                    'Retry submission'
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleSubmit}
                  disabled={isBusy || !pickedFile}
                >
                  {submitState.isUploading
                    ? 'Uploading…'
                    : submitState.isSubmittingToServer
                    ? 'Submitting…'
                    : resubmittingReport
                    ? 'Confirm resubmission'
                    : 'Confirm submission'}
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export default SubmitReportModal;