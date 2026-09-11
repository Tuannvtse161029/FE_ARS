/**
 * TemplateSelector — Preset criteria template list with tier breakdown
 *
 * Each template is shown as an expandable row that lists out each tier's
 * criteria (Bronze: ≥3 seminars, Silver: ≥5 seminars, etc.) so the admin
 * can see the exact thresholds before selecting. The selected template is
 * highlighted with the accent color and a checkmark.
 *
 * Features:
 * - List view (one template per row) instead of compact cards
 * - Per-tier breakdown: each tier shown with its target value + unit
 * - Visual feedback on selection
 * - Bilingual support (EN/VI)
 */
import { Check, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import {
  criteriaUnitLabel,
} from '../../../services/medal.service';
import {
  MEDAL_CRITERIA_CATALOG,
  type MedalCategoryCatalogItem,
  type MedalConditionPreset,
} from './TierEditor.catalog';
import styles from './TemplateSelector.module.css';

export interface TemplateSelectorProps {
  /** Currently selected template ID */
  selectedId?: string;
  /** Callback when a template is selected */
  onSelect: (template: MedalCategoryCatalogItem) => void;
  /** Optional: filter to specific metric codes */
  filterMetricCodes?: string[];
}

const TIER_COLORS: Record<string, string> = {
  Bronze: '#cd7f32',
  Silver: '#94a3b8',
  Gold: '#eab308',
  Platinum: '#38bdf8',
};

const TIER_LABELS: Record<string, { en: string; vi: string }> = {
  Bronze: { en: 'Bronze', vi: 'Đồng' },
  Silver: { en: 'Silver', vi: 'Bạc' },
  Gold: { en: 'Gold', vi: 'Vàng' },
  Platinum: { en: 'Platinum', vi: 'Bạch Kim' },
};

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedId,
  onSelect,
  filterMetricCodes,
}) => {
  const { locale } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);
  const [expandedId, setExpandedId] = useState<string | undefined>(selectedId);

  // Filter templates based on filterMetricCodes
  const templates = filterMetricCodes
    ? MEDAL_CRITERIA_CATALOG.filter(c => filterMetricCodes.includes(c.metric))
    : MEDAL_CRITERIA_CATALOG;

  // Filter out CUSTOM (no conditions)
  const validTemplates = templates.filter(c => c.conditions.length > 0);

  const handleToggleExpand = (templateId: string, template: MedalCategoryCatalogItem) => {
    if (expandedId === templateId) {
      setExpandedId(undefined);
    } else {
      setExpandedId(templateId);
      // Auto-select on expand so the admin doesn't need two clicks
      onSelect(template);
    }
  };

  const handleSelect = (template: MedalCategoryCatalogItem) => {
    onSelect(template);
    setExpandedId(template.id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Star size={14} className={styles.headerIcon} />
        <span className={styles.headerText}>
          {copy(
            'Select a predefined criteria template',
            'Chọn một mẫu tiêu chí có sẵn'
          )}
        </span>
        <span className={styles.headerHint}>
          {copy(
            'Each row shows the tier-by-tier breakdown',
            'Mỗi hàng hiển thị chi tiết target theo từng cấp'
          )}
        </span>
      </div>

      <div className={styles.list}>
        {validTemplates.map((template) => {
          const isSelected = selectedId === template.id;
          const isExpanded = expandedId === template.id;

          return (
            <div
              key={template.id}
              className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
            >
              <button
                type="button"
                className={styles.rowHeader}
                onClick={() => handleToggleExpand(template.id, template)}
                aria-expanded={isExpanded}
                aria-pressed={isSelected}
              >
                <div className={styles.rowHeaderLeft}>
                  <div className={styles.rowIcon}>
                    <Star size={16} />
                  </div>
                  <div className={styles.rowInfo}>
                    <div className={styles.rowName}>
                      {locale === 'vi' ? template.nameVi : template.nameEn}
                    </div>
                    <div className={styles.rowMetric}>{template.metric}</div>
                  </div>
                </div>
                <div className={styles.rowHeaderRight}>
                  {isSelected && (
                    <div className={styles.selectedBadge}>
                      <Check size={12} />
                      <span>{copy('Selected', 'Đã chọn')}</span>
                    </div>
                  )}
                  <span className={styles.expandIcon}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className={styles.rowBody}>
                  <TierBreakdown
                    conditions={template.conditions}
                    defaultUnit={template.unit}
                    locale={locale}
                    copyFn={copy}
                    onApply={() => handleSelect(template)}
                    isSelected={isSelected}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {validTemplates.length === 0 && (
        <div className={styles.emptyState}>
          <Star size={20} />
          <span>
            {copy(
              'No templates available for the selected metric',
              'Không có mẫu nào cho chỉ số đã chọn'
            )}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Tier breakdown list — renders each tier condition as a row showing
 * the tier name, stage level, target value, and unit.
 */
interface TierBreakdownProps {
  conditions: MedalConditionPreset[];
  defaultUnit: string;
  locale: string;
  copyFn: (en: string, vi: string) => string;
  onApply: () => void;
  isSelected: boolean;
}

const TierBreakdown: React.FC<TierBreakdownProps> = ({
  conditions,
  defaultUnit,
  locale,
  copyFn,
  onApply,
  isSelected,
}) => {
  return (
    <div className={styles.tierBreakdown}>
      <div className={styles.tierBreakdownHeader}>
        <span>{copyFn('Tier breakdown', 'Phân chia theo cấp')}</span>
        <span className={styles.tierBreakdownCount}>
          {conditions.length} {copyFn('tiers', 'cấp')}
        </span>
      </div>

      <div className={styles.tierList}>
        {conditions.map((cond, idx) => {
          const unit = cond.unit ?? defaultUnit;
          const unitLabel = criteriaUnitLabel(unit, locale as 'en' | 'vi');
          const color = TIER_COLORS[cond.tier] ?? '#94a3b8';
          const tierLabel = TIER_LABELS[cond.tier] ?? {
            en: cond.tier,
            vi: cond.tier,
          };

          return (
            <div key={`${cond.tier}-${idx}`} className={styles.tierLine}>
              <div className={styles.tierLineLeft}>
                <span
                  className={styles.tierDot}
                  style={{ backgroundColor: color }}
                />
                <span className={styles.tierName}>
                  {copyFn(tierLabel.en, tierLabel.vi)}
                </span>
                <span className={styles.tierLevel}>
                  {copyFn(`Level ${cond.stageLevel}`, `Cấp ${cond.stageLevel}`)}
                </span>
              </div>
              <div className={styles.tierLineRight}>
                <span className={styles.tierOperator}>≥</span>
                <span className={styles.tierTarget}>{cond.threshold}</span>
                <span className={styles.tierUnit}>{unitLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      {!isSelected && (
        <button
          type="button"
          className={styles.applyBtn}
          onClick={onApply}
        >
          <Check size={14} />
          <span>{copyFn('Apply this template', 'Áp dụng mẫu này')}</span>
        </button>
      )}
    </div>
  );
};

export default TemplateSelector;
