import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import styles from './PdfViewer.module.css';

// Configure PDF.js worker from CDN (avoids bundling the 600KB worker file)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  /** URL of the PDF to render */
  url: string;
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
  currentPage,
  onTotalPages,
  onPageChange,
}: PdfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageState, setPageState] = useState<PageState>({
    pageNum: 1,
    rendering: false,
    scale: 1.5,
  });
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Unwatch ref to cancel in-progress renders on re-render
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // ── Load PDF document ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        onTotalPages?.(doc.numPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      setPdfDoc(null);
    };
  }, [url, onTotalPages]);

  // ── Render a single page ─────────────────────────────────────────────────
  const renderPage = useCallback(
    async (pageNum: number, scale: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      // Cancel any in-progress render to avoid flickering
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      setPageState((prev) => ({ ...prev, pageNum, rendering: true }));

      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: context,
          viewport,
          intent: 'display' as const,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
        // Silently ignore cancelled renders
      } finally {
        setPageState((prev) => ({ ...prev, rendering: false }));
      }
    },
    [pdfDoc]
  );

  // Re-render when page or scale changes
  useEffect(() => {
    renderPage(pageState.pageNum, pageState.scale);
  }, [pageState.pageNum, pageState.scale, renderPage]);

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
