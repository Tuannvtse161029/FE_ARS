# Lecturer Research Workflow API Audit

**Source:** live ARS Platform Swagger UI at `https://arsplatform.onrender.com/swagger/index.html` and its linked definition `/swagger/v1/swagger.json`  
**Audit date:** 2026-08-30  
**Frontend branch:** `phuongpdse140481_FE`

## Executive Summary

The current live contract does expose the core research-workflow resources: `ResearchGroup`, `GroupMember`, `SharedMaterial`, and `PhasedReport`. It also exposes leader-management and report submission/evaluation operations. The contract does **not** expose a `ResearchTopicPhase` entity/CRUD API, a `ProjectGuideline` entity/API, phase-specific group-task linkage, report resubmission lineage, or an explicit `POST /api/ResearchGroup/{id}/assign-topic` operation.

The existing milestone operation is a `PhasedReport` operation that creates a fixed `Phase 1..5` set from a `TopicMilestonesCreateRequest`; it is not a dynamic phase resource. Frontend behavior requiring more than five configurable phases or phase CRUD therefore needs a backend contract extension.

## Authentication

Swagger advertises one security scheme:

- **Bearer**: HTTP Bearer token (`Authorization: Bearer <JWT>`). The Swagger UI shows the scheme as available on workflow operations. The token value is entered without the `Bearer ` prefix in Swagger.

Authorization is enforced by the backend per endpoint/role policy; operation descriptions identify Lecturer or Group Leader responsibilities where applicable. The Swagger document does not provide a complete role matrix for every operation, so the frontend must continue to handle `401/403` responses explicitly.

## Confirmed Workflow Paths

### SharedMaterial

All confirmed operations use `/api/SharedMaterial` and return JSON (or text/json) response bodies.

| Method | Path | Contract behavior |
|---|---|---|
| GET | `/api/SharedMaterial` | List all shared materials |
| POST | `/api/SharedMaterial` | Create/share a material |
| GET | `/api/SharedMaterial/paged` | Paginated list (`pageSize`, `pageNumber` query parameters are used by the generic paged controllers) |
| GET | `/api/SharedMaterial/{id}` | Get one shared material |
| PUT | `/api/SharedMaterial/{id}` | Update a shared material |
| DELETE | `/api/SharedMaterial/{id}` | Delete a shared material |

The live DTO is collaboration-oriented (`paperId`, `sharedWithColleagueId`), not a general PDF/Drive/Web/reference catalog. It has no `title`, `description`, `materialType`, `url`, or topic association.

### ResearchGroup

| Method | Path | Contract behavior |
|---|---|---|
| GET | `/api/ResearchGroup` | List all research groups |
| POST | `/api/ResearchGroup` | Create a group |
| GET | `/api/ResearchGroup/my-groups` | Groups for the current Lecturer/Student |
| POST | `/api/ResearchGroup/{id}/invite` | Invite students by email list |
| GET | `/api/ResearchGroup/paged` | Paginated list |
| GET | `/api/ResearchGroup/{id}` | Group detail |
| PUT | `/api/ResearchGroup/{id}` | Update group |
| DELETE | `/api/ResearchGroup/{id}` | Delete group |

There is no `POST /api/ResearchGroup/{id}/assign-topic`. Topic assignment is represented by `topicId` in the group create/update body and must use `PUT /api/ResearchGroup/{id}` for an existing group.

### GroupMember

| Method | Path | Contract behavior |
|---|---|---|
| GET | `/api/GroupMember` | List all group memberships |
| POST | `/api/GroupMember` | Add a student to a group |
| GET | `/api/GroupMember/paged` | Paginated list |
| GET | `/api/GroupMember/{id}` | Membership detail |
| PUT | `/api/GroupMember/{id}` | Update membership |
| DELETE | `/api/GroupMember/{id}` | Delete membership |
| POST | `/api/GroupMember/{id}/set-leader` | Set the membership row as leader; required path `id` is the GroupMember record id; optional query `userId` |
| POST | `/api/GroupMember/set-leader` | Set leader with request body |
| POST | `/api/GroupMember/{id}/remove-leader` | Remove leader role |
| DELETE | `/api/GroupMember/{id}/leader` | Remove leader role (alternate operation) |

The response explicitly includes both `leaderId` (boolean, nullable in the schema) and `isLeader` (boolean). The request DTOs do not include an `isLeader` field; leadership is changed through the dedicated operations.

### PhasedReport

