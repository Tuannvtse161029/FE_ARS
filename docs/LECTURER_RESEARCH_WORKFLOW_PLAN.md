# Lecturer Research Workflow Plan

Coordinator record for the lecturer research workflow on branch phuongpdse140481_FE.

## Sequential Execution

1. Agent 61 audited live Swagger and documented DTOs and gaps.
2. Agent 67 added the typed demo adapter and BackendGapBanner.
3. Agent 62 implemented Shared Materials using confirmed CRUD.
4. Agent 63 implemented group/member leadership and max-four validation.
5. Agent 64 implemented topic phase management.
6. Agent 65 implemented lecturer phase-report grouping and evaluation.
7. Agent 66 owns the student workspace and leader-only submission.
8. Agent 60 completes integration documentation and verification.

## API Boundary

Confirmed resources are ResearchGroup, GroupMember, SharedMaterial, LearningMaterial, and PhasedReport. Independent ResearchTopicPhase CRUD, project guidelines, phase-group tasks, stable phaseId, report lineage, dedicated resubmit, atomic topic assignment, catalog material metadata, and server capacity enforcement are not published and remain visible backend-gap states.

## Rules

One topic per group; topic-owner lecturer review; sequential phases with optional gaps; phase lock after first report; rejected reports may be resubmitted; one leader and advisory max four members.

## Verification

Check routes and guards, TypeScript, focused tests, ownership scope, leader permissions, phase validation, and that demo fixtures never merge silently into API responses.
