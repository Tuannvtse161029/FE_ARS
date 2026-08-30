---
name: Lecturer Workflow Implementation
overview: Create a coordinator agent and seven specialized sub-agents to implement the full dynamic Lecturer research workflow with API-first data handling, Swagger contract verification, and visible backend-gap banners for missing fields.
todos:
  - id: swagger-audit
    content: Agent 61 — Fetch live Swagger, verify research workflow endpoints, document exact DTOs
    status: pending
  - id: demo-adapter
    content: Agent 67 — Create demo adapter skeleton and BackendGapBanner component
    status: pending
  - id: shared-materials
    content: Agent 62 — Build Shared Materials page with PDF/Drive/Web/Reference cards
    status: pending
  - id: group-leadership
    content: Agent 63 — Add group leader selection, max-4-member validation
    status: pending
  - id: dynamic-phases
    content: Agent 64 — Replace hardcoded 5-phase workflow with dynamic phase CRUD
    status: pending
  - id: phase-reports
    content: Agent 65 — Build phase report review page with overdue calculation, grade/comment/accept/reject
    status: pending
  - id: student-workspace
    content: Agent 66 — Update student workspace with leader-only submission permissions
    status: pending
  - id: integration
    content: Agent 60 — Integrate all changes, produce file ownership and backend-gap docs
    status: pending
isProject: false
---

# Lecturer Research Workflow — Implementation Plan

## Clarified Product Rules (from user answers)

1. **Report resubmission**: Groups CAN resubmit rejected reports anytime, even after deadline or next phase begins
2. **Multi-topic groups**: NO — one group works on exactly one topic at a time
3. **Topic visibility**: OWNER ONLY — only the Lecturer who created the topic can see/review its reports
4. **Phase overlap**: SEQUENTIAL WITH OPTIONAL GAP — Lecturer controls each phase start date
5. **Phase editing after submission**: NO — phase is locked once first report is submitted

## Architecture Decisions

### Current State Analysis

**Existing pages**:
- [`src/pages/Lecturer/ResearchTopics.tsx`](src/pages/Lecturer/ResearchTopics.tsx) — topics CRUD, status transitions
- [`src/pages/Lecturer/ResearchGroup.tsx`](src/pages/Lecturer/ResearchGroup.tsx) — groups list, creation
- [`src/pages/Lecturer/GroupDetail.tsx`](src/pages/Lecturer/GroupDetail.tsx) — members, topic summary
- [`src/pages/Lecturer/ConfigureMilestones.tsx`](src/pages/Lecturer/ConfigureMilestones.tsx) — **hardcoded 5-phase workflow**

**Services**:
- [`src/services/researchTopic.service.ts`](src/services/researchTopic.service.ts)
- [`src/services/researchGroup.service.ts`](src/services/researchGroup.service.ts)
- [`src/services/groupMember.service.ts`](src/services/groupMember.service.ts)
- [`src/services/phasedReport.service.ts`](src/services/phasedReport.service.ts)

**Types**: [`src/types/researchWorkflowDtos.ts`](src/types/researchWorkflowDtos.ts)

### Key Problems to Fix

1. **Hardcoded 5-phase workflow** in `ConfigureMilestones.tsx` — must become dynamic (1-N phases)
2. **No Shared Materials entity** — currently only `ResearchTopic.materialsUrl` (single URL)
3. **No Project Guideline entity** — confused with `GuidanceProject` (lecturer-student supervision)
4. **No phase-group task assignment** — phases apply uniformly to all groups
5. **No Group Leader field** — `GroupMember` has no `isLeader` backend field per Swagger gap
6. **No phase-report linkage** — `PhasedReport` has no `researchTopicPhaseId` or `topicId` fields
7. **No overdue calculation** — must be computed frontend from `deadlineAt` vs `submittedAt`

### Swagger Contract Reality

The latest backend Swagger contract (referenced in [`docs/ORCID_OPENALEX_SWAGGER_CONTRACT.md`](docs/ORCID_OPENALEX_SWAGGER_CONTRACT.md)) **does not document** research workflow endpoints. We must:

