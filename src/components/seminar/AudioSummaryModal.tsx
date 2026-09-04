// AudioSummaryModal — upload MP4, trigger AI summarization, display result.
//
// Props:
//   seminarId          — the seminar to attach the summary to
//   seminarTitle       — display name for the seminar
//   isOpen             — controls modal visibility
//   onClose            — called when the modal should close
//   onSuccess          — called with the response after a successful upload
//   initialAiSummary   — the summary already stored on the BE (from
//                        GET /api/Seminar). When non-empty, the modal opens
//                        directly in summary view so the user does not need
//                        to re-upload their video just to view it.

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
  Save,
  CheckCircle2,
} from 'lucide-react';
import { useSeminarAudio } from '../../hooks/useSeminarAudio';
import { seminarService } from '../../services/seminar.service';
import styles from './AudioSummaryModal.module.css';

interface AudioSummaryModalProps {
  seminarId: number;
  seminarTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (seminarId: number) => void;
  /** Pre-existing AI summary text returned by GET /api/Seminar. */
  initialAiSummary?: string | null;
}

const MAX_SIZE_MB = 500;

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /**
   * Local view mode. The hook tracks upload progress; this flag decides what
   * the modal renders when `status === 'idle'`:
   *   • 'summary' → display the AI summary (existing or just-generated)
   *   • 'upload'  → display the dropzone for a new recording
   */
  const [viewMode, setViewMode] = useState<'summary' | 'upload'>(
    initialAiSummary ? 'summary' : 'upload',
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tracks whether the seminar already had an AI summary when the modal
  // opened. Used to:
  //   1. Render a "Saved on seminar record" pill instead of "Save Summary"
  //   2. Auto-send `ReplaceExisting=true` on subsequent uploads (so the BE
  //      does not reject the upload with HTTP 409 Conflict)
  const hadInitialSummary = Boolean(initialAiSummary);

  // ── Reset state when modal opens ──────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      reset();
      setSelectedFile(null);
      setCopied(false);
      setIsSaving(false);
      setSaveError(null);
      setSavedAt(null);
      // Open in summary view if the seminar already has an AI summary;
      // otherwise go straight to the upload dropzone.
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
      // If the seminar already has a stored summary (either from the GET
      // payload that opened this modal, or because the host just generated
      // one earlier in this session), pass `ReplaceExisting=true` so the BE
      // does not reject the upload with 409 Conflict.
      const replaceExisting = hadInitialSummary;
      const response = await summarize(seminarId, selectedFile, { replaceExisting });
      // Show the freshly generated summary in the same summary view.
      setViewMode('summary');
      onSuccess?.(seminarId);
      void response; // unused — result is in state
    } catch {
      // error handled by hook
    }
  };

  // ── Copy summary ────────────────────────────────────────────────────────────

  const handleCopy = () => {
    const text = result?.aiSummary ?? initialAiSummary;
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Save summary ───────────────────────────────────────────────────────────
  // Persists the AI-generated text via PUT /api/Seminar/{id}/ai-summary.
  // Until the host clicks Save, the summary is only kept in the local modal
  // state — the BE is not authoritative yet. Re-running the upload will
  // overwrite the unsaved text on the next `summarize-audio` call.
  //
  // NOTE: When the modal opened with a pre-existing summary from GET
  // /api/Seminar, the BE already considers it saved — we hide this button
  // entirely and surface an "Already saved" pill instead.

  const handleSaveSummary = async () => {
    const text = result?.aiSummary;
    if (!text || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await seminarService.saveAiSummary(seminarId, text);
      setSavedAt(updated.updatedAt ?? new Date().toISOString());
      onSuccess?.(seminarId);
    } catch (err: unknown) {
      const responseData = (
        err as {
          response?: { data?: { message?: string } | string; status?: number };
        }
      )?.response?.data;
      const status = (err as { response?: { status?: number } })?.response?.status;
      const rawMsg =
        typeof responseData === 'string'
          ? responseData
          : responseData?.message ??
            (err instanceof Error ? err.message : '') ??
            '';
      let friendly =
        'Could not save the summary. Please try again in a moment.';
      if (status === 404 || status === 405) {
        friendly =
          'The backend does not yet support saving the AI summary. Please ask the BE team to expose PUT /api/Seminar/{id}/ai-summary.';
      } else if (status === 401 || status === 403) {
        friendly =
          'You are not authorized to save this summary. Only the seminar organizer can.';
      } else if (rawMsg) {
        friendly = rawMsg;
      }
      setSaveError(friendly);
    } finally {
      setIsSaving(false);
    }
  };

  // ── View-mode toggles ──────────────────────────────────────────────────────

  const switchToUpload = useCallback(() => {
    reset();
    setSelectedFile(null);
    setSaveError(null);
    setSavedAt(null);
    setViewMode('upload');
  }, [reset]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const isUploading = status === 'validating' || status === 'uploading' || status === 'processing';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const hasFile = selectedFile != null;

  // Summary text priority: freshly generated result > pre-existing summary.
  const displayedSummary = result?.aiSummary ?? initialAiSummary ?? null;
  // Show the summary view when:
  //   • the hook just completed a fresh upload, OR
  //   • we're idle but already chose the summary view AND we have text
  //     (this is the new "show existing summary" path — avoids forcing the
  //     user to re-upload just to see what the BE already stored).
  const showSummaryView =
    (isCompleted && displayedSummary) ||
    (status === 'idle' && viewMode === 'summary' && displayedSummary);
  const showUploadView =
    status === 'idle' && viewMode === 'upload';

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

          {/* ── Idle / File selection ───────────────────────────────────────── */}
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

          {/* ── Summary view (existing or freshly generated) ─────────────────── */}
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
                  {/* Save control — only meaningful for freshly generated
                      results, NOT when the modal opened with a pre-existing
                      summary (the BE already considers that one saved). */}
                  {isCompleted && !hadInitialSummary && (
                    <button
                      className={styles.saveBtn}
                      onClick={() => void handleSaveSummary()}
                      disabled={isSaving}
                      data-testid="save-ai-summary"
                    >
                      {isSaving ? (
                        <>
                          <Loader size={14} className={styles.spinningIcon} aria-hidden />
                          Saving…
                        </>
                      ) : savedAt ? (
                        <>
                          <CheckCircle2 size={14} aria-hidden />
                          Saved
                        </>
                      ) : (
                        <>
                          <Save size={14} aria-hidden />
                          Save Summary
                        </>
                      )}
                    </button>
                  )}
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
              {savedAt && (
                <div className={styles.savedBanner} role="status">
                  <CheckCircle2 size={14} aria-hidden />
                  <span>
                    Saved to seminar record · {new Date(savedAt).toLocaleString()}
                  </span>
                </div>
              )}
              {saveError && (
                <div className={styles.saveErrorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{saveError}</span>
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
                  setViewMode(initialAiSummary ? 'summary' : 'upload');
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

          {(isUploading || isFailed) && !showUploadView && !showSummaryView && (
            <button className={styles.cancelBtn} onClick={onClose}>
              {isUploading ? 'Cancel' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioSummaryModal;
