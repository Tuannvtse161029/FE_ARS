# Lecturer Research Workflow — Backend Change Request

**Audience:** Backend (.NET) team (BE owns this — FE hand-off only)
**Author:** agent-61-swagger-workflow-contract-audit (FE)
**Date of write:** 2026-08-30 (UTC+7)
**Reads first:** `docs/LECTURER_RESEARCH_WORKFLOW_API_AUDIT.md` (full verified audit)
**Status of upstream doc:** `docs/local-only/research-workflow-contract.md` (orchestrator, 2026-08-17) — *superseded by the live Swagger as of this run*. Many items previously filed as "gap" are now live endpoints (see audit §2).

---

## Goal

List the minimal, ranked BE changes that the FE team needs so the Lecturer workspace workflow (topics → groups → members / leaders → dynamic phases → per-group phase reports → lecturer review → revisions → progression → notifications) becomes fully server-driven, with no remaining FE workarounds.

The FE will **not** invent endpoints, fields, or DTOs. Each item below states (a) what the FE currently does, (b) what it would prefer the BE to expose, (c) why this matters for the Lecturer UX, and (d) the Swagger surface change required.

---

## Priority legend

| Priority | Meaning |
| --- | --- |
| **P0** | Blocks one of the agreed acceptance criteria for the Lecturer workspace. Required before next milestone. |
| **P1** | Removes a documented workaround; improves data integrity. Required before lecturer console ships to all users. |
| **P2** | Nice-to-have; FE will not block on it. |

---

## P0 — required for the next release

### BR-1 Add `ResearchGroup.Status` column (gap ticket §E.6)

- **FE today:** `deriveGroupStatus(group, topic.status)` synthesizes `OPEN | ASSIGNED | COMPLETED` from `topicId` presence + topic status.
- **BE needed:** Persist the column on the DB; expose it on `ResearchGroupResponse` and accept it on `ResearchGroupUpdateRequest`. Valid values: `OPEN | ASSIGNED | COMPLETED | CANCELLED` (free-form string accepted today; the new column should be `nvarchar(20)` to align with `ResearchTopic.Status`).
- **Why:** Without it the FE cannot distinguish a "cancelled" group from "open". The Lecturer console would render them as identical rows.
- **Swagger delta:** Add `status: string | null` to `ResearchGroupResponse`. Document enum in the schema description.

### BR-2 Per-phase CRUD on milestone phases

- **FE today:** `phasedReportService.setTopicMilestones` POSTs the *entire* new phase list, replacing whatever existed. Adding / removing / reordering a single phase is impossible without overwriting peer phases.
- **BE needed:**
  - `POST /api/PhasedReport/topic-milestones/{topicId}/phases` — append one phase.
  - `PUT /api/PhasedReport/phases/{phaseId}` — edit a phase (title, deadline, phaseNumber).
  - `DELETE /api/PhasedReport/phases/{phaseId}` — remove a phase.
- **Why:** Re-ordering phases (the most common lecturer edit) currently requires posting a new list with all peers — easy to drop a peer in transit. Per-phase CRUD is the lowest-risk correction.
- **Swagger delta:** Three new operations; new `PhaseUpdateRequest` schema (`phaseNumber`, `milestoneTitle`, `deadlineAt`); `PhaseDeleteResponse` returning the affected row count.

### BR-3 Notification types for the lecturer lifecycle

- **FE today:** Lecturer view relies on polling `PhasedReport` and `ResearchGroup` to know there's work waiting. `NotificationCenter` does not recognise any of the lecturer lifecycle types.
- **BE needed:** Publish the following strings as documented `Notification.type` values:

  | `type` | Trigger | Recipients |
  | --- | --- | --- |
  | `report-submitted` | `POST /api/PhasedReport/submit` succeeds | Lecturer owner of the group |
  | `report-evaluated` | `PUT /api/PhasedReport/{id}/evaluate` with `status: Passed` | Submitter, group leader |
  | `report-rejected` | `…/evaluate` with `status: Rejected` | Submitter, group leader |
  | `group-overdue` | A `PhasedReport.isOverdue === true` row exists | Lecturer, group leader |
  | `topic-milestones-published` | `POST /api/PhasedReport/topic-milestones` succeeds | All current members |
  | `group-member-leader-changed` | `POST /api/GroupMember/{id}/set-leader` / `…/remove-leader` | Lecturer, affected student |

- **Swagger delta:** Add the strings to the `Notification.type` schema description. No new endpoints.

### BR-4 Student-side invitation acceptance endpoint

- **FE today:** Group invitation banner is read-only; "accept" never calls the BE.
- **BE needed:** Either of the following:
  - `POST /api/ResearchGroup/invitations/{token}/accept` accepting a one-time token issued by `/api/ResearchGroup/{id}/invite`.
  - `POST /api/ResearchGroup/{id}/join` with the invitation token in the body.
