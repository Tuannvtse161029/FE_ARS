// Shared types for the Lecturer ↔ Graduate Student research workflow.
// Source of truth: docs/local-only/research-workflow-contract.md §6.
// Lead-owned; consumed by both Agent 1 (lecturer) and Agent 2 (grad student).
// If you need a new field, file a ticket — do not extend locally.

export type ResearchTopicStatus = 'OPEN' | 'ASSIGNED' | 'COMPLETED';
// CLOSED was removed: a topic no longer has a separate "closed" state —
// once it's done, it transitions to COMPLETED. See utils/researchStatus.ts
// for the canonical transition table.
export type PhasedReportStatus =
  | 'WAITING'
  | 'SUBMITTED'
  | 'EVALUATED'
  | 'REJECTED'
  | 'Pending'
  | 'OnTime'
  | 'Overdue'
  | 'Passed';

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
  lecturerId?: number | null;
  lecturerName?: string | null;
}

export interface ResearchGroup {
  id: number;
  lecturerId: number | null;
  topicId?: number | null;
  name: string;
  description?: string;
  deadline?: string;
  assignedAt?: string;
  /**
   * Whether the group is active (visible/enabled) or inactive (archived/
   * hidden). When `undefined`, the FE treats the group as active — that
   * covers legacy rows that pre-date the BE column.
   *
   * Mirrors `ResearchGroups.isActive` from the swagger contract and the
   * `ResearchGroup` interface in `src/services/researchGroup.service.ts`.
   */
  isActive?: boolean | null;
}

export interface GroupMember {
  id: number;
  researchGroupId: number;
  studentId: number;
  activityStatus?: string;
  joinedAt?: string;
  /**
   * Set when the BE payload indicates this member is the group leader.
   * The canonical BE column is `isLeader` (boolean); the legacy alias
   * `leaderId` is forwarded too because older BE deployments serialise
   * the leader signal as a truthy `leaderId` value rather than a
   * separate boolean. See `groupMembership.service.ts` for the
   * normaliser that preserves both fields.
   *
   * Added Sep 2026 — prior to this, the normalizer dropped both fields,
   * which made every GradStudent view report `isLeader: false` for the
   * actual leader (regression covered by
   * `tests/unit/services/groupMembership.service.test.ts`).
   */
  isLeader?: boolean;
  /**
   * Legacy alias for `isLeader` — kept so existing code paths that read
   * `member.leaderId` continue to work. The BE's column type has been
   * inconsistent across migrations; the FE normaliser accepts either a
   * boolean or a numeric id here.
   */
  leaderId?: number | boolean | null;
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