| Method | Path | Contract behavior |
|---|---|---|
| GET | `/api/PhasedReport` | List reports; description allows filtering by `researchGroupId` or `topicId` |
| POST | `/api/PhasedReport` | Create a report record |
| GET | `/api/PhasedReport/topic/{topicId}` | Reports for a topic (described as five phase reports) |
| GET | `/api/PhasedReport/by-topic/{topicId}` | Alternate topic report path |
| GET | `/api/PhasedReport/topic/{topicId}/members` | Members associated with a topic |
| GET | `/api/PhasedReport/group/{groupId}` | Reports for a group |
| GET | `/api/PhasedReport/paged` | Paginated list |
| POST | `/api/PhasedReport/topic-milestones` | Lecturer creates topic milestones using a phase array; description says `Phase 1..5` |
| POST | `/api/PhasedReport/submit` | Group Leader submission; backend checks deadline and assigns OnTime/Overdue status |
| GET | `/api/PhasedReport/{id}` | Report detail |
| PUT | `/api/PhasedReport/{id}` | Update report |
| PUT | `/api/PhasedReport/{id}/evaluate` | Lecturer evaluation (grade, comments, status) |
| DELETE | `/api/PhasedReport/{id}` | Delete report |

The live response includes `topicId`, `phaseNumber`, `deadlineAt`, `submittedAt`, and read-only `isOverdue`. There is no `phaseId` foreign-key field; phase identity is represented by the integer `phaseNumber` plus `milestoneTitle`.

## Exact DTO Shapes

Swagger marks the following request properties as nullable. The schema does not publish a `required` array for these properties; callers should treat nullable fields as optional on the wire, while path ids remain required.

### `SharedMaterial*`

```typescript
interface SharedMaterialCreateRequest {
  lecturerId: number | null;
  paperId: number | null;
  sharedWithColleagueId: number | null;
  sharedAt: string | null; // date-time
  status: string | null;
}

interface SharedMaterialResponse extends SharedMaterialCreateRequest {
  sharedMaterialId: number;
}
interface SharedMaterialUpdateRequest extends SharedMaterialCreateRequest {}
```

### `ResearchGroup*`

```typescript
interface ResearchGroupCreateRequest {
  lecturerId: number | null;
  topicId: number | null;
  name: string | null;
  description: string | null;
  deadline: string | null;   // date-time
  assignedAt: string | null; // date-time
}

interface ResearchGroupResponse {
  researchGroupId: number;
  lecturerId: number | null;
  topicId: number | null;
  name: string | null;
  description: string | null;
  deadline: string | null;
  assignedAt: string | null;
  createdAt: string | null;
  lecturerName: string | null;
  topicTitle: string | null;
  memberCount: number;
  members: GroupMemberResponse[] | null;
}
interface ResearchGroupUpdateRequest extends ResearchGroupCreateRequest {}
```

### `GroupMember*`

```typescript
interface GroupMemberCreateRequest {
  researchGroupId: number | null;
  studentId: number | null;
  activityStatus: string | null;
  joinedAt: string | null; // date-time
}

interface GroupMemberResponse {
  groupMemberId: number;
  researchGroupId: number | null;
  studentId: number | null;
  activityStatus: string | null;
  leaderId: boolean | null;
  isLeader: boolean;
  joinedAt: string | null; // date-time
  studentName: string | null;
  studentEmail: string | null;
  studentAvatarUrl: string | null;
}

interface GroupMemberSetLeaderRequest {
  groupMemberId: number | null;
  userId: number | null;
  researchGroupId: number | null;
}
interface GroupMemberUpdateRequest extends GroupMemberCreateRequest {}
```

### `PhasedReport*`

```typescript
interface TopicMilestonesCreateRequest {
  topicId: number;
  researchGroupId: number | null;
  phases: TopicPhaseItem[];
}
interface TopicPhaseItem {
  phaseNumber: number;
  milestoneTitle: string;
  deadlineAt: string; // date-time
}

interface PhasedReportCreateRequest {
  topicId: number | null;
  researchGroupId: number | null;
  groupMemberId: number | null;
  reportFileUrl: string | null;
  capacityEvaluation: string | null;
  finalOutcomeEvaluation: string | null;
  lectureFeedback: number | null; // double
  lecturerDescription: string | null;
  phaseNumber: number;
  milestoneTitle: string | null;
  status: string | null;
  deadlineAt: string | null; // date-time
  submittedAt: string | null; // date-time
}

interface PhasedReportSubmitRequest {
  phasedReportId: number | null;
  topicId: number | null;
  phaseNumber: number | null;
  researchGroupId: number | null;
  reportFileUrl: string | null;
  groupMemberId: number | null;
}

interface PhasedReportEvaluationRequest {
  lecturerDescription: string | null;
  lectureFeedback: number | null; // double
  capacityEvaluation: string | null;
  finalOutcomeEvaluation: string | null;
  status: string | null;
}

interface PhasedReportResponse {
  phasedReportId: number;
  researchGroupId: number | null;
  topicId: number | null;
  topicTitle: string | null;
  groupMemberId: number | null;
  reportFileUrl: string | null;
  capacityEvaluation: string | null;
  finalOutcomeEvaluation: string | null;
  lectureFeedback: number | null;
  lecturerDescription: string | null;
  phaseNumber: number;
  milestoneTitle: string | null;
  status: string | null;
  createdAt: string | null;  // date-time
  deadlineAt: string | null; // date-time
  submittedAt: string | null; // date-time
  updatedAt: string | null;   // date-time
  groupName: string | null;
  studentName: string | null;
  isOverdue: boolean; // read-only
}
```

