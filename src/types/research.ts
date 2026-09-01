// Shared types for the Lecturer ↔ Graduate Student research workflow.
// Source of truth: docs/local-only/research-workflow-contract.md §6.
// Lead-owned; consumed by both Agent 1 (lecturer) and Agent 2 (grad student).
// If you need a new field, file a ticket — do not extend locally.

export type GuidanceProjectStatus = 'PROPOSED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type ResearchTopicStatus = 'OPEN' | 'ASSIGNED' | 'COMPLETED' | 'CLOSED';
export type PhasedReportStatus =
  | 'WAITING'
  | 'SUBMITTED'
  | 'EVALUATED'
  | 'REJECTED'
  | 'Pending'
  | 'OnTime'
  | 'Overdue'
  | 'Passed';

export interface GuidanceProject {
  id: number;
  lecturerId: number | null;
  studentId: number | null;
  title: string;
  description?: string;
  status: GuidanceProjectStatus;
  createdAt?: string;
  updatedAt?: string;
  researchGroupId?: number;
  researchGroupName?: string;
}

export interface ResearchTopic {
  id: number;
  title: string;
  description?: string;
  status: ResearchTopicStatus;
  materialsUrl?: string;
  assignedGroupId?: number | null;
  /**
   * When the topic was created. The BE may omit this; consumers must
   * tolerate `undefined` (older records pre-date the field).
   */
  createdAt?: string;
  updatedAt?: string;
}

export interface ResearchGroup {
  id: number;
  lecturerId: number | null;
  topicId?: number | null;
  name: string;
  description?: string;
  deadline?: string;
  assignedAt?: string;
}

export interface GroupMember {
  id: number;
  researchGroupId: number;
  studentId: number;
  activityStatus?: string;
  joinedAt?: string;
}

export interface LearningMaterial {
  id: number;
  lecturerId: number;
  title: string;
  fileUrl?: string;
  description?: string;
  subFieldId?: number;
}

// Mirrors BE PhasedReports table (per docs/local-only/research-workflow-contract.md §6
// and the BE gap ticket E.5). Columns `phase`, `description`, `dueDate`,
// `referenceMaterials`, `notes`, `grade`, `feedbackComment`, `annotatedFileUrl`,
// `lecturerId` are documented as MISSING from the BE schema — Agent 1 (lecturer
// evaluation modal) stores its structured feedback into `capacityEvaluation`
// (free-text) and `lectureFeedback` (number) on the existing PUT
// /api/PhasedReport/{id} until the BE ships the structured columns.
export interface PhasedReport {
  id: number;
  researchGroupId: number;
  groupMemberId?: number;
  reportFileUrl?: string;
  capacityEvaluation?: string;
  finalOutcomeEvaluation?: string;
  lectureFeedback?: number;
  submittedAt?: string;
  status: PhasedReportStatus;
}
