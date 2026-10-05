import { useRef } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import styles from './ResearchFieldTabs.module.css';

export type ResearchFieldTabKey = 'major' | 'sub' | 'gr';

export interface ResearchFieldTabsProps {
  active: ResearchFieldTabKey;
  onChange: (next: ResearchFieldTabKey) => void;
}

const ORDER: ResearchFieldTabKey[] = ['major', 'sub', 'gr'];

export const ResearchFieldTabs = ({ active, onChange }: ResearchFieldTabsProps) => {
  const { t } = useI18n();
  const tabRefs = useRef<Record<ResearchFieldTabKey, HTMLButtonElement | null>>({
    major: null,
    sub: null,
    gr: null,
  });

  const handleKey = (e: React.KeyboardEvent<HTMLButtonElement>, current: ResearchFieldTabKey) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    const idx = ORDER.indexOf(current);
    let nextIdx = idx;
    if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + ORDER.length) % ORDER.length;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % ORDER.length;
    if (e.key === 'Home') nextIdx = 0;
    if (e.key === 'End') nextIdx = ORDER.length - 1;
    const next = ORDER[nextIdx];
    onChange(next);
    tabRefs.current[next]?.focus();
  };

  const labels: Record<ResearchFieldTabKey, string> = {
    major: t('admin.researchField.tabs.major', 'Major Field'),
    sub: t('admin.researchField.tabs.sub', 'Sub Field'),
    gr: t('admin.researchField.tabs.gr', 'Grading Rubic'),
  };

  return (
    <div role="tablist" aria-label={t('admin.researchField.title', 'Research Field')} className={styles.tabBar}>
      {ORDER.map((key) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            ref={(el) => {
              tabRefs.current[key] = el;
            }}
            type="button"
            role="tab"
            id={`research-field-tab-${key}`}
            aria-selected={isActive}
            aria-controls={`research-field-panel-${key}`}
            tabIndex={isActive ? 0 : -1}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={() => onChange(key)}
            onKeyDown={(e) => handleKey(e, key)}
          >
            {labels[key]}
          </button>
        );
      })}
    </div>
  );
};
