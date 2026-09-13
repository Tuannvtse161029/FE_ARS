# BE Ticket: Research Group Join Request Workflow

## ID

BE-RESEARCH-GROUP-JOIN-REQUEST-01

## Priority

High - required to replace the Lecturer frontend invitation preview with a production workflow.

## Background

Graduate Students can currently apply to join a Lecturer's Research Group, but the backend contract does not expose a complete workflow for the Lecturer to review and decide on those applications.

The Lecturer Research Groups page now contains a frontend-only preview showing the intended experience:

- A pending-request banner.
- A clickable applicant entry below the Research Group member list.
- An applicant profile modal.
- An optional rejection-note field.
- Accept and Reject actions, currently disabled until this backend work is available.

The preview uses hardcoded data only to communicate the required API and UX to the BE team. It does not persist or mutate any request.

## Goal

Provide an authenticated, authorized, and idempotent API workflow that allows:

- A Graduate Student to submit a request to join a Research Group.
- A Lecturer who owns the group to list pending requests.
- The Lecturer to accept or reject a pending request.
- The Lecturer to include an optional rejection note.
- The requesting student to receive a decision notification.
- Existing group members to receive a notification when a request is accepted.
- The frontend to refresh the group membership and pending-request state after a decision.

## Proposed API Contract

The exact route naming may be adjusted to match existing backend conventions, but the final contract must be documented in Swagger and communicated to FE before the preview is connected.

### 1. Create join request

`POST /api/ResearchGroup/{groupId}/join-requests`

Authenticated Graduate Student only.

**Request body:** none, or an optional request body if the BE requires an applicant note.

**Response:** `201 Created`

```json
{
  "joinRequestId": 501,
  "researchGroupId": 42,
  "applicantUserId": 107,
  "status": "PENDING",
  "createdAt": "2026-09-13T15:00:00Z",
  "updatedAt": "2026-09-13T15:00:00Z"
}
```

**Rules:**

- The authenticated user is the applicant; never accept an arbitrary applicant user ID from the client.
- Reject duplicate pending requests for the same student and group with `409 Conflict`, or return the existing pending request consistently if the endpoint is explicitly idempotent.
- Reject requests when the student is already a member of the group.
- Reject requests when the group is inactive, full, deleted, or otherwise unavailable for joining.
- Define whether a student may have pending requests for multiple groups at once and document that rule.
- Create the Lecturer notification as part of the same transactional operation.

### 2. List pending requests for Lecturer

`GET /api/lecturer/research-groups/{groupId}/join-requests?status=PENDING`

Authenticated Lecturer owner, or an authorized Admin.

**Response:** `200 OK`

```json
[
  {
    "joinRequestId": 501,
    "researchGroupId": 42,
    "researchGroupName": "AI Research Group",
    "applicant": {
      "userId": 107,
      "displayName": "Nguyen Minh Anh",
      "email": "minhanh@example.edu",
      "avatarUrl": null,
      "major": "Computer Science",
      "academicLevel": "Graduate Student"
    },
    "status": "PENDING",
    "createdAt": "2026-09-13T15:00:00Z",
    "updatedAt": "2026-09-13T15:00:00Z"
  }
]
```

**Rules:**

- Return only requests for groups owned by the authenticated Lecturer.
- Return enough applicant profile data for the FE modal without exposing private account fields, credentials, or unrelated personal data.
- Support filtering by status and define pagination behavior for larger groups.
- The response must contain a stable request ID for decision actions.
- Return an empty array when there are no pending requests.

### 3. Get one join request

`GET /api/lecturer/research-groups/{groupId}/join-requests/{joinRequestId}`

Authenticated Lecturer owner, or an authorized Admin.

Return the same applicant-safe profile fields as the list endpoint, plus the request status and timestamps.

### 4. Accept a join request

`POST /api/lecturer/research-groups/{groupId}/join-requests/{joinRequestId}/accept`

Authenticated Lecturer owner, or an authorized Admin according to product policy.

**Request body:** none, unless the BE needs an optional acceptance note.

**Response:** `200 OK`

```json
{
  "joinRequestId": 501,
  "researchGroupId": 42,
  "applicantUserId": 107,
  "status": "ACCEPTED",
  "groupMemberId": 9001,
  "decidedByUserId": 12,
  "decidedAt": "2026-09-13T16:00:00Z",
  "note": null
}
```

**Rules:**

- Verify the request belongs to the specified group and is currently `PENDING`.
- Add the applicant to the group exactly once.
- Enforce the group capacity at decision time, not only when the request is created.
- Prevent the applicant from becoming a duplicate member.
- Change the request status and create notifications atomically.
- A repeated accept request must be idempotent, or return a documented `409 Conflict` without creating duplicate membership or notifications.
- Notify the requesting student that the request was accepted.
- Notify all existing group members that a new member was accepted. Define whether the newly accepted student is included in this fan-out.

### 5. Reject a join request

`POST /api/lecturer/research-groups/{groupId}/join-requests/{joinRequestId}/reject`

Authenticated Lecturer owner, or an authorized Admin according to product policy.

**Request body:**

```json
{
  "rejectionNote": "The group's current topic requires prior experience in distributed systems."
}
```

`rejectionNote` is optional, but must be length-limited and safely stored and rendered.

**Response:** `200 OK`

```json
{
  "joinRequestId": 501,
  "researchGroupId": 42,
  "applicantUserId": 107,
  "status": "REJECTED",
  "decidedByUserId": 12,
  "decidedAt": "2026-09-13T16:00:00Z",
  "rejectionNote": "The group's current topic requires prior experience in distributed systems."
}
```

