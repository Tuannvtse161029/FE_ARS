// Shared milestone progress surface used by both Lecturer (GroupDetail) and
// Graduate Student (StudentResearchGroups / Dashboard) surfaces.
//
// Counts phased reports by status so each role can render a milestone summary.
// The visual treatment is identical across both surfaces — visual divergence
// is forbidden by lead-phase-c-contract.md §3.3 / SH1.
//
// Added in Phase C (Lead, lead-phase-c-contract.md SH1).
//
// Accessibility: the counts region uses `role="status"` with
// `aria-live="polite"` so screen readers announce updates without grabbing
// focus. No emoji icons; counts are rendered as plain text.

import type { ReactElement } from 'react';
import type { PhasedReportCounts } from '../../utils/researchStatus';
import styles from './MilestoneProgress.module.css';

export interface MilestoneProgressReportLike {
  status?: string | null;
}

export interface MilestoneProgressProps {
  reports: ReadonlyArray<MilestoneProgressReportLike>;
  className?: string;
}

export const MilestoneProgress = ({
  reports,
  className,
}: MilestoneProgressProps): ReactElement => {
  const counts: PhasedReportCounts = {
    waiting: 0,
    submitted: 0,
    rejected: 0,
    evaluated: 0,
  };
  for (const report of reports) {
    const v = (report?.status ?? '').toUpperCase().trim();
    if (v === 'WAITING') counts.waiting += 1;
    else if (v === 'SUBMITTED') counts.submitted += 1;
    else if (v === 'REJECTED') counts.rejected += 1;
    else if (v === 'EVALUATED' || v === 'APPROVED' || v === 'REVIEWED') {
      counts.evaluated += 1;
    }
  }

  return (
    <section
      className={className ? `${styles.root} ${className}` : styles.root}
      role="status"
      aria-live="polite"
      aria-label="Milestone progress"
      data-testid="milestone-progress"
    >
      <header className={styles.header}>
        <h3 className={styles.title}>Milestone progress</h3>
        <p className={styles.subtitle}>
          {reports.length} total milestone{reports.length === 1 ? '' : 's'}
        </p>
      </header>
      <dl className={styles.counts}>
        <div className={styles.countRow} data-status="evaluated">
          <dt className={styles.countLabel}>Evaluated</dt>
          <dd className={styles.countValue} data-testid="count-evaluated">
            {counts.evaluated}
          </dd>
        </div>
        <div className={styles.countRow} data-status="submitted">
          <dt className={styles.countLabel}>Awaiting review</dt>
          <dd className={styles.countValue} data-testid="count-submitted">
            {counts.submitted}
          </dd>
        </div>
        <div className={styles.countRow} data-status="rejected">
          <dt className={styles.countLabel}>Revision needed</dt>
          <dd className={styles.countValue} data-testid="count-rejected">
            {counts.rejected}
          </dd>
        </div>
        <div className={styles.countRow} data-status="waiting">
          <dt className={styles.countLabel}>Not started</dt>
          <dd className={styles.countValue} data-testid="count-waiting">
            {counts.waiting}
          </dd>
        </div>
      </dl>
    </section>
  );
};

export default MilestoneProgress;