1. Inspect live Swagger at `https://arsplatform.onrender.com/swagger/index.html`
2. Document exact request/response shapes
3. Build typed adapters for confirmed endpoints
4. Build isolated demo state for missing backend fields
5. Display visible **"Demo field — awaiting backend API"** banners for every gap

## Agent Structure

### Agent 60 — Coordinator & Program Manager

**Files to create**:
- `docs/LECTURER_RESEARCH_WORKFLOW_PLAN.md`
- `docs/LECTURER_RESEARCH_WORKFLOW_DECISIONS.md`
- `docs/LECTURER_RESEARCH_WORKFLOW_FILE_OWNERSHIP.md`
- `docs/LECTURER_RESEARCH_WORKFLOW_BACKEND_REQUEST.md`

**Responsibilities**:
- Inspect current Swagger contract at runtime
- Assign exclusive file ownership to prevent merge conflicts
- Review Agent 61 findings before approving DTO changes
- Integrate all agent changes into coherent workflow
- Produce final backend-gap documentation

**Exclusive file ownership**: coordinator docs only

---

### Agent 61 — Swagger Workflow Contract Audit

**Files to create**:
- `docs/LECTURER_RESEARCH_WORKFLOW_API_AUDIT.md`

**Responsibilities**:
- Fetch and parse live Swagger JSON from `https://arsplatform.onrender.com/swagger/index.html`
- Verify existence of:
  - `GET/POST /api/SharedMaterial`
  - `GET/POST /api/ProjectGuideline`
  - `GET/POST /api/ResearchTopicPhase`
  - `POST /api/ResearchGroup/{id}/assign-topic`
  - `GroupMember.isLeader` field
  - `PhasedReport.topicId`, `PhasedReport.phaseId`, `PhasedReport.isOverdue` fields
- Document exact DTOs for confirmed endpoints
- List missing fields/endpoints for backend request doc

**Exclusive file ownership**: Swagger audit doc, no code changes

---

### Agent 62 — Shared Materials & Project Guidelines

**Files to modify**:
- `src/pages/Lecturer/SharedMaterials.tsx` (NEW)
- `src/services/sharedMaterial.service.ts` (NEW or update existing)
- `src/types/researchWorkflowDtos.ts` (add `SharedMaterialCreateRequest`, etc.)
- `src/routes/paths.ts` (add `LECTURER_SHARED_MATERIALS`)
- Navigation component (add menu item)

**Responsibilities**:
- Build `/lecturer/shared-materials` page with card grid
- Support material types: PDF (Firebase), Google Drive link, Website link, Reference link
- PDF upload: Firebase Storage → `getDownloadURL()` → backend
- External links: validate HTTPS URLs
- Cards show: title, description, material type, source/link, created date, open/edit/delete actions
- Project Guideline section in topic detail (not a separate CRUD — attached to topic)
- Demo banner if backend has no `SharedMaterial` table

**Exclusive file ownership**: `SharedMaterials.tsx`, `sharedMaterial.service.ts`

---

### Agent 63 — Research Groups, Members, Leadership

**Files to modify**:
- [`src/pages/Lecturer/ResearchGroup.tsx`](src/pages/Lecturer/ResearchGroup.tsx)
- [`src/pages/Lecturer/GroupDetail.tsx`](src/pages/Lecturer/GroupDetail.tsx)
- [`src/services/groupMember.service.ts`](src/services/groupMember.service.ts)
- [`src/types/researchWorkflowDtos.ts`](src/types/researchWorkflowDtos.ts)

**Responsibilities**:
- Enforce max 4 members per group (frontend validation)
- Add "Select Leader" action per member row
- Only one leader allowed per group
- Prevent selecting 5th member (disable invite if `members.length >= 4`)
- Warn before changing existing leader
- Display crown icon for current leader
- Demo banner if backend has no `GroupMember.isLeader` field

**Exclusive file ownership**: group member leadership UI in `GroupDetail.tsx`

---

### Agent 64 — Dynamic Phases & Group Tasks

