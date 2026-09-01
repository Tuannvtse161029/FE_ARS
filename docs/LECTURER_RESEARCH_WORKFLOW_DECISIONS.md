# Lecturer Research Workflow Decisions

## Confirmed Product Decisions

### Dynamic phases

The workflow supports any positive number of Lecturer-defined ordered phases. Phase order is represented by `phaseNumber`; the frontend must remove fixed five-phase defaults, copy, and assumptions. `milestoneTitle` and `deadlineAt` are the supported phase fields visible in Swagger.

### Sequential actionability

The next phase is actionable only after earlier phases satisfy the frontend's accepted-state policy. A deadline gap changes scheduling only; it does not allow skipping a prior phase. The server response remains authoritative when it disagrees with derived UI state.

### Configuration lock

After the first report submission for a phase is observed, the frontend locks that phase's title, deadline, task requirements, and material requirements. This lock is derived from report rows because Swagger exposes neither an independent phase resource nor an authoritative lock field. Report evaluation remains available.

### Rejection and resubmission

Rejected reports remain resubmittable without a time limit. The frontend preserves displayed feedback and does not claim a predecessor relationship because Swagger publishes no `previousReportId`, lineage field, or dedicated resubmission operation. Existing sentinel-based lineage behavior is not a confirmed backend contract and must be removed or quarantined by the owning agent.

### One active topic per group

The published group shape contains one nullable `topicId`. The frontend prevents a known duplicate assignment and surfaces server conflicts, but must not claim atomic assignment, capacity enforcement, or a conflict schema. The supported operation is the documented group update path.

### Visibility and review

Lecturer review is scoped to Lecturer-owned topics/groups. Student report views are scoped to the current user's group/topic. Missing ownership relationships fail closed in the UI. Backend authorization remains authoritative. A dedicated review queue is not published; review queues are derived from loaded reports.

### Notifications

The Notification API is generic CRUD plus unread/read operations. No workflow event payload, trigger, recipient rule, or automatic notification is published. The frontend must not manufacture deadline, submission, evaluation, rejection, resubmission, or advancement notifications.

## Live Swagger Evidence

The reviewed live document is `https://arsplatform.onrender.com/swagger/v1/swagger.json`, dated 2026-08-30 for this coordination. It publishes:

- `ResearchTopic` CRUD, lecturer filtering, and current-user topics.
- `ResearchGroup` CRUD, current-user groups, invitation by email, nullable `topicId`, member count, and members.
- `GroupMember` CRUD and leader operations.
- `GuidanceProject` CRUD with nullable `researchGroupId`.
- `LearningMaterial` CRUD with lecturer ownership and `fileUrl`.
- `PhasedReport` list/filter reads, topic/group reads, topic members, topic milestones, submit, evaluate, CRUD, status, deadlines, and submission timestamps.
- Generic `Notification` CRUD and read/unread operations.

Swagger does not publish atomic topic assignment, group capacity, independent phase CRUD, phase/task/material relations, report lineage, a dedicated review queue, workflow notification events, or automatic phase advancement.

## Clarification Questions For Backend

1. What endpoint and response guarantee one active topic per group atomically?
2. Where are phase task requirements and phase-specific material relations stored and queried?
3. How can milestone configuration be read, edited, or deleted after creation?
4. What is the authoritative first-submission lock and next-phase state?
5. How is a resubmission linked to the rejected report?
6. What authorization guarantee enforces topic-owner and group-member report visibility?
7. Which workflow notifications are generated, with what payload and recipient rules?
8. Does the server generate IDs when `topicId` is omitted even though the live create/update schema publishes the property as an integer?
9. Does the server enforce report deadlines and status transitions, or should those remain display-only frontend policy?

Until answered in Swagger or a confirmed backend contract, these questions remain blockers or risks and must not be resolved by invented frontend contracts.
