/**
 * TierEditor — medal create/edit form modal
 *
 * Extracted from src/pages/Admin/AdminMedals.tsx
 */
import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  X,
  UploadCloud,
} from 'lucide-react';
import {
  type Medal,
  type MedalTier,
  type RoleTarget,
  type MedalCreateInput,
  MEDAL_CRITERIA_UNITS,
  criteriaUnitLabel,
  type MedalCriteriaUnit,
} from '../../../services/medal.service';
import { useFirebaseFileUpload } from '../../../hooks/useFirebaseFileUpload';
import { useI18n } from '../../../i18n/I18nContext';
import { Button } from '../../../components/Button/Button';
import {
  SafeMedalBadge,
  resolveMedalIconName,
} from './SafeMedalBadge';
import { LucideIconPicker } from './LucideIconPicker';
import styles from './TierEditor.module.css';

const TIER_OPTIONS: MedalTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const ALL_ROLES: RoleTarget[] = [
  'Researcher',
  'Lecturer',
  'Reviewer',
  'Graduate Student',
];

const TIER_LABEL_KEY: Record<MedalTier, string> = {
  Bronze: 'admin.medals.tier.bronze',
  Silver: 'admin.medals.tier.silver',
  Gold: 'admin.medals.tier.gold',
  Platinum: 'admin.medals.tier.platinum',
};

export interface TierEditorProps {
  mode: 'create' | 'edit';
  medal: Medal | null;
  onSave: (payload: MedalCreateInput) => Promise<void>;
  onClose: () => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  locale: string;
}

