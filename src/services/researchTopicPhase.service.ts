// Lecturer — Research Topic Phase service.
//
// The live API exposes phases through the PhasedReport milestone surface:
//   POST /api/PhasedReport/topic-milestones
//         body = { topicId, researchGroupId?, phases: [{ phaseNumber, milestoneTitle, deadlineAt }] }
//
// Each topic can have at most five phases — the Swagger summary documents
// "Phase 1..5". Phases beyond five are rejected by the BE, so the FE mirrors
// that limit and surfaces an explicit validation message instead of writing
// anything to local state.
//
// No mock / demo store. No fallback rows. The lecturer page (ConfigureMilestones)
// is the sole consumer and reads/writes exclusively through this service.

import { phasedReportService, type PhasedReport } from './phasedReport.service';

export const MAX_PHASES_PER_TOPIC = 5;

export interface ResearchTopicPhase {
  id: string;
  topicId: number;
  phaseNumber: number;
  title: string;
  requirements: string;
  assessmentCriteria: string;
  startAt: string;
  endAt: string;
  deadlineAt: string;
  order: number;
  locked: boolean;
  source: 'api';
  report?: PhasedReport;
}

export interface PhaseDraft {
  title: string;
  requirements: string;
  assessmentCriteria: string;
  startAt: string;
  endAt: string;
}

const toInputDate = (value: string | null | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
};

const fromReport = (report: PhasedReport): ResearchTopicPhase | null => {
  if (typeof report.phaseNumber !== 'number' || typeof report.topicId !== 'number') {
    return null;
  }
  const end = report.deadlineAt ?? '';
  return {
    id: `api-${report.topicId}-${report.phaseNumber}`,
    topicId: report.topicId,
    phaseNumber: report.phaseNumber,
    title: report.milestoneTitle ?? `Phase ${report.phaseNumber}`,
    requirements: '',
    assessmentCriteria: '',
    startAt: '',
    endAt: end,
    deadlineAt: end,
    order: report.phaseNumber,
    locked: Boolean(report.submittedAt),
    source: 'api',
    report,
  };
};

export const validatePhaseDrafts = (
  drafts: readonly PhaseDraft[],
): string | null => {
  if (drafts.length < 1) {
    return 'Add at least one phase before activating a topic.';
  }
  if (drafts.length > MAX_PHASES_PER_TOPIC) {
    return `The backend limits each topic to ${MAX_PHASES_PER_TOPIC} phases. Remove the extras before saving.`;
  }
  let previousEnd: number | null = null;
  for (const [index, draft] of drafts.entries()) {
    if (!draft.title.trim()) return `Enter a title for Phase ${index + 1}.`;
    const start = Date.parse(draft.startAt);
    const end = Date.parse(draft.endAt);
    if (draft.startAt && Number.isNaN(start)) {
      return `Choose a valid start date for Phase ${index + 1}.`;
    }
    if (draft.endAt && Number.isNaN(end)) {
      return `Choose a valid end date for Phase ${index + 1}.`;
    }
    if (draft.startAt && draft.endAt && end <= start) {
      return `Phase ${index + 1} must end after it starts.`;
    }
    if (
      previousEnd !== null &&
      draft.startAt &&
      start < previousEnd
    ) {
      return `Phase ${index + 1} overlaps the previous phase. Gaps are allowed.`;
    }
    if (draft.endAt && !Number.isNaN(end)) previousEnd = end;
  }
  return null;
};

export const researchTopicPhaseService = {
  /**
   * Fetch every PhasedReport row whose phaseNumber matches this topic, then
   * project them into a ResearchTopicPhase list. The BE is authoritative —
   * no mock or local rows are appended.
   */
  async getByTopic(topicId: number): Promise<ResearchTopicPhase[]> {
    const reports = await phasedReportService.getByTopic(topicId);
    const apiPhases = reports
      .map(fromReport)
      .filter((phase): phase is ResearchTopicPhase => Boolean(phase));
    return apiPhases.sort((a, b) => a.order - b.order);
  },

  /**
   * Persist the supplied drafts via POST /api/PhasedReport/topic-milestones.
   * Returns the live response rows from the BE. `usedDemo` is always false;
   * the field is kept on the return type to preserve the lecturer page's
   * existing UX message contract (which used to mean "extras were written to
   * a local demo store"). With the demo store removed it now means "no
   * backend rows were written" and is only true when the BE returns an
   * empty list — which the lecturer page treats as a recoverable failure.
   */
  async save(
    topicId: number,
    drafts: readonly PhaseDraft[],
    researchGroupId: number | null,
  ): Promise<{ phases: ResearchTopicPhase[]; usedDemo: boolean }> {
    const validation = validatePhaseDrafts(drafts);
    if (validation) throw new Error(validation);
    const response = await phasedReportService.setTopicMilestones({
      topicId,
      researchGroupId,
      phases: drafts.map((draft, index) => ({
        phaseNumber: index + 1,
        milestoneTitle: draft.title.trim(),
        deadlineAt: new Date(
          draft.endAt || draft.startAt,
        ).toISOString(),
      })),
    });
    const apiPhases = response
      .map(fromReport)
      .filter((phase): phase is ResearchTopicPhase => Boolean(phase))
      .sort((a, b) => a.order - b.order);
    return { phases: apiPhases, usedDemo: false };
  },
};

export { toInputDate };
export default researchTopicPhaseService;
