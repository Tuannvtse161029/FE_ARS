import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Shapes, Upload, X } from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useI18n } from '../../i18n/I18nContext';
import { AVATAR_OPTIONS } from './avatarCatalog';
import { AvatarVisual } from './AvatarVisual';
import styles from './AvatarPickerModal.module.css';

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentUrl?: string | null;
  userId: number;
  onClose: () => void;
  onSave: (url: string) => Promise<void> | void;
}

type Tab = 'catalog' | 'upload';

// Image renders larger than the circular frame so the user can pan to a
// different crop region. ZOOM = 1.6 means 60 % more visible area than the
// frame, which gives enough headroom for portraits and landscapes without
// making the picker feel cramped.
const ZOOM = 1.6;

const makeAvatarUrl = (id: string) => `lucide:${id}`;

// `offsetX` / `offsetY` ∈ [0, 1] describe the crop region's centre within
// the largest square crop of the source image. They map directly onto the
// CSS `object-position` percentage AND the `cropImage` canvas math, so
// the preview, the cropped file, and the avatar saved to the server stay
// in lock-step.
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const cropImage = (image: HTMLImageElement, offsetX: number, offsetY: number): Promise<Blob> => {
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const maxX = image.naturalWidth - size;
  const maxY = image.naturalHeight - size;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Canvas is unavailable.'));
  context.drawImage(image, maxX * offsetX, maxY * offsetY, size, size, 0, 0, 512, 512);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not crop image.'))), 'image/jpeg', 0.9));
};

