// AudioSummaryModal — upload MP4, trigger AI summarization, display result.
//
// Props:
//   seminarId          — the seminar to attach the summary to
//   seminarTitle       — display name for the seminar
//   isOpen             — controls modal visibility
//   onClose            — called when the modal should close
//   onSuccess          — called after a successful upload (BE has persisted
//                        the summary into Seminars.aiSummary — no extra save
//                        step is needed; ticket §37 explicitly removes the
//                        legacy `PUT /api/Seminar/{id}/ai-summary` flow)
//   initialAiSummary   — the summary already stored on the BE (from
//                        `GET /api/Seminar/{id}`). When non-empty, the modal
//                        opens directly in summary view so the user does not
//                        need to re-upload their video just to view it.
//
// Ticket references: §34-§37 (canonical summarize-audio flow, 409 replace
// confirm, removal of the standalone save endpoint).

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
  CheckCircle2,
} from 'lucide-react';
import { useSeminarAudio } from '../../hooks/useSeminarAudio';
import styles from './AudioSummaryModal.module.css';

interface AudioSummaryModalProps {
  seminarId: number;
  seminarTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (seminarId: number) => void;
  /** Pre-existing AI summary text returned by GET /api/Seminar/{id}. */
  initialAiSummary?: string | null;
}

const MAX_SIZE_MB = 500;

type ViewMode = 'summary' | 'upload';

export const AudioSummaryModal = ({
  seminarId,
  seminarTitle,
  isOpen,
  onClose,
  onSuccess,
  initialAiSummary = null,
}: AudioSummaryModalProps) => {
  const { summarize, status, progress, result, error, reset } = useSeminarAudio();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialAiSummary ? 'summary' : 'upload',
  );
  /**
   * Track whether the host has confirmed the AI-summary replacement.
   * Per ticket §36 the BE rejects the second upload with HTTP 409; the FE
   * shows an in-modal confirm and only sends `ReplaceExisting=true` once
   * the host clicks "Replace summary".
   */
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  /** Inline confirm-modal controller (avoids native `window.confirm`). */
  const [replacePrompt, setReplacePrompt] = useState<{ open: boolean }>({
    open: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // `true` when the seminar already had an AI summary when the modal
  // opened. Drives the dropzone warning + replace-prompt on upload.
  const hadInitialSummary = Boolean(initialAiSummary);

  // ── Reset state when modal opens ──────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      reset();
      setSelectedFile(null);
      setCopied(false);
      setReplaceConfirmed(false);
      setViewMode(initialAiSummary ? 'summary' : 'upload');
    }
  }, [isOpen, initialAiSummary, reset]);

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
    // Native alert() is fine here — this is a transient validation prompt
    // for an obviously wrong file type, not a destructive confirmation.
    if (!file.type.includes('mp4') && !file.type.includes('mpeg')) {
      window.alert('Only MP4 files are supported.');
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
    [handleFileChange],
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

  // ── 409 Conflict handling ──────────────────────────────────────────────────
  // The BE error has the shape `{ code: 'SUMMARY_ALREADY_EXISTS', message }`
  // (ticket §36). When we see it we open the inline replace prompt; only
  // after the host confirms do we re-call `summarize()` with
  // `ReplaceExisting=true`. Native `window.confirm` is explicitly avoided.

  const trySummarize = useCallback(
    async (replaceExisting: boolean) => {
      if (!selectedFile) return;
      try {
        await summarize(seminarId, selectedFile, { replaceExisting });
        // Success — the BE persists `Seminars.aiSummary` itself
        // (ticket §35), so there's no separate save step.
        setViewMode('summary');
        onSuccess?.(seminarId);
      } catch {
        // Error is surfaced by the hook via `error` state.
      }
    },
    [seminarId, selectedFile, summarize, onSuccess],
  );

  const handleUpload = async () => {
    if (!selectedFile) return;
    // If we already had an initial summary AND the host confirmed replacement
    // in the inline confirm-modal — or the upload is fresh — go ahead.
    if (hadInitialSummary && !replaceConfirmed) {
      // Show the in-modal replacement prompt (NOT a native `window.confirm`).
      setReplacePrompt({ open: true });
      return;
    }
    await trySummarize(true);
  };

  const acceptReplace = async () => {
    setReplaceConfirmed(true);
    setReplacePrompt({ open: false });
    await trySummarize(true);
  };

  // ── Copy summary ────────────────────────────────────────────────────────────

  const handleCopy = () => {
    const text = result?.aiSummary ?? initialAiSummary;
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── View-mode toggles ──────────────────────────────────────────────────────

  const switchToUpload = useCallback(() => {
    reset();
    setSelectedFile(null);
    setReplaceConfirmed(false);
    setViewMode('upload');
  }, [reset]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const isUploading =
    status === 'validating' ||
    status === 'uploading' ||
    status === 'processing';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const hasFile = selectedFile != null;

  // Summary text priority: freshly generated result > pre-existing summary.
  const displayedSummary = result?.aiSummary ?? initialAiSummary ?? null;
  const showSummaryView =
    (isCompleted && displayedSummary) ||
    (status === 'idle' && viewMode === 'summary' && displayedSummary);
  const showUploadView = status === 'idle' && viewMode === 'upload';

  // Did the BE just 409 us?
  const is409 =
    isFailed &&
    (error ?? '').toLowerCase().includes('summary_already_exists');

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
    >
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeaderRow}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.aiIconCircle}>
              <Sparkles size={18} aria-hidden />
            </span>
            <div>
              <h3 className={styles.modalTitle} id="ai-modal-title">
                Meeting Summary
              </h3>
              <span className={styles.modalSubtitle}>{seminarTitle}</span>
            </div>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Content */}
        <div className={styles.contentArea}>
          {/* ── Uploading / Processing ────────────────────────────────────── */}
          {isUploading && (
            <div className={styles.progressArea}>
              <div className={styles.progressHeader}>
                <Loader
                  size={20}
                  className={styles.spinningIcon}
                  aria-hidden
                />
                <span className={styles.progressLabel}>
                  {status === 'validating' && 'Validating file…'}
                  {status === 'uploading' && `Uploading… ${progress}%`}
                  {status === 'processing' && 'Processing audio with AI…'}
                </span>
              </div>
              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFill}
                  style={{
                    width: `${status === 'validating' ? 0 : progress}%`,
                  }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <p className={styles.progressSub}>
                {status === 'validating' &&
                  'Checking file type, size, and duration…'}
                {status === 'uploading' && 'Please keep this tab open.'}
                {status === 'processing' &&
                  'Extracting audio, generating summary…'}
              </p>
            </div>
          )}

          {/* ── Idle / File selection ─────────────────────────────────────────── */}
          {showUploadView && (
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
                <p className={styles.dropzoneMain}>
                  Drag &amp; drop your meeting recording here
                </p>
                <p className={styles.dropzoneSub}>
                  or{' '}
                  <span className={styles.browseLink}>browse files</span>
                </p>
                <p className={styles.dropzoneConstraints}>
                  Format: MP4 · Max size: {MAX_SIZE_MB} MB · Max duration:
                  2 hours
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
                    <span className={styles.fileSize}>
                      {formatBytes(selectedFile!.size)}
                    </span>
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

              {/* Replacement warning — only when the BE already has a summary. */}
              {hadInitialSummary && (
                <div className={styles.replaceWarning} role="note">
                  <AlertTriangle size={14} aria-hidden />
                  <span>
                    This seminar already has an AI summary. Uploading a new
                    recording will <strong>replace</strong> the current
                    summary on the seminar record.
                  </span>
                </div>
              )}
            </>
          )}

          {/* ── Summary view (existing or freshly generated) ─────────────── */}
          {showSummaryView && displayedSummary && (
            <div className={styles.resultArea}>
              <div className={styles.resultHeader}>
                <span className={styles.aiResultBadge}>
                  <Sparkles size={12} aria-hidden />
                  AI Generated
                </span>
                <div className={styles.resultHeaderActions}>
                  <button
                    className={styles.copyBtn}
                    onClick={handleCopy}
                    aria-label="Copy summary"
                  >
                    <Copy size={14} aria-hidden />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <pre className={styles.summaryText}>{displayedSummary}</pre>

              {hadInitialSummary && !isCompleted && (
                <div className={styles.savedBanner} role="status">
                  <CheckCircle2 size={14} aria-hidden />
                  <span>
                    Saved on the seminar record — opening an existing summary
                    never overwrites it.
                  </span>
                </div>
              )}
              <div className={styles.disclaimer}>
                <AlertTriangle size={12} aria-hidden />
                AI-generated content — review for accuracy before sharing.
              </div>
            </div>
          )}

          {showSummaryView && !displayedSummary && (
            <div className={styles.emptyResult}>
              <AlertTriangle size={20} aria-hidden />
              <p>
                No summary was generated. Please try uploading again or contact
                support.
              </p>
            </div>
          )}

          {/* ── Failed ───────────────────────────────────────────────────────── */}
          {isFailed && !isUploading && (
            <div className={styles.errorArea}>
              <AlertTriangle
                size={24}
                className={styles.errorIcon}
                aria-hidden
              />
              <p className={styles.errorMessage}>
                {error ?? 'An unexpected error occurred.'}
              </p>
              {is409 && (
                <div className={styles.replaceWarning} role="note">
                  <AlertTriangle size={14} aria-hidden />
                  <span>
                    The seminar already has an AI summary. Confirm replacement
                    to overwrite it with a fresh one.
                  </span>
                </div>
              )}
              <button
                className={styles.retryBtn}
                onClick={() => {
                  reset();
                  setSelectedFile(null);
                  setViewMode(initialAiSummary ? 'summary' : 'upload');
                }}
              >
                <RotateCcw size={14} aria-hidden />
                Try Again
              </button>
              {is409 && (
                <button
                  className={styles.submitBtn}
                  onClick={() => void acceptReplace()}
                  data-testid="replace-ai-summary-confirm"
                >
                  <Upload size={14} aria-hidden />
                  Replace existing summary
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {showUploadView && (
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
                {hadInitialSummary ? 'Upload & Replace' : 'Upload & Summarize'}
              </button>
            </>
          )}

          {showSummaryView && (
            <>
              <button className={styles.cancelBtn} onClick={onClose}>
                Close
              </button>
              <button
                className={styles.submitBtn}
                onClick={switchToUpload}
                data-testid="replace-ai-summary"
              >
                <Upload size={14} aria-hidden />
                {hadInitialSummary
                  ? 'Replace with new recording'
                  : 'Upload Another'}
              </button>
            </>
          )}

          {(isUploading || isFailed) &&
            !showUploadView &&
            !showSummaryView && (
              <button className={styles.cancelBtn} onClick={onClose}>
                {isUploading ? 'Cancel' : 'Close'}
              </button>
            )}
        </div>
      </div>

      {/* In-modal replace-summary confirm (ticket §36). Replaces any prior
          native `window.confirm` usage — see ARS rules §0. The host must
          click "Replace" before the FE re-uploads with `ReplaceExisting=true`. */}
      {replacePrompt.open && (
        <ReplaceConfirmOverlay
          onConfirm={() => void acceptReplace()}
          onClose={() => setReplacePrompt({ open: false })}
        />
      )}
    </div>
  );
};

// ── Local sub-component: in-modal replacement confirm (ticket §36) ────────

interface ReplaceConfirmOverlayProps {
  onConfirm: () => void;
  onClose: () => void;
}

const ReplaceConfirmOverlay: React.FC<ReplaceConfirmOverlayProps> = ({
  onConfirm,
  onClose,
}) => {
  // Trap Escape for this nested overlay.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className={styles.modalOverlay}
      role="presentation"
      style={{ zIndex: 60 }}
    >
      <div
        className={styles.modalCard}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="replace-confirm-title"
      >
        <div className={styles.modalHeaderRow}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.aiIconCircle}>
              <AlertTriangle size={18} aria-hidden />
            </span>
            <div>
              <h3
                className={styles.modalTitle}
                id="replace-confirm-title"
              >
                Replace AI summary?
              </h3>
              <span className={styles.modalSubtitle}>
                This seminar already has an AI summary.
              </span>
            </div>
          </div>
        </div>
        <div className={styles.contentArea}>
          <p>
            A new upload will overwrite the current summary on this seminar
            record. Continue?
          </p>
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.submitBtn}
            onClick={onConfirm}
            data-testid="replace-ai-summary-confirm"
            autoFocus
          >
            Replace summary
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioSummaryModal;
