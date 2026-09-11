/**
 * TierEditor — Redesigned Medal Creation/Edit Modal
 *
 * Three-section layout:
 *   1. Icon & Tier Preview (4-tier badge row + unified picker)
 *   2. Medal Details (bilingual title with EN/VI toggle + description + roles)
 *   3. Tier & Activation Rules (metric dropdown + template/custom toggle)
 *
 * Key improvements over the previous design:
 *   - Clear visual hierarchy with section cards
 *   - Bilingual content with single language toggle (no mixed labels)
 *   - Unified icon picker (Library | Bold | Lucide | Upload | URL)
 *   - Template vs Custom mode for tier configuration
 *   - "Target" replaces "Threshold" for friendlier UX
 *   - Validation: Silver ≥ Bronze ≥ Gold ≥ Platinum
 */
import { useState, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image as ImageIcon,
  FileText,
  ListChecks,
  Globe,
  Star,
  PenLine,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import {
  type Medal,
  type MedalTier,
  type MedalTierCount,
  type RoleTarget,
  type MedalCreateInput,
  type TierTarget,
  PREDEFINED_METRICS,
  getAutoUnitForMetric,
} from '../../../services/medal.service';
import { useI18n } from '../../../i18n/I18nContext';
import { Button } from '../../../components/Button/Button';
import { SafeMedalBadge, resolveMedalIconName } from './SafeMedalBadge';
import { UnifiedIconPicker } from './UnifiedIconPicker';
import { CustomTierEditor } from './CustomTierEditor';
import { TemplateSelector } from './TemplateSelector';
import {
  MEDAL_CRITERIA_CATALOG,
  type MedalConditionPreset,
  type MedalCategoryCatalogItem,
} from './TierEditor.catalog';
import styles from './TierEditor.module.css';

const TIER_OPTIONS: MedalTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const ALL_ROLES: RoleTarget[] = [
  'Researcher',
  'Lecturer',
  'Reviewer',
  'Graduate Student',
];

const TIER_LABELS: Record<MedalTier, { en: string; vi: string }> = {
  Bronze: { en: 'Bronze', vi: 'Đồng' },
  Silver: { en: 'Silver', vi: 'Bạc' },
  Gold: { en: 'Gold', vi: 'Vàng' },
  Platinum: { en: 'Platinum', vi: 'Bạch Kim' },
};

const DEFAULT_TARGETS: Record<MedalTierCount, TierTarget[]> = {
  2: [
    { tier: 'Bronze', target: 1, stageLevel: 1 },
    { tier: 'Silver', target: 5, stageLevel: 2 },
  ],
  3: [
    { tier: 'Bronze', target: 1, stageLevel: 1 },
    { tier: 'Silver', target: 5, stageLevel: 2 },
    { tier: 'Gold', target: 10, stageLevel: 3 },
  ],
  4: [
    { tier: 'Bronze', target: 1, stageLevel: 1 },
    { tier: 'Silver', target: 5, stageLevel: 2 },
    { tier: 'Gold', target: 10, stageLevel: 3 },
    { tier: 'Platinum', target: 25, stageLevel: 4 },
  ],
};

export type { MedalConditionPreset, MedalCategoryCatalogItem };

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

  // ============ Form State ============
  const [imageUrl, setImageUrl] = useState('lucide:Medal');
  const [title, setTitle] = useState('');
  const [titleVi, setTitleVi] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionVi, setDescriptionVi] = useState('');
  const [roles, setRoles] = useState<RoleTarget[]>([]);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Bilingual editing mode — single locale input switch
  const [editLang, setEditLang] = useState<'en' | 'vi'>('vi');

  // Tier & Activation Rules
  const [metricCode, setMetricCode] = useState<string>('published_papers');
  const [useTemplate, setUseTemplate] = useState<boolean>(true);
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [tierCount, setTierCount] = useState<MedalTierCount>(4);
  const [targets, setTargets] = useState<TierTarget[]>(DEFAULT_TARGETS[4]);

  // UI State
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [titleError, setTitleError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============ Effects ============

  // Populate form when editing or initializing
  useEffect(() => {
    if (mode === 'edit' && medal) {
      setImageUrl(medal.imageUrl || 'lucide:' + resolveMedalIconName(medal));
      setTitle(medal.title);
      setTitleVi(medal.titleVi);
      setDescription(medal.description);
      setDescriptionVi(medal.descriptionVi);
      setRoles(medal.roles);
      setIsActive(medal.isActive);
      setMetricCode(medal.criteriaMetric);

      const matchedCat = MEDAL_CRITERIA_CATALOG.find(
        c => c.metric === medal.criteriaMetric,
      );

      if (matchedCat) {
        // Template mode — use the matched catalog's conditions
        setUseTemplate(true);
        setTemplateId(matchedCat.id);
        const conditions = matchedCat.conditions;
        const newCount = Math.min(conditions.length, 4) as MedalTierCount;
        setTierCount(newCount);
        setTargets(
          conditions.slice(0, newCount).map(c => ({
            tier: c.tier,
            target: c.threshold,
            stageLevel: c.stageLevel,
          })),
        );
      } else {
        // Custom mode — use medal's individual threshold
        setUseTemplate(false);
        setTemplateId(undefined);
        setTierCount(4);
        // For edit mode, only set the current tier; admin will need to
        // configure other tiers or apply a template
        setTargets([
          { tier: medal.tier, target: medal.criteriaThreshold, stageLevel: medal.stageLevel },
          // Fill remaining tiers with monotonic defaults
          ...DEFAULT_TARGETS[4].filter(t => t.tier !== medal.tier),
        ]);
      }
    } else if (mode === 'create') {
      // Default state for create mode
      const defaultFam = MEDAL_CRITERIA_CATALOG[0];
      setImageUrl(defaultFam.defaultIcon);
      setTitle(defaultFam.conditions[0]?.titleEn ?? '');
      setTitleVi(defaultFam.conditions[0]?.titleVi ?? '');
      setDescription(defaultFam.conditions[0]?.descriptionEn ?? '');
      setDescriptionVi(defaultFam.conditions[0]?.descriptionVi ?? '');
      setRoles(defaultFam.roles);
      setMetricCode(defaultFam.metric);
      setUseTemplate(true);
      setTemplateId(defaultFam.id);
      const newCount = Math.min(defaultFam.conditions.length, 4) as MedalTierCount;
      setTierCount(newCount);
      setTargets(
        defaultFam.conditions.slice(0, newCount).map(c => ({
          tier: c.tier,
          target: c.threshold,
          stageLevel: c.stageLevel,
        })),
      );
      setIsActive(true);
    }
    setTitleError('');
    setEditLang(locale === 'vi' ? 'vi' : 'en');
  }, [mode, medal, locale]);

  // ============ Handlers ============

  const handleTemplateSelect = (template: MedalCategoryCatalogItem) => {
    setTemplateId(template.id);
    setMetricCode(template.metric);
    setRoles(template.roles);

    // Auto-fill targets from template
    const newCount = Math.min(template.conditions.length, 4) as MedalTierCount;
    setTierCount(newCount);
    setTargets(
      template.conditions.slice(0, newCount).map(c => ({
        tier: c.tier,
        target: c.threshold,
        stageLevel: c.stageLevel,
      })),
    );

    // Auto-fill titles/descriptions from the first condition
    if (template.conditions.length > 0) {
      const first = template.conditions[0];
      setTitleVi(first.titleVi);
      setTitle(first.titleEn);
      setDescriptionVi(first.descriptionVi);
      setDescription(first.descriptionEn);
    }

    if (template.defaultIcon) {
      setImageUrl(template.defaultIcon);
    }
  };

  const handleModeChange = (mode: 'template' | 'custom') => {
    if (mode === 'template') {
      setUseTemplate(true);
      if (templateId) {
        const template = MEDAL_CRITERIA_CATALOG.find(c => c.id === templateId);
        if (template) {
          handleTemplateSelect(template);
        }
      }
    } else {
      setUseTemplate(false);
      setTemplateId(undefined);
    }
  };

  const handleMetricChange = (newMetric: string) => {
    setMetricCode(newMetric);
  };

  const handleTierCountChange = (count: MedalTierCount) => {
    setTierCount(count);
    // Ensure targets array matches tierCount
    if (targets.length > count) {
      setTargets(targets.slice(0, count));
    } else if (targets.length < count) {
      const additional = DEFAULT_TARGETS[count].slice(targets.length);
      setTargets([...targets, ...additional]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!titleVi.trim() && !title.trim()) {
      const errorMsg = t('admin.medals.error.titleRequired', 'Vui lòng nhập tên huy hiệu');
      setTitleError(errorMsg);
      showNotification(errorMsg, 'error');
      return;
    }

    if (roles.length === 0) {
      showNotification(
        copy('Please select at least one role', 'Vui lòng chọn ít nhất một vai trò'),
        'error'
      );
      return;
    }

    setTitleError('');

    // Build the payload — for simplicity, we save with the first tier's
    // data. The full multi-tier configuration is reflected in the local
    // state for now. The BE will be updated to support bulk create.
    const firstTarget = targets[0];
    const unit = getAutoUnitForMetric(metricCode);

    const payload: MedalCreateInput = {
      title: title.trim() || titleVi.trim(),
      titleVi: titleVi.trim() || title.trim(),
      description: description.trim() || descriptionVi.trim(),
      descriptionVi: descriptionVi.trim() || description.trim(),
      roles: roles,
      tier: firstTarget.tier,
      stageLevel: firstTarget.stageLevel,
      imageUrl: imageUrl.trim() || 'lucide:Medal',
      frameShape: 'circle',
      criteriaMetric: metricCode.trim(),
      criteriaThreshold: firstTarget.target,
      criteriaUnit: unit,
      isActive,
    };

    setIsSubmitting(true);
    try {
      await onSave(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============ Render ============

  return createPortal(
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="medal-editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3 id="medal-editor-title" className={styles.modalTitle}>
            {mode === 'create'
              ? copy('Create new medal', 'Thêm huy hiệu mới')
              : copy('Edit medal', 'Chỉnh sửa huy hiệu')}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label={copy('Close', 'Đóng')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {/* ============================================================
                SECTION 1: Icon & Tier Preview
                ============================================================ */}
            <div className={styles.iconPreviewSection}>
              <div className={styles.tierPreviewRow}>
                {TIER_OPTIONS.map((tier) => (
                  <div key={tier} className={styles.tierPreviewCell}>
                    <SafeMedalBadge
                      imageUrl={imageUrl}
                      tier={tier}
                      size={64}
                      alt={`${tier} preview`}
                    />
                    <span className={`${styles.tierPreviewLabel} ${styles[`tierPreviewLabel--${tier.toLowerCase()}`]}`}>
                      {copy(TIER_LABELS[tier].en, TIER_LABELS[tier].vi)}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className={styles.iconPickerButton}
                onClick={() => setShowIconPicker(true)}
              >
                <ImageIcon size={16} />
                <span>
                  {copy('Choose icon', 'Chọn biểu tượng')}
                </span>
              </button>
            </div>

            {/* ============================================================
                SECTION 2: Medal Details
                ============================================================ */}
            <div className={`${styles.sectionCard}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h4 className={styles.sectionTitle}>
                    <FileText size={16} className={styles.sectionTitleIcon} />
                    <span>
                      {copy('Medal details', 'Thông tin huy hiệu')}
                    </span>
                  </h4>
                  <p className={styles.sectionSubtitle}>
                    {copy(
                      'Title and description shown on the medal card and tooltip.',
                      'Tên và mô tả hiển thị trên thẻ huy hiệu và tooltip.'
                    )}
                  </p>
                </div>
              </div>

              <div className={styles.detailsSection}>
                {/* Language Toggle */}
                <div className={styles.languageToggle} role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editLang === 'en'}
                    className={`${styles.languageToggleBtn} ${editLang === 'en' ? styles.languageToggleBtnActive : ''}`}
                    onClick={() => setEditLang('en')}
                  >
                    <Globe size={12} />
                    <span>EN</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editLang === 'vi'}
                    className={`${styles.languageToggleBtn} ${editLang === 'vi' ? styles.languageToggleBtnActive : ''}`}
                    onClick={() => setEditLang('vi')}
                  >
                    <Globe size={12} />
                    <span>VI</span>
                  </button>
                </div>

                {/* Title Input */}
                <div className={styles.formGroup}>
                  <label htmlFor="medalTitleInput" className={`${styles.formLabel} ${styles['formLabel--required']}`}>
                    {editLang === 'vi' ? 'Tên huy hiệu' : 'Medal title'}
                  </label>
                  {editLang === 'vi' ? (
                    <input
                      type="text"
                      id="medalTitleInput"
                      required
                      placeholder={copy(
                        'e.g., Prolific Author (Bronze)',
                        'ví dụ: Tác giả năng suất (Đồng)'
                      )}
                      value={titleVi}
                      onChange={(e) => {
                        setTitleVi(e.target.value);
                        if (titleError) setTitleError('');
                      }}
                      className={`${styles.formInput} ${titleError ? styles['formInput--error'] : ''}`}
                    />
                  ) : (
                    <input
                      type="text"
                      id="medalTitleInput"
                      required
                      placeholder={copy(
                        'e.g., Prolific Author (Bronze)',
                        'ví dụ: Tác giả năng suất (Đồng)'
                      )}
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (titleError) setTitleError('');
                      }}
                      className={`${styles.formInput} ${titleError ? styles['formInput--error'] : ''}`}
                    />
                  )}
                  {titleError && (
                    <div className={styles.errorText} role="alert">
                      {titleError}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className={styles.formGroup}>
                  <label htmlFor="medalDescInput" className={styles.formLabel}>
                    {editLang === 'vi' ? 'Mô tả (hiển thị khi hover)' : 'Description (shown on hover)'}
                  </label>
                  {editLang === 'vi' ? (
                    <textarea
                      id="medalDescInput"
                      rows={2}
                      placeholder={copy(
                        'e.g., First research paper published on the ARS platform.',
                        'ví dụ: Xuất bản thành công bài báo khoa học đầu tiên trên hệ thống.'
                      )}
                      value={descriptionVi}
                      onChange={(e) => setDescriptionVi(e.target.value)}
                      className={styles.formTextarea}
                    />
                  ) : (
                    <textarea
                      id="medalDescInput"
                      rows={2}
                      placeholder={copy(
                        'e.g., First research paper published on the ARS platform.',
                        'ví dụ: Xuất bản thành công bài báo khoa học đầu tiên trên hệ thống.'
                      )}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={styles.formTextarea}
                    />
                  )}
                </div>

                {/* Roles */}
                <div className={styles.formGroup}>
                  <span className={styles.formLabel}>
                    {copy('Applicable roles', 'Vai trò áp dụng')}
                  </span>
                  <div className={styles.roleGroup}>
                    {ALL_ROLES.map((role) => {
                      const isChecked = roles.includes(role);
                      let label: string = role;
                      let tagClass: string = '';
                      if (role === 'Researcher') {
                        label = copy('Researcher', 'Nhà nghiên cứu');
                        tagClass = styles['roleTag--researcher'] ?? '';
                      } else if (role === 'Lecturer') {
                        label = copy('Lecturer', 'Giảng viên');
                        tagClass = styles['roleTag--lecturer'] ?? '';
                      } else if (role === 'Reviewer') {
                        label = copy('Reviewer', 'Người phản biện');
                        tagClass = styles['roleTag--reviewer'] ?? '';
                      } else if (role === 'Graduate Student') {
                        label = copy('Graduate Student', 'Học viên');
                        tagClass = styles['roleTag--student'] ?? '';
                      }
                      return (
                        <label key={role} className={styles.roleCheckbox}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRoles([...roles, role]);
                              } else {
                                setRoles(roles.filter(r => r !== role));
                              }
                            }}
                          />
                          <span className={`${styles.roleTag} ${tagClass}`}>
                            {label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================
                SECTION 3: Tier & Activation Rules
                ============================================================ */}
            <div className={`${styles.sectionCard} ${styles['sectionCard--accent']}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h4 className={styles.sectionTitle}>
                    <ListChecks size={16} className={styles.sectionTitleIcon} />
                    <span>
                      {copy('Tier & activation rules', 'Tiêu chí & cấp bậc')}
                    </span>
                  </h4>
                  <p className={styles.sectionSubtitle}>
                    {copy(
                      'Configure the metric and target values for each tier.',
                      'Cấu hình chỉ số đo lường và target cho từng cấp bậc.'
                    )}
                  </p>
                </div>
              </div>

              <div className={styles.tierRulesSection}>
                {/* Metric Dropdown */}
                <div className={styles.metricDropdownGroup}>
                  <label htmlFor="metricDropdown" className={`${styles.formLabel} ${styles['formLabel--required']}`}>
                    {copy('Measurement metric', 'Chỉ số đo lường')}
                  </label>
                  <select
                    id="metricDropdown"
                    value={metricCode}
                    onChange={(e) => handleMetricChange(e.target.value)}
                    className={styles.metricDropdown}
                  >
                    {PREDEFINED_METRICS.map((pm) => (
                      <option key={pm.metric} value={pm.metric}>
                        {locale === 'vi' ? pm.labelVi : pm.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mode Toggle */}
                <div className={styles.modeToggle} role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={useTemplate}
                    className={`${styles.modeToggleBtn} ${useTemplate ? `${styles['modeToggleBtn--active']} ${styles.useTemplate}` : ''}`}
                    onClick={() => handleModeChange('template')}
                  >
                    <Star size={16} />
                    <span>{copy('Use template', 'Sử dụng mẫu')}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!useTemplate}
                    className={`${styles.modeToggleBtn} ${!useTemplate ? `${styles['modeToggleBtn--active']} ${styles.customTarget}` : ''}`}
                    onClick={() => handleModeChange('custom')}
                  >
                    <PenLine size={16} />
                    <span>{copy('Custom targets', 'Tùy chỉnh target')}</span>
                  </button>
                </div>

                {/* Template Mode */}
                {useTemplate && (
                  <TemplateSelector
                    selectedId={templateId}
                    onSelect={handleTemplateSelect}
                    filterMetricCodes={[metricCode]}
                  />
                )}

                {/* Custom Mode */}
                {!useTemplate && (
                  <CustomTierEditor
                    metricCode={metricCode}
                    targets={targets}
                    tierCount={tierCount}
                    onTargetsChange={setTargets}
                    onTierCountChange={handleTierCountChange}
                  />
                )}
              </div>
            </div>

            {/* Active Switch */}
            <div className={styles.activeSwitch}>
              <input
                type="checkbox"
                id="isActiveSwitch"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isActiveSwitch">
                {copy('Activate this medal immediately for users', 'Kích hoạt huy hiệu này ngay cho người dùng')}
              </label>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnAction} onClick={onClose}>
              {copy('Cancel', 'Hủy bỏ')}
            </button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                copy('Saving...', 'Đang lưu...')
              ) : (
                <>
                  {mode === 'create' ? <Plus size={16} /> : <CheckCircle2 size={16} />}
                  <span>
                    {mode === 'create'
                      ? copy('Create medal', 'Tạo huy hiệu')
                      : copy('Save changes', 'Lưu thay đổi')}
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Icon Picker Modal */}
      {showIconPicker && (
        <UnifiedIconPicker
          value={imageUrl}
          onChange={(next) => {
            setImageUrl(next);
            setShowIconPicker(false);
          }}
          title={copy('Choose medal icon', 'Chọn biểu tượng huy hiệu')}
        />
      )}
    </div>,
    document.body
  );
};

export default TierEditor;
