/**


 * GroupPhases — phase timeline component


 *


 * Extracted from src/pages/Lecturer/GroupDetail.tsx


 */


import { useMemo } from 'react';


import { useI18n } from '../../../i18n/I18nContext';


import { PhaseTimeline, type PhaseTimelineItem } from '../../../components/research/PhaseTimeline';


import type { PhasedReport } from '../../../services/phasedReport.service';
import { classifyPhaseReportStatus } from '../../../utils/lecturerPhaseStatus';


// CSS module kept at the original GroupDetail CSS location for now.


import styles from '../../../pages/Lecturer/GroupDetail.module.css';





export interface GroupPhasesProps {


  reports: PhasedReport[];


}





export const GroupPhases = ({ reports }: GroupPhasesProps) => {


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

    const now = new Date();

    return phases.map((phaseNumber) => {

      const report = byPhase.get(phaseNumber);
      const deadlineMs = report?.deadlineAt ? new Date(report.deadlineAt).getTime() : NaN;

      const cls = classifyPhaseReportStatus(report, now);
      let state: PhaseTimelineItem['state'] = 'upcoming';

      if (cls.status === 'evaluated') {
        state = 'accepted';
      } else if (cls.status === 'submitted') {
        state = 'submitted';
      } else if (cls.status === 'submitted-late') {
        state = 'overdue';
      } else if (cls.status === 'overdue') {
        state = 'overdue';
      } else if (cls.status === 'rejected') {
        state = 'upcoming';
      } else if (cls.status === 'awaiting-submission') {
        if (Number.isFinite(deadlineMs)) {
          const dayMs = 24 * 60 * 60 * 1000;
          if (deadlineMs - now.getTime() <= 7 * dayMs && deadlineMs >= now.getTime()) {
            state = 'dueSoon';
          } else if (deadlineMs < now.getTime()) {
            state = 'overdue';
          }
        }
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


