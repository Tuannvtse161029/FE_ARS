# Publication Incident: Independent QA

## Scope and environment

- Repository: `F:\CAPSTONE_PROJECT\ARS_FE`.
- Branch supplied and preserved: `phuongpdse140481_FE`.
- Baseline supplied by coordinator: `ac9b1ba`, with pre-existing dirty files and concurrent incident implementation edits. This report does not attribute every dirty file to the incident.
- Independent QA changed tests and this report only. Production findings were sent to the coordinator for correction.
- Runtime observed: Node.js 24.19.0, Vitest 4.1.11, Vite 6.4.3.
- The global npm/npx PowerShell shims fail before running the project because their npm CLI module is missing. Equivalent installed executables were run directly with Node; the machine's npm installation was not modified.

## Release verdict

**Full real publication lifecycle: NOT VERIFIED.** Do not treat compile success or mocked tests as proof of a real cross-role backend lifecycle.

The live contract audit supplied by the coordinator documents CRUD status strings but no enum/transition semantics for Admin editorial approval. Independent publication activity/reactivation is also absent. The adapter deliberately blocks manual authorship approval, approval-for-review and reactivation. A complete approved lifecycle cannot be certified by bypassing those guards.

No production records were created, deleted, assigned, evaluated, published or deactivated during this QA task. No push or deployment was performed. No browser screenshot or authenticated role-session evidence was collected.

## Actual automated results

- `node node_modules/typescript/bin/tsc --noEmit`: PASS, including the final production edits.
- `node node_modules/typescript/bin/tsc -b`: PASS, including the final production edits.
- `node --max-old-space-size=2048 node_modules/vite/bin/vite.js build`: PASS, including the final production edits; 2,927 modules transformed.
- First focused test selection: 86 passed / 22 failed, across six files.
- Latest observed per-file totals: **109 passed / 1 failed** across 110 tests. These totals combine the latest permitted run of each file, not a single all-green run.
- PDF viewer: 65 passed / 0 failed. The initial 404/HTML-response download-link failures exposed a real regression. Coordinator fixed the fallback and toolbar download guards; final permitted run passed.
- Publication confirmation: 2 passed / 0 failed. Verified portal placement outside a transformed container, mutation error visibility and busy confirmation/dismissal guards.
- Publication adapter incident regressions: 12 passed / 0 failed.
- Reviewer criteria: 9 passed / 0 failed.
- Reviewer assignment detail: 11 passed / 0 failed after updating the exact-assignment mock, policy precondition, mandatory criterion notes and translated copy expectations.
- Researcher submission form: 10 passed / 1 failed in the last permitted run. The remaining assertion received literal `{id}` from the test-only translation mock. The mock now interpolates parameters, but that final test edit was **not rerun** because the three-attempt limit was reached. This is not recorded as a pass.
- Initial suites did not provide an English translation provider and still mocked the removed paper-list lookup. Tests now supply English translations and the exact-assignment lookup boundary.
- The coordinator's final synchronous researcher submission guard and confirmation body-scroll restoration compiled, but their specific runtime behavior was not independently retested after those final edits.

Commands used the installed `vitest.mjs run --config vitest.config.ts` with the six files below. Test reruns were limited to meaningful changes/diagnostic isolation; no file exceeded three executions.

## Coverage added or repaired

1. Evaluation mutations use `ReviewRequest.id`, never `Paper.id`.
2. Another reviewer's assignment and mismatched response IDs are rejected without writes.
3. A Pending assignment cannot submit an evaluation.
4. Evaluation-save failure does not send the Completed request update.
5. Unconfirmed assignment acceptance rejects the operation.
6. Missing evaluation does not invent an ACCEPT recommendation.
7. `Accepted` alone does not normalize to a completed evaluation.
8. Missing bibliographic authors are not replaced by the submitter's account name; publication/submission dates are not inferred from update timestamps.
9. Undocumented editorial approval/reactivation actions do not issue a paper update.
10. Create requires Journal/Conference and sends all supplied authors.
11. Confirmation overlays are attached to `document.body`, outside transformed page containers; busy actions cannot be repeated.
12. Existing PDF coverage validates local File/Blob inputs, protected-viewer behavior and error cases. It does not establish actual Firebase delivery in a browser.
13. Existing researcher tests validate upload sequencing and exact fixture URL propagation. The URL is synthetic test data, not a live storage object.

## Exact frontend field mapping

