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
//   initialAiSummary   — OPTIONAL fallback summary text. The BE intentionally
//                        nulls `aiSummary` in the list response (`GET /api/Seminar`,
//                        ticket §7), so this prop is almost always null. The
//                        modal fetches the canonical summary itself via
//                        `GET /api/Seminar/{id}` on open — see `loadSeminarDetail`.
//
// Ticket references: §34-§37 (canonical summarize-audio flow, 409 replace
// confirm, removal of the standalone save endpoint).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Loader,
  AlertTriangle,
  Copy,
  Star,
  Film,
  Upload,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { useSeminarAudio } from '../../hooks/useSeminarAudio';
import { useLongTaskTracker } from '../../hooks/useLongTaskTracker';
import { seminarService } from '../../services/seminar.service';
import { ROUTES } from '../../routes/paths';
import { toast } from 'sonner';
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
  const { startTask, finishTask, cancelTask } = useLongTaskTracker();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // `currentAiSummary` is the canonical summary rendered in the modal. It is
  // populated by `loadSeminarDetail()` on open so the host sees the existing
  // AI summary (the BE intentionally nulls `aiSummary` in the list response,
  // so we cannot rely on `initialAiSummary` from the seminar card).
  const [currentAiSummary, setCurrentAiSummary] = useState<string | null>(
    initialAiSummary,
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
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
  const hadInitialSummary = Boolean(currentAiSummary);

  // ── Fetch seminar detail (canonical AI summary) ──────────────────────────
  // The list endpoint `GET /api/Seminar` intentionally nulls `aiSummary`
  // (ticket §7). The detail endpoint `GET /api/Seminar/{id}` is the only
  // place that surfaces the persisted summary. We fetch on open so the
  // modal opens in summary view when one already exists, and so the
  // host sees the replace-confirm warning before uploading.
  //
  // Declared before the open-time effect below so the effect can call it
  // without a `used before declaration` TypeScript error.
  //
  // A `mountedRef` guards the async setter calls: if the user closes the
  // modal (or unmounts the page) while `GET /api/Seminar/{id}` is still
  // in flight, the response handler would otherwise try to update state
  // on an unmounted component and surface a React warning.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSeminarDetail = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const detail = await seminarService.getById(seminarId);
      if (!mountedRef.current) return;
      // Defensive: if a fresh summarize already populated `currentAiSummary`
      // while the detail request was in flight, keep the fresher value.
      const fetched = detail?.aiSummary ?? null;
      setCurrentAiSummary((prev) => {
        const next = prev ?? fetched;
        // If the BE says there IS a summary and we haven't already moved
        // into summary view (e.g. the open-time effect landed in upload
        // mode because `initialAiSummary` was null), flip the view mode
        // now so the host actually sees the existing summary instead of
        // the upload dropzone. This is the core fix for the "View Notes
        // button didn't get those notes up" bug.
        if (next && status === 'idle') {
          setViewMode('summary');
        }
        return next;
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not load the saved AI summary.';
      setDetailError(msg);
      // Fall back to whatever the parent gave us (almost always null).
      setCurrentAiSummary((prev) => prev ?? initialAiSummary);
    } finally {
      if (mountedRef.current) setLoadingDetail(false);
    }
  }, [seminarId, initialAiSummary, status]);

  // ── Reset state when modal opens ──────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      reset();
      setSelectedFile(null);
      setCopied(false);
      setReplaceConfirmed(false);
      setCurrentAiSummary(initialAiSummary);
      setViewMode(initialAiSummary ? 'summary' : 'upload');
      // Always fetch the canonical seminar detail on open. The BE nulls
      // `aiSummary` in the list response (ticket §7), so without this fetch
      // the modal cannot tell whether the seminar already has a summary and
      // opens in upload mode even when a summary exists. The fetch is what
      // fixes the "View Notes button didn't get those notes up" bug.
      void loadSeminarDetail();
    }
  }, [isOpen, initialAiSummary, reset, loadSeminarDetail]);

  // ── Close handler ──────────────────────────────────────────────────────────
  // The modal can be closed in two different ways:
  //   1. User explicitly dismisses (X button, Escape, Cancel/Close) — we want
  //      to clear the in-flight tracker task so the widget disappears too.
  //      The user has chosen to abandon the operation and we should respect
  //      that — re-surfacing "click to return" later would be jarring.
  //   2. User navigates away to another page — the modal unmounts without
  //      `onClose` firing. We DO NOT cancelTask in that path so the widget
  //      can carry the loading feedback across the navigation; the orphaned
  //      explicit origin will be garbage-collected by `loadingTracker.end()`
  //      when the in-flight axios request eventually resolves.
  //
  // `handleClose` is the canonical entry for case (1). It's wired to every
  // explicit close affordance in the modal JSX so the cleanup stays in one
  // place. `ReplaceConfirmOverlay` has its own `onClose` because it only
  // dismisses the inline confirm prompt — never the parent modal.
  const handleClose = useCallback(() => {
    cancelTask();
    onClose?.();
  }, [cancelTask, onClose]);

  // ── Background task tracker ────────────────────────────────────────────────
  // The AI summarise flow can run for tens of seconds (upload + BE
  // processing). Once the request is in flight, we register it with the
  // global `loadingTracker` so the header `LoadingTaskWidget` chip can
  // take over from the page-level overlay and let the user navigate
  // freely while the BE finishes. On success the chip shows a checkmark
  // and a "click to return" affordance; on failure it silently cancels.
  //
  // We also write the reopen intent to `sessionStorage` so when the
  // user clicks the chip we can re-open this modal on return — even if
  // the page unmounted while the user was away. The key is keyed by
  // the modal identity so multiple modals don't trample each other.
  const reopenStorageKey = `ars:task-reopen:aiSummary|${seminarId}`;

  useEffect(() => {
    if (!isOpen) return undefined;
    try {
      window.sessionStorage.setItem(reopenStorageKey, JSON.stringify({ seminarId }));
    } catch {
      /* ignore quota / privacy mode */
    }
    return () => {
      try {
        window.sessionStorage.removeItem(reopenStorageKey);
      } catch {
        /* ignore */
      }
    };
  }, [isOpen, reopenStorageKey]);

  // Watch the upload hook's status and reflect the terminal outcome into
  // the long-task tracker. We intentionally do NOT touch the tracker on
  // unmount — see the comment on `handleClose` for why cross-page
  // navigation should keep an in-flight task alive.
  useEffect(() => {
    if (status === 'completed') {
      finishTask(true);
    } else if (status === 'failed') {
      // Treat failures as cancellations — don't leave an erroneous
      // success chip on the screen. The modal itself surfaces the BE
      // error message inline.
      cancelTask();
    }
  }, [status, finishTask, cancelTask]);

  // Close on Escape (modal-level only; ReplaceConfirmOverlay traps its
  // own Escape separately).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  // ── File selection helpers ──────────────────────────────────────────────────

  const handleFileChange = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.includes('mp4') && !file.type.includes('mpeg')) {
      toast.error('Only MP4 files are supported.');
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
      // Register the long-running task with the global tracker so the
      // header widget can carry the loading feedback. We register here
      // (right before the API call) rather than on modal-open, because
      // most users pick a file, hit Summarize, and the BE takes time;
      // we don't want to start a "task in progress" the moment the
      // modal pops open without any actual work happening yet.
      startTask({
        path: ROUTES.SEMINAR_WORKSPACE,
        modalKey: `aiSummary|${seminarId}`,
        label: 'AI Summary',
      });
      try {
        const response = await summarize(seminarId, selectedFile, { replaceExisting });
        // Persist the freshly generated summary into `currentAiSummary` so
        // the modal stays in summary view after `reset()` is called from
        // somewhere else. The `result` from the hook is the source of truth
        // while it is populated, but `currentAiSummary` outlives that.
        if (response?.aiSummary) {
          setCurrentAiSummary(response.aiSummary);
        }
        // Success — the BE persists `Seminars.aiSummary` itself
        // (ticket §35), so there's no separate save step.
        setViewMode('summary');
        onSuccess?.(seminarId);
      } catch {
        // Error is surfaced by the hook via `error` state.
      }
    },
    [seminarId, selectedFile, summarize, startTask, onSuccess],
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
    const text = result?.aiSummary ?? currentAiSummary;
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

  // Summary text priority: freshly generated result > canonical detail-fetched
  // summary > prop fallback. `currentAiSummary` is populated by the detail
  // fetch on open, which is the fix for "View Notes didn't show the existing
  // summary" — the BE nulls `aiSummary` in the list response (ticket §7) so
  // we have to read it from the detail endpoint.
  const displayedSummary = result?.aiSummary ?? currentAiSummary ?? null;
  const showSummaryView =
    (isCompleted && displayedSummary) ||
    (status === 'idle' && viewMode === 'summary' && displayedSummary);
  const showUploadView =
    status === 'idle' && viewMode === 'upload' && !loadingDetail;

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
              <Star size={18} aria-hidden />
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
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Content */}
        <div className={styles.contentArea}>
          {/* ── Loading canonical AI summary ──────────────────────────────────
              Shown briefly while we read `GET /api/Seminar/{id}` so we know
              whether the seminar already has an AI summary persisted on the
              BE. Without this fetch the modal would always open in upload
              mode (because the list response nulls `aiSummary` per ticket
              §7), which is the original "View Notes button didn't get those
              notes up" bug. */}
          {loadingDetail && (
            <div className={styles.progressArea} data-testid="ai-summary-loading-detail">
              <div className={styles.progressHeader}>
                <Loader
                  size={20}
                  className={styles.spinningIcon}
                  aria-hidden
                />
                <span className={styles.progressLabel}>
                  Loading saved AI summary…
                </span>
              </div>
              <p className={styles.progressSub}>
                Reading the AI summary already stored on this seminar record.
              </p>
            </div>
          )}

          {/* ── Detail fetch failed — show a non-blocking warning and fall
              through to the regular upload / summary views below. The user
              can still upload a new recording; we just couldn't confirm
              whether one already existed. */}
          {!loadingDetail && detailError && (
            <div className={styles.replaceWarning} role="note">
              <AlertTriangle size={14} aria-hidden />
              <span>
                Could not load the saved AI summary ({detailError}). You can
                still upload a new recording below.
              </span>
            </div>
          )}

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
                  <Star size={12} aria-hidden />
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
                  setViewMode(currentAiSummary ? 'summary' : 'upload');
                  // Re-read the canonical summary from the BE so the modal
                  // lands in the right view mode after the user hits Try
                  // Again — without this re-fetch we'd reopen on whatever
                  // was cached locally and re-trigger the same 409.
                  void loadSeminarDetail();
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
              <button className={styles.cancelBtn} onClick={handleClose}>
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
              <button className={styles.cancelBtn} onClick={handleClose}>
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
              <button className={styles.cancelBtn} onClick={handleClose}>
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

const ReplaceConfirmOverlay = ({
  onConfirm,
  onClose,
}: ReplaceConfirmOverlayProps) => {
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
