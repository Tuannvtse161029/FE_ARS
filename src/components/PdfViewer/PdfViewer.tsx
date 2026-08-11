import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.js?raw';
import styles from './PdfViewer.module.css';

// Create a Blob URL from the worker source at module init.
// This is more reliable than ?url imports in sandboxed/embedded browsers
// (e.g. Cursor IDE's internal browser) that block separate script fetches.
const workerSrc = URL.createObjectURL(
  new Blob([pdfjsWorkerSrc], { type: 'application/javascript' })
);
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfViewerProps {
  /**
   * URL string or a File/Blob object.
   * Prefer File/Blob — read as ArrayBuffer internally for maximum compatibility.
   */
  url: string | File | Blob | null;
  /** Current page number (1-indexed), controlled externally */
  currentPage?: number;
  /** Called when total pages are known */
  onTotalPages?: (total: number) => void;
  /** Called when page changes */
  onPageChange?: (page: number) => void;
}

interface PageState {
  pageNum: number;
  rendering: boolean;
  scale: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;

export const PdfViewer = ({
  url,
  currentPage: _currentPage,
  onTotalPages,
  onPageChange,
}: PdfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pageState, setPageState] = useState<PageState>({
    pageNum: 1,
    rendering: false,
    scale: 1.5,
  });
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep latest pdfDoc in a ref so the render function always reads the current value
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Keep latest page state in a ref too
  const pageStateRef = useRef(pageState);
  pageStateRef.current = pageState;

  // ── Render a single page (stable function, always reads latest pdfDoc from ref) ──
  const renderPage = async (pageNum: number, scale: number) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    // Cancel any in-progress render to avoid flicker
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    setPageState((prev) => ({ ...prev, pageNum, rendering: true }));

    try {
      const page = await doc.getPage(pageNum);
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale });

      // Only set canvas pixel dimensions — let pdfjs v3 handle DPR internally
      // via its own transform inside page.render(). No setTransform needed here.
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const renderTask = page.render({
        canvasContext: context as CanvasRenderingContext2D,
        viewport,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name;
      if (errName !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    } finally {
      setPageState((prev) => ({ ...prev, rendering: false }));
    }
  };

  // ── Load PDF document ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setTotalPages(0);
    setPageState({ pageNum: 1, rendering: false, scale: 1.5 });

    let cancelled = false;

    const loadPdf = async () => {
      try {
        let source: string | { data: ArrayBuffer };

        if (typeof url === 'string') {
          source = url;
        } else {
          // Read File / Blob as ArrayBuffer for maximum compatibility
          const buffer = await url.arrayBuffer();
          source = { data: buffer };
        }

        const loadingTask = pdfjsLib.getDocument(source);
        const doc = await loadingTask.promise;

        if (cancelled) {
          doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        onTotalPages?.(doc.numPages);

        // Render page 1 immediately after doc is available
        await renderPage(1, pageStateRef.current.scale);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      pdfDocRef.current = null;
    };
  }, [url, onTotalPages]);

  // Re-render when page or scale changes (renderPage is stable — reads pdfDoc from ref)
  useEffect(() => {
    renderPage(pageState.pageNum, pageState.scale);
  }, [pageState.pageNum, pageState.scale]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Page navigation ───────────────────────────────────────────────────────
  const goToPage = (pageNum: number) => {
    const clamped = Math.max(1, Math.min(pageNum, totalPages));
    setPageState((prev) => ({ ...prev, pageNum: clamped }));
    onPageChange?.(clamped);
  };

  const prevPage = () => goToPage(pageState.pageNum - 1);
  const nextPage = () => goToPage(pageState.pageNum + 1);

  const canPrev = pageState.pageNum > 1;
  const canNext = pageState.pageNum < totalPages;

  // ── Zoom ────────────────────────────────────────────────────────────────
  const zoomIn = () =>
    setPageState((prev) => ({
      ...prev,
      scale: Math.min(prev.scale + SCALE_STEP, MAX_SCALE),
    }));

  const zoomOut = () =>
    setPageState((prev) => ({
      ...prev,
      scale: Math.max(prev.scale - SCALE_STEP, MIN_SCALE),
    }));

  const zoomReset = () =>
    setPageState((prev) => ({ ...prev, scale: 1.5 }));

  // ── Keyboard navigation ─────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      prevPage();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextPage();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
    } else if (e.key === '-') {
      e.preventDefault();
      zoomOut();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.viewerWrapper} data-testid="pdf-viewer">
      {/* Toolbar */}
      <div className={styles.toolbar} role="toolbar" aria-label="PDF viewer controls">
        {/* Page navigation */}
        <div className={styles.navGroup}>
          <button
            className={styles.navBtn}
            onClick={prevPage}
            disabled={!canPrev}
            aria-label="Previous page"
            data-testid="pdf-prev-btn"
          >
            ‹
          </button>

          <span className={styles.pageIndicator} data-testid="pdf-page-indicator">
            <input
              type="number"
              className={styles.pageInput}
              value={pageState.pageNum}
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
            onClick={nextPage}
            disabled={!canNext}
            aria-label="Next page"
            data-testid="pdf-next-btn"
          >
            ›
          </button>
        </div>

        {/* Zoom controls */}
        <div className={styles.zoomGroup}>
          <button
            className={styles.zoomBtn}
            onClick={zoomOut}
            disabled={pageState.scale <= MIN_SCALE}
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
            {Math.round(pageState.scale * 100)}%
          </button>

          <button
            className={styles.zoomBtn}
            onClick={zoomIn}
            disabled={pageState.scale >= MAX_SCALE}
            aria-label="Zoom in"
            data-testid="pdf-zoom-in-btn"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div
        className={styles.canvasContainer}
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="PDF page viewer"
        data-testid="pdf-canvas-container"
      >
        {loading && (
          <div className={styles.overlay} data-testid="pdf-loading">
            <div className={styles.spinner} aria-label="Loading PDF" />
            <span>Loading PDF...</span>
          </div>
        )}

        {error && (
          <div className={styles.errorBox} role="alert" data-testid="pdf-error">
            <strong>Failed to load PDF</strong>
            <p>{error}</p>
          </div>
        )}

        {pageState.rendering && !loading && (
          <div className={styles.renderingBadge} data-testid="pdf-rendering">
            Rendering...
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={styles.canvas}
          aria-label={`Page ${pageState.pageNum} of ${totalPages}`}
          data-testid="pdf-canvas"
        />
      </div>
    </div>
  );
};

export default PdfViewer;
