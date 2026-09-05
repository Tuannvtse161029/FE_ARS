/**
 * ArtworkUpload — quick icon/image change modal for medal families
 *
 * Extracted from src/pages/Admin/AdminMedals.tsx
 */
import { useState, useRef } from 'react';
import {
  Medal as MedalIcon,
  X,
  Image as ImageIcon,
  UploadCloud,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { type Medal, type MedalTier } from '../../../services/medal.service';
import { useFirebaseFileUpload } from '../../../hooks/useFirebaseFileUpload';
import { useI18n } from '../../../i18n/I18nContext';
import { Button } from '../../../components/Button/Button';
import {
  SafeMedalBadge,
  LUCIDE_ICONS_MAP,
  LUCIDE_ICONS_LIST,
} from './SafeMedalBadge';
import styles from './ArtworkUpload.module.css';

const TIER_PREVIEW: MedalTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export interface ArtworkUploadProps {
  medal: Medal;
  currentImageUrl: string;
  onSave: (newImageUrl: string) => Promise<void>;
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
  const [activeTab, setActiveTab] = useState<'lucide' | 'upload' | 'url'>('lucide');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const medalTitle = locale === 'vi' ? medal.titleVi || medal.title : medal.title || medal.titleVi;

  const handleSave = async () => {
    const url = imageUrl.trim() || 'lucide:Medal';
    await onSave(url);
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

  return (
    <div className={styles.modalOverlay} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <ImageIcon size={20} color="#2563eb" />
            <h3 className={styles.modalTitle}>
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
              className={`${styles.tabBtn} ${activeTab === 'lucide' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('lucide')}
            >
              <MedalIcon size={16} />
              <span>{t('admin.medals.quick.tab.lucide', 'Biểu tượng Lucide')}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'upload' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <UploadCloud size={16} />
              <span>{t('admin.medals.quick.tab.upload', 'Tải file ảnh')}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'url' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('url')}
            >
              <ExternalLink size={16} />
              <span>{t('admin.medals.quick.tab.url', 'Link ảnh')}</span>
            </button>
          </div>

          {/* Lucide icon picker */}
          {activeTab === 'lucide' && (
            <div className={styles.iconPickerWrapper}>
              <span className={styles.iconPickerLabel}>
                {copy('Select an icon from the lucide-react library:', 'Chọn biểu tượng chuẩn từ thư viện lucide-react:')}
              </span>
              <div className={styles.iconPickerGrid}>
                {LUCIDE_ICONS_LIST.map((item) => {
                  const IconComp = LUCIDE_ICONS_MAP[item.name] || MedalIcon;
                  const isSelected = imageUrl === `lucide:${item.name}`;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      className={`${styles.iconPickerItem} ${isSelected ? styles.iconPickerItemActive : ''}`}
                      onClick={() => setImageUrl(`lucide:${item.name}`)}
                    >
                      <IconComp size={24} color={isSelected ? '#1d4ed8' : '#475569'} />
                      <span>{locale === 'vi' ? item.labelVi : item.labelEn}</span>
                    </button>
                  );
                })}
              </div>
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
                <UploadCloud size={36} color="#3b82f6" />
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
    </div>
  );
};

export default ArtworkUpload;
