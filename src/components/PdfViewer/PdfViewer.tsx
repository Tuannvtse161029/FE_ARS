import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.js?raw';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
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
}

interface ThumbnailEntry {
  dataUrl: string;
  width: number;
  height: number;
}

const THUMBNAIL_SCALE = 0.2;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;

async function fetchViaFirebaseStorage(url: string): Promise<Blob> {
  if (!storage) {
    throw new Error('Firebase is not configured. Cannot fetch PDF from Firebase Storage.');
  }
  const storageRef = ref(storage, url);
  const downloadUrl = await getDownloadURL(storageRef);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
  }
  return await response.blob();
}

export const PdfViewer = ({
  url,
  currentPage: _currentPage,
  onTotalPages,
  onPageChange,
}: PdfViewerProps) => {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [thumbnails, setThumbnails] = useState<Map<number, ThumbnailEntry>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderingPages, setRenderingPages] = useState<Set<number>>(new Set());

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const thumbCanvasCache = useRef<Map<number, HTMLCanvasElement>>(new Map());

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
        console.error('Render error:', err);
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

    // Reuse a hidden offscreen canvas from cache
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
      console.error(`Thumbnail error page ${pageNum}:`, err);
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
    if (!url) return;
    setLoading(true);
    setError(null);
    setTotalPages(0);
    setThumbnails(new Map());
    setCurrentPage(1);
    thumbCanvasCache.current.clear();

    let cancelled = false;

    const loadPdf = async () => {
      try {
        let source: string | { data: ArrayBuffer };

        if (typeof url === 'string') {
          if (url.includes('firebasestorage.googleapis.com')) {
            const blob = await fetchViaFirebaseStorage(url);
            source = { data: await blob.arrayBuffer() };
          } else {
            source = url;
          }
        } else {
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
        setTotalPages(doc.numPages);
        onTotalPages?.(doc.numPages);

        // Render the first page immediately
        renderMainPage(1, 1.5);

        // Render thumbnails for first few pages
        for (let i = 1; i <= Math.min(5, doc.numPages); i++) {
          renderThumbnail(i);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      pdfDocRef.current = null;
    };
  }, [url, onTotalPages]);

  // Re-render main canvas when current page or scale changes
  useEffect(() => {
    renderMainPage(currentPage, scale);
  }, [currentPage, scale]);

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

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className={styles.viewerWrapper} data-testid="pdf-viewer">
      {/* Toolbar */}
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
      </div>

      {/* Body: sidebar + main canvas */}
      <div className={styles.viewerBody}>
        {/* Sidebar: thumbnail strip */}
        <aside className={styles.sidebar} ref={sidebarRef} aria-label="Page thumbnails">
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Pages</span>
          </div>
          <div className={styles.thumbList}>
            {totalPages > 0 ? (
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
              <div className={styles.sidebarEmpty}>No pages</div>
            )}
          </div>
        </aside>

        {/* Main canvas area */}
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

          <canvas
            ref={mainCanvasRef}
            className={styles.canvas}
            aria-label={`Page ${currentPage} of ${totalPages}`}
            data-testid="pdf-canvas"
          />
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;