**Files to modify**:
- [`src/pages/Lecturer/ConfigureMilestones.tsx`](src/pages/Lecturer/ConfigureMilestones.tsx) → rename to `TopicPhases.tsx`
- `src/services/researchTopicPhase.service.ts` (NEW)
- [`src/types/researchWorkflowDtos.ts`](src/types/researchWorkflowDtos.ts)
- [`src/pages/Lecturer/ResearchTopics.tsx`](src/pages/Lecturer/ResearchTopics.tsx) (add "Manage Phases" button)

**Responsibilities**:
- Replace hardcoded 5-phase array with dynamic phase CRUD
- Lecturer can add/edit/delete/reorder phases
- Each phase: `title`, `requirements`, `assessmentCriteria`, `startAt`, `endAt`, `order`
- Phase-specific group tasks: each group sees different task instructions
- Validate: at least 1 phase before topic activation, unique order, end > start
- Sequential with gap: warn if phases overlap, allow gaps
- Lock phase editing after first report submission
- Demo banner if backend has no `ResearchTopicPhase` table

**Exclusive file ownership**: `TopicPhases.tsx`, `researchTopicPhase.service.ts`

---

### Agent 65 — Phase Reports & Lecturer Review

**Files to modify**:
- `src/pages/Lecturer/PhaseReports.tsx` (NEW)
- `src/pages/Lecturer/EvaluateReports.tsx` (if exists, or merge into above)
- [`src/services/phasedReport.service.ts`](src/services/phasedReport.service.ts)
- [`src/types/researchWorkflowDtos.ts`](src/types/researchWorkflowDtos.ts)
- `src/components/lecturer/PhaseReportCard.tsx` (NEW)

**Responsibilities**:
- Show all phase reports grouped by topic → phase → group
- Required linkage: `topicId`, `phaseId`, `researchGroupId`, `groupMemberId`, `pdfUrl`, `submittedAt`, `deadlineAt`
- Calculate `isOverdue` frontend: `submittedAt > deadlineAt`
- Report states: `Not Open`, `Awaiting Submission`, `Submitted On Time`, `Overdue Submitted`, `Under Review`, `Accepted`, `Rejected`
- Lecturer actions: grade (0-10), comment, accept, reject
- Rejection requires feedback text
- Resubmission allowed anytime (per clarification)
- Revision history if backend supports it
- Demo banner for missing `PhasedReport.topicId`, `phaseId`, `isOverdue` fields

**Exclusive file ownership**: `PhaseReports.tsx`, phase report evaluation modal

---

### Agent 66 — Student Group Workspace & Permissions

**Files to modify**:
- `src/pages/GraduateStudent/StudentResearchGroups.tsx` (exists)
- `src/pages/GraduateStudent/GroupWorkspace.tsx` (NEW or update existing)
- Student phase report submission modal

**Responsibilities**:
- Each member sees: assigned topic, guideline, current phase, requirements, their group's task, materials, deadline, report status, feedback
- Only Group Leader can: submit report, upload PDF, resubmit
- Other members see: "Only your Group Leader can submit this phase report."
- No free-text workspace label as phase substitute
- Demo banner if backend has no phase-group-task linkage

**Exclusive file ownership**: `GroupWorkspace.tsx`, student phase submission UI

---

### Agent 67 — Demo Adapter, Backend Gap QA

**Files to create**:
- `src/adapters/lecturerWorkflowDemo.adapter.ts` (NEW)
- `src/components/BackendGapBanner.tsx` (NEW)

**Responsibilities**:
- For every missing backend field, create typed demo state
- Demo fixtures isolated from real API data
- Visible banner near affected feature: **"Demo field — awaiting backend API: [field name]"**
- Never silently merge demo data with real API responses
- Never claim demo changes were persisted
- Document exact backend request in `LECTURER_RESEARCH_WORKFLOW_BACKEND_REQUEST.md`:
  - Feature name
  - Current frontend limitation
  - Required backend entity/field
  - Required endpoint
  - Request/response DTOs
  - Authorization rule
  - Validation rule
  - Status lifecycle
  - Frontend demo behavior

