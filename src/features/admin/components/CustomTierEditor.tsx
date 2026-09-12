/**
 * CustomTierEditor — Custom tier target configuration
 * 
 * Features:
 * - Tier count selector (2, 3, or 4 tiers)
 * - Visual tier ladder with target inputs
 * - Real-time validation (monotonic increasing targets)
 * - Unit auto-selection from metric
 */
import { useMemo } from 'react';
import { AlertCircle, CheckCircle, ArrowUp } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import {
  type MedalTier,
  type MedalCriteriaUnit,
  type TierTarget,
  PREDEFINED_METRICS,
  getAutoUnitForMetric,
  criteriaUnitLabel,
} from '../../../services/medal.service';
import styles from './CustomTierEditor.module.css';

export interface CustomTierEditorProps {
  /** Selected metric code */
  metricCode: string;
  /** Current tier targets */
  targets: TierTarget[];
  /** Number of active tiers (2-4) */
  tierCount: 2 | 3 | 4;
  /** Callback when targets change */
  onTargetsChange: (targets: TierTarget[]) => void;
  /** Callback when tier count changes */
  onTierCountChange: (count: 2 | 3 | 4) => void;
}

const ALL_TIERS: MedalTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

const TIER_LABELS: Record<MedalTier, { en: string; vi: string }> = {
  Bronze: { en: 'Bronze', vi: 'Đồng' },
  Silver: { en: 'Silver', vi: 'Bạc' },
  Gold: { en: 'Gold', vi: 'Vàng' },
  Platinum: { en: 'Platinum', vi: 'Bạch Kim' },
};

const TIER_COLORS: Record<MedalTier, string> = {
  Bronze: '#cd7f32',
  Silver: '#94a3b8',
  Gold: '#eab308',
  Platinum: '#38bdf8',
};

