/**
 * GroupStatusFilterTabs — ALL / ACTIVE / INACTIVE filter tabs for the
 * Research Groups list in the Lecturer workspace.
 *
 * Sits above the card grid. Clicking a tab filters the list to show:
 *   - ALL      — both active and inactive groups
 *   - ACTIVE   — only groups where isActive === true
 *   - INACTIVE — only groups where isActive === false (or undefined/null)
 *
 * Each tab shows a count badge next to the label.
 */

import styles from './GroupStatusFilterTabs.module.css';

export type GroupFilterTab = 'all' | 'active' | 'inactive';

interface GroupStatusFilterTabsProps {
  /** Currently selected tab. */
  value: GroupFilterTab;
  /** Callback fired when the user selects a different tab. */
  onChange: (tab: GroupFilterTab) => void;
  /** Total number of groups (all). */
  countAll: number;
  /** Number of active groups. */
  countActive: number;
  /** Number of inactive groups. */
  countInactive: number;
  /** Translation label for "All". */
  labelAll: string;
  /** Translation label for "Active". */
  labelActive: string;
  /** Translation label for "Inactive". */
  labelInactive: string;
}

export const GroupStatusFilterTabs = ({
  value,
  onChange,
  countAll,
  countActive,
  countInactive,
  labelAll,
  labelActive,
  labelInactive,
}: GroupStatusFilterTabsProps) => {
  const tabs: Array<{
    key: GroupFilterTab;
    label: string;
    count: number;
  }> = [
    { key: 'all',      label: labelAll,      count: countAll },
    { key: 'active',   label: labelActive,    count: countActive },
    { key: 'inactive', label: labelInactive,  count: countInactive },
  ];

  return (
    <div
      className={styles.tabBar}
      role="tablist"
      aria-label="Filter research groups by status"
    >
      {tabs.map((tab) => {
        const isSelected = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={`${styles.tab} ${isSelected ? styles.tabSelected : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            <span
              className={`${styles.count} ${isSelected ? styles.countSelected : ''}`}
              aria-label={`${tab.count} groups`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default GroupStatusFilterTabs;