export const AvatarPickerModal = ({ isOpen, currentUrl, userId, onClose, onSave }: AvatarPickerModalProps) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('catalog');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [cropX, setCropX] = useState(0.5);
  const [cropY, setCropY] = useState(0.5);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const upload = useImageUpload(`avatars/${userId}/`);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = ''; };
  }, [isOpen, onClose]);

  // ── Hooks below MUST all run on every render of an open modal — keep
  // them above the `if (!isOpen) return null` early return so React's
  // Rules of Hooks invariant holds. React otherwise throws "Rendered
  // more hooks than during the previous render" when the modal toggles.
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    event.preventDefault();
    stageRef.current.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cropX,
      originY: cropY,
    };
  }, [cropX, cropY]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const rangeX = rect.width * (ZOOM - 1);
    const rangeY = rect.height * (ZOOM - 1);
    const deltaX = (event.clientX - drag.startX) / rangeX;
    const deltaY = (event.clientY - drag.startY) / rangeY;
    setCropX(clamp01(drag.originX - deltaX));
    setCropY(clamp01(drag.originY - deltaY));
  }, []);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    if (stageRef.current.hasPointerCapture(event.pointerId)) {
      stageRef.current.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }, []);

  // Arrow-key nudge — accessibility affordance that pairs with the
  // drag-to-pan picker. 2 % per press, 10 % with Page Up / Page Down.
  const nudge = useCallback((dx: number, dy: number) => {
    setCropX((prev) => clamp01(prev + dx));
    setCropY((prev) => clamp01(prev + dy));
  }, []);

  const handleStageKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    switch (event.key) {
      case 'ArrowLeft': nudge(-step, 0); event.preventDefault(); break;
      case 'ArrowRight': nudge(step, 0); event.preventDefault(); break;
      case 'ArrowUp': nudge(0, -step); event.preventDefault(); break;
      case 'ArrowDown': nudge(0, step); event.preventDefault(); break;
      case 'Home': setCropX(0.5); setCropY(0.5); event.preventDefault(); break;
      default: break;
    }
  }, [nudge]);

  if (!isOpen) return null;
  const selected = AVATAR_OPTIONS.find((option) => option.id === selectedId);
  const previewUrl = tab === 'catalog' && selected ? makeAvatarUrl(selected.id) : fileUrl ?? currentUrl;

  // Convert (cropX, cropY) ∈ [0,1] → a `translate` percentage on the
  // rendered, ZOOM-scaled image.
  //
  // Geometry recap (frame-relative coords, frame from 0 to W):
  //   - Image layout box: positioned at `left: 50%`, width W, so layout
  //     box spans [0.5W, 1.5W] with centre at W.
  //   - `transform: scale(ZOOM)` is applied around `transform-origin:
  //     center`, so the visual image is centred on the layout box centre
  //     (x = W). Visual width = W × ZOOM. Visual image extends from
  //     (W − 0.5 × W × ZOOM) to (W + 0.5 × W × ZOOM).
  //   - `transform: translate(Tx%)` shifts the visual image by Tx % of
  //     the LAYOUT BOX width (not the visual width). So Tx % = Tx × W / 100
  //     pixels.
  //
  // What we want:
  //   - cropX = 0.5 → image centred (visual centre at frame centre 0.5W).
  //     Layout box centre is at W, so we need translate of −0.5W = −50 %.
  //   - cropX = 0   → image's left edge (source column 0) at frame's left
  //     edge (0). Without translate, image visual left = W − 0.5 × W ×
  //     ZOOM = W × (1 − 0.5 × ZOOM). We need translate that brings
  //     visual left to 0, i.e. Tx = −100 × (1 − 0.5 × ZOOM) =
  //     50 × ZOOM − 100.
  //   - cropX = 1   → image's right edge (source column W_source) at
  //     frame's right edge (W). Visual right without translate =
  //     W × (1 + 0.5 × ZOOM). Translate = −100 × (0.5 × ZOOM) = −50 × ZOOM.
  //
  // Per-axis formula (linear interpolation between the three anchors):
  //   translateXPct = −50 + (0.5 − cropX) × 100 × (ZOOM − 1)
  //
  // Verify at ZOOM = 1.6:
  //   cropX = 0   → −50 + 30 = −20 %  (image left at 0.2W − 0.2W = 0)   ✓
  //   cropX = 0.5 → −50 %              (image centre at frame centre)   ✓
  //   cropX = 1   → −50 − 30 = −80 %   (image right at 1.8W − 0.8W = W) ✓
  const panRangePct = 100 * (ZOOM - 1);
  const translateXPct = -50 + (0.5 - cropX) * panRangePct;
  const translateYPct = -50 + (0.5 - cropY) * panRangePct;

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { setError(t('profile.avatar.invalidType', 'Choose a JPEG, PNG, GIF, or WebP image.')); return; }
    if (file.size > 10 * 1024 * 1024) { setError(t('profile.avatar.tooLarge', 'Images must be 10 MB or smaller.')); return; }
    setError(null);
    setTab('upload');
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(URL.createObjectURL(file));
    setCropX(0.5);
    setCropY(0.5);
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      let url = previewUrl;
      if (tab === 'upload' && fileUrl && imageRef.current) {
        const blob = await cropImage(imageRef.current, cropX, cropY);
        url = await upload.uploadImage(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
        if (!url) throw new Error(upload.error ?? t('profile.avatar.uploadFailed', 'Avatar upload failed.'));
      }
      if (!url) throw new Error(t('profile.avatar.chooseFirst', 'Choose an avatar or upload an image first.'));
      await onSave(url);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('profile.avatar.saveFailed', 'Could not update avatar.'));
    } finally { setIsSaving(false); }
  };

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title">
      <div className={styles.modal}>
        <header className={styles.header}><h2 id="avatar-picker-title">{t('profile.avatar.title', 'Choose profile picture')}</h2><button type="button" className={styles.iconButton} onClick={onClose} aria-label={t('common.close', 'Close')}><X size={20} /></button></header>
        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'catalog'} className={tab === 'catalog' ? styles.activeTab : styles.tab} onClick={() => setTab('catalog')}><Shapes size={16} />{t('profile.avatar.symbolicTab', 'Research symbols')}</button>
          <button type="button" role="tab" aria-selected={tab === 'upload'} className={tab === 'upload' ? styles.activeTab : styles.tab} onClick={() => setTab('upload')}><Upload size={16} />{t('profile.avatar.uploadTab', 'Upload photo')}</button>
        </div>
        <div className={styles.body}>
          {tab === 'catalog' ? <div className={styles.grid}>{AVATAR_OPTIONS.map((option) => { const Icon = option.icon; return <button key={option.id} type="button" aria-label={t(option.labelKey, option.id)} aria-pressed={selectedId === option.id} className={`${styles.option} ${selectedId === option.id ? styles.selected : ''}`} style={{ '--avatar-color': option.color } as React.CSSProperties} onClick={() => setSelectedId(option.id)}><Icon size={28} aria-hidden="true" />{selectedId === option.id ? <Check className={styles.check} size={14} /> : null}</button>; })}</div> : <div className={styles.uploadPanel}><label className={styles.uploadButton}><ImagePlus size={18} />{t('profile.avatar.choosePhoto', 'Choose image')}<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFile} /></label>{fileUrl ? (
            <>
              {/* Interactive circular picker — drag the photo to choose the
                  crop region. Replaces the previous Horizontal/Vertical
                  position range inputs. The stage is keyboard-focusable so
                  arrow keys nudge the crop region for accessibility. */}
              <div
                ref={stageRef}
                className={styles.cropStage}
                role="slider"
                aria-label={t('profile.avatar.cropStageLabel', 'Drag to reposition your avatar crop')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(cropX * 100)}
                aria-valuetext={`${Math.round(cropX * 100)}% horizontal, ${Math.round(cropY * 100)}% vertical`}
                tabIndex={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={handleStageKeyDown}
                style={{ cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
              >
                <img
                  ref={imageRef}
                  src={fileUrl}
                  alt={t('profile.avatar.cropPreview', 'Avatar crop preview')}
                  className={styles.cropStageImage}
                  draggable={false}
                  style={{ transform: `translate(${translateXPct}%, ${translateYPct}%) scale(${ZOOM})` }}
                />
                <span className={styles.cropStageHint} aria-hidden="true">
                  {t('profile.avatar.dragHint', 'Drag to reposition')}
                </span>
              </div>
              <div className={styles.cropActions}>
                <button
                  type="button"
                  className={styles.cropResetBtn}
                  onClick={() => { setCropX(0.5); setCropY(0.5); }}
                >
                  {t('profile.avatar.resetCrop', 'Center')}
                </button>
              </div>
            </>
          ) : <p className={styles.emptyUpload}>{t('profile.avatar.uploadHint', 'Select a square crop from your photo before saving.')}</p>}</div>}
          {previewUrl ? <div className={styles.preview}><span>{t('profile.avatar.preview', 'Preview')}</span>{selected && tab === 'catalog' ? <AvatarVisual url={previewUrl} initials="" size={48} /> : <img src={previewUrl} alt="" />}</div> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
        <footer className={styles.footer}><button type="button" className={styles.cancel} onClick={onClose}>{t('common.cancel', 'Cancel')}</button><button type="button" className={styles.save} onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? t('profile.avatar.saving', 'Saving...') : t('profile.avatar.save', 'Save avatar')}</button></footer>
      </div>
    </div>,
    document.body,
  );
};

