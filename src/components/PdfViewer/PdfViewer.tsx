import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.js?raw';
import { RefreshCw, ExternalLink, FileText } from 'lucide-react';
import {
  resolvePdfSource,
  classifyPdfSource,
  isRecoverablePdfError,
  PdfSourceError,
  type PdfSourceReason,
  type PdfSourceCategory,
} from '../../utils/pdfSource';
import styles from './PdfViewer.module.css';

// Create a Blob URL from the worker source at module init.
const workerSrc = URL.createObjectURL(
  new Blob([pdfjsWorkerSrc], { type: 'application/javascript' })
);
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfViewerProps {
  url: string | File | Blob | null;
  currentPage?: number;
  onTotalPages?: (total: number) => void;
  onPageChange?: (page: number) => void;
  /**
   * Viewer mode that controls content-protection behaviour.
   * - `'standard'` — default; normal viewer with open-in-new-tab toolbar action.
   * - `'protected-review'` — reviewer-facing manuscript view: no open-in-new-tab,
   *   no download/print shortcuts, copy/cut/context-menu/drag blocked inside the
   *   viewer, and a confidential watermark/notice overlay is shown.
   *
   * Applied only to reviewer-facing researcher-paper views (EvaluationDesk
   * reviewer path).  NOT applied to researcher upload preview, researcher
   * viewing their own paper, admin proof-document review, or other PDF usages.
   */
  mode?: 'standard' | 'protected-review';
  /**
   * Optional copy-identifier displayed in the watermark overlay when in
   * `protected-review` mode.  Typically the review-request id or a reviewer
   * copy token.  Never exposes researcher identity (double-blind support).
   */
  reviewCopyId?: string;
}

interface ThumbnailEntry {
  dataUrl: string;
  width: number;
  height: number;
}

interface ErrorState {
  category: PdfSourceCategory;
  reason: PdfSourceReason;
  message: string;
  httpStatus: number | undefined;
  recoverable: boolean;
  rawInputUrl: string | null;
}

/** Stable object URL lifecycle helper — revoke previous URL before replacing. */
function swapObjectUrl(prev: string | null, next: string | null): string | null {
  if (prev && prev !== next) URL.revokeObjectURL(prev);
  return next;
}

const THUMBNAIL_SCALE = 0.2;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;

function isOpenableAbsoluteUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function safeLabelForCategory(category: PdfSourceCategory): string {
  switch (category) {
    case 'firebaseDownloadUrl':
    case 'gsUri':
    case 'firebaseObjectPath':
      return 'the storage location';
    case 'httpUrl':
    case 'relativeUrl':
      return 'the document URL';
    case 'blob':
      return 'the file';
    default:
      return 'the document';
  }
}

function buildErrorState(err: unknown, rawInput: string | File | Blob | null): ErrorState {
  if (err instanceof PdfSourceError) {
    return {
      category: err.category,
      reason: err.reason,
      message: err.message,
      httpStatus: err.httpStatus,
      recoverable: isRecoverablePdfError(err),
      rawInputUrl: null,
    };
  }
  // Unknown error. Don't expose err.message — it may contain URLs or stack traces.
  const category = classifyPdfSource(rawInput);
  return {
    category,
    reason: 'invalid',
    message: 'Unable to load proof document.',
    httpStatus: undefined,
    recoverable: false,
    rawInputUrl: null,
  };
}

