/**
 * Explicit demo boundary for lecturer workflow capabilities that are not in
 * the live Swagger contract. These records must never be merged into API
 * responses implicitly; callers opt in by using the `Demo`-prefixed API.
 */

export interface DemoResearchTopicPhase {
  id: string;
  topicId: number;
  title: string;
  requirements: string;
  assessmentCriteria: string;
  startAt: string;
  endAt: string;
  order: number;
  locked: boolean;
}

export interface DemoProjectGuideline {
  id: string;
  topicId: number;
  title: string;
  content: string;
  updatedAt: string;
}

export interface DemoPhaseGroupTask {
  id: string;
  phaseId: string;
  researchGroupId: number;
  instructions: string;
  updatedAt: string;
}

export interface DemoReportRevision {
  id: string;
  reportId: number;
  reportFileUrl: string;
  submittedAt: string;
  status: string;
}

export interface DemoRejectionFeedback {
  reportId: number;
  reason: string;
  createdAt: string;
  authorLabel: string;
}

export type DemoSharedMaterialType = 'pdf' | 'drive' | 'website' | 'reference';

export interface DemoSharedMaterial {
  id: string;
  topicId: number;
  title: string;
  description: string;
  materialType: DemoSharedMaterialType;
  url: string;
  fileName?: string;
  createdAt: string;
}

export interface DemoWorkflowState {
  phases: DemoResearchTopicPhase[];
  guidelines: DemoProjectGuideline[];
  phaseGroupTasks: DemoPhaseGroupTask[];
  reportRevisions: DemoReportRevision[];
  rejectionFeedback: DemoRejectionFeedback[];
  sharedMaterials: DemoSharedMaterial[];
}

const INITIAL_DEMO_STATE: DemoWorkflowState = {
  phases: [],
  guidelines: [],
  phaseGroupTasks: [],
  reportRevisions: [],
  rejectionFeedback: [],
  sharedMaterials: [],
};

/** Return a mutation-safe copy of demo state for a component or test. */
export const cloneDemoWorkflowState = (state: DemoWorkflowState): DemoWorkflowState => ({
  phases: state.phases.map((item) => ({ ...item })),
  guidelines: state.guidelines.map((item) => ({ ...item })),
  phaseGroupTasks: state.phaseGroupTasks.map((item) => ({ ...item })),
  reportRevisions: state.reportRevisions.map((item) => ({ ...item })),
  rejectionFeedback: state.rejectionFeedback.map((item) => ({ ...item })),
  sharedMaterials: state.sharedMaterials.map((item) => ({ ...item })),
});

let demoState = cloneDemoWorkflowState(INITIAL_DEMO_STATE);

/** Explicitly opt in to isolated demo state. No API response is read or merged. */
export const getDemoWorkflowState = (): DemoWorkflowState => cloneDemoWorkflowState(demoState);

/** Replace demo state with a cloned value, preserving caller ownership. */
export const setDemoWorkflowState = (state: DemoWorkflowState): void => {
  demoState = cloneDemoWorkflowState(state);
};

/** Reset all demo-only records to their empty initial state. */
export const resetDemoWorkflowState = (): DemoWorkflowState => {
  demoState = cloneDemoWorkflowState(INITIAL_DEMO_STATE);
  return getDemoWorkflowState();
};

/** Create an empty state for local previews without changing the module store. */
export const createEmptyDemoWorkflowState = (): DemoWorkflowState => cloneDemoWorkflowState(INITIAL_DEMO_STATE);

export default {
  getDemoWorkflowState,
  setDemoWorkflowState,
  resetDemoWorkflowState,
  cloneDemoWorkflowState,
  createEmptyDemoWorkflowState,
};