**Rules:**

- Verify the request belongs to the specified group and is currently `PENDING`.
- Do not create a group member record.
- Store the optional rejection note with the request decision.
- Notify the requesting student with the decision and note when present.
- A repeated reject request must be idempotent, or return a documented `409 Conflict` without duplicate notifications.

## Notification Requirements

Create notifications through the existing backend notification mechanism, or provide the notification contract if a new mechanism is required.

Minimum notification events:

1. `RESEARCH_GROUP_JOIN_REQUESTED`
   - Recipient: Lecturer who owns the group.
   - Payload: request ID, group ID, group name, applicant display name, and a route/deep link to the request.

2. `RESEARCH_GROUP_JOIN_REQUEST_ACCEPTED`
   - Recipient: requesting Graduate Student.
   - Payload: request ID, group ID, group name, and decision timestamp.

3. `RESEARCH_GROUP_JOIN_REQUEST_REJECTED`
   - Recipient: requesting Graduate Student.
   - Payload: request ID, group ID, group name, decision timestamp, and rejection note when present.

4. `RESEARCH_GROUP_MEMBER_ACCEPTED`
   - Recipients: all existing members of the affected group, according to the product rule confirmed by BE/PM.
   - Payload: group ID, group name, accepted member display name, and decision timestamp.

Notification creation must be transactional with the request status change and membership insert. Retried requests must not create duplicate notifications.

## Data Model

Add a persistent join-request entity/table, using the project's existing naming conventions. Minimum fields:

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `JoinRequestId` | integer / UUID | no | Primary key |
| `ResearchGroupId` | integer / UUID | no | Foreign key to ResearchGroup |
| `ApplicantUserId` | integer / UUID | no | Foreign key to user |
| `Status` | enum/string | no | `PENDING`, `ACCEPTED`, `REJECTED`, optionally `CANCELLED` |
| `RejectionNote` | text | yes | Only applicable to rejected requests |
| `DecidedByUserId` | integer / UUID | yes | Lecturer/Admin who decided |
| `CreatedAt` | date-time | no | Request creation time |
| `UpdatedAt` | date-time | no | Last state change |
| `DecidedAt` | date-time | yes | Decision time |

Recommended constraints and indexes:

- Foreign keys to the research group and applicant user.
- Index on `(ResearchGroupId, Status)` for the Lecturer pending list.
- Index on `(ApplicantUserId, Status)` for student request history.
- Constraint or transaction-level protection against duplicate active membership.
- Define whether only one historical request per student/group is allowed, or whether a rejected student may apply again.

## Authorization and Validation

- All endpoints require authentication.
- Only Graduate Students may create requests.
- Only the Lecturer who owns the group may list or decide requests for that group, unless Admin access is explicitly approved.
- Never trust `applicantUserId`, `decidedByUserId`, or lecturer ownership values supplied by the client.
- Return:
  - `400` for invalid request data.
  - `401` for unauthenticated requests.
  - `403` for unauthorized group access.
  - `404` when the group or request does not exist, subject to the project's resource-disclosure policy.
  - `409` for invalid state transitions, duplicate membership, duplicate pending requests, or capacity conflicts.
- Sanitize and length-limit rejection notes.
- Do not expose private user fields in Lecturer responses.

## State Transition Rules

Allowed transitions:

- `PENDING` -> `ACCEPTED`
- `PENDING` -> `REJECTED`
- Optional: `PENDING` -> `CANCELLED` by the requesting student

Once accepted or rejected, a request must not be changed through the same decision endpoint. Any reopen or reversal workflow requires a separate product decision and API contract.

## Frontend Integration Notes

The frontend preview is located in:

- `src/pages/Lecturer/ResearchGroup.tsx`
- `src/pages/Lecturer/ResearchGroup.module.css`

The FE will replace the hardcoded preview with live API calls after the BE contract is available. Please preserve stable field names or provide a migration note before changing them.

The FE needs to know:

- Final endpoint paths and HTTP methods.
- Request and response DTO names.
- Status enum values and transition errors.
- Applicant profile fields allowed in the response.
- Pagination and filtering semantics.
- Notification event names and payload/deep-link fields.
- Whether accepted applicants are included in the member notification fan-out.

## Acceptance Criteria

- [ ] A Graduate Student can create a join request for an eligible Research Group.
- [ ] Duplicate pending requests are rejected or handled idempotently as documented.
- [ ] The owning Lecturer can retrieve pending requests with applicant-safe profile data.
- [ ] A Lecturer cannot read or decide requests for another Lecturer's group.
- [ ] The Lecturer can accept a pending request, creating exactly one group membership.
- [ ] The Lecturer can reject a pending request with or without a rejection note.
- [ ] Invalid transitions from `ACCEPTED` or `REJECTED` are rejected or handled idempotently as documented.
- [ ] Group capacity and duplicate membership are checked atomically during acceptance.
- [ ] The requesting student receives exactly one notification for acceptance or rejection.
- [ ] The group Lecturer receives exactly one notification for a new pending request.
- [ ] Existing group members receive the acceptance notification according to the confirmed fan-out rule.
- [ ] Request status, membership creation, and notification writes are transactionally consistent.
- [ ] API authorization, validation, `401`, `403`, `404`, and `409` behavior is covered by tests.
- [ ] Database migrations, indexes, and foreign keys are included.
- [ ] Swagger documents all endpoints, DTOs, status values, authorization requirements, and error responses.
- [ ] Integration tests cover create, list, accept, reject, duplicate request, invalid transition, cross-owner access, full-group acceptance, and notification idempotency.
