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
import { toLocalDatetimeInput, toApiIsoString, parseApiDate } from '../utils/datetime';

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
  learningMaterialId?: number | null;
  report?: PhasedReport | null;
}

export interface PhaseDraft {
  /**
   * The 1-based phase number used in the BE contract. Always present so
   * the editor can compare against a deep-link `?phase=N` highlight
   * without relying on array index — add / remove reorderings must not
   * cause the highlight to drift to a different phase row.
   */
  phaseNumber: number;
  title: string;
  requirements: string;
  assessmentCriteria: string;
  startAt: string;
  endAt: string;
  /** ID of the LearningMaterial assigned to this phase (null = none). */
  learningMaterialId: number | null;
}

export type ResearchTopicPhaseDraft = PhaseDraft;

const toInputDate = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // Defensive validity probe — guard against legacy BE shapes
  // (`"2026-09-15 00:00:00"`, `"2026-09-15T00:00:00"`, etc.) that some
  // engines accept as local time and some reject. Bail with empty string
  // rather than producing a garbage date.
  const probe = new Date(trimmed);
  if (!Number.isFinite(probe.getTime())) {
    return '';
  }
  return toLocalDatetimeInput(trimmed);
};

// Local-only helper used inside `fromReport`. Centralises the legacy BE
// shape normalisation so a row with `"2026-09-15 00:00:00"` or
// `"2026-09-15T00:00:00"` round-trips into the same `<input
// type="datetime-local">` value the lecturer originally picked. Without
// this helper, the page silently lost the deadline after reload because
// some engines treat the bare strings as local time and others reject
// them outright, returning `''` from `toInputDate`.
const normaliseEndAt = (raw: string | null | undefined): string => {
  if (raw === null || raw === undefined) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Replace the legacy BE space separator (`2026-09-15 00:00:00`) with
  // the canonical ISO 'T' so `new Date()` interprets it consistently
  // across browsers.
  const normalised = trimmed.replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/,
    '$1T$2',
  );
  const probe = new Date(normalised);
  if (!Number.isFinite(probe.getTime())) {
    // Final fallback: try `toInputDate` (which has its own defensive probe).
    return toInputDate(trimmed);
  }
  // Delegate the formatting to `toLocalDatetimeInput` so we share its
  // date-only / locale-aware padding logic.
  const date = parseApiDate(normalised);
  return date ? toLocalDatetimeInput(date) : '';
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
  // Use `normaliseEndAt` / `normaliseStartAt` so legacy BE date shapes
  // (`"2026-09-15 00:00:00"`, `"2026-09-15T00:00:00"`) survive the
  // round-trip into the `<input type="datetime-local">` without losing
  // the picked day.
  return {
    id: `api-${report.topicId}-${report.phaseNumber}`,
    topicId: report.topicId,
    phaseNumber: report.phaseNumber,
    // milestoneTitle is the canonical field; phaseTitle is a readOnly alias.
    title: report.milestoneTitle ?? `Phase ${report.phaseNumber}`,
    // requirements and assessmentCriteria are now persisted by the BE Swagger.
    requirements: report.requirements ?? '',
    assessmentCriteria: criteria,
    startAt: start ? normaliseEndAt(start) : '',
    endAt: end ? normaliseEndAt(end) : '',
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
        deadlineAt:
          toApiIsoString(draft.endAt || draft.startAt) ||
          new Date().toISOString(),
        // BE Swagger now accepts these fields on TopicPhaseItem.
        requirements: draft.requirements || null,
        assessmentCriteria: draft.assessmentCriteria || null,
        startDate: draft.startAt
          ? toApiIsoString(draft.startAt)
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