**Exclusive file ownership**: `lecturerWorkflowDemo.adapter.ts`, `BackendGapBanner.tsx`

---

## Implementation Order

1. **Agent 61** — Swagger audit (blocking all others)
2. **Agent 67** — Demo adapter skeleton + banner component
3. **Agent 62** — Shared Materials (parallel)
4. **Agent 63** — Group leadership (parallel)
5. **Agent 64** — Dynamic phases (depends on 61, 67)
6. **Agent 65** — Phase reports (depends on 64, 67)
7. **Agent 66** — Student workspace (depends on 65)
8. **Agent 60** — Integration, file ownership, final docs

## Critical Testing

### Focused Tests (add to existing test files)

1. Lecturer can create topic with 1, 3, 7 phases (not hardcoded 5)
2. Phase ordering and date validation work
3. One topic assigned to multiple groups
4. Frontend prevents 5th group member (validation)
5. Frontend allows only one leader per group
6. Non-leader cannot see submit button
7. Leader PDF submission waits for Firebase URL
8. Late submission shows "Overdue" badge
9. Lecturer rejection requires feedback
10. Shared Material cards show PDF/Drive/Web/Reference types
11. Missing backend fields show visible demo banner
12. Demo data never appears as real API data

### Commands

```bash
npx tsc --noEmit
npm test -- --run src/pages/Lecturer/
npm test -- --run src/services/researchTopic
npm test -- --run src/components/lecturer/
```

Playwright flow (one critical path):
```typescript
// tests/e2e/lecturer-workflow.spec.ts
test('Lecturer creates topic with 3 phases, assigns to group, reviews report', async ({ page }) => {
  // Login as Lecturer → Create topic → Add 3 phases → Assign to group
  // Login as Student (leader) → Submit phase 1 report
  // Login as Lecturer → Grade report → Accept
});
```

## Backend Request Template

For every missing field/endpoint, Agent 67 adds to `LECTURER_RESEARCH_WORKFLOW_BACKEND_REQUEST.md`:

```markdown
### [Feature Name]

**Current frontend limitation**: [what we cannot do without backend]

**Required backend entity/field**: `[TableName].[columnName]` or `[EndpointPath]`

**Required endpoint**: `[HTTP METHOD] /api/[Resource]`

**Request DTO**:
\`\`\`typescript
interface [RequestName] {
  field: type;
}
\`\`\`

**Response DTO**:
\`\`\`typescript
interface [ResponseName] {
  field: type;
}
\`\`\`

**Authorization rule**: [who can call this]

**Validation rule**: [constraints]

**Status lifecycle**: [state transitions if applicable]

**Frontend demo behavior**: [how we fake it until backend ships it]
```

## Completion Criteria

- All 7 agents complete their assigned files
- Agent 60 produces integration docs
- Swagger audit complete with exact DTOs
- Every missing backend field has visible demo banner
- Backend request doc lists all gaps with exact contracts
- TypeScript compiles with no errors
- Focused tests pass
- Manual verification: Lecturer can create topic with dynamic phases, assign to groups, review reports

## Final Deliverable

Agent 60 returns:

```markdown
# LECTURER RESEARCH WORKFLOW — COMPLETION REPORT

## Agent Ownership
[file → agent mapping]

## Swagger Findings
[confirmed endpoints, missing endpoints]

## Real API Features
[what works with live backend]

## Demo Features with Backend-Gap Banners
[what uses demo state + visible banners]

## Shared Materials Behavior
[PDF/Drive/Web/Reference card types]

## Project Guideline Behavior
[attached to topic, not separate CRUD]

## Dynamic Phase Behavior
[1-N phases, not hardcoded 5]

## Group/Leader Rules
[max 4 members, 1 leader, frontend validation]

## Phase Report Permissions
[leader-only submission, owner-only review]

## Backend Contract Requests
[count of missing fields/endpoints, link to doc]

## Modified Files
[list with agent ownership]

## Test Results
[tsc, vitest, playwright]

## Manual Verification Steps
[numbered checklist]

ARS_DYNAMIC_LECTURER_RESEARCH_WORKFLOW_READY
```
