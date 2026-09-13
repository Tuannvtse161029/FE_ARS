import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
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

const makeAvatarUrl = (id: string) => `lucide:${id}`;

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
  const upload = useImageUpload(`avatars/${userId}/`);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = ''; };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const selected = AVATAR_OPTIONS.find((option) => option.id === selectedId);
  const previewUrl = tab === 'catalog' && selected ? makeAvatarUrl(selected.id) : fileUrl ?? currentUrl;
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { setError(t('profile.avatar.invalidType', 'Choose a JPEG, PNG, GIF, or WebP image.')); return; }
    if (file.size > 10 * 1024 * 1024) { setError(t('profile.avatar.tooLarge', 'Images must be 10 MB or smaller.')); return; }
    setError(null);
    setTab('upload');
    setFileUrl(URL.createObjectURL(file));
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
          {tab === 'catalog' ? <div className={styles.grid}>{AVATAR_OPTIONS.map((option) => { const Icon = option.icon; return <button key={option.id} type="button" aria-label={t(option.labelKey, option.id)} aria-pressed={selectedId === option.id} className={`${styles.option} ${selectedId === option.id ? styles.selected : ''}`} style={{ '--avatar-color': option.color } as React.CSSProperties} onClick={() => setSelectedId(option.id)}><Icon size={28} aria-hidden="true" />{selectedId === option.id ? <Check className={styles.check} size={14} /> : null}</button>; })}</div> : <div className={styles.uploadPanel}><label className={styles.uploadButton}><ImagePlus size={18} />{t('profile.avatar.choosePhoto', 'Choose image')}<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFile} /></label>{fileUrl ? <><div className={styles.cropStage}><img ref={imageRef} src={fileUrl} alt={t('profile.avatar.cropPreview', 'Avatar crop preview')} style={{ objectPosition: `${cropX * 100}% ${cropY * 100}%` }} /></div><label className={styles.rangeLabel}>{t('profile.avatar.horizontalPosition', 'Horizontal position')}<input type="range" min="0" max="1" step="0.01" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} /></label><label className={styles.rangeLabel}>{t('profile.avatar.verticalPosition', 'Vertical position')}<input type="range" min="0" max="1" step="0.01" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} /></label></> : <p className={styles.emptyUpload}>{t('profile.avatar.uploadHint', 'Select a square crop from your photo before saving.')}</p>}</div>}
          {previewUrl ? <div className={styles.preview}><span>{t('profile.avatar.preview', 'Preview')}</span>{selected && tab === 'catalog' ? <AvatarVisual url={previewUrl} initials="" size={48} /> : <img src={previewUrl} alt="" />}</div> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
        <footer className={styles.footer}><button type="button" className={styles.cancel} onClick={onClose}>{t('common.cancel', 'Cancel')}</button><button type="button" className={styles.save} onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? t('profile.avatar.saving', 'Saving...') : t('profile.avatar.save', 'Save avatar')}</button></footer>
      </div>
    </div>,
    document.body,
  );
};

