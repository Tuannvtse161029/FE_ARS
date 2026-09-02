// Lecturer — Research Topic Phase service.
//
// The live API exposes phases through the PhasedReport milestone surface:
//   POST /api/PhasedReport/topic-milestones
//         body = { topicId, researchGroupId?, phases: [{ phaseNumber, milestoneTitle?, deadlineAt? }] }
//
// The BE does not document a fixed phase limit. The lecturer decides how many
// phases a topic has. A soft sanity cap of 99 is enforced in the UI only to
// prevent accidental runaway input; it is not a backend contract.
//
// Swagger does NOT expose `requirements`, `assessmentCriteria`, or `startAt`
// on the milestone DTOs — those fields render as read-only placeholders with a
// BackendGapBanner until the BE ships them.
//
// No mock / demo store. No fallback rows. The lecturer page (ConfigureMilestones)
// is the sole consumer and reads/writes exclusively through this service.

import { phasedReportService, type PhasedReport } from './phasedReport.service';

// Soft sanity cap — prevents accidental runaway input. Not a backend contract.
export const MAX_PHASES_PER_TOPIC = 99;

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
  /** ID of the LearningMaterial assigned to this phase (null = none). */
  learningMaterialId: number | null;
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
  const end = report.deadlineAt ?? report.deadline ?? '';
  // Prefer camelCase (startDate) over startedAt; fall back to empty string.
  const start =
    report.startDate ?? report.startedAt ?? '';
  // Prefer camelCase (assessmentCriteria) over criteria alias.
  const criteria =
    report.assessmentCriteria ?? report.criteria ?? '';
  return {
    id: `api-${report.topicId}-${report.phaseNumber}`,
    topicId: report.topicId,
    phaseNumber: report.phaseNumber,
    // milestoneTitle is the canonical field; phaseTitle is a readOnly alias.
    title: report.milestoneTitle ?? `Phase ${report.phaseNumber}`,
    // requirements and assessmentCriteria are now persisted by the BE Swagger.
    requirements: report.requirements ?? '',
    assessmentCriteria: criteria,
    startAt: start ? toInputDate(start) : '',
    endAt: end ? toInputDate(end) : '',
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
    return `A topic cannot have more than ${MAX_PHASES_PER_TOPIC} phases. Remove the extras before saving.`;
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
        milestoneTitle: draft.title.trim() || null,
        deadlineAt: new Date(
          draft.endAt || draft.startAt,
        ).toISOString(),
        // BE Swagger now accepts these fields on TopicPhaseItem.
        requirements: draft.requirements || null,
        assessmentCriteria: draft.assessmentCriteria || null,
        startDate: draft.startAt
          ? new Date(draft.startAt).toISOString()
          : null,
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