- **Why:** Until students can accept invitations, the Lecturer cannot complete onboarding for a group.
- **Swagger delta:** New operation(s); `GroupInvitationAcceptRequest` schema with `{ token }`.

---

## P1 — improves data integrity, removes FE workarounds

### BR-5 `ResearchGroup.capacity` validation on member insert

- **FE today:** `ResearchGroup.capacity` is documented in Swagger but not enforced; the FE doesn't display it.
- **BE needed:** Reject `POST /api/GroupMember` with `409 Conflict` when the target group is at capacity; expose `memberCount` and `capacity` on `ResearchGroupResponse`.
- **Swagger delta:** Confirm `capacity: int | null` and `memberCount: int | null` on `ResearchGroupResponse`. Add a `409` response on `GroupMember` POST with a documented error schema.

### BR-6 `PhasedReport.previousReportId` structured column

- **FE today:** Threads lineage via the sentinel `__LINEAGE__:Resubmitted from report #N` written into `capacityEvaluation`. SQL-side queries cannot filter on it.
- **BE needed:** Add `PreviousReportId` (`int | null`) on `PhasedReports`; populate it on resubmission.
- **Swagger delta:** Add `previousReportId: int | null` to `PhasedReportResponse`. Update the contract gate so the FE can stop writing the sentinel.

### BR-7 `PhasedReport.annotatedFileUrl` column

- **FE today:** Lecturer reuses `LearningMaterial.fileUrl` rows to publish annotated PDFs.
- **BE needed:** Add `annotatedFileUrl` (`string | null`) on `PhasedReports`; populate it via a new endpoint or accept it on `evaluate`.
- **Swagger delta:** Add the field to `PhasedReportResponse` + `PhasedReportEvaluationRequest`. Either:
  - `POST /api/PhasedReport/{id}/annotation` body `{ annotatedFileUrl }`, or
  - accept `annotatedFileUrl` on the existing `/evaluate` payload.

### BR-8 `SharedMaterial` lifecycle endpoints (attach + detach from phase)

- **FE today:** Shared materials are pinned to a topic only.
- **BE needed:** Allow attaching/detaching a `SharedMaterial` row to a specific phase of a topic. Options:
  - `POST /api/SharedMaterial/{id}/attach-phase` body `{ topicId, phaseNumber }`.
  - `DELETE /api/SharedMaterial/{id}/attach-phase`.
- **Why:** Lecturer's milestone review benefits from "phase 3 — read paper X" links.
- **Swagger delta:** Two new operations; optional `phaseNumber: int | null` on `SharedMaterialResponse`.

### BR-9 Confirm `ResearchTopic.topicGuidelines` + `…Url` field semantics

- **FE today:** DTO + service ignore both fields.
- **BE needed:** Document the difference:
  - `topicGuidelines` = free-form text body the lecturer authors.
  - `topicGuidelinesUrl` = optional PDF / external URL the lecturer uploads (already covered by SharedMaterial).
- **Swagger delta:** Add the field description (the field itself is already exposed).

---

## P2 — nice to have, FE will not block

### BR-10 Server-side filters on `GroupMember`

- **FE today:** `groupMemberService.getMembersForGroup` fetches all and filters client-side; same for `filterGroupMembersByStudentId`.
- **BE needed:** Accept `?researchGroupId=` and `?studentId=` on `GET /api/GroupMember`.
- **Swagger delta:** Document the two new query parameters on the existing operation.

### BR-11 Server-side filter on `PhasedReport` for the lecturer

- **FE today:** `filterPhasedReportsByGroupIds` fetches all rows then filters client-side.
- **BE needed:** Accept `?researchGroupId=…&topicId=…&phaseNumber=…` on `GET /api/PhasedReport`.
- **Swagger delta:** Document query parameters.

### BR-12 Aggregated overdue + topic-complete helpers

- **FE today:** FE computes "all phases Passed → group complete" locally.
- **BE needed:** Either:
  - Add a derived `isOverdue` / `isCompleted` flag on `ResearchGroupResponse` (server-computed).
  - Or expose `GET /api/ResearchGroup/{id}/progress` returning `{ totalPhases, submittedPhases, passedPhases, overduePhases, isOverdue, isCompleted }`.
- **Swagger delta:** Depends on chosen approach.

### BR-13 `GuidanceProject.topicId` linkage (deferred)

- **FE today:** `GuidanceProjectCreateRequest` is sent without `topicId`; the project is linked implicitly through `researchGroupId`.
- **BE needed:** None for now — keep the gap ticket deferred until the Lecturer UX actually needs a topic-level Guidance view.

---

## Affected Swagger paths (summary)

