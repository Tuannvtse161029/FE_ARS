/**
 * PhaseReportStatusTabs — status filter pills for the Phase Reports page.
 *
 * Modelled on `GroupStatusFilterTabs`: pill-style tab strip with count
 * badges, role accent (lecturer burgundy) on the selected pill. The page
 * passes already-resolved counts (computed from the full owned-report
 * set, not the search-filtered set) so the pills always reflect the
 * actual number of reports each status contains, regardless of the
 * active search query.
 *
 * Status taxonomy:
 *   - all       Every report owned by the lecturer.
 *   - awaiting  No submission yet (status WAITING / Pending).
 *   - submitted Submitted on time (status SUBMITTED, before deadline).
 *   - overdue   Submitted after the deadline (status SUBMITTED, isOverdue).
 *   - evaluated Approved by the lecturer (status EVALUATED / Passed).
 *   - rejected  Request-resubmit decision returned (status REJECTED).
 */

import styles from './PhaseReportStatusTabs.module.css';

export type PhaseReportStatusFilter =
  | 'all'
  | 'awaiting'
  | 'submitted'
  | 'overdue'
  | 'evaluated'
  | 'rejected';

export interface PhaseReportStatusTabsProps {
  value: PhaseReportStatusFilter;
  onChange: (next: PhaseReportStatusFilter) => void;
  counts: {
    all: number;
    awaiting: number;
    submitted: number;
    overdue: number;
    evaluated: number;
    rejected: number;
  };
  labels: {
    all: string;
    awaiting: string;
    submitted: string;
    overdue: string;
    evaluated: string;
    rejected: string;
  };
}

interface TabSpec {
  key: PhaseReportStatusFilter;
  label: string;
  count: number;
}

export const PhaseReportStatusTabs = ({
  value,
  onChange,
  counts,
  labels,
}: PhaseReportStatusTabsProps) => {
  const tabs: TabSpec[] = [
    { key: 'all', label: labels.all, count: counts.all },
    { key: 'awaiting', label: labels.awaiting, count: counts.awaiting },
    { key: 'submitted', label: labels.submitted, count: counts.submitted },
    { key: 'overdue', label: labels.overdue, count: counts.overdue },
    { key: 'evaluated', label: labels.evaluated, count: counts.evaluated },
    { key: 'rejected', label: labels.rejected, count: counts.rejected },
  ];

  return (
    <div
      className={styles.tabBar}
      role="tablist"
      aria-label="Filter phase reports by status"
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
              aria-label={`${tab.count} reports`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default PhaseReportStatusTabs;
