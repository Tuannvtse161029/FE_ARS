/**
 * GroupPhases — phase timeline component
 *
 * Extracted from src/pages/Lecturer/GroupDetail.tsx
 */
import { useMemo } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import { PhaseTimeline, type PhaseTimelineItem } from '../../../components/research/PhaseTimeline';
import type { PhasedReport } from '../../../services/phasedReport.service';
// CSS module kept at the original GroupDetail CSS location for now.
import styles from '../../pages/Lecturer/GroupDetail.module.css';

export interface GroupPhasesProps {
  reports: PhasedReport[];
}

export const GroupPhases: React.FC<GroupPhasesProps> = ({ reports }) => {
  const { t } = useI18n();

  const phaseTimelineItems = useMemo<PhaseTimelineItem[]>(() => {
    const byPhase = new Map<number, typeof reports[number]>();
    for (const r of reports) {
      if (typeof r.phaseNumber !== 'number') continue;
      const existing = byPhase.get(r.phaseNumber);
      if (!existing || (r.submittedAt ?? '') > (existing.submittedAt ?? '')) {
        byPhase.set(r.phaseNumber, r);
      }
    }
    const phases = Array.from(byPhase.keys()).sort((a, b) => a - b);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return phases.map((phaseNumber) => {
      const report = byPhase.get(phaseNumber);
      const status = (report?.status ?? '').toLowerCase();
      const deadlineMs = report?.deadlineAt ? new Date(report.deadlineAt).getTime() : NaN;
      const overdue = Boolean(
        report?.isOverdue ??
        (report?.submittedAt && report?.deadlineAt &&
          new Date(report.submittedAt) > new Date(report.deadlineAt)),
      );
      let state: PhaseTimelineItem['state'] = 'upcoming';
      if (status === 'evaluated' || status === 'passed' || status === 'approved') {
        state = 'accepted';
      } else if (status === 'submitted' || status === 'pending_review') {
        state = overdue ? 'overdue' : 'submitted';
      } else if (Number.isFinite(deadlineMs) && deadlineMs < now && status !== 'rejected' && status !== 'denied') {
        state = 'overdue';
      } else if (Number.isFinite(deadlineMs) && deadlineMs - now <= 7 * dayMs && deadlineMs >= now) {
        state = 'dueSoon';
      }
      return {
        number: phaseNumber,
        title: report?.milestoneTitle ?? '',
        state,
        deadline: report?.deadlineAt ?? null,
        submittedAt: report?.submittedAt ?? null,
      };
    });
  }, [reports]);

  if (phaseTimelineItems.length === 0) return null;

  return (
    <section className={styles.card} aria-labelledby="phaseProgressTitle">
      <header className={styles.cardHeader}>
        <h2 id="phaseProgressTitle" className={styles.cardTitle}>
          {t('lecturer.groupDetail.phaseProgressTitle')}
        </h2>
        <span className={styles.cardHint}>
          {t('lecturer.groupDetail.phaseProgressHint')}
        </span>
      </header>
      <div className={styles.cardBody}>
        <PhaseTimeline items={phaseTimelineItems} />
      </div>
    </section>
  );
};

export default GroupPhases;