export const CustomTierEditor = ({
  metricCode,
  targets,
  tierCount,
  onTargetsChange,
  onTierCountChange,
}: CustomTierEditorProps) => {
  const { locale } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  // Get active tiers based on tierCount
  const activeTiers = ALL_TIERS.slice(0, tierCount);

  // Auto-determine unit from metric
  const unit: MedalCriteriaUnit = getAutoUnitForMetric(metricCode);
  const unitLabel = criteriaUnitLabel(unit, locale as 'en' | 'vi');

  // Get metric label
  const metricLabel = useMemo(() => {
    const match = PREDEFINED_METRICS.find(m => m.metric === metricCode);
    if (match) {
      return locale === 'vi' ? match.labelVi : match.labelEn;
    }
    return metricCode;
  }, [metricCode, locale]);

  // Validation: check if targets are monotonically increasing
  const validation = useMemo(() => {
    const errors: { tier: MedalTier; message: string }[] = [];
    const warnings: { tier: MedalTier; message: string }[] = [];
    
    const sortedTargets = [...targets].sort((a, b) => {
      const aIdx = ALL_TIERS.indexOf(a.tier);
      const bIdx = ALL_TIERS.indexOf(b.tier);
      return aIdx - bIdx;
    });

    for (let i = 1; i < sortedTargets.length; i++) {
      const prev = sortedTargets[i - 1];
      const curr = sortedTargets[i];
      
      if (curr.target < prev.target) {
        errors.push({
          tier: curr.tier,
          message: copy(
            `${TIER_LABELS[curr.tier].en} target must be ≥ ${TIER_LABELS[prev.tier].en}`,
            `Target ${TIER_LABELS[curr.tier].vi} phải ≥ Target ${TIER_LABELS[prev.tier].vi}`
          ),
        });
      } else if (curr.target === prev.target && tierCount > 2) {
        warnings.push({
          tier: curr.tier,
          message: copy(
            `${TIER_LABELS[curr.tier].en} has same target as ${TIER_LABELS[prev.tier].en}`,
            `${TIER_LABELS[curr.tier].vi} có cùng target với ${TIER_LABELS[prev.tier].vi}`
          ),
        });
      }
    }

    // Check for zero/negative targets
    for (const target of targets) {
      if (target.target < 1) {
        errors.push({
          tier: target.tier,
          message: copy(
            'Target must be at least 1',
            'Target phải từ 1 trở lên'
          ),
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [targets, tierCount, locale]);

  const handleTargetChange = (tier: MedalTier, value: number) => {
    const newTargets = targets.map(t =>
      t.tier === tier ? { ...t, target: Math.max(1, value) } : t
    );
    onTargetsChange(newTargets);
  };

  const handleIncrement = (tier: MedalTier, amount: number) => {
    const current = targets.find(t => t.tier === tier);
    if (current) {
      handleTargetChange(tier, current.target + amount);
    }
  };

  return (
    <div className={styles.container}>
      {/* Tier Count Selector */}
      <div className={styles.tierCountSelector}>
        <span className={styles.tierCountLabel}>
          {copy('Number of tiers:', 'Số cấp bậc:')}
        </span>
        <div className={styles.tierCountBtns}>
          {([2, 3, 4] as const).map(count => (
            <button
              key={count}
              type="button"
              className={`${styles.tierCountBtn} ${tierCount === count ? styles.tierCountBtnActive : ''}`}
              onClick={() => onTierCountChange(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Tier Ladder */}
      <div className={styles.tierLadder}>
        <div className={styles.tierLadderHeader}>
          <span>{copy('Target configuration', 'Cấu hình target')}</span>
          <span className={styles.metricTag}>{metricLabel}</span>
        </div>

        <div className={styles.tierRows}>
          {activeTiers.map((tier, index) => {
            const currentTarget = targets.find(t => t.tier === tier);
            const targetValue = currentTarget?.target ?? 1;
            const hasError = validation.errors.some(e => e.tier === tier);

            return (
              <div
                key={tier}
                className={`${styles.tierRow} ${styles[`tierRow--${tier.toLowerCase()}`]}`}
              >
                <div className={styles.tierBadge}>
                  <span
                    className={styles.tierBadgeDot}
                    style={{ backgroundColor: TIER_COLORS[tier] }}
                  />
                  <span>{copy(TIER_LABELS[tier].en, TIER_LABELS[tier].vi)}</span>
                </div>

                <div className={styles.tierTargetInput}>
                  <span className={styles.targetLabel}>&ge;</span>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    onClick={() => handleIncrement(tier, -1)}
                    disabled={targetValue <= 1}
                    aria-label={copy('Decrease', 'Giảm')}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={targetValue}
                    onChange={(e) => handleTargetChange(tier, parseInt(e.target.value) || 1)}
                    className={`${styles.targetInput} ${hasError ? styles.targetInputError : ''}`}
                    aria-label={`${tier} target`}
                  />
                  <button
                    type="button"
                    className={styles.stepBtn}
                    onClick={() => handleIncrement(tier, 1)}
                    aria-label={copy('Increase', 'Tăng')}
                  >
                    +
                  </button>
                  <span className={styles.unitLabel}>{unitLabel}</span>
                </div>

                {index < activeTiers.length - 1 && (
                  <div className={styles.tierArrow}>
                    <ArrowUp size={14} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Validation Messages */}
        {validation.errors.length > 0 && (
          <div className={styles.validationContainer}>
            {validation.errors.map((error, idx) => (
              <div key={idx} className={`${styles.validationMsg} ${styles.validationMsgError}`}>
                <AlertCircle size={14} />
                <span>{error.message}</span>
              </div>
            ))}
          </div>
        )}

        {validation.warnings.length > 0 && validation.errors.length === 0 && (
          <div className={styles.validationContainer}>
            {validation.warnings.map((warning, idx) => (
              <div key={idx} className={`${styles.validationMsg} ${styles.validationMsgWarning}`}>
                <AlertCircle size={14} />
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        )}

        {validation.isValid && validation.warnings.length === 0 && (
          <div className={`${styles.validationMsg} ${styles.validationMsgSuccess}`}>
            <CheckCircle size={14} />
            <span>
              {copy('All targets are valid', 'Tất cả target đều hợp lệ')}
            </span>
          </div>
        )}
      </div>

      {/* Helper Text */}
      <p className={styles.helperText}>
        {copy(
          `Each higher tier must have a target value greater than or equal to the previous tier. The unit is automatically set based on the selected metric.`,
          `Mỗi cấp bậc cao hơn phải có target lớn hơn hoặc bằng cấp bậc trước. Đơn vị được tự động đặt dựa trên chỉ số đã chọn.`
        )}
      </p>
    </div>
  );
};

export default CustomTierEditor;
