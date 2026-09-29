/**
 * ImageViewer — modal lightbox for previewing images attached to forum posts,
 * manuscripts, or any other upload flow. Accepts either a remote URL or a
 * local `File | Blob` (which is rendered through an object URL that is
 * revoked on close).
 *
 * Scope: this viewer is read-only — it intentionally exposes **no edit
 * affordances**. It's a viewer, not an editor.
 *
 * Zoom levels: 25 % → 400 %, snap-to-fit (100 %) reset. Pinch / wheel zoom
 * is supported but only on devices that emit the events; the click toolbar
 * is the canonical control.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  X,
  Download,
  ExternalLink,
} from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import styles from './ImageViewer.module.css';

export interface ImageViewerProps {
  /** Remote URL, or a local `File | Blob` to preview before sending it. */
  src: string | File | Blob | null;
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Called when the user dismisses the viewer (Escape / overlay click / X). */
  onClose: () => void;
  /** Accessible label for the close button and the dialog. */
  title?: string;
  /** Optional alt text for the image. Defaults to "Attached image". */
  alt?: string;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

interface Point {
  x: number;
  y: number;
}

/** Object URL lifecycle helper — revoke previous URL before replacing. */
function swapObjectUrl(prev: string | null, next: string | null): string | null {
  if (prev && prev !== next) URL.revokeObjectURL(prev);
  return next;
}

/** Resolve the underlying display URL for the `src` prop. */
function resolveSrc(src: string | File | Blob | null): string | null {
  if (!src) return null;
  if (typeof src === 'string') return src;
  return URL.createObjectURL(src);
}

export const ImageViewer = ({ src, isOpen, onClose, title, alt }: ImageViewerProps) => {
  const t = useT();
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dragRef = useRef<{ start: Point; origin: Point } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve `src` → displayable URL, keeping object URLs revoked when the
  // prop changes (e.g. the user picks a different file).
  useEffect(() => {
    setResolvedSrc((prev) => swapObjectUrl(prev, resolveSrc(null)));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setResolvedSrc((prev) => swapObjectUrl(prev, resolveSrc(src)));
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }, [isOpen, src]);

  // Cleanup on unmount — revoke any outstanding object URL.
  useEffect(() => {
    return () => {
      if (resolvedSrc && resolvedSrc.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedSrc);
      }
    };
  }, [resolvedSrc]);

  // Keyboard shortcuts — Escape closes, +/- zooms, R resets, 0 fits.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
      } else if (event.key === '-') {
        event.preventDefault();
        setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)));
      } else if (event.key === '0') {
        event.preventDefault();
        setScale(1);
        setRotation(0);
        setOffset({ x: 0, y: 0 });
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        setRotation((r) => (r + 90) % 360);
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Wheel-zoom around the cursor. Skip if the event is a horizontal
  // scrollbar drag (deltaX dominant) so page scroll still feels natural.
  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      setScale((s) => {
        const next = +(s + direction * SCALE_STEP).toFixed(2);
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      });
    }
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    dragRef.current = {
      start: { x: event.clientX, y: event.clientY },
      origin: offset,
    };
  }, [offset, scale]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({
      x: drag.origin.x + (event.clientX - drag.start.x),
      y: drag.origin.y + (event.clientY - drag.start.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleZoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
  const handleZoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)));
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const isLocalFile = useMemo(() => src instanceof Blob, [src]);
  const downloadHref = resolvedSrc ?? '#';
  const downloadName = useMemo(() => {
    if (typeof src === 'string') return title ?? 'attached-image';
    if (src instanceof File) return src.name;
    return title ?? 'attached-image';
  }, [src, title]);

  if (!isOpen || !resolvedSrc) return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? t('imageViewer.title', 'Image viewer')}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          {title ?? t('imageViewer.title', 'Image viewer')}
        </div>
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleZoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label={t('imageViewer.zoomOut', 'Zoom out')}
            title={t('imageViewer.zoomOut', 'Zoom out')}
          >
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <span className={styles.scaleBadge} aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleZoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label={t('imageViewer.zoomIn', 'Zoom in')}
            title={t('imageViewer.zoomIn', 'Zoom in')}
          >
            <ZoomIn size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleRotate}
            aria-label={t('imageViewer.rotate', 'Rotate')}
            title={t('imageViewer.rotate', 'Rotate')}
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleReset}
            aria-label={t('imageViewer.reset', 'Reset zoom')}
            title={t('imageViewer.reset', 'Reset zoom')}
          >
            <Maximize2 size={16} aria-hidden="true" />
          </button>
          <a
            className={styles.iconBtn}
            href={downloadHref}
            download={downloadName}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t('imageViewer.download', 'Download image')}
            title={t('imageViewer.download', 'Download image')}
          >
            <Download size={16} aria-hidden="true" />
          </a>
          {!isLocalFile && (
            <a
              className={styles.iconBtn}
              href={downloadHref}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t('imageViewer.openNewTab', 'Open in new tab')}
              title={t('imageViewer.openNewTab', 'Open in new tab')}
            >
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.closeBtn}`}
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            title={t('common.close', 'Close')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={styles.stage}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        role="presentation"
      >
        <img
          src={resolvedSrc}
          alt={alt ?? t('imageViewer.alt', 'Attached image preview')}
          className={styles.image}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
            cursor: scale > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          draggable={false}
          onClick={() => scale === 1 && handleZoomIn()}
        />
      </div>

      <div className={styles.hint}>
        {t(
          'imageViewer.hint',
          'Scroll to zoom · drag to pan · Esc to close · 0 to reset'
        )}
      </div>
    </div>,
    document.body
  );
};

export default ImageViewer;