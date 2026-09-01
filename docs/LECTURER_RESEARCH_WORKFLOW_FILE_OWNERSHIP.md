# Lecturer Research Workflow File Ownership

## Ownership Rules

Agents 60-67 have exclusive ownership of the files listed below for this coordinated workflow. Ownership is limited to substantive edits in the listed files and does not transfer existing leases held by other agents. Every owner must preserve unrelated working-tree changes and report contract conflicts before editing shared surfaces.

## Agent 60: Coordinator

Exclusive files:

- `docs/LECTURER_RESEARCH_WORKFLOW_PLAN.md`
- `docs/LECTURER_RESEARCH_WORKFLOW_DECISIONS.md`
- `docs/LECTURER_RESEARCH_WORKFLOW_FILE_OWNERSHIP.md`

Responsibilities: maintain plan, decisions, ownership, risk register, integration gates, and final review.

## Agent 61: API Evidence

Exclusive files:

- `docs/LECTURER_RESEARCH_WORKFLOW_API_AUDIT.md`
- `docs/local-only/research-workflow-contract.md`

Responsibilities: refresh endpoint/schema evidence from live Swagger; document discrepancies only; escalate contract changes to Agent 60.

## Agent 62: Topics And Groups

Exclusive files:

- `src/pages/Lecturer/ResearchTopics.tsx`
- `src/pages/Lecturer/ResearchGroup.tsx`
- `src/pages/Lecturer/GroupDetail.tsx`
- `src/components/lecturer/AssignTopicModal.tsx`
- `src/services/researchTopic.service.ts`
- `src/services/researchGroup.service.ts`
- matching lecturer page/component and service tests.

Responsibilities: topic/group CRUD presentation, lecturer ownership, one-active-topic UI policy, invitation handling, and honest conflict states. No atomic-assignment or capacity claims.

## Agent 63: Dynamic Milestones

Exclusive files:

- `src/pages/Lecturer/ConfigureMilestones.tsx`
- `src/components/research/MilestoneProgress.tsx`
- `src/services/phasedReport.service.ts` milestone/configuration functions only
- `tests/unit/components/ConfigureMilestones.test.tsx`

Responsibilities: positive-length dynamic phase editing, ordering, schedule gaps, first-submission lock, and explicit unsupported task/material persistence state.

## Agent 64: Student Submission

Exclusive files:

- `src/pages/GraduateStudent/SubmitReport.tsx`
- `src/components/gradstudent/SubmitReportModal.tsx`
- `src/components/gradstudent/RejectionFeedbackBanner.tsx`
- `src/components/gradstudent/ResubmitReportModal.tsx`
- `src/hooks/useSubmitPhasedReport.ts`
- matching student submission/resubmission tests.

Responsibilities: leader-only submission, next sequential unlocked phase, rejected-anytime resubmission, group/topic scoping, and no unsupported lineage claims.

## Agent 65: Lecturer Review

Exclusive files:

- `src/pages/Lecturer/EvaluateReports.tsx`
- `src/components/lecturer/EvaluateReportModal.tsx`
- `src/components/lecturer/StatusBadge.tsx`
- matching report-review tests.

Responsibilities: Lecturer-owned review scope, evaluation/rejection feedback, rejected-row visibility, and truthful unsupported queue/notification states.

## Agent 66: Materials

Exclusive files:

- `src/pages/Lecturer/LearningMaterials.tsx`
- `src/components/lecturer/LearningMaterialModal.tsx`
- `src/services/learningMaterial.service.ts`
- `src/hooks/useLearningMaterials.ts`
- matching materials page/component/service/hook tests.

Responsibilities: Firebase URL and LearningMaterial CRUD alignment; distinguish general materials from unsupported phase/group/task relationships.

## Agent 67: Shared Integration

Exclusive files:

- `src/types/researchWorkflowDtos.ts`
- `src/types/research.ts`
- `src/routes/paths.ts`
- `src/App.tsx`
- research-workflow subtree of `src/utils/constants.ts`
- `src/hooks/usePhasedReports.ts`
- `src/hooks/useResearchGroups.ts`
- `src/hooks/useResearchTopics.ts`
- `src/hooks/useNotifications.ts`
- matching shared hooks, route, and phased-report service tests.

Responsibilities: integrate shared types, endpoint constants, route registration, cross-surface hooks, and generic notification behavior. Coordinate exported shape changes with Agents 62-66 before editing.

## Shared-File Rules

`src/services/phasedReport.service.ts` is function-partitioned: Agent 63 owns milestone/configuration functions, Agent 64 owns submission/resubmission functions, Agent 65 owns evaluation/review functions, and Agent 67 owns shared interfaces/constants. No agent reformats or rewrites another section. Endpoint and DTO changes require Agent 60 review.

`src/utils/constants.ts`, `src/routes/paths.ts`, and `src/App.tsx` are shared integration points owned by Agent 67 for research-workflow changes only. Preserve unrelated auth, layout, publication, and existing route work.

## Existing Agent Coordination

Agent 20 owns email verification and related authentication files. Consult Agent 20 before adding any email or notification entry point; this workflow remains generic-notification-only.

Agent 27 has an existing overlapping research-workflow lease. Agent 27's current work is authoritative in overlapping files until Agent 60 records an explicit transfer. Agents 61-67 must report proposed overlaps to Agent 60 and must not overwrite Agent 27 changes.

## Strict Handoff Sequence

1. Agent 61 confirms live endpoint/schema evidence.
2. Agent 62 completes topic/group surfaces and tests.
3. Agent 63 completes milestone configuration and tests.
4. Agent 64 completes student submission/resubmission and tests.
5. Agent 65 completes lecturer review and tests.
6. Agent 66 completes materials and limitation states and tests.
7. Agent 67 reconciles shared contracts/routes/hooks/tests.
8. Agent 60 reviews the complete diff and runs focused verification.

Each handoff must list files changed, tests run, failures, contract questions, and requested decisions. Work proceeds one agent at a time; no parallel implementation is authorized.

## Markdown Convention

Every heading in this document and the companion coordinator documents is surrounded by exactly one blank line when adjacent content exists.