## Related Confirmed Resources

`LearningMaterial` is available as a separate CRUD resource (`GET/POST /api/LearningMaterial`, `/paged`, `/{id}` GET/PUT/DELETE), with `LearningMaterialCreateRequest` fields `lecturerId`, `title`, `fileUrl`, `description`, and `subFieldId` (all nullable). It is not the same as `SharedMaterial` and is not linked to a research topic in the live schema.

`GuidanceProject` is also available as CRUD (`GET/POST /api/GuidanceProject`, `/paged`, `/{id}` GET/PUT/DELETE). Its DTO represents lecturer guidance projects (`lecturerId`, `title`, `description`, `status`, `studentId`, optional `researchGroupId`); it is not a project-guideline entity.

## Missing Contract Items / Backend Gaps

The following plan requirements are absent or insufficient in the live Swagger contract:

1. **`ResearchTopicPhase` entity and CRUD**: no `GET/POST/PUT/DELETE /api/ResearchTopicPhase` paths and no `ResearchTopicPhase*` schemas. Current `/api/PhasedReport/topic-milestones` is fixed to a phase-number/title/deadline array and its description explicitly says Phase 1..5.
2. **Dynamic phase fields**: no `requirements`, `assessmentCriteria`, `startAt`, `endAt`, `order`, lock state, or phase-level status fields.
3. **Project Guideline**: no `/api/ProjectGuideline` paths or schemas. `ResearchTopic` has only its existing topic fields; `GuidanceProject` is a different feature.
4. **Phase-group task linkage**: no phase-specific group task entity or fields linking a task/instructions to `researchGroupId + phaseId`.
5. **Dedicated topic assignment endpoint**: no `POST /api/ResearchGroup/{id}/assign-topic`. Assignment must use `topicId` in `ResearchGroup` create/update, or a new endpoint must be added.
6. **Stable phase identifier**: `PhasedReport` has `phaseNumber`, but no `phaseId`/`researchTopicPhaseId` foreign key. This prevents safe dynamic phase reordering and immutable linkage.
7. **Report resubmission endpoint/lineage**: no dedicated resubmit operation and no `previousReportId`/revision-history property in `PhasedReport` schemas. A frontend resubmission flow cannot persist lineage through the documented contract.
8. **Structured rejection feedback**: evaluation has generic text fields but no dedicated rejection reason/feedback field and no documented rejection status enum/transition rules.
9. **Explicit ownership filters**: list endpoints mention `researchGroupId`/`topicId` filters for reports, but no documented `lecturerId` ownership filter or owner-only authorization matrix is present in the UI contract.
10. **Shared material catalog fields**: `SharedMaterial` supports sharing a `paperId` with a colleague, but lacks material type, title, description, URL, Firebase file metadata, topic association, and authoring ownership needed by the planned Shared Materials page.
11. **Maximum-member constraint**: no documented max-four validation or group-member count constraint is described in the contract; frontend validation can be advisory only.

## Frontend Implementation Guidance

- Use the confirmed `SharedMaterial`, `GroupMember`, `ResearchGroup`, and `PhasedReport` operations as real API features.
- Keep dynamic phases, topic guidelines, phase-group tasks, report lineage, and catalog-style materials behind an explicit backend-gap/demo boundary; do not merge fixture data into real API responses silently.
- Treat `isOverdue` as server-provided when present, with a defensive client calculation from `submittedAt > deadlineAt` only when necessary.
- For leader actions, call the dedicated `/set-leader` operations and refresh the group membership response; do not send an undocumented `isLeader` property in create/update bodies.
- Preserve visible error handling for `401`, `403`, and validation responses because the Swagger document does not define a complete role matrix.

