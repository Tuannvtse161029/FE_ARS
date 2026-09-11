/**
 * UnifiedIconPicker — Modal picker for medal artwork
 * 
 * Features:
 * - 4-tier badge preview (Bronze, Silver, Gold, Platinum)
 * - Tabbed interface: Library | Bold | Lucide | Upload | URL
 * - Search functionality
 * - Bilingual support (EN/VI)
 */
import { useState, useRef, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image as ImageIcon,
  UploadCloud,
  ExternalLink,
  HelpCircle,
  GalleryThumbnails,
  Sparkles,
  Medal as MedalIcon,
  Search,
} from 'lucide-react';
import {
  type MedalTier,
} from '../../../services/medal.service';
import { useFirebaseFileUpload } from '../../../hooks/useFirebaseFileUpload';
import { useI18n } from '../../../i18n/I18nContext';
import { SafeMedalBadge } from './SafeMedalBadge';
import { LucideIconPicker } from './LucideIconPicker';
import { BadgeArtworkPicker } from './BadgeArtworkPicker';
import { BoldArtworkPicker } from './BoldArtworkPicker';
import styles from './UnifiedIconPicker.module.css';

const TIER_PREVIEW: MedalTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

const TIER_LABELS: Record<MedalTier, { en: string; vi: string }> = {
  Bronze: { en: 'Bronze', vi: 'Đồng' },
  Silver: { en: 'Silver', vi: 'Bạc' },
  Gold: { en: 'Gold', vi: 'Vàng' },
  Platinum: { en: 'Platinum', vi: 'Bạch Kim' },
};

export interface UnifiedIconPickerProps {
  /** Current imageUrl value */
  value: string;
  /** Called when user selects an icon */
  onChange: (next: string) => void;
  /** Modal title */
  title?: string;
}

type TabId = 'library' | 'bold' | 'lucide' | 'upload' | 'url';

