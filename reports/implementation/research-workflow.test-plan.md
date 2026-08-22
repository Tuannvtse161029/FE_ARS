# Research Workflow Test Matrix

**Status:** Phase A complete; awaiting `LECTURER_INTERFACE_READY`, `GRADUATE_STUDENT_INTERFACE_READY`, and `SHARED_INTEGRATION_READY`.
**Author:** Agent-4-testing

---

## 0. Lead-answered questions (pre-freeze)

| # | Question | Answer |
|---|---|---|
| 1 | `RoleRouteGuard` import path | `src/routes/RoleRouteGuard.tsx` (default export). Will be created by the lead during Gate 4. Tests should `import RoleRouteGuard from '@/routes/RoleRouteGuard'` (or the relative equivalent) and may need a fallback path while it's being integrated. |
| 2 | Does `landingRouteForRoleName` accept `'Graduate Student'` (with space)? | No — that helper only special-cases `'admin'` and `'researcher'`. Anything else falls through to `/dashboard`. GraduateStudent's `RoleRouteGuard` redirect target should be `/dashboard` (or `/forum`, your call — the contract doesn't pin this). |
| 3 | Are `useAuth().user.role` values normalized to canonical enum strings? | Yes — they are always one of `'Researcher' \| 'Reviewer' \| 'Lecturer' \| 'Graduate Student' \| 'Admin'`. The `UserRole` enum preserves the space in `'Graduate Student'`. Tests can compare to these literals directly. |
| 4 | Does `<EvaluateReportModal>` render `<PdfViewer>` lazily (on "Open in new tab") or inline? | **Lazy** — by clicking "View Report PDF". This means each component test for `EvaluateReportModal` does NOT need the `IntersectionObserver` polyfill unless the test specifically opens the viewer. |
| 5 | Sequential vs parallel fetch for `GET /api/ResearchGroup` + `GET /api/GroupMember` on the grad side? | **Parallel** — wrap both in `Promise.all`. Document this in the test (mock both as resolved promises simultaneously). |
| 6 | Admin `useAdminGuard` reads from BOTH `user.role` and `ars_user.roleId` in localStorage. Does mocking only `useAuth` cover the guard? | Yes — `useAuth().user.role` is the first signal. Tests that mount an Admin page with `buildMockAuth({ role: 'Admin' })` pass through the guard. |

---

## 1. Cross-cutting plan

- **Mocks at stable boundaries** — axios (service-level), `useFirebaseUpload` (hook-level for Submit flow; raw `firebase/storage` only for the existing hook unit test pattern), `useAuth` (per-test), `pdfjs-dist` (reused via `src/tests/utils/mockPdfJs.ts`).
- **Reused helpers** — `mockFirebaseUpload.ts` (callbacksRef + `simulateUploadComplete`/`simulateUploadRemove`) and `mockPdfJs.ts`.
- **New helpers to add in Phase B** — `mockAuth.ts`, `mockPhasedReportService.ts`, `mockResearchGroupService.ts`, `mockRouterParams.ts`.
- **`IntersectionObserver` policy** — does **not** add a global polyfill to `setup.ts` (per brief). New tests that mount `<PdfViewer>` will copy the 4-line local polyfill already used in `src/tests/components/PdfViewer.test.tsx`. A small "guard test" is proposed to document the contract.

---

## 2. Lecturer tests (~30 cases)

- **Services** (`researchTopic`, `researchGroup`, `guidanceProject`, `phasedReport`) — 14 cases covering POST/PUT/GET, defensive shape normalization, conflict (409) propagation, lecturer-scoped filtering.
- **Hooks** (`useResearchTopics`, `useResearchGroups`, `useEvaluatePhasedReport`) — 9 cases including optimistic-update rollback on conflict.
- **Components** (`EvaluateReportModal`, `CreateTopicModal`, `AssignTopicModal`, `ConfigureMilestonesForm`) — 19 cases including the **required-feedback-on-reject** rule and the **disabled-save-with-tooltip** for milestones.
- **Page** (`Lecturer/ResearchGroup`) — 9 cases including the 4 status-badge colors (OPEN/ASSIGNED/COMPLETED/CLOSED) and loading/empty/error states.
- **Utils** (`researchStatus.test.ts`) — 9 transition-guard cases mirroring §3 of the contract exactly.

---

## 3. Graduate Student tests (~25 cases)

- **Services** (`phasedReport` writes, `groupMember` filter) — 4 cases including the documented **client-side filter** for `?studentId=` (Swagger gap).
- **Hooks** (`useSubmitPhasedReport`, `usePhasedReports`) — 8 cases including: Firebase success, Firebase failure, **Firebase success + BE failure** (must keep URL, no auto-re-upload), duplicate-submit prevention, filename sanitization.
- **Components** (`SubmitReportModal`, `RejectionBanner`, `InvitationBanner`) — 15 cases including real `<input type="file">`, MIME rejection, >10MB rejection, progress visibility, **recoverable retry that does not re-upload the binary**, **invitation accept is a no-op** with advisory text.
- **Pages** (`GraduateStudent/StudentResearchGroups`, `GraduateStudent/SubmitReport`) — 12 cases including `RoleRouteGuard` enforcement for `Graduate Student` only and the BE-gap banner for missing filter.

---

## 4. Shared / integrated (12 cases)

- `lecturerGraduateStudent.flow.integration.test.tsx` — happy path (assign → submit → see on Lecturer side), reject-resubmit loop, approve loop, cross-role guard × 3, topic conflict propagation.
- `submitReport.uploadContract.integration.test.tsx` — exact folder path assertion, MIME/size pre-upload validation, sanitization regex, `reportFileUrl` byte-identical passthrough.

---

## 5. E2E — drafted, deferred

`researcherWorkflow.e2e.test.ts` — 2 cases mirroring existing `researcherUpload`/`pdfRender` patterns. Will only run after `SHARED_INTEGRATION_READY` and a Chromium-enabled env.

---

## 6. Execution order after freeze

helpers → utils → services → hooks → components → pages → integration → run `npm run test` then `npm run test:integration` → e2e last.

---

## 7. Pre-existing failures — left untouched

`pdfUploadView.integration.test.tsx`, `Papers.test.tsx`, `researcherUpload.e2e.test.ts`, `pdfRender.e2e.test.ts` — out of scope per the brief. Phase B work must not regress them.
