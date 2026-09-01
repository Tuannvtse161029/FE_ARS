// AudioSummaryModal — upload MP4, trigger AI summarization, display result.
//
// Props:
//   seminarId  — the seminar to attach the summary to
//   seminarTitle — display name for the seminar
//   isOpen     — controls modal visibility
//   onClose    — called when the modal should close
//   onSuccess  — called with the response after a successful upload

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Loader,
  AlertTriangle,
  Copy,
  Sparkles,
  Film,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { useSeminarAudio } from '../../hooks/useSeminarAudio';
import styles from './AudioSummaryModal.module.css';

interface AudioSummaryModalProps {
  seminarId: number;
  seminarTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (seminarId: number) => void;
}

const MAX_SIZE_MB = 500;

export const AudioSummaryModal = ({
  seminarId,
  seminarTitle,
  isOpen,
  onClose,
  onSuccess,
}: AudioSummaryModalProps) => {
  const { summarize, status, progress, result, error, reset } = useSeminarAudio();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      reset();
      setSelectedFile(null);
      setCopied(false);
    }
  }, [isOpen, reset]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── File selection helpers ──────────────────────────────────────────────────

  const handleFileChange = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.includes('mp4') && !file.type.includes('mpeg')) {
      alert('Only MP4 files are supported.');
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      handleFileChange(file);
    },
    [handleFileChange]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleBrowseClick = () => fileInputRef.current?.click();

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // ── Upload trigger ──────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      const response = await summarize(seminarId, selectedFile);
      onSuccess?.(seminarId);
      void response; // unused — result is in state
    } catch {
      // error handled by hook
    }
  };

  // ── Copy summary ────────────────────────────────────────────────────────────

  const handleCopy = () => {
    if (!result?.aiSummary) return;
    void navigator.clipboard.writeText(result.aiSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const isUploading = status === 'validating' || status === 'uploading' || status === 'processing';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const hasFile = selectedFile != null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="ai-modal-title">
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeaderRow}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.aiIconCircle}>
              <Sparkles size={18} aria-hidden />
            </span>
            <div>
              <h3 className={styles.modalTitle} id="ai-modal-title">Meeting Summary</h3>
              <span className={styles.modalSubtitle}>{seminarTitle}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Content */}
        <div className={styles.contentArea}>
          {/* ── Idle / File selection ───────────────────────────────────────── */}
          {status === 'idle' && (
            <>
              <div
                className={`${styles.dropzone} ${dragOver ? styles.dropzoneDragOver : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleBrowseClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleBrowseClick()}
                aria-label="Drop zone for video upload"
              >
                <Film size={32} className={styles.dropzoneIcon} aria-hidden />
                <p className={styles.dropzoneMain}>Drag &amp; drop your meeting recording here</p>
                <p className={styles.dropzoneSub}>
                  or <span className={styles.browseLink}>browse files</span>
                </p>
                <p className={styles.dropzoneConstraints}>
                  Format: MP4 · Max size: {MAX_SIZE_MB} MB · Max duration: 2 hours
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/mpeg"
                className={styles.hiddenFileInput}
                onChange={(e) => handleFileChange(e.target.files?.[0])}
                aria-label="Select video file"
              />

              {/* Selected file preview */}
              {hasFile && (
                <div className={styles.fileCard}>
                  <Film size={20} className={styles.fileIcon} aria-hidden />
                  <div className={styles.fileMeta}>
                    <span className={styles.fileName}>{selectedFile!.name}</span>
                    <span className={styles.fileSize}>{formatBytes(selectedFile!.size)}</span>
                  </div>
                  <button
                    className={styles.removeFileBtn}
                    onClick={() => setSelectedFile(null)}
                    aria-label="Remove selected file"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Uploading / Processing ────────────────────────────────────────── */}
          {isUploading && (
            <div className={styles.progressArea}>
              <div className={styles.progressHeader}>
                <Loader size={20} className={styles.spinningIcon} aria-hidden />
                <span className={styles.progressLabel}>
                  {status === 'validating' && 'Validating file…'}
                  {status === 'uploading' && `Uploading… ${progress}%`}
                  {status === 'processing' && 'Processing audio with AI…'}
                </span>
              </div>
              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${status === 'validating' ? 0 : progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <p className={styles.progressSub}>
                {status === 'validating' && 'Checking file type, size, and duration…'}
                {status === 'uploading' && 'Please keep this tab open.'}
                {status === 'processing' && 'Extracting audio, generating summary…'}
              </p>
            </div>
          )}

          {/* ── Completed ────────────────────────────────────────────────────── */}
          {isCompleted && result?.aiSummary && (
            <div className={styles.resultArea}>
              <div className={styles.resultHeader}>
                <span className={styles.aiResultBadge}>
                  <Sparkles size={12} aria-hidden />
                  AI Generated
                </span>
                <button className={styles.copyBtn} onClick={handleCopy} aria-label="Copy summary">
                  <Copy size={14} aria-hidden />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className={styles.summaryText}>{result.aiSummary}</pre>
              <div className={styles.disclaimer}>
                <AlertTriangle size={12} aria-hidden />
                AI-generated content — review for accuracy before sharing.
              </div>
            </div>
          )}

          {isCompleted && !result?.aiSummary && (
            <div className={styles.emptyResult}>
              <AlertTriangle size={20} aria-hidden />
              <p>No summary was generated. Please try uploading again or contact support.</p>
            </div>
          )}

          {/* ── Failed ───────────────────────────────────────────────────────── */}
          {isFailed && (
            <div className={styles.errorArea}>
              <AlertTriangle size={24} className={styles.errorIcon} aria-hidden />
              <p className={styles.errorMessage}>{error ?? 'An unexpected error occurred.'}</p>
              <button
                className={styles.retryBtn}
                onClick={() => {
                  reset();
                  setSelectedFile(null);
                }}
              >
                <RotateCcw size={14} aria-hidden />
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {status === 'idle' && (
            <>
              <button className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                className={styles.submitBtn}
                onClick={handleUpload}
                disabled={!hasFile || isUploading}
              >
                <Upload size={14} aria-hidden />
                Upload &amp; Summarize
              </button>
            </>
          )}

          {(isUploading || isCompleted || isFailed) && (
            <>
              {isCompleted && (
                <button
                  className={styles.submitBtn}
                  onClick={() => {
                    reset();
                    setSelectedFile(null);
                  }}
                >
                  <Upload size={14} aria-hidden />
                  Upload Another
                </button>
              )}
              <button className={styles.cancelBtn} onClick={onClose}>
                {isUploading ? 'Cancel' : 'Close'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioSummaryModal;
