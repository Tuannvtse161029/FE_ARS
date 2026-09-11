/**
 * ArtworkUpload — quick icon/image change modal for medal families
 *
 * Extracted from src/pages/Admin/AdminMedals.tsx
 */
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Medal as MedalIcon,
  X,
  Image as ImageIcon,
  UploadCloud,
  ExternalLink,
  HelpCircle,
  GalleryThumbnails,
  Star,
} from 'lucide-react';
import {
  type Medal,
  type MedalTier,
} from '../../../services/medal.service';
import { useFirebaseFileUpload } from '../../../hooks/useFirebaseFileUpload';
import { useI18n } from '../../../i18n/I18nContext';
import { Button } from '../../../components/Button/Button';
import { SafeMedalBadge } from './SafeMedalBadge';
import { LucideIconPicker } from './LucideIconPicker';
import { BadgeArtworkPicker } from './BadgeArtworkPicker';
import { BoldArtworkPicker } from './BoldArtworkPicker';
import styles from './ArtworkUpload.module.css';

const TIER_PREVIEW: MedalTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export interface ArtworkUploadProps {
  medal: Medal;
  currentImageUrl: string;
  onSave: (next: { imageUrl: string }) => Promise<void>;
  onClose: () => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  locale: string;
}

export const ArtworkUpload: React.FC<ArtworkUploadProps> = ({
  medal,
  currentImageUrl,
  onSave,
  onClose,
  showNotification,
  locale,
}) => {
  const { t } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const {
    uploadFile,
    progress: uploadProgress,
    isUploading,
    error: uploadError,
  } = useFirebaseFileUpload('medals/');

  const [imageUrl, setImageUrl] = useState(currentImageUrl || `lucide:Medal`);
  // The frame-shape picker was removed — every medal renders as a
  // circle now. We still send `frameShape: 'circle'` in the save
  // payload (see `handleSave`) so the backend contract stays
  // unchanged.
  const [activeTab, setActiveTab] = useState<
    'library' | 'bold' | 'lucide' | 'upload' | 'url'
  >('library');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const medalTitle = locale === 'vi' ? medal.titleVi || medal.title : medal.title || medal.titleVi;

  const handleSave = async () => {
    const url = imageUrl.trim() || 'lucide:Medal';
    await onSave({ imageUrl: url });
  };

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const downloadUrl = await uploadFile(file);
      if (downloadUrl) {
        setImageUrl(downloadUrl);
        showNotification(
          t('admin.medals.success.uploaded', 'Tải ảnh lên Firebase thành công!')
        );
      }
    } catch {
      showNotification(
        t('admin.medals.error.uploadFailed', 'Không thể tải ảnh lên Firebase'),
        'error'
      );
    }
  };

  return createPortal(
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="artwork-upload-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <ImageIcon size={20} color="#d9a200" />
            <h3 id="artwork-upload-title" className={styles.modalTitle}>
              {copy(
                `Family Icon: ${medalTitle}`,
                `Biểu tượng huy hiệu: ${medalTitle}`
              )}
            </h3>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.infoBanner}>
          <HelpCircle size={14} />
          {copy(
            'This icon is shared by every tier (Bronze, Silver, Gold, Platinum) of this achievement. Only the frame colour changes per tier.',
            'Biểu tượng này dùng chung cho mọi cấp (Đồng, Bạc, Vàng, Bạch Kim). Chỉ màu khung đổi theo cấp.'
          )}
        </div>

        <div className={styles.modalBody}>
          {/* Preview — all 4 tiers */}
          <div className={styles.previewHero}>
            <div className={styles.tierPreviewRow}>
              {TIER_PREVIEW.map((tier) => (
                <div key={tier} className={styles.tierPreviewCell}>
                  <SafeMedalBadge
                    imageUrl={imageUrl}
                    code={medal.code}
                    criteriaMetric={medal.criteriaMetric}
                    tier={tier}
                    size={80}
                    alt={`${tier} preview`}
                  />
                  <span className={styles.tierPreviewLabel}>
                    {t(`admin.medals.tier.${tier.toLowerCase()}`, tier)}
                  </span>
                </div>
              ))}
            </div>
            <span className={styles.previewHint}>
              {t(
                'admin.medals.quick.previewFamily',
                'Xem trước — cùng một biểu tượng cho cả 4 cấp bậc (chỉ khác màu khung).'
              )}
            </span>
          </div>

          {/* Tabs */}
          <div className={styles.tabBar}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'library' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('library')}
            >
              <GalleryThumbnails size={16} />
              <span>{t('admin.medals.quick.tab.library', 'ARS Library')}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'bold' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('bold')}
            >
              <Star size={16} />
              <span>{t('admin.medals.quick.tab.bold', 'Bold designs')}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'lucide' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('lucide')}
            >
              <MedalIcon size={16} />
              <span>{t('admin.medals.quick.tab.lucide', 'Lucide icons')}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'upload' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <UploadCloud size={16} />
              <span>{t('admin.medals.quick.tab.upload', 'Upload file')}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'url' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('url')}
            >
              <ExternalLink size={16} />
              <span>{t('admin.medals.quick.tab.url', 'Image URL')}</span>
            </button>
          </div>

          {/* Curated ARS library */}
          {activeTab === 'library' && (
            <div className={styles.iconPickerWrapper}>
              <span className={styles.iconPickerLabel}>
                {copy(
                  'Pick a professional flat-color artwork from the curated ARS library:',
                  'Chọn biểu tượng flat-color chuyên nghiệp từ thư viện ARS:'
                )}
              </span>
              <BadgeArtworkPicker
                value={imageUrl}
                onChange={setImageUrl}
                id="artworkUploadLibrarySearch"
              />
            </div>
          )}

          {/* Bold / illustrative designs */}
          {activeTab === 'bold' && (
            <div className={styles.iconPickerWrapper}>
              <span className={styles.iconPickerLabel}>
                {copy(
                  'Pick a bolder, illustrated artwork with gradients, glow, and dramatic composition:',
                  'Chọn biểu tượng cá tính hơn với gradient, phát sáng và bố cục ấn tượng:'
                )}
              </span>
              <BoldArtworkPicker
                value={imageUrl}
                onChange={setImageUrl}
                id="artworkUploadBoldSearch"
              />
            </div>
          )}

          {/* Lucide icon picker */}
          {activeTab === 'lucide' && (
            <div className={styles.iconPickerWrapper}>
              <span className={styles.iconPickerLabel}>
                {copy('Select an icon from the lucide-react library:', 'Chọn biểu tượng chuẩn từ thư viện lucide-react:')}
              </span>
              <LucideIconPicker
                value={imageUrl}
                onChange={setImageUrl}
                id="artworkUploadIconPickerSearch"
              />
            </div>
          )}

          {/* Upload file */}
          {activeTab === 'upload' && (
            <div className={styles.uploadWrapper}>
              <input
                type="file"
                id="quickUploadFileInput"
                ref={fileInputRef}
                onChange={handlePickFile}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
              />
              <div
                className={styles.uploadDropArea}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <UploadCloud size={36} color="#facc15" />
                <p>
                  {isUploading
                    ? copy('Uploading to Firebase Storage...', 'Đang tải lên Firebase...')
                    : copy('Click here to select a custom image file', 'Bấm vào đây để chọn file ảnh riêng')}
                </p>
                <span>{t('admin.medals.quick.uploadHint', 'Hỗ trợ: PNG, JPG, WEBP, SVG (tối đa 10MB)')}</span>
                {isUploading && (
                  <div className={styles.progressBarWrapper}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
              {uploadError && (
                <p className={styles.errorText}>{uploadError}</p>
              )}
            </div>
          )}

          {/* Direct URL */}
          {activeTab === 'url' && (
            <div className={styles.formGroup}>
              <label htmlFor="quickImageUrlInput" className={styles.formLabel}>
                {copy('Online Image URL:', 'Đường dẫn ảnh trực tuyến (Image URL):')}
              </label>
              <input
                type="url"
                id="quickImageUrlInput"
                placeholder={t('admin.medals.quick.urlPlaceholder', 'https://example.com/badge.png')}
                value={imageUrl.startsWith('lucide:') ? '' : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className={styles.formInput}
              />
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnAction} onClick={onClose}>
            {t('admin.medals.modal.cancel', 'Hủy bỏ')}
          </button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!imageUrl.trim() || isUploading}
          >
            {t('admin.medals.modal.save', 'Lưu thay đổi')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ArtworkUpload;