export const PdfViewer = ({
  url,
  currentPage: _currentPage,
  onTotalPages,
  onPageChange,
  mode = 'standard',
  reviewCopyId,
}: PdfViewerProps) => {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const lastResolvedUrlRef = useRef<{ absolute: string | null } | null>(null);

  const isProtected = mode === 'protected-review';

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [thumbnails, setThumbnails] = useState<Map<number, ThumbnailEntry>>(new Map());
  const [error, setError] = useState<ErrorState | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderingPages, setRenderingPages] = useState<Set<number>>(new Set());
  const [retryNonce, setRetryNonce] = useState(0);

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const thumbCanvasCache = useRef<Map<number, HTMLCanvasElement>>(new Map());
  /** Object URL of the resolved PDF blob, kept so the toolbar can open it in a new tab. */
  const pdfObjectUrlRef = useRef<string | null>(null);

  // ── Protected-review event blockers ────────────────────────────────────
  // Scoped to the viewer container ref so they do not affect the rest of the page.
  // Registered only when isProtected is true and cleaned up on unmount.

  /** Returns true when the event originates from inside the protected viewer. */
  const isInsideProtected = (e: MouseEvent | DragEvent | Event) => {
    const container = containerRef.current;
    if (!container) return false;
    const target = e.target as Node | null;
    return target !== null && container.contains(target);
  };

  const handleProtectedCopy = (e: ClipboardEvent) => { if (isInsideProtected(e)) e.preventDefault(); };
  const handleProtectedCut  = (e: ClipboardEvent) => { if (isInsideProtected(e)) e.preventDefault(); };
  const handleProtectedPaste = (e: ClipboardEvent) => { if (isInsideProtected(e)) e.preventDefault(); };
  const handleProtectedContextMenu = (e: MouseEvent) => { if (isInsideProtected(e)) e.preventDefault(); };
  const handleProtectedDragStart = (e: DragEvent) => { if (isInsideProtected(e)) e.preventDefault(); };
  const handleProtectedDrag = (e: DragEvent) => { if (isInsideProtected(e)) e.preventDefault(); };

  const handleProtectedKeyDown = (e: KeyboardEvent) => {
    if (!isInsideProtected(e)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    // Block Ctrl/Cmd+C (copy), Ctrl/Cmd+S (save page), Ctrl/Cmd+P (print)
    if (ctrl && /^[csap]$/i.test(e.key)) {
      e.preventDefault();
      return;
    }
    // Also block right-arrow drag (select-all in some contexts) — but allow
    // navigation arrows which are handled by the dedicated handleKeyDown below.
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Let the component's own handleKeyDown manage navigation — don't double-stop here.
      return;
    }
  };

  useEffect(() => {
    if (!isProtected) return;
    document.addEventListener('copy',      handleProtectedCopy);
    document.addEventListener('cut',       handleProtectedCut);
    document.addEventListener('paste',     handleProtectedPaste);
    document.addEventListener('contextmenu', handleProtectedContextMenu);
    document.addEventListener('dragstart', handleProtectedDragStart);
    document.addEventListener('drag',      handleProtectedDrag);
    document.addEventListener('keydown',   handleProtectedKeyDown);
    return () => {
      document.removeEventListener('copy',      handleProtectedCopy);
      document.removeEventListener('cut',       handleProtectedCut);
      document.removeEventListener('paste',     handleProtectedPaste);
      document.removeEventListener('contextmenu', handleProtectedContextMenu);
      document.removeEventListener('dragstart', handleProtectedDragStart);
      document.removeEventListener('drag',      handleProtectedDrag);
      document.removeEventListener('keydown',   handleProtectedKeyDown);
    };
  }, [isProtected]); // re-register only when protection mode changes

  // ── Render a single page to a canvas ───────────────────────────────
  const renderToCanvas = async (
    pageNum: number,
    canvas: HTMLCanvasElement,
    renderScale: number,
    _signal?: AbortSignal
  ) => {
    const doc = pdfDocRef.current;
    if (!doc) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const page = await doc.getPage(pageNum);
    const context = canvas.getContext('2d');
    if (!context) return;

    const viewport = page.getViewport({ scale: renderScale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const renderTask = page.render({ canvasContext: context, viewport });
    renderTaskRef.current = renderTask;

    try {
      await renderTask.promise;
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name !== 'RenderingCancelledException') {
        // Silent — the actual document-level error is already surfaced in `error` state.
        void err;
      }
    } finally {
      renderTaskRef.current = null;
    }
  };

  // ── Render main canvas ────────────────────────────────────────────
  const renderMainPage = (pageNum: number, renderScale: number) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    renderToCanvas(pageNum, canvas, renderScale);
  };

  // ── Render a thumbnail (lazy — only when visible or needed) ────────
  const renderThumbnail = async (pageNum: number) => {
    if (thumbnails.has(pageNum) || renderingPages.has(pageNum)) return;

    let offscreen = thumbCanvasCache.current.get(pageNum);
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      thumbCanvasCache.current.set(pageNum, offscreen);
    }

    setRenderingPages((prev) => new Set(prev).add(pageNum));

    try {
      const doc = pdfDocRef.current;
      if (!doc) return;
      const page = await doc.getPage(pageNum);
      const context = offscreen.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
      offscreen.width = Math.floor(viewport.width);
      offscreen.height = Math.floor(viewport.height);
      offscreen.style.width = `${viewport.width}px`;
      offscreen.style.height = `${viewport.height}px`;

      const renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;

      const dataUrl = offscreen.toDataURL('image/png');
      setThumbnails((prev) => {
        const next = new Map(prev);
        next.set(pageNum, { dataUrl, width: offscreen!.width, height: offscreen!.height });
        return next;
      });
    } catch (err) {
      void err;
    } finally {
      setRenderingPages((prev) => {
        const next = new Set(prev);
        next.delete(pageNum);
        return next;
      });
    }
  };

  // ── Load PDF ──────────────────────────────────────────────────────
  useEffect(() => {
    // Cancel any in-flight load before starting a new one.
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const resetState = () => {
      setLoading(true);
      setError(null);
      setTotalPages(0);
      setThumbnails(new Map());
      setCurrentPage(1);
      thumbCanvasCache.current.clear();
      pdfObjectUrlRef.current = swapObjectUrl(pdfObjectUrlRef.current, null);
    };

    // Empty input → show empty state, no work.
    if (url == null || (typeof url === 'string' && url.trim().length === 0)) {
      setLoading(false);
      setError(null);
      setTotalPages(0);
      setThumbnails(new Map());
      setCurrentPage(1);
      thumbCanvasCache.current.clear();
      pdfObjectUrlRef.current = swapObjectUrl(pdfObjectUrlRef.current, null);
      pdfDocRef.current = null;
      return;
    }

    resetState();

    const rawInput = url;
    const rawInputUrl = typeof url === 'string' ? url : null;

    const loadPdf = async () => {
      try {
        const source = await resolvePdfSource(url, { signal: controller.signal });
        if (controller.signal.aborted) return;

        let buffer: ArrayBuffer;
        if (source.resolved instanceof Blob) {
          buffer = await source.resolved.arrayBuffer();
        } else {
          buffer = source.resolved;
        }
        if (controller.signal.aborted) return;

        // Cache an object URL for the resolved bytes so the toolbar can
        // open the PDF in a new tab without forcing a Chrome "save as" dialog.
        // In protected-review mode the open-in-new-tab button is hidden; we skip
        // creating the URL here to avoid retaining a blob URL that could be
        // exploited to open the document outside the viewer.
        const blob = new Blob([buffer], { type: 'application/pdf' });
        if (!isProtected) {
          pdfObjectUrlRef.current = swapObjectUrl(
            pdfObjectUrlRef.current,
            URL.createObjectURL(blob),
          );
        }

        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const doc = await loadingTask.promise;

        if (controller.signal.aborted) {
          doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        onTotalPages?.(doc.numPages);

        renderMainPage(1, 1.5);

        for (let i = 1; i <= Math.min(5, doc.numPages); i++) {
          renderThumbnail(i);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        // Loading failed — drop any partial object URL so the toolbar
        // does not expose a "Download" for an unreadable document.
        pdfObjectUrlRef.current = swapObjectUrl(pdfObjectUrlRef.current, null);
        setError(buildErrorState(err, rawInput));
        setTotalPages(0);
        if (typeof rawInputUrl === 'string') {
          lastResolvedUrlRef.current = { absolute: rawInputUrl };
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadPdf();

    return () => {
      controller.abort();
      pdfDocRef.current = null;
    };
    // retryNonce forces a retry-driven reload without depending on identity of `url`.
    // isProtected is included so that switching modes re-fetches the PDF.
  }, [url, onTotalPages, retryNonce, isProtected]);

  // Revoke the cached object URL when the component unmounts.
  useEffect(() => {
    return () => {
      pdfObjectUrlRef.current = swapObjectUrl(pdfObjectUrlRef.current, null);
    };
  }, []);

  // Re-render main canvas when current page or scale changes
  useEffect(() => {
    if (totalPages > 0) renderMainPage(currentPage, scale);
  }, [currentPage, scale, totalPages]);

  // ── Scroll thumbnail into view when page changes externally ─────────
  const scrollThumbIntoView = (pageNum: number) => {
    requestAnimationFrame(() => {
      const thumbCanvas = thumbRefs.current.get(pageNum);
      const sidebar = sidebarRef.current;
      if (thumbCanvas && sidebar) {
        thumbCanvas.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };

  // ── Page navigation ───────────────────────────────────────────────
  const goToPage = (pageNum: number) => {
    if (totalPages <= 0) return;
    const clamped = Math.max(1, Math.min(pageNum, totalPages));
    setCurrentPage(clamped);
    onPageChange?.(clamped);
    scrollThumbIntoView(clamped);
  };

  // ── Zoom ─────────────────────────────────────────────────────────
  const zoomIn = () => setScale((s) => Math.min(s + SCALE_STEP, MAX_SCALE));
  const zoomOut = () => setScale((s) => Math.max(s - SCALE_STEP, MIN_SCALE));
  const zoomReset = () => setScale(1.5);

  // ── Keyboard navigation ────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      goToPage(currentPage + 1);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
    } else if (e.key === '-') {
      e.preventDefault();
      zoomOut();
    }
  };

  // ── Intersection Observer for lazy thumbnail loading ───────────────
  useEffect(() => {
    if (!totalPages) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = Number((entry.target as HTMLElement).dataset.page);
            if (!isNaN(pageNum)) {
              renderThumbnail(pageNum);
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { root: sidebar, rootMargin: '100px' }
    );

    const items = sidebar.querySelectorAll('[data-page]');
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [totalPages]);

  // ── Error UI helpers ─────────────────────────────────────────────
  const showToolbar = !error;
  const showPagination = !error && totalPages > 0;
  const showSidebarThumbs = !error && totalPages > 0;

  const handleRetry = () => setRetryNonce((n) => n + 1);

  const openTarget = (() => {
    if (!error) return null;
    if (isOpenableAbsoluteUrl(error.rawInputUrl)) return error.rawInputUrl;
    if (typeof url === 'string' && isOpenableAbsoluteUrl(url)) return url;
    return null;
  })();

  // Open the resolved PDF in a new tab without forcing a "save as" dialog.
  // The toolbar action only ever exists while a successful PDF is loaded.
  const openResolvedInNewTab = () => {
    const objectUrl = pdfObjectUrlRef.current;
    if (!objectUrl) return;
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
  };

  const renderErrorReasonExtra = () => {
    if (!error) return null;
    if (error.reason === 'notFound') {
      return <span>The document was not found at {safeLabelForCategory(error.category)}.</span>;
    }
    if (error.reason === 'forbidden') {
      return <span>Access is restricted. Try reloading or requesting a new link.</span>;
    }
    if (error.reason === 'server') {
      return <span>The document server reported an error. Please try again shortly.</span>;
    }
    if (error.reason === 'network') {
      return <span>Check your connection and try again.</span>;
    }
    if (error.reason === 'htmlResponse') {
      return <span>The link responded with a non-PDF document instead of a PDF.</span>;
    }
    if (error.reason === 'invalid') {
      return <span>The document link is not in a recognized format.</span>;
    }
    if (error.reason === 'firebaseNotConfigured') {
      return <span>Document storage is not configured for this environment.</span>;
    }
    return null;
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <div
        className={styles.errorCard}
        role="alert"
        data-testid="pdf-error"
        data-reason={error.reason}
      >
        <div className={styles.errorIcon} aria-hidden="true">
          <FileText size={28} />
        </div>
        <div className={styles.errorBody}>
          <strong className={styles.errorTitle}>Unable to load proof document</strong>
          <p className={styles.errorMessage} data-testid="pdf-error-message">{error.message}</p>
          <p className={styles.errorHint}>{renderErrorReasonExtra()}</p>
        </div>
        <div className={styles.errorActions}>
          {error.recoverable ? (
            <button
              type="button"
              className={styles.errorRetry}
              onClick={handleRetry}
              data-testid="pdf-error-retry"
            >
              <RefreshCw size={14} /> Retry
            </button>
          ) : null}
          {openTarget ? (
            <a
              href={openTarget}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.errorOpen}
              data-testid="pdf-error-open"
            >
              <ExternalLink size={14} /> Open in new tab
            </a>
          ) : null}
        </div>
      </div>
    );
  };

  const renderEmpty = () => (
    <div className={styles.emptyCard} role="status" data-testid="pdf-empty">
      <FileText size={28} aria-hidden="true" />
      <strong>No proof document supplied</strong>
      <span>This request did not include an attached document.</span>
    </div>
  );

  // ── Protected-review notice + watermark overlay ────────────────────────────
  //
  // Non-interactive: `pointer-events: none` so it never captures focus or clicks.
  // The watermark uses reviewCopyId (review-request id or reviewer copy token) so
  // the copy is traceable without exposing researcher identity (double-blind).
  const renderProtectedOverlay = () => {
    if (!isProtected) return null;
    return (
      <div
        className={styles.protectedOverlay}
        aria-hidden="true"
        data-testid="pdf-protected-overlay"
      >
        <span className={styles.protectedNotice}>
          Confidential review copy — copying and redistribution are prohibited.
        </span>
        {reviewCopyId ? (
          <span className={styles.protectedWatermark} aria-label="Review copy identifier">
            {reviewCopyId}
          </span>
        ) : null}
      </div>
    );
  };

  const inputIsEmpty =
    url == null || (typeof url === 'string' && url.trim().length === 0);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div
      className={`${styles.viewerWrapper}${isProtected ? ` ${styles.protectedWrapper}` : ''}`}
      data-testid="pdf-viewer"
    >
      {showToolbar ? (
        <div className={styles.toolbar} role="toolbar" aria-label="PDF viewer controls">
          <div className={styles.navGroup}>
            <button
              className={styles.navBtn}
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              data-testid="pdf-prev-btn"
            >
              ‹
            </button>

            <span className={styles.pageIndicator} data-testid="pdf-page-indicator">
              <input
                type="number"
                className={styles.pageInput}
                value={currentPage}
                min={1}
                max={totalPages}
                aria-label="Current page"
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) goToPage(v);
                }}
                data-testid="pdf-page-input"
              />
              <span className={styles.pageTotal}>/ {totalPages}</span>
            </span>

            <button
              className={styles.navBtn}
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              data-testid="pdf-next-btn"
            >
              ›
            </button>
          </div>

          <div className={styles.zoomGroup}>
            <button
              className={styles.zoomBtn}
              onClick={zoomOut}
              disabled={scale <= MIN_SCALE}
              aria-label="Zoom out"
              data-testid="pdf-zoom-out-btn"
            >
              −
            </button>

            <button
              className={styles.zoomPercent}
              onClick={zoomReset}
              aria-label="Reset zoom"
              title="Reset zoom"
              data-testid="pdf-zoom-percent"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              className={styles.zoomBtn}
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE}
              aria-label="Zoom in"
              data-testid="pdf-zoom-in-btn"
            >
              +
            </button>
          </div>

          {/* Top-right action: open the loaded PDF in a new tab. Uses
              `window.open(URL.createObjectURL(blob), ...)` so Chrome does
              not treat the response as a forced "save as" download — the
              user already sees the PDF inline and just wants a new tab.
              Hidden in protected-review mode. */}
          {totalPages > 0 && !isProtected ? (
            <div className={styles.toolbarActions}>
              <button
                type="button"
                className={styles.toolbarOpenBtn}
                onClick={openResolvedInNewTab}
                aria-label="Open PDF in new tab"
                title="Open in new tab"
                data-testid="pdf-open-newtab-btn"
              >
                <ExternalLink size={14} /> Open in new tab
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Body: sidebar + main canvas */}
      <div className={styles.viewerBody}>
        <aside className={styles.sidebar} ref={sidebarRef} aria-label="Page thumbnails">
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Pages</span>
          </div>
          <div className={styles.thumbList}>
            {showSidebarThumbs ? (
              Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const thumb = thumbnails.get(pageNum);
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    ref={(el) => {
                      if (el) thumbRefs.current.set(pageNum, el as unknown as HTMLCanvasElement);
                      else thumbRefs.current.delete(pageNum);
                    }}
                    data-page={pageNum}
                    className={`${styles.thumbItem} ${isActive ? styles.thumbItemActive : ''}`}
                    onClick={() => goToPage(pageNum)}
                    aria-label={`Page ${pageNum}${isActive ? ' (current)' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    title={`Page ${pageNum}`}
                  >
                    <div className={styles.thumbNumber}>{pageNum}</div>
                    <div className={styles.thumbPreview}>
                      {thumb ? (
                        <img
                          src={thumb.dataUrl}
                          alt={`Page ${pageNum}`}
                          className={styles.thumbImg}
                        />
                      ) : (
                        <div className={styles.thumbPlaceholder}>
                          {renderingPages.has(pageNum) ? '...' : ''}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className={styles.sidebarEmpty}>{showPagination ? 'No pages' : '0 pages'}</div>
            )}
          </div>
        </aside>

        <div
          className={styles.canvasContainer}
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-label="PDF page viewer"
          data-testid="pdf-canvas-container"
        >
          {loading ? (
            <div className={styles.overlay} data-testid="pdf-loading">
              <div className={styles.spinner} aria-label="Loading PDF" />
              <span>Loading PDF...</span>
            </div>
          ) : null}

          {inputIsEmpty && !loading ? renderEmpty() : null}
          {error && !loading ? renderError() : null}

          <canvas
            ref={mainCanvasRef}
            className={styles.canvas}
            aria-label={`Page ${currentPage} of ${totalPages}`}
            data-testid="pdf-canvas"
          />

          {renderProtectedOverlay()}
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;