- `Paper.id` -> publication `id` string. `Paper.authorId` remains account ownership metadata only.
- `Paper.paperType` -> `paperType`; create accepts `Journal` or `Conference`. The service fills update paperType from the authoritative record and preserves authors/metadata when omitted by the caller; this service preservation path was inspected, not independently integration-tested here.
- `Paper.authors[].paperAuthorId/authorName/orcidId/authorOrder` -> author `id/name/orcid/order`. Missing authors -> empty list.
- `Paper.publicationDate/sourceName/issnValue/doi/openAlexWorkId/fileUrl` -> `publicationDate/sourceName/issnValue/doi/openAlexId/fileUrl`.
- `Paper.subFieldId` -> `subFieldId`, with `Subfield #N` as an identifier label. Domain/field names, institution arrays, topics, keywords and version are not invented from account data or browser storage.
- Publication `submittedAt` and `publishedAt` remain undefined because dedicated contract fields were not confirmed. `Paper.createdAt` remains creation time.
- `ReviewRequest.id/paperId/reviewerId/status` identify the assignment, manuscript, authorized reviewer and request state separately.
- `DetailedEvaluation.finalDecision` -> optional recommendation only for recognized `ACCEPT`, `REVISION_REQUIRED`, `REJECT` values.
- `DetailedEvaluation.generalComments` -> private comments; `createdAt` -> evaluation submission time only.
- Criterion score mapping: originality -> `scoreOriginality`; references -> `scoreLiterature`; methodology -> `scoreMethodology`; significance -> `scoreResults`; clarity -> `scoreFormatting`. Notes use the corresponding `notes*` keys. Specialized rubric values retain `criteria1..3`, `expandedCriteria1..3`, `evaluationCriteria1..3`.

## Transition mapping and limits

- Assignment Pending -> UI REVIEWER_ASSIGNED; In Progress -> UNDER_REVIEW.
- Assignment response sends `PUT ReviewRequest/{assignmentId}` with `In Progress` or `Declined`, then reloads the canonical assignment and checks confirmation.
- Review submit creates a DetailedEvaluation with the exact assignment/reviewer IDs, then updates that same ReviewRequest to `Completed` and reloads.
- Completed + recognized evaluation decision -> corresponding reviewer recommendation UI. Completed without a decision is not ACCEPT; the detail view indicates evaluation unavailability.
- Declined/Cancelled request -> READY_FOR_REVIEWER presentation. Unknown request status must not be treated as completed review.
- Draft/submission/publication/rejection use Paper CRUD string values (`Draft`, `Waiting for Review`, `Published`, `Rejected`). These are frontend write mappings, **not proof of server-authorized lifecycle semantics**.
- Manual authorship approval, Admin approval-for-review and independent reactivation: blocked pending backend contract.
- Any remaining legacy deactivation behavior must not be described as independent activity tracking without a backend activity field.

## Unverified risks and blocked checks

- Evaluation creation and request completion are separate mutations. If evaluation creation succeeds and completion fails, the backend can retain a partial result. Atomic submission/idempotency and duplicate prevention need backend confirmation. The failure-before-evaluation-save guard is tested; partial-persistence retry and draft preservation in a real session are not certified.
- Credential helper only reads environment variables and throws if required credentials are missing. `.env.playwright.local` contains key names for Admin, Researcher and Reviewer; the current QA process has none of those role values loaded. Credential validity was not tested and values were never printed.
- Existing `tests/automation/Playwright/specs/publication-flow.spec.ts` was not executed. Its fallback reviewer identity, storage clearing, direct mutations and logging of protected data make it unsuitable unchanged for this incident.
- Zero Playwright flows were executed. The requested real cross-role critical path remains blocked; no mock flow is presented as equivalent.
- Owner-only backend authorization, reload across separate role sessions, real private PDF access, server state transitions and activity reactivation require controlled test records and confirmed backend behavior.

## QA-owned files

- `tests/unit/publication/api/publication.adapter.mainFlowRepairs.test.ts`
- `tests/unit/publication/admin/PublicationConfirmation.incident.test.tsx`
- `tests/unit/publication/reviewer/ReviewerAssignmentDetail.test.tsx`
- `tests/unit/publication/researcher/ResearcherSubmissionForm.test.tsx`
- `docs/PUBLICATION_INCIDENT_QA.md`

Sanitized machine-readable test results are in the agent workspace (`publication-qa-result.json` and `publication-final-qa-result.json`). They contain synthetic test DOM and assertions, not live credentials or protected manuscript URLs.
