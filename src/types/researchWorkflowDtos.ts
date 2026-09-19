// Strict DTOs that mirror the Swagger OpenAPI spec for the research-workflow
// resources. These are the *single source of truth* for what the FE is allowed
// to send to (and receive from) the BE; service-layer code must use these
// types instead of inline `Record<string, unknown>` blobs.
//
// Each interface is named after the Swagger schema it mirrors:
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
  /**
   * Optional material URL the lecturer attaches to the group. This is the
   * group-level (not topic-level, not phase-level) "starter pack" of reading
   * materials that help the group understand the assigned topic. The BE
   * persists this on the `ResearchGroups.materialsUrl` column. Nullable per
   * Swagger; omit or pass `null` when the group has no materials attached.
   */
  materialsUrl?: string | null;
  /**
   * Whether the group is active. Defaults to `true` for newly created
   * groups. Persisted on the BE `ResearchGroups.is_active` column (added
   * via gap ticket BE-RESEARCH-GROUP-ACTIVE-01). Nullable per Swagger
   * `ResearchGroupCreateRequest`; the FE may omit it.
   */
  isActive?: boolean | null;
}

export interface ResearchGroupUpdateRequest {
  lecturerId: number | null;
  topicId: number | null;
  name: string | null;
  description: string | null;
  deadline: string | null;
  assignedAt: string | null;
  /**
   * See `ResearchGroupCreateRequest.materialsUrl`. Echoed back on PUT so the
   * BE preserves the existing value when the caller doesn't intentionally
   * change it.
   */
  materialsUrl?: string | null;
  /**
   * Whether the group is active. Toggle this via the UI to archive or
   * re-activate a group. Persisted on the BE `ResearchGroups.is_active`
   * column (added via gap ticket BE-RESEARCH-GROUP-ACTIVE-01). Omitting the
   * field preserves the existing value on the BE side; prefer the dedicated
   * `PATCH /api/ResearchGroup/{id}/active` endpoint (see
   * `researchGroupService.setActive`) for the toggle flow so concurrent
   * edits don't fight each other.
   */
  isActive?: boolean | null;
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

export interface LearningMaterialDeleteResponse {
  message?: string;
  deletedId?: number;
  revokedSharesCount?: number;
}

// SharedMaterial is a collaboration record in the live Swagger contract.
// Catalog metadata belongs to isolated demo state until the BE adds fields.
export interface SharedMaterialCreateRequest {
  lecturerId?: number | null;
  learningMaterialId?: number | null;
  paperId?: number | null;
  sharedWithColleagueId?: number | null;
  sharedAt?: string | null;
  expiresAt?: string | null;
  status?: string | null;
}

export interface SharedMaterialUpdateRequest extends SharedMaterialCreateRequest {
  respondedAt?: string | null;
}

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
  /** URL of the learning material assigned to this phase's report. */
  phasedMaterialsUrl?: string | null;
  // ── Live Swagger additions ────────────────────────────────────────────
  // Echo these back on PUT so the BE doesn't wipe the values written by the
  // preceding POST /api/PhasedReport/topic-milestones call. With the older
  // DTO shape the BE silently nulled `requirements`, `assessmentCriteria`,
  // and `startDate` because they were absent from the update payload.
  topicId?: number | null;
  requirements?: string | null;
  assessmentCriteria?: string | null;
  startDate?: string | null;
  /**
   * Phase deadline. Echo back on PUT so the BE doesn't wipe the value the
   * preceding milestone POST wrote. Per Swagger PhasedReportUpdateRequest
   * this field is nullable on write.
   */
  deadlineAt?: string | null;
  /** Swagger `deadline` alias — see PhasedReportUpdateRequest schema. */
  deadline?: string | null;
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
  /**
   * Phase definitions. The BE Swagger schema now accepts `requirements`,
   * `assessmentCriteria`, `startDate`, and `phaseTitle` in addition to the
   * canonical fields. The BE persists all of them and echoes them back in
   * the PhasedReportResponse.
   */
  phases: Array<{
    phaseNumber: number;
    milestoneTitle?: string | null;
    phaseTitle?: string | null;
    requirements?: string | null;
    assessmentCriteria?: string | null;
    criteria?: string | null;
    startDate?: string | null;
    deadlineAt: string;
    deadline?: string | null;
  }>;
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

// ---------- Topic Learning Materials (BE-LEARNING-MATERIAL-TOPIC-ASSOCIATION-01) ----------
//
// IMPORTANT — `topicId` is NOT a BE field:
//   `GET /api/ResearchTopic/{topicId}/learning-materials` returns
//   `LearningMaterialResponse[]` (see Swagger: components.schemas.LearningMaterialResponse).
//   That schema has no `topicId` column; the row's topic is implicit in the URL
//   the caller used. Per-topic fetch callsites MUST inject `topicId` into each
//   row before flattening, otherwise downstream consumers cannot resolve the
//   row back to a `ResearchTopic` and the "Used by …" fan-out silently drops
//   every row.
//
// `topicId` is therefore marked optional here. Callers that flatten across
// multiple topics must inject it (see Materials.tsx `loadCrossReference`);
// single-topic callers like LearningMaterialModal can leave it undefined.

export interface TopicLearningMaterialResponse {
  learningMaterialId: number;
  /** FE-injected per-fetch; the BE does NOT return this. */
  topicId?: number;
  lecturerId?: number | null;
  title: string;
  fileUrl: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttachLearningMaterialRequest {
  learningMaterialId: number;
}

export interface AttachLearningMaterialResponse {
  topicId: number;
  learningMaterialId: number;
  attachedAt?: string;
}

export interface CreateTopicLearningMaterialRequest {
  lecturerId?: number | null;
  title: string;
  fileUrl: string;
  description?: string | null;
}

// ---------- Research Group Join Requests (BE-RESEARCH-GROUP-JOIN-REQUEST-01) ----------

export type GroupJoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface ApplicantProfileDto {
  userId: number;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  major?: string | null;
  academicLevel?: string | null;
}

export interface GroupJoinRequestResponse {
  joinRequestId: number;
  researchGroupId: number;
  researchGroupName?: string;
  applicant: ApplicantProfileDto;
  status: GroupJoinRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupJoinRequestResponse {
  joinRequestId: number;
  researchGroupId: number;
  applicantUserId: number;
  status: GroupJoinRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RejectGroupJoinRequestPayload {
  rejectionNote?: string;
}

export interface AcceptGroupJoinRequestResponse {
  joinRequestId: number;
  researchGroupId: number;
  applicantUserId: number;
  status: 'ACCEPTED';
  groupMemberId?: number;
  decidedByUserId?: number;
  decidedAt?: string;
  note?: string | null;
}

export interface RejectGroupJoinRequestResponse {
  joinRequestId: number;
  researchGroupId: number;
  applicantUserId: number;
  status: 'REJECTED';
  decidedByUserId?: number;
  decidedAt?: string;
  rejectionNote?: string | null;
}
