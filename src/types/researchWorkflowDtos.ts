// Strict DTOs that mirror the Swagger OpenAPI spec for the research-workflow
// resources. These are the *single source of truth* for what the FE is allowed
// to send to (and receive from) the BE; service-layer code must use these
// types instead of inline `Record<string, unknown>` blobs.
//
// Each interface is named after the Swagger schema it mirrors:
//   - GuidanceProjectCreateRequest / GuidanceProjectUpdateRequest
//   - ResearchGroupCreateRequest / ResearchGroupUpdateRequest
//   - ResearchTopicCreateRequest / ResearchTopicUpdateRequest
//   - GroupMemberCreateRequest / GroupMemberUpdateRequest
//   - LearningMaterialCreateRequest / LearningMaterialUpdateRequest
//   - PhasedReportCreateRequest / PhasedReportUpdateRequest
//
// Every property is `T | null` (or `number | null`) because the Swagger
// spec marks each field as `nullable: true`. The FE therefore treats
// "absent" and "null" identically on both request and response shapes.
//
// Do NOT add fields that the BE does not expose — see BE gap ticket for the
// list of documented gaps (e.g. PhasedReport.lecturerId, FeedbackComment).

// ---------- GuidanceProject ----------

export interface GuidanceProjectCreateRequest {
  lecturerId: number | null;
  title: string | null;
  description: string | null;
  status: string | null;
  studentId: number | null;
  researchGroupId?: number | null;
}

export interface GuidanceProjectUpdateRequest {
  lecturerId: number | null;
  title: string | null;
  description: string | null;
  status: string | null;
  studentId: number | null;
  researchGroupId?: number | null;
}

// ---------- ResearchGroup ----------
//
// The Swagger ResearchGroup bodies require `lecturerId` and `topicId` to be
// present in both create and update. The FE always has the lecturerId when
// the lecturer is signed in (extracted from the auth context); topicId is
// either omitted (create, before the BE assigns one) or supplied from the
// caller's known-good id. Callers MAY omit any of the optional nullable
// fields (`description`, `deadline`, `assignedAt`, `name`) — they will be
// forwarded as `null` on the wire so the BE sees a complete body shape.

export interface ResearchGroupCreateRequest {
  lecturerId: number | null;
  topicId?: number | null;
  name: string | null;
  description: string | null;
  deadline: string | null;
  assignedAt: string | null;
}

export interface ResearchGroupUpdateRequest {
  lecturerId: number | null;
  topicId: number | null;
  name: string | null;
  description: string | null;
  deadline: string | null;
  assignedAt: string | null;
}

// ---------- ResearchTopic ----------
//
// Swagger declares `topicId` as `integer` (not nullable) on the
// ResearchTopic create/update bodies. In practice the FE cannot supply the
// BE-assigned id when creating a new topic, so this field is optional from
// the caller's perspective — when omitted, the BE will assign one. When the
// caller already has an id (e.g. retry / idempotency), it MUST be sent.

export interface ResearchTopicCreateRequest {
  topicId?: number | null;
  title: string | null;
  description: string | null;
  status: string | null;
  materialsUrl: string | null;
  lecturerId?: number | null;
}

export interface ResearchTopicUpdateRequest {
  topicId?: number | null;
  title: string | null;
  description: string | null;
  status: string | null;
  materialsUrl: string | null;
  lecturerId?: number | null;
}

// ---------- GroupMember ----------

export interface GroupMemberCreateRequest {
  researchGroupId: number | null;
  studentId: number | null;
  activityStatus: string | null;
  joinedAt: string | null;
}

export interface GroupMemberUpdateRequest {
  researchGroupId: number | null;
  studentId: number | null;
  activityStatus: string | null;
  joinedAt: string | null;
}

// ---------- LearningMaterial ----------

export interface LearningMaterialCreateRequest {
  lecturerId: number | null;
  title: string | null;
  fileUrl: string | null;
  description: string | null;
  subFieldId: number | null;
}

export interface LearningMaterialUpdateRequest {
  lecturerId: number | null;
  title: string | null;
  fileUrl: string | null;
  description: string | null;
  subFieldId: number | null;
}

// SharedMaterial is a collaboration record in the live Swagger contract.
// Catalog metadata belongs to isolated demo state until the BE adds fields.
export interface SharedMaterialCreateRequest {
  lecturerId: number | null;
  paperId: number | null;
  sharedWithColleagueId: number | null;
  sharedAt: string | null;
  status: string | null;
}

export interface SharedMaterialUpdateRequest extends SharedMaterialCreateRequest {}

// ---------- PhasedReport ----------

export interface PhasedReportCreateRequest {
  researchGroupId: number | null;
  groupMemberId: number | null;
  reportFileUrl: string | null;
  capacityEvaluation: string | null;
  finalOutcomeEvaluation: string | null;
  lectureFeedback: number | null;
  phaseNumber?: number | null;
  milestoneTitle?: string | null;
  status?: string | null;
  submittedAt: string | null;
}

export interface PhasedReportUpdateRequest {
  researchGroupId: number | null;
  groupMemberId: number | null;
  reportFileUrl: string | null;
  capacityEvaluation: string | null;
  finalOutcomeEvaluation: string | null;
  lectureFeedback: number | null;
  phaseNumber?: number | null;
  milestoneTitle?: string | null;
  status?: string | null;
  submittedAt: string | null;
}

// ---------- TopicMilestones & Phase Reports ----------

export interface TopicPhaseItem {
  phaseNumber: number;
  milestoneTitle: string;
  deadlineAt: string;
}

export interface TopicMilestonesCreateRequest {
  topicId: number;
  researchGroupId?: number | null;
  phases: TopicPhaseItem[];
}

export interface PhasedReportSubmitRequest {
  phasedReportId?: number | null;
  topicId?: number | null;
  phaseNumber?: number | null;
  researchGroupId: number;
  groupMemberId: number;
  reportFileUrl: string;
}

export interface PhasedReportEvaluationRequest {
  lecturerDescription: string;
  lectureFeedback?: number | null;
  capacityEvaluation?: string | null;
  finalOutcomeEvaluation?: string | null;
  status: string;
}
