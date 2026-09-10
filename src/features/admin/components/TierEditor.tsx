import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  X,
  UploadCloud,
  Lock,
  Unlock,
  Sparkles,
  Award,
  Trophy,
  GraduationCap,
  BookOpen,
  Mic,
  Headphones,
  ClipboardCheck,
  ShieldCheck,
  Users,
  Flame,
  Star,
  FileText,
} from 'lucide-react';
import {
  type Medal,
  type MedalTier,
  type RoleTarget,
  type MedalCreateInput,
  MEDAL_CRITERIA_UNITS,
  criteriaUnitLabel,
  type MedalCriteriaUnit,
  PREDEFINED_METRICS,
  getAutoUnitForMetric,
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

const ACADEMIC_ICON_PRESETS = [
  { name: 'BookOpen', label: 'Bài báo', icon: BookOpen },
  { name: 'GraduationCap', label: 'Giảng dạy', icon: GraduationCap },
  { name: 'Award', label: 'Vinh danh', icon: Award },
  { name: 'Trophy', label: 'Thành tựu', icon: Trophy },
  { name: 'Mic', label: 'Diễn thuyết', icon: Mic },
  { name: 'Headphones', label: 'Tham dự', icon: Headphones },
  { name: 'ClipboardCheck', label: 'Thẩm định', icon: ClipboardCheck },
  { name: 'ShieldCheck', label: 'Xác thực', icon: ShieldCheck },
  { name: 'Sparkles', label: 'Xuất sắc', icon: Sparkles },
  { name: 'Users', label: 'Cộng đồng', icon: Users },
  { name: 'Flame', label: 'Tương tác', icon: Flame },
  { name: 'FileText', label: 'Đề tài', icon: FileText },
  { name: 'Star', label: 'Ngôi sao', icon: Star },
];

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
  const [previewTier, setPreviewTier] = useState<MedalTier>('Bronze');
  const [formStageLevel, setFormStageLevel] = useState<number>(1);
  const [formImageUrl, setFormImageUrl] = useState('lucide:Medal');
  const [formCriteriaMetric, setFormCriteriaMetric] = useState('');
  const [formCriteriaThreshold, setFormCriteriaThreshold] = useState<number>(1);
  const [formCriteriaUnit, setFormCriteriaUnit] = useState<MedalCriteriaUnit>('times');
  const [isUnitLocked, setIsUnitLocked] = useState<boolean>(true);
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
      setPreviewTier(medal.tier);
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
      setPreviewTier('Bronze');
      setFormStageLevel(1);
      setFormImageUrl('lucide:Medal');
      setFormCriteriaMetric('');
      setFormCriteriaThreshold(1);
      setFormCriteriaUnit('times');
      setFormIsActive(true);
    }
    setIsUnitLocked(true);
    setTitleError('');
  }, [mode, medal]);

  // Handle metric change with auto-filled locked unit
  const handleMetricChange = (metricVal: string) => {
    setFormCriteriaMetric(metricVal);
    if (isUnitLocked) {
      const autoUnit = getAutoUnitForMetric(metricVal);
      setFormCriteriaUnit(autoUnit);
    }
  };

  const handleTierSelect = (tier: MedalTier) => {
    setFormTier(tier);
    setPreviewTier(tier);
  };

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
      frameShape: 'circle',
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
            {/* Section 1: Identity & Tier Preview */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {t('admin.medals.modal.identity', 'Nhận diện & Khung xem trước')}
              </span>
            </div>
            <div className={styles.imageSectionCard}>
              <div className={styles.previewContainer}>
                <SafeMedalBadge
                  imageUrl={formImageUrl}
                  tier={previewTier}
                  size={104}
                  alt="Preview"
                />
                <div className={styles.tierPills} title={copy('Preview badge across tier frames', 'Xem trước viền khung theo từng Tier')}>
                  {TIER_OPTIONS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={`${styles.tierPillBtn} ${previewTier === tier ? styles.tierPillBtnActive : ''}`}
                      onClick={() => setPreviewTier(tier)}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

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

                {/* Curated Academic Icon Shortcuts */}
                <div className={styles.quickIconsGroup}>
                  <span className={styles.quickIconsLabel}>
                    {copy('Curated Academic Icons:', 'Biểu tượng học thuật nhanh:')}
                  </span>
                  <div className={styles.quickIconsRow}>
                    {ACADEMIC_ICON_PRESETS.map((item) => {
                      const IconComp = item.icon;
                      const isSelected = formImageUrl === `lucide:${item.name}`;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          className={`${styles.quickIconBtn} ${isSelected ? styles.quickIconBtnActive : ''}`}
                          onClick={() => setFormImageUrl(`lucide:${item.name}`)}
                          title={item.label}
                        >
                          <IconComp size={14} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
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

            {/* Section 2: Naming & Public Meta Description */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {t('admin.medals.modal.naming', 'Đặt tên & Mô tả công khai')}
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
                  placeholder="vd: Tác giả năng suất (Cấp 1 - Khởi đầu)"
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
                  placeholder="e.g.: Prolific Author (Bronze)"
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

            {/* Public Meta Description */}
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label htmlFor="formDescViInput" className={styles.formLabel}>
                  {t('admin.medals.modal.descVi', 'Mô tả công khai (Tiếng Việt - Public Meta Description)')}
                </label>
                <textarea
                  id="formDescViInput"
                  rows={2}
                  placeholder="vd: Xuất bản thành công bài báo khoa học đầu tiên trên hệ thống."
                  value={formDescriptionVi}
                  onChange={(e) => setFormDescriptionVi(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="formDescEnInput" className={styles.formLabel}>
                  {t('admin.medals.modal.descEn', 'Public Meta Description (English)')}
                </label>
                <textarea
                  id="formDescEnInput"
                  rows={2}
                  placeholder="e.g.: First research paper published on the ARS platform."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
            </div>
            <p className={styles.fieldHint}>
              {t(
                'admin.medals.modal.descHint',
                'Mô tả công khai lý do và giá trị của huy hiệu để người dùng có động lực phấn đấu.'
              )}
            </p>

            {/* Section 3: Tier & Stage Level */}
            <div className={styles.formGroup}>
              <span className={styles.sectionLabel}>
                {t('admin.medals.modal.rules', 'Cấp bậc & Tiến trình')}
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
                  onChange={(e) => handleTierSelect(e.target.value as MedalTier)}
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

            {/* Section 4: Activation Rules (Grouped Section) */}
            <div className={styles.activationRulesCard}>
              <div className={styles.activationRulesHeader}>
                <div>
                  <h4 className={styles.activationRulesTitle}>
                    {t('admin.medals.modal.activationRules', 'Quy tắc kích hoạt tự động (Activation Rules)')}
                  </h4>
                  <p className={styles.fieldHint}>
                    {t(
                      'admin.medals.modal.activationRulesHint',
                      'Cấu hình điều kiện để hệ thống tự động ghi nhận tiến trình và mở khóa huy hiệu.'
                    )}
                  </p>
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
                    list="predefinedMetricsList"
                    required
                    placeholder="vd: published_papers, hosted_seminars..."
                    value={formCriteriaMetric}
                    onChange={(e) => handleMetricChange(e.target.value)}
                    className={styles.formInput}
                  />
                  <datalist id="predefinedMetricsList">
                    {PREDEFINED_METRICS.map((pm) => (
                      <option
                        key={pm.metric}
                        value={pm.metric}
                        label={locale === 'vi' ? pm.labelVi : pm.labelEn}
                      />
                    ))}
                  </datalist>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label htmlFor="formCriteriaUnitSelect" className={styles.formLabel}>
                        {t('admin.medals.modal.unit', 'Đơn vị tính')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsUnitLocked(!isUnitLocked)}
                        className={styles.unitLockToggleBtn}
                        title={isUnitLocked ? copy('Click to unlock unit', 'Bấm để mở khóa đơn vị') : copy('Click to auto-lock unit', 'Bấm để khóa tự động theo chỉ số')}
                      >
                        {isUnitLocked ? <Lock size={12} className={styles.unitLockActiveIcon} /> : <Unlock size={12} />}
                        <span>{isUnitLocked ? copy('Locked', 'Đã khóa') : copy('Unlocked', 'Mở')}</span>
                      </button>
                    </div>

                    <div className={styles.unitSelectWrapper}>
                      <select
                        id="formCriteriaUnitSelect"
                        value={formCriteriaUnit}
                        disabled={isUnitLocked}
                        onChange={(e) => setFormCriteriaUnit(e.target.value as MedalCriteriaUnit)}
                        className={`${styles.formSelect} ${isUnitLocked ? styles.unitSelectLocked : ''}`}
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
              </div>

              {isUnitLocked && (
                <div className={styles.lockedUnitIndicator}>
                  <Lock size={12} />
                  <span>{t('admin.medals.modal.unitLockedHint', 'Đơn vị tính được khóa và tự động liên kết theo mã chỉ số đo lường.')}</span>
                </div>
              )}
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