export const TierEditor: React.FC<TierEditorProps> = ({
  mode,
  medal,
  onSave,
  onClose,
  showNotification,
  locale,
}) => {
  const { t } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const {
    uploadFile,
    isUploading,
  } = useFirebaseFileUpload('medals/');

  const [formTitle, setFormTitle] = useState('');
  const [formTitleVi, setFormTitleVi] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDescriptionVi, setFormDescriptionVi] = useState('');
  const [formRoles, setFormRoles] = useState<RoleTarget[]>([]);
  const [formTier, setFormTier] = useState<MedalTier>('Bronze');
  const [formStageLevel, setFormStageLevel] = useState<number>(1);
  const [formImageUrl, setFormImageUrl] = useState('lucide:Medal');
  const [formCriteriaMetric, setFormCriteriaMetric] = useState('');
  const [formCriteriaThreshold, setFormCriteriaThreshold] = useState<number>(1);
  const [formCriteriaUnit, setFormCriteriaUnit] = useState<MedalCriteriaUnit>('times');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [titleError, setTitleError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && medal) {
      setFormTitle(medal.title);
      setFormTitleVi(medal.titleVi);
      setFormDescription(medal.description);
      setFormDescriptionVi(medal.descriptionVi);
      setFormRoles(medal.roles);
      setFormTier(medal.tier);
      setFormStageLevel(medal.stageLevel);
      setFormImageUrl(medal.imageUrl || 'lucide:' + resolveMedalIconName(medal));
      setFormCriteriaMetric(medal.criteriaMetric);
      setFormCriteriaThreshold(medal.criteriaThreshold);
      setFormCriteriaUnit(medal.criteriaUnit);
      setFormIsActive(medal.isActive);
    } else if (mode === 'create') {
      setFormTitle('');
      setFormTitleVi('');
      setFormDescription('');
      setFormDescriptionVi('');
      setFormRoles(['Researcher', 'Lecturer', 'Reviewer', 'Graduate Student']);
      setFormTier('Bronze');
      setFormStageLevel(1);
      setFormImageUrl('lucide:Medal');
      setFormCriteriaMetric('');
      setFormCriteriaThreshold(1);
      setFormCriteriaUnit('times');
      setFormIsActive(true);
    }
    setTitleError('');
  }, [mode, medal]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formTitleVi.trim() && !formTitle.trim()) {
      setTitleError(
        t('admin.medals.error.titleRequired', 'Vui lòng nhập tên huy hiệu')
      );
      showNotification(
        t('admin.medals.error.titleRequired', 'Vui lòng nhập tên huy hiệu'),
        'error'
      );
      return;
    }
    setTitleError('');

    const payload: MedalCreateInput = {
      title: formTitle.trim() || formTitleVi.trim(),
      titleVi: formTitleVi.trim() || formTitle.trim(),
      description: formDescription.trim() || formDescriptionVi.trim(),
      descriptionVi: formDescriptionVi.trim() || formDescription.trim(),
      roles: formRoles.length > 0 ? formRoles : ['All'],
      tier: formTier,
      stageLevel: Number(formStageLevel) || 1,
      imageUrl: formImageUrl.trim() || 'lucide:Medal',
      criteriaMetric: formCriteriaMetric.trim() || 'default_metric',
      criteriaThreshold: Number(formCriteriaThreshold) || 1,
      criteriaUnit: formCriteriaUnit,
      isActive: formIsActive,
    };

    setIsSubmitting(true);
    try {
      await onSave(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {mode === 'create'
              ? t('admin.medals.modal.createTitle', 'Thêm huy hiệu vinh danh mới')
              : t('admin.medals.modal.editTitle', 'Chỉnh sửa huy hiệu')}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {/* Section 1: Identity */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {t('admin.medals.modal.identity', 'Nhận diện')}
              </span>
            </div>
            <div className={styles.imageSectionCard}>
              <SafeMedalBadge
                imageUrl={formImageUrl}
                tier={formTier}
                size={112}
                alt="Preview"
              />
              <div className={styles.imageUploadControls}>
                <label htmlFor="formImageUrlInput" className={styles.formLabel}>
                  {t('admin.medals.modal.artworkUrl', 'Biểu tượng / Hình ảnh (Mã Lucide hoặc URL)')}
                </label>
                <div className={styles.imageUrlRow}>
                  <input
                    type="text"
                    id="formImageUrlInput"
                    name="formImageUrlInput"
                    placeholder="vd: lucide:BookOpen hoặc https://..."
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className={styles.formInput}
                  />
                  <input
                    type="file"
                    id="formImageFileInput"
                    ref={modalFileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadFile(file);
                      if (url) setFormImageUrl(url);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.btnAction}
                    onClick={() => modalFileInputRef.current?.click()}
                    title={copy('Upload image to Firebase', 'Tải ảnh lên Firebase')}
                  >
                    <UploadCloud size={16} />
                    <span>{isUploading ? copy('Uploading...', 'Đang tải...') : copy('Upload', 'Upload')}</span>
                  </button>
                </div>

                <div className={styles.iconPickerGrid}>
                  <LucideIconPicker
                    value={formImageUrl}
                    onChange={setFormImageUrl}
                    id="tierEditorIconPickerSearch"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Naming */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {t('admin.medals.modal.naming', 'Đặt tên')}
              </span>
            </div>
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label htmlFor="formTitleViInput" className={styles.formLabel}>
                  {t('admin.medals.modal.titleVi', 'Tên huy hiệu (Tiếng Việt) *')}
                </label>
                <input
                  type="text"
                  id="formTitleViInput"
                  required
                  placeholder="vd: Học giả xác thực ORCID (Cấp 1 - Đồng)"
                  value={formTitleVi}
                  onChange={(e) => {
                    setFormTitleVi(e.target.value);
                    if (titleError) setTitleError('');
                  }}
                  className={`${styles.formInput} ${titleError ? styles.formInputError : ''}`}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="formTitleEnInput" className={styles.formLabel}>
                  {t('admin.medals.modal.titleEn', 'Tên huy hiệu (English)')}
                </label>
                <input
                  type="text"
                  id="formTitleEnInput"
                  placeholder="e.g.: ORCID Verified Scholar (Bronze)"
                  value={formTitle}
                  onChange={(e) => {
                    setFormTitle(e.target.value);
                    if (titleError) setTitleError('');
                  }}
                  className={styles.formInput}
                />
              </div>
            </div>
            {titleError && (
              <div className={styles.errorText} role="alert">
                {titleError}
              </div>
            )}

            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label htmlFor="formDescViInput" className={styles.formLabel}>
                  {t('admin.medals.modal.descVi', 'Mô tả điều kiện (Tiếng Việt)')}
                </label>
                <textarea
                  id="formDescViInput"
                  rows={2}
                  placeholder="vd: Đã liên kết và xác minh định danh khoa học quốc tế ORCID iD thành công."
                  value={formDescriptionVi}
                  onChange={(e) => setFormDescriptionVi(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="formDescEnInput" className={styles.formLabel}>
                  {t('admin.medals.modal.descEn', 'Mô tả điều kiện (English)')}
                </label>
                <textarea
                  id="formDescEnInput"
                  rows={2}
                  placeholder="e.g.: Successfully connected and verified an international ORCID iD."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
            </div>

            {/* Section 3: Rules */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {t('admin.medals.modal.rules', 'Quy tắc')}
              </span>
            </div>
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label htmlFor="formTierSelect" className={styles.formLabel}>
                  {t('admin.medals.modal.tier', 'Cấp bậc xếp hạng (Tier) *')}
                </label>
                <select
                  id="formTierSelect"
                  value={formTier}
                  onChange={(e) => setFormTier(e.target.value as MedalTier)}
                  className={styles.formSelect}
                >
                  {TIER_OPTIONS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier} — {t(TIER_LABEL_KEY[tier], tier)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="formStageLevelInput" className={styles.formLabel}>
                  {t('admin.medals.modal.stageLevel', 'Cấp độ tiến trình (Stage Level)')}
                </label>
                <input
                  type="number"
                  id="formStageLevelInput"
                  min={1}
                  max={10}
                  value={formStageLevel}
                  onChange={(e) => setFormStageLevel(parseInt(e.target.value, 10) || 1)}
                  className={styles.formInput}
                />
              </div>
            </div>

            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label htmlFor="formCriteriaMetricInput" className={styles.formLabel}>
                  {t('admin.medals.modal.metric', 'Mã chỉ số tự động (Metric Code) *')}
                </label>
                <input
                  type="text"
                  id="formCriteriaMetricInput"
                  required
                  placeholder="e.g.: orcid_connected, published_papers..."
                  value={formCriteriaMetric}
                  onChange={(e) => setFormCriteriaMetric(e.target.value)}
                  className={styles.formInput}
                />
              </div>
              <div className={styles.thresholdRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="formCriteriaThresholdInput" className={styles.formLabel}>
                    {t('admin.medals.modal.threshold', 'Ngưỡng đạt >=')}
                  </label>
                  <input
                    type="number"
                    id="formCriteriaThresholdInput"
                    min={1}
                    value={formCriteriaThreshold}
                    onChange={(e) => setFormCriteriaThreshold(parseInt(e.target.value, 10) || 1)}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formCriteriaUnitSelect" className={styles.formLabel}>
                    {t('admin.medals.modal.unit', 'Đơn vị tính')}
                  </label>
                  <select
                    id="formCriteriaUnitSelect"
                    value={formCriteriaUnit}
                    onChange={(e) => setFormCriteriaUnit(e.target.value as MedalCriteriaUnit)}
                    className={styles.formSelect}
                  >
                    {MEDAL_CRITERIA_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {criteriaUnitLabel(unit, locale as 'vi' | 'en')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Roles */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                {t('admin.medals.modal.roles', 'Vai trò áp dụng huy hiệu')}
              </label>
              <div className={styles.checkboxRoleGroup}>
                {ALL_ROLES.map((role) => {
                  const isChecked = formRoles.includes(role);
                  let label: string = role;
                  if (role === 'Researcher') label = t('admin.medals.role.researcher', 'Nhà nghiên cứu');
                  else if (role === 'Lecturer') label = t('admin.medals.role.lecturer', 'Giảng viên');
                  else if (role === 'Reviewer') label = t('admin.medals.role.reviewer', 'Người phản biện');
                  else if (role === 'Graduate Student') label = t('admin.medals.role.student', 'Học viên');
                  const inputId = `roleCheck_${role.replace(/\s+/g, '_')}`;
                  return (
                    <label key={role} htmlFor={inputId} className={styles.checkboxRoleItem}>
                      <input
                        type="checkbox"
                        id={inputId}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setFormRoles([...formRoles, role]);
                          else setFormRoles(formRoles.filter((r) => r !== role));
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Active switch */}
            <div className={styles.activeSwitch}>
              <input
                type="checkbox"
                id="isActiveSwitch"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              <label htmlFor="isActiveSwitch">
                {t('admin.medals.modal.active', 'Kích hoạt huy hiệu này ngay cho người dùng')}
              </label>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnAction} onClick={onClose}>
              {t('admin.medals.modal.cancel', 'Hủy bỏ')}
            </button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span>{copy('Saving...', 'Đang lưu...')}</span>
              ) : (
                <span>{mode === 'create' ? t('admin.medals.action.create', 'Tạo huy hiệu') : t('admin.medals.action.save', 'Lưu thay đổi')}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TierEditor;