export const UnifiedIconPicker: React.FC<UnifiedIconPickerProps> = ({
  value,
  onChange,
  title,
}) => {
  const { locale } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const {
    uploadFile,
    progress: uploadProgress,
    isUploading,
    error: uploadError,
  } = useFirebaseFileUpload('medals/');

  const [activeTab, setActiveTab] = useState<TabId>('library');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: TabId; labelEn: string; labelVi: string; icon: typeof GalleryThumbnails }[] = [
    { id: 'library', labelEn: 'ARS Library', labelVi: 'Thư viện ARS', icon: GalleryThumbnails },
    { id: 'bold', labelEn: 'Bold designs', labelVi: 'Thiết kế cá tính', icon: Sparkles },
    { id: 'lucide', labelEn: 'Lucide icons', labelVi: 'Biểu tượng Lucide', icon: MedalIcon },
    { id: 'upload', labelEn: 'Upload file', labelVi: 'Tải lên', icon: UploadCloud },
    { id: 'url', labelEn: 'Image URL', labelVi: 'Đường dẫn ảnh', icon: ExternalLink },
  ];

  const handleUploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const downloadUrl = await uploadFile(file);
      if (downloadUrl) {
        onChange(downloadUrl);
      }
    } catch {
      // Error handled by hook
    }
  };

  const handleSaveUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
    }
  };

  const currentImageUrl = value || 'lucide:Medal';

  return createPortal(
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="icon-picker-title"
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <ImageIcon size={20} className={styles.titleIcon} />
            <h3 id="icon-picker-title" className={styles.modalTitle}>
              {title || copy('Choose medal icon', 'Chọn biểu tượng huy hiệu')}
            </h3>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={() => onChange(currentImageUrl)}
            aria-label={copy('Close', 'Đóng')}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.infoBanner}>
          <HelpCircle size={14} />
          <span>
            {copy(
              'This icon is shared by all tiers. Only the frame color changes per tier.',
              'Biểu tượng này dùng chung cho mọi cấp bậc. Chỉ màu khung đổi theo cấp.'
            )}
          </span>
        </div>

        <div className={styles.modalBody}>
          {/* 4-tier preview */}
          <div className={styles.previewSection}>
            <div className={styles.previewRow}>
              {TIER_PREVIEW.map((tier) => (
                <div key={tier} className={styles.previewCell}>
                  <SafeMedalBadge
                    imageUrl={currentImageUrl}
                    tier={tier}
                    size={72}
                    alt={`${tier} preview`}
                  />
                  <span className={`${styles.previewLabel} ${styles[`previewLabel--${tier.toLowerCase()}`]}`}>
                    {copy(TIER_LABELS[tier].en, TIER_LABELS[tier].vi)}
                  </span>
                </div>
              ))}
            </div>
            <span className={styles.previewHint}>
              {copy('Preview — same icon, different frame colors', 'Xem trước — cùng biểu tượng, khác màu khung')}
            </span>
          </div>

          {/* Tab bar */}
          <div className={styles.tabBar} role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} />
                  <span>{copy(tab.labelEn, tab.labelVi)}</span>
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className={styles.tabContent} role="tabpanel">
            {activeTab === 'library' && (
              <div className={styles.pickerWrapper}>
                <p className={styles.pickerLabel}>
                  {copy(
                    'Professional flat-color artwork from the ARS library:',
                    'Biểu tượng flat-color chuyên nghiệp từ thư viện ARS:'
                  )}
                </p>
                <BadgeArtworkPicker
                  value={currentImageUrl}
                  onChange={onChange}
                  id="unifiedIconLibrarySearch"
                />
              </div>
            )}

            {activeTab === 'bold' && (
              <div className={styles.pickerWrapper}>
                <p className={styles.pickerLabel}>
                  {copy(
                    'Bold, illustrated designs with gradients and glow:',
                    'Thiết kế cá tính với gradient và phát sáng:'
                  )}
                </p>
                <BoldArtworkPicker
                  value={currentImageUrl}
                  onChange={onChange}
                  id="unifiedIconBoldSearch"
                />
              </div>
            )}

            {activeTab === 'lucide' && (
              <div className={styles.pickerWrapper}>
                <p className={styles.pickerLabel}>
                  {copy(
                    'Select an icon from the Lucide library:',
                    'Chọn biểu tượng từ thư viện Lucide:'
                  )}
                </p>
                <LucideIconPicker
                  value={currentImageUrl}
                  onChange={onChange}
                  id="unifiedIconLucideSearch"
                />
              </div>
            )}

            {activeTab === 'upload' && (
              <div className={styles.uploadWrapper}>
                <input
                  type="file"
                  id="unifiedIconUploadFile"
                  ref={fileInputRef}
                  onChange={handleUploadFile}
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
                  <UploadCloud size={40} className={styles.uploadIcon} />
                  <p className={styles.uploadText}>
                    {isUploading
                      ? copy('Uploading to Firebase...', 'Đang tải lên Firebase...')
                      : copy(
                          'Click to select an image file',
                          'Bấm vào đây để chọn file ảnh'
                        )}
                  </p>
                  <span className={styles.uploadHint}>
                    {copy('Supports: PNG, JPG, WEBP, SVG (max 10MB)', 'Hỗ trợ: PNG, JPG, WEBP, SVG (tối đa 10MB)')}
                  </span>
                  {isUploading && (
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
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

            {activeTab === 'url' && (
              <div className={styles.urlWrapper}>
                <label htmlFor="iconUrlInput" className={styles.urlLabel}>
                  {copy('Online Image URL:', 'Đường dẫn ảnh trực tuyến:')}
                </label>
                <div className={styles.urlInputRow}>
                  <input
                    type="url"
                    id="iconUrlInput"
                    placeholder={copy(
                      'https://example.com/badge.png',
                      'https://example.com/hieu-bieu-tuong.png'
                    )}
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className={styles.urlInput}
                  />
                  <button
                    type="button"
                    className={styles.urlSaveBtn}
                    onClick={handleSaveUrl}
                    disabled={!urlInput.trim()}
                  >
                    <Search size={16} />
                    <span>{copy('Apply', 'Áp dụng')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UnifiedIconPicker;
