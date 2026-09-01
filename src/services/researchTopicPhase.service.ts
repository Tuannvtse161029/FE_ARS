import { phasedReportService, type PhasedReport } from './phasedReport.service';
import { getDemoWorkflowState, setDemoWorkflowState } from '../adapters/lecturerWorkflowDemo.adapter';
import type { DemoResearchTopicPhase } from '../adapters/lecturerWorkflowDemo.adapter';

export interface ResearchTopicPhase {
  id: string; topicId: number; phaseNumber: number; title: string; requirements: string;
  assessmentCriteria: string; startAt: string; endAt: string; deadlineAt: string;
  order: number; locked: boolean; source: 'api' | 'demo'; report?: PhasedReport;
}
export interface PhaseDraft { title: string; requirements: string; assessmentCriteria: string; startAt: string; endAt: string; }
const toInputDate = (value: string | null | undefined): string => { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16); };
const fromDemo = (item: DemoResearchTopicPhase): ResearchTopicPhase => ({ ...item, phaseNumber: item.order, deadlineAt: item.endAt, source: 'demo' });
const fromReport = (report: PhasedReport): ResearchTopicPhase | null => {
  if (typeof report.phaseNumber !== 'number' || typeof report.topicId !== 'number') return null;
  const end = report.deadlineAt ?? '';
  return { id: `api-${report.topicId}-${report.phaseNumber}`, topicId: report.topicId, phaseNumber: report.phaseNumber, title: report.milestoneTitle ?? `Phase ${report.phaseNumber}`, requirements: '', assessmentCriteria: '', startAt: '', endAt: end, deadlineAt: end, order: report.phaseNumber, locked: Boolean(report.submittedAt), source: 'api', report };
};
export const validatePhaseDrafts = (drafts: readonly PhaseDraft[]): string | null => {
  if (drafts.length < 1) return 'Add at least one phase before activating a topic.';
  let previousEnd: number | null = null;
  for (const [index, draft] of drafts.entries()) {
    if (!draft.title.trim()) return `Enter a title for Phase ${index + 1}.`;
    const start = Date.parse(draft.startAt); const end = Date.parse(draft.endAt);
    if (draft.startAt && Number.isNaN(start)) return `Choose a valid start date for Phase ${index + 1}.`;
    if (draft.endAt && Number.isNaN(end)) return `Choose a valid end date for Phase ${index + 1}.`;
    if (draft.startAt && draft.endAt && end <= start) return `Phase ${index + 1} must end after it starts.`;
    if (previousEnd !== null && draft.startAt && start < previousEnd) return `Phase ${index + 1} overlaps the previous phase. Gaps are allowed.`;
    if (draft.endAt && !Number.isNaN(end)) previousEnd = end;
  }
  return null;
};
export const researchTopicPhaseService = {
  async getByTopic(topicId: number): Promise<ResearchTopicPhase[]> {
    const reports = await phasedReportService.getByTopic(topicId);
    const apiPhases = reports.map(fromReport).filter((phase): phase is ResearchTopicPhase => Boolean(phase));
    const demo = getDemoWorkflowState().phases.filter((phase) => phase.topicId === topicId).map(fromDemo);
    return [...apiPhases, ...demo].sort((a, b) => a.order - b.order);
  },
  async save(topicId: number, drafts: readonly PhaseDraft[], researchGroupId: number | null): Promise<{ phases: ResearchTopicPhase[]; usedDemo: boolean }> {
    const error = validatePhaseDrafts(drafts); if (error) throw new Error(error);
    const reports = await phasedReportService.setTopicMilestones({ topicId, researchGroupId, phases: drafts.slice(0, 5).map((draft, index) => ({ phaseNumber: index + 1, milestoneTitle: draft.title.trim(), deadlineAt: new Date(draft.endAt || draft.startAt).toISOString() })) });
    const apiPhases = reports.map(fromReport).filter((phase): phase is ResearchTopicPhase => Boolean(phase));
    const state = getDemoWorkflowState(); state.phases = state.phases.filter((phase) => phase.topicId !== topicId);
    const demoPhases = drafts.slice(5).map((draft, offset) => ({ id: `demo-phase-${topicId}-${offset + 6}`, topicId, title: draft.title.trim(), requirements: draft.requirements, assessmentCriteria: draft.assessmentCriteria, startAt: draft.startAt, endAt: draft.endAt, order: offset + 6, locked: false }));
    state.phases.push(...demoPhases); setDemoWorkflowState(state);
    return { phases: [...apiPhases, ...demoPhases.map(fromDemo)], usedDemo: demoPhases.length > 0 };
  },
};
export { toInputDate };
export default researchTopicPhaseService;