| Method | Path | Change |
| --- | --- | --- |
| GET | `/api/ResearchGroup/{id}` | Add `status`, `capacity`, `memberCount` |
| POST | `/api/GroupMember` | Add `409 Conflict` response when at capacity |
| POST | `/api/PhasedReport/topic-milestones/{topicId}/phases` | New — append phase |
| PUT | `/api/PhasedReport/phases/{phaseId}` | New — edit phase |
| DELETE | `/api/PhasedReport/phases/{phaseId}` | New — remove phase |
| POST | `/api/PhasedReport/{id}/annotation` | New — store annotated PDF URL |
| GET | `/api/GroupMember` | New query params `researchGroupId`, `studentId` |
| GET | `/api/PhasedReport` | New query params `topicId`, `phaseNumber` |
| GET | `/api/ResearchGroup/{id}/progress` | New — aggregated progress |
| POST | `/api/ResearchGroup/{id}/join` (or `/invitations/{token}/accept`) | New — student accepts invite |
| POST | `/api/SharedMaterial/{id}/attach-phase` | New — phase binding |
| DELETE | `/api/SharedMaterial/{id}/attach-phase` | New — unbind |

Schemas to update: `ResearchGroupResponse` (status, capacity, memberCount), `PhasedReportResponse` (annotatedFileUrl, previousReportId), `SharedMaterialResponse` (phaseNumber, nullable), `Notification.type` (enum description), `GroupMemberCreateRequest` (no change; only the 409 is new), `TopicMilestonesCreateRequest` (no change).

---

## Authorization impact

All new endpoints inherit the existing lecturer / grad student JWT scoping. No new permission model is required. The BE team should however verify that:

- `POST /api/ResearchGroup/{id}/join` (or equivalent) enforces the token claim.
- `POST /api/PhasedReport/phases/*` enforces the lecturer-owns-topic rule.
- `POST /api/SharedMaterial/{id}/attach-phase` enforces the lecturer-owns-topic rule.

---

## Clarification questions for the BE team

1. **Single source of truth for "topic completion"**: When all phases of a topic are `Passed`, should the BE auto-flip `ResearchTopic.status` to `COMPLETED`? Today the FE derives it from polling.
2. **Resubmission lifecycle**: Should `POST /api/PhasedReport/submit` accept a `previousReportId` field and reject when the prior report is not `Rejected`?
3. **Topic reassignment**: If a topic is moved from one group to another, should existing `PhasedReport` rows be preserved (and shown as orphaned) or hard-deleted?
4. **Group invitation tokens**: Do you plan single-use tokens with TTL, or is `POST /api/ResearchGroup/{id}/join` preferred? Today's Swagger contract exposes only the email list — no token surface.
5. **Overdue calculation cadence**: Is `isOverdue` computed at request time or cached? The audit needs this to confirm there is no client-side drift.
6. **Notification fan-out**: When `POST /api/PhasedReport/{id}/evaluate` is called, should the BE emit `report-evaluated` + (if `Rejected`) `report-rejected` as a batch, or two separate writes?
7. **SharedMaterial upload**: Do you want a `/api/SharedMaterial/upload` that proxies Firebase, or do you keep the Firebase-direct upload pattern the LearningMaterial / PhasedReport PDFs already use?
8. **Annotated PDF flow**: Should `POST /api/PhasedReport/{id}/annotation` accept the URL only, or should it also accept the binary (multipart)?

---

## What this request explicitly does NOT ask for

- No new admin endpoints. Admin side is a separate audit track.
- No changes to the ORCID / OpenAlex / Google onboarding flows (already audited separately).
- No restructuring of `PhasedReport.status` enum (the FE handles synonym mapping locally).
- No changes to `GuidanceProject` (BR-13 deferred).

---

## Handoff instructions for Agent 62

1. Read both audit documents in full before editing any FE file.
2. Treat this document as a wishlist for the BE team. Until BR-1 / BR-2 / BR-3 / BR-4 land, **do not remove the FE workarounds** — they remain the source of truth.
3. The new `sharedMaterial.service.ts` (FE work item) can be staged in parallel; it only consumes BR-9 (or the existing `SharedMaterial` resource).
4. For BR-5 / BR-6 / BR-7, once they ship, remove the corresponding FE fallback code paths in `phasedReport.service.ts`, `learningMaterial.service.ts`, and `researchGroup.service.ts`.
5. For BR-10 / BR-11, replace the client-side `getMembersForGroup` / `filterPhasedReportsByGroupIds` filters with server-side calls — only after verifying with a smoke test that the new query params behave as documented.
6. Coordinate with Agent 27 before touching `groupMember.service.ts` (the file is shared per `lead-phase-c-contract.md` §3.3).
7. Coordinate with Agent 40 before touching `researchTopic.service.ts` or `phasedReport.service.ts`.

End of request.