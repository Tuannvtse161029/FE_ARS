# BE-to-FE Takeover Audit

> Audit timestamp: 2026-09-04 (Friday Sep 4, 2026, 00:04 UTC+7)
> Audited branch: `phuongpdse140481_FE`
> Auditor: FE agent (read-only audit mode; no production code changed)
> Audit scope: BE-side changes during the takeover window, latest live Swagger contract, current FE ↔ BE alignment, outstanding blockers

---

## Audit timestamp and branch

| Item | Value |
| --- | --- |
| Branch | `phuongpdse140481_FE` |
| Working tree | Clean (`git status` reports `nothing to commit, working tree clean`) |
| Local `origin/phuongpdse140481_FE` | Up to date |
| Latest commit on branch | `a50a04e refactor(translations): clean up and standardize admin-related translation keys for improved clarity and consistency` (author Kayaba Zeref, 2026-09-04 00:01 UTC+7) |
| Local Swagger snapshot | `swagger.json` (509,781 bytes; last modified 2026-09-01 11:37 UTC+7) |
| Live Swagger pulled for this audit | `https://arsplatform.onrender.com/swagger/v1/swagger.json` (536,338 bytes; pulled 2026-09-04 00:06 UTC+7) |
| Local `main` HEAD | `8a04756 fix(datetime): standardize datetime handling and prevent timezone skew across inputs, APIs, and display` |

---

## Git/worktree safety findings

| Check | Result |
| --- | --- |
| Are we on the correct branch? | YES — `phuongpdse140481_FE` |
| Are uncommitted changes present? | NO — `nothing to commit, working tree clean` |
| Is there any destructive git operation to undo? | NO — `git log`, `git diff`, `git status` used read-only; no `reset`, `checkout --`, `clean`, rebase, or destructive command was run |
| Is the audit touching `main`? | NO — only the FE branch was inspected; `main` was only read via `git log origin/main` to identify divergence |
| Are there any stashed changes? | NO — `git stash list` is empty |
| Is there a second worktree? | NO — `git worktree list` shows only `F:/CAPSTONE_PROJECT/ARS_FE` |
| Did any push, force-push, or fetch happen during the audit? | NO |
| Was the live Swagger file `swagger_live.json` left behind? | NO — it was created for the diff and removed before this audit was written |

The conversation-start git status snapshot referenced several files as `??` (untracked). Cross-checking those paths with `git ls-files` confirmed they are **tracked** files (e.g. `src/pages/Subscription/Subscription.tsx` was added in commit `8e18eb8` on 2026-09-01). The snapshot is stale; the working tree is clean and aligned with `origin/phuongpdse140481_FE`.

### Reality of the "BE takeover"

The task framing stated that the backend team took over the FE repository for ~4 hours. Inspecting `git log --since="4 hours ago"` shows **all commits in that window are by FE authors** (`tuannvtse161029` and `Kayaba Zeref`):

```text
a50a04e 2026-09-04 00:01  Kayaba Zeref        refactor(translations): clean up and standardize admin-related translation keys
8a04756 2026-09-03 20:51  tuannvtse161029    fix(datetime): standardize datetime handling and prevent timezone skew
af806f1 2026-09-03 20:15  tuannvtse161029    feat(phased-report): add update deadline button and modal
bf5f969 2026-09-03 20:01  tuannvtse161029    feat(auth): full remember me support with email prefill and persistent storage
6829679 2026-09-03 19:24  tuannvtse161029    feat(seminar): wire BE suggested-invitees endpoint
```

No commit during the takeover window is authored by a BE developer, and no commit message references a backend takeover. **Either the BE team did not push during the stated window, or the takeover never materialised.** Either way, the audit scope remains: "what shipped during the window, and what is the live BE now exposing that the FE has not yet wired up?" — both of which are answered below.

---

## Work completed during the takeover window (last 4 hours)

The following items landed in the 4-hour window. Each is listed with classification, frontend files touched, Swagger endpoint/DTO it relates to, evidence, and risk.

### COMPLETE

| Status | Feature | Frontend files | Swagger endpoint / DTO | Evidence | Risk | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| COMPLETE | Auth remember-me support with email prefill | `src/pages/Login/Login.tsx`, `src/store/authSlice.ts`, `src/utils/constants.ts`, `src/utils/storage.ts`, `tests/unit/auth/rememberMe.test.ts`, `tests/unit/pages/Login.test.tsx` | n/a (FE-only change) | commit `bf5f969` (Sep 3 20:01) | None — localStorage / sessionStorage split matches the ARS authentication rules. Logout clears both stores. | FE |
| COMPLETE | PhasedReport extend-deadline UI + service method | `src/components/lecturer/ExtendDeadlineModal.tsx`, `src/components/lecturer/ExtendDeadlineModal.module.css`, `src/pages/GraduateStudent/SubmitReport.tsx`, `src/pages/GraduateStudent/SubmitReport.module.css`, `src/pages/Lecturer/PhaseReports.tsx`, `src/services/phasedReport.service.ts`, `src/utils/constants.ts`, `src/App.tsx` | `PUT /api/PhasedReport/{id}/extend-deadline`, `PhasedReportExtendDeadlineRequest { deadlineAt }` | commit `af806f1` (Sep 3 20:15) — endpoint is live in Swagger | Low — payload is `{ deadlineAt: string }`; service uses `iso` and trusts BE to set `Status = "Pending"`. | FE |
| COMPLETE | Seminar suggested-invitees wired | `src/pages/Lecturer/SeminarWorkspace.tsx`, `src/pages/Lecturer/SeminarWorkspace.module.css`, `src/services/seminar.service.ts`, `src/utils/constants.ts` | `GET /api/Seminar/suggested-invitees?subFieldId={int}` | commit `6829679` (Sep 3 19:24) — endpoint is live in Swagger | Low — `subFieldId` is optional; UI falls back to manual invite when omitted. | FE |
| COMPLETE | Datetime standardization (no timezone skew) | 18 source files including `src/utils/datetime.ts`, `src/services/researchTopicPhase.service.ts`, `src/components/lecturer/*`, `src/pages/Lecturer/*`, `src/pages/GraduateStudent/*`, `src/pages/Profile/*`, `tests/unit/utils/datetime.test.ts` | n/a (pure FE change) | commit `8a04756` (Sep 3 20:51) | Low — all inputs are converted via `datetime.ts` helpers. | FE |
| COMPLETE | Translation key cleanup | `src/i18n/translations.ts` | n/a (i18n) | commit `a50a04e` (Sep 4 00:01) | None | FE |

### PARTIALLY_COMPLETE

| Status | Feature | Frontend files | Swagger endpoint / DTO | Evidence | Risk | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| PARTIALLY_COMPLETE | Admin paper review flow | `src/features/publication/admin/AdminPaperSubmissionDetail.tsx`, `src/features/publication/admin/AdminPaperSubmissions.tsx`, `src/features/publication/api/publication.adapter.ts`, `src/services/paper.service.ts` | `POST /api/Paper/{id}/assign-reviewers` (auto-assign; count param) — LIVE; `POST /api/Paper/{id}/assign-reviewers-manual` (manual) — LIVE; `POST /api/ReviewRequest/manual-assign` — LIVE; `GET /api/Paper/by-reviewer/{reviewerId}` — LIVE | `publication.adapter.ts:563` exposes `assignReviewersAuto` only; no `assignReviewersManual` adapter method exists; UI calls `publicationAdapter.assignReviewersAuto(paper.id, 3)` from `AdminPaperSubmissionDetail.tsx:139`. | Medium — the manual-reviewer endpoints shipped, but the FE has no UI surface to pick specific reviewers. Today every assignment is auto. | shared |
| PARTIALLY_COMPLETE | Seminar feedback constraints | `src/services/seminar.service.ts:293`, `src/components/seminar/SeminarFeedbackModal.tsx` | `POST /api/Seminar/{id}/feedback` body `SeminarFeedbackRequest { participantEvaluation (required, 1..255), rating (required, 1..10) }` | `submitFeedback` payload type allows `rating?: number \| null` and `participantEvaluation?: string \| null`. Modal *does* validate that text is non-empty and rating is in range, but the service signature is permissive. | Low–Medium — if any code path bypasses the modal (e.g. unit tests, future hooks), the BE will return 400. | FE |

### NOT_STARTED

| Status | Feature | Frontend files | Swagger endpoint / DTO | Evidence | Risk | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| NOT_STARTED | Auth `update-expires-at` admin tool | none | `PUT /api/Auth/update-expires-at` body `UpdateExpiresAtRequest { userId, expiresAt }` | No code references `update-expires-at` in `src/`. | Low — admin-only operation; current UX is unaffected. | FE (when admin tooling work is prioritised) |
| NOT_STARTED | Admin manual reviewer assignment UI | none | `POST /api/Paper/{id}/assign-reviewers-manual`, `POST /api/ReviewRequest/manual-assign`, `GET /api/Paper/by-reviewer/{reviewerId}` | Same as the "PARTIALLY_COMPLETE" row above — only the auto-assign path is wired. | Medium — Admin cannot hand-pick specific reviewers when the BE policy requires it. | shared |

### BLOCKED_BY_API_CONTRACT

| Status | Feature | Frontend files | Swagger endpoint / DTO | Evidence | Risk | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| BLOCKED_BY_API_CONTRACT | Annual subscription gate (PayOS) | `src/pages/Subscription/Subscription.tsx`, `src/pages/Subscription/SubscriptionReturn.tsx`, `src/components/subscription/SubscriptionAccessGuard.tsx`, `src/hooks/useSubscription.ts`, `src/services/subscription.service.ts`, `src/routes/SubscriptionRouteGuard.tsx`, `src/types/subscription.ts` | Required: `GET /api/SubscriptionPlan`, `POST /api/Subscription/order`, `GET /api/Subscription/me`, `POST /api/Subscription/cancel/{orderCode}`, `POST /api/payos/subscription-webhook` — **none** in live Swagger | `subscription.service.ts` throws `SubscriptionBackendUnavailableError` from every method. `PROD-001` entry remains `DEVELOPMENT_BYPASS`. `docs/SUBSCRIPTION_ACCESS_CONTRACT.md` and `docs/BACKEND_ANNUAL_SUBSCRIPTION_API_TICKET.md` already define the FE-facing contract. | None for FE today; remains a P0 rollout blocker before PROD-001 can be re-enabled. | BE |
| BLOCKED_BY_API_CONTRACT | Withdrawal admin actions (`accept`, `complete`, `deny`) | `src/services/adminAuxiliary.service.ts`, `src/utils/constants.ts` (now-removed `ADMIN.WITHDRAWALS` block) | `POST /api/WithdrawalRequest/{id}/accept`, `/complete`, `/deny` — **none** in live Swagger (only the GET list, GET single, POST create, and paged variants are live) | `utils/constants.ts` no longer exposes `ADMIN.WITHDRAWALS`; the prior locations were removed when wallet flow was retired. `admin.endpointContract.test.ts` still references the removed keys (see "Test status" below). | Low — the Transactions admin tab has worked with mocks; live actions remain blocked. | BE |

### NEEDS_MANUAL_VERIFICATION

| Status | Feature | Frontend files | Swagger endpoint / DTO | Evidence | Risk | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| NEEDS_MANUAL_VERIFICATION | Several legacy endpoints that the FE thought were missing | many FE constants point to these paths | `GET/POST /api/RoleRequest`, `/api/RoleRequest/{id}/approve`, `/api/RoleRequest/{id}/deny`, `GET /api/RoleRequest/paged`, `GET/POST /api/WithdrawalRequest`, `GET/POST /api/PremiumPackage`, `POST /api/PremiumPackage/{id}/toggle`, `GET/POST/PATCH/DELETE /api/AnnualFee` — all **NOW LIVE** in Swagger | Prior `BACKEND_BLOCKER` tickets (BTR-AGENT29-01 through 04 and the BE-R series in `docs/BACKEND_REQUESTS.md`) were filled by BE work that is **not** visible in any FE commit. The Admin pages now have a live API contract to integrate against. | Medium — many of these services (`adminService`, `adminAuxiliaryService`) still default to `USE_MOCK_DATA = true` and have not been flipped to live. Flipping them should be done as a P1 follow-up after auditing each consumer. | FE |

---

## Work still missing (cumulative, not limited to the 4-hour window)

The following items were already known gaps before the takeover and remain open:

| ID | Area | Severity | FE evidence | BE evidence | Owner |
| --- | --- | --- | --- | --- | --- |
| GAP-001 | `/api/Subscription*` and PayOS webhook contract not shipped | P0 | `src/services/subscription.service.ts`, `docs/SUBSCRIPTION_ACCESS_CONTRACT.md` | Live Swagger contains 0 `Subscription` / `PayOS` paths. | BE |
| GAP-002 | `/api/Account` missing | P1 | `src/utils/constants.ts:198-203`, `src/services/admin.service.ts` | Live Swagger contains 0 `Account` paths. FE workaround uses `/api/user` + mapper. | BE |
| GAP-003 | `/api/ViolationReport` missing | P1 | `src/utils/constants.ts:204-208`, `src/services/adminAuxiliary.service.ts` | Live Swagger contains 0 `ViolationReport` paths. Admin ContentReports remains mocked. | BE |
| GAP-004 | `/api/WithdrawalRequest/{id}/{accept,complete,deny}` missing | P1 | `src/services/adminAuxiliary.service.ts` (was `ADMIN.WITHDRAWALS`) | Live Swagger exposes only GET/POST/DELETE on the collection. | BE |
| GAP-005 | ResearchTopic `materialsUrl` → `guidanceProjectsUrl` rename (BREAKING) | **P0** | `src/types/researchWorkflowDtos.ts:91-107` still uses `materialsUrl`; `src/types/research.ts:36`; `src/services/researchTopic.service.ts:50-126`; pages `src/pages/Lecturer/ResearchTopics.tsx`, `src/components/lecturer/AssignTopicModal.tsx`, `src/pages/Lecturer/ConfigureMilestones.tsx` | Live Swagger `ResearchTopicCreateRequest`, `ResearchTopicUpdateRequest`, `ResearchTopicResponse` no longer have `materialsUrl`; they expose `guidanceProjectsUrl` instead. | FE |
| GAP-006 | PaperCreateRequest / PaperUpdateRequest `paperType` is now REQUIRED | **P0** | `src/services/paper.service.ts:30-52` omits `paperType`. `src/features/publication/researcher/ResearcherSubmissionForm.tsx:55,250` does set it in the local payload, but `publicationAdapter` calls `paperService.create(payload)` whose type does not include `paperType`. | Live Swagger marks `paperType` as `required` on both create and update requests, and adds it to `PaperResponse`. | FE |
| GAP-007 | SeminarFeedbackRequest payload `rating` + `participantEvaluation` are now required | **P1** | `src/services/seminar.service.ts:293-307` declares both as optional. `src/components/seminar/SeminarFeedbackModal.tsx` validates at form level. | Live Swagger: `participantEvaluation (required, minLength 1, maxLength 255)`, `rating (required, integer, minimum 1, maximum 10)`. | FE |
| GAP-008 | Manual reviewer assignment UI | P1 | `src/features/publication/admin/AdminPaperSubmissionDetail.tsx:139` only triggers auto-assign | Live Swagger exposes `POST /api/Paper/{id}/assign-reviewers-manual` and `POST /api/ReviewRequest/manual-assign` plus `GET /api/Paper/by-reviewer/{reviewerId}` for read. | FE |
| GAP-009 | `stale admin.endpointContract.test.ts` reference to removed `ADMIN.WITHDRAWALS` | P2 | `tests/unit/services/admin.endpointContract.test.ts:35-37` reads `e.WITHDRAWALS.GET_ALL` etc. — `ADMIN.WITHDRAWALS` was deleted from constants when the wallet was retired (commit `3189bc5`). | n/a | FE |

---

## Latest Swagger API delta

The live contract pulled 2026-09-04 00:06 UTC+7 was compared to the local `swagger.json` snapshot (2026-09-01 11:37 UTC+7). The two diverge in **6 new endpoints** and **23 changed schemas**; no endpoint was removed. Note: schemas can still be authored at the same path with new fields — those are listed under "Changed schemas" below, not "New endpoints".

### New endpoints in live Swagger (not in local swagger.json)

| Method | Path | Summary (loose translation) | Status | Frontend wired? |
| --- | --- | --- | --- | --- |
| `PUT` | `/api/Auth/update-expires-at` | Admin updates a user's `ExpiresAt` | NEW | NO |
| `GET` | `/api/Paper/by-reviewer/{reviewerId}` | List papers assigned to a reviewer (includes `ReviewerId`/`ReviewerName`) | NEW | NO |
| `POST` | `/api/Paper/{id}/assign-reviewers-manual` | Manually assign reviewers to a paper | NEW | NO |
| `POST` | `/api/ReviewRequest/manual-assign` | Manually assign reviewers to a review request (body `ManualAssignReviewersRequest { paperId, reviewerIds[], reviewerId1/2/3, deadline, fee, note }`) | NEW | NO |
| `PUT` | `/api/PhasedReport/{id}/extend-deadline` | Lecturer extends a phase report deadline; BE sets status back to `Pending` | NEW | **YES** (commit `af806f1`) |
| `GET` | `/api/Seminar/suggested-invitees?subFieldId=` | Suggest invitees for a seminar based on subfield | NEW | **YES** (commit `6829679`) |

### Removed endpoints in live Swagger

NONE. (All paths from the local snapshot still exist in the live contract.)

### New request / response schemas in live Swagger

- `UpdateExpiresAtRequest { userId, expiresAt }`
- `ManualAssignReviewersRequest { paperId, reviewerIds?, reviewerId1?, reviewerId2?, reviewerId3?, deadline?, fee?, note? }`
- `ManualAssignReviewersResponse`
- `PaperWithReviewerResponse` (presumed: a paper joined with `ReviewerId`/`ReviewerName`)
- `PhasedReportExtendDeadlineRequest { deadlineAt }`
- `SuggestedInviteeDto { userId, fullName? }`

### Changed schemas (in both, but properties differ)

The schemas below share a name in local and live Swagger but their properties diverge. The "Impact" column lists the frontend files that consume each.

| Schema | Live delta | Impact (FE files) |
| --- | --- | --- |
| `PaperCreateRequest` | **Adds REQUIRED `paperType: string`**. `title` and `abstract` were already required. | `src/services/paper.service.ts:30-39`, `src/features/publication/researcher/ResearcherSubmissionForm.tsx:55-358`, `src/features/publication/api/publication.adapter.ts` |
| `PaperUpdateRequest` | **Adds REQUIRED `paperType: string`**. | `src/services/paper.service.ts:43-53`, `src/features/publication/api/publication.adapter.ts` (assign / publish / reject paths) |
| `PaperResponse` | **Adds `paperType: string`** (read-only). | All Paper renderers: `src/features/publication/admin/*`, `src/features/publication/reviewer/*`, `src/features/publication/researcher/*`, `src/features/publication/home/PublishedPaperCard.tsx`. `PublicationPaper.paperType: string` already present. |
| `PhasedReportCreateRequest` / `PhasedReportUpdateRequest` / `PhasedReportResponse` / `TopicPhaseItem` | Adds optional `phaseTitle`, `requirements`, `assessmentCriteria`, `criteria`, `startDate`, `startedAt`, `deadline` (response), `phasedMaterialsUrl` (response). | `src/types/researchWorkflowDtos.ts:157-200`, `src/services/phasedReport.service.ts:107-138`, `src/components/lecturer/ConfigureMilestones.tsx`, `src/pages/Lecturer/PhaseReports.tsx`, `src/components/lecturer/EvaluateReportModal.tsx`, `src/components/gradstudent/PhaseReportDetailModal.tsx` |
| `DetailedEvaluationCreateRequest` / `DetailedEvaluationUpdateRequest` / `DetailedEvaluationResponse` | Adds optional `criteria1/2/3`, `expandedCriteria1/2/3`, `evaluationCriteria1/2/3`. | `src/services/detailedEvaluation.service.ts:37-76` |
| `ResearchTopicCreateRequest` / `ResearchTopicUpdateRequest` | **Removes `materialsUrl`. Adds `guidanceProjectsUrl`.** | `src/types/researchWorkflowDtos.ts:91-107`, `src/types/research.ts:36`, `src/services/researchTopic.service.ts` |
| `ResearchTopicResponse` | **Removes `materialsUrl`. Adds `guidanceProjectsUrl`, `groupCount`, `groups`.** | `src/services/researchTopic.service.ts:50-63`, `src/pages/Lecturer/ResearchTopics.tsx`, `src/components/lecturer/AssignTopicModal.tsx`, `src/hooks/useResearchTopics.ts` |
| `ResearchGroupCreateRequest` / `ResearchGroupUpdateRequest` / `ResearchGroupResponse` | **Adds optional `materialsUrl`.** | `src/types/researchWorkflowDtos.ts:51-81` (already carries `materialsUrl`). |
| `SeminarCreateRequest` / `SeminarUpdateRequest` | Adds optional `subFieldId`. | `src/services/seminar.service.ts`, `src/pages/Lecturer/SeminarWorkspace.tsx` (commit `6829679`) |
| `SeminarResponse` | Adds `subFieldId`, `subFieldName`. | `src/services/seminar.service.ts:155-175`, `src/pages/Lecturer/SeminarWorkspace.tsx` |
| `SeminarFeedbackRequest` | **`participantEvaluation` is now REQUIRED with `minLength: 1, maxLength: 255`. `rating` is now REQUIRED with `minimum: 1, maximum: 10`.** | `src/services/seminar.service.ts:293-307`, `src/components/seminar/SeminarFeedbackModal.tsx` |
| `SeminarFeedbackResponse` | Adds `userId`, `rating`, `feedbackSubmittedAt`. | `src/services/seminar.service.ts` |
| `SeminarParticipantResponse` | Adds `rating`, `feedbackSubmittedAt`. | `src/services/seminar.service.ts:153-159` |
| `SeminarInvitationResponse` | Adds `feedbackSubmittedAt`. | `src/services/seminar.service.ts:169-175` |

### Endpoints that were previously documented as missing but are now live

The takeover window (or earlier BE work) shipped several endpoints that older BE tickets listed as `BACKEND_BLOCKER`. The FE has not yet flipped its services to consume them; the work to wire them is queued below.

| Path | Operations now live | Old ticket | Recommended FE action |
| --- | --- | --- | --- |
| `/api/RoleRequest` | GET, GET `/paged`, GET `/{id}`, POST `/{id}/approve`, POST `/{id}/deny` | BTR-AGENT29-01, BTR-AGENT38-01 | Flip `adminService.getRoleRequests` / `decideRoleRequest` off `USE_MOCK_DATA` after verifying the response DTO matches `RoleRequest` in `src/types/admin.ts`. |
| `/api/WithdrawalRequest` | GET, POST, GET `/paged`, GET `/{id}`, DELETE `/{id}` | BTR-AGENT29-03 | Add a `withdrawal.service` that calls these endpoints; keep the `note` → `requestReason` mapper at `admin.service.ts:265-277`. |
| `/api/PremiumPackage` + `/{id}` + `/{id}/toggle` | GET, POST, GET `/paged`, PATCH `/{id}`, DELETE `/{id}`, POST `/{id}/toggle` | BTR-AGENT29-05 | Flip the `PremiumPackages` admin tab to live, given `PremiumPackageResponse` schema matches FE shape (verify before flipping). |
| `/api/AnnualFee` + `/{id}` + `/{id}/toggle` | GET, POST, GET, PUT `/{id}`, DELETE `/{id}`, PATCH `/{id}/toggle` | (none — was in `BACKEND_ANNUAL_SUBSCRIPTION_API_TICKET.md`) | Surface Annual Fee management in `Admin` once subscription tier is enabled. |
| `/api/UserRole` + `/{id}` | GET, POST, GET `/paged`, GET/PUT/DELETE `/{id}` | (used as fallback for `RoleRequest` in older tickets) | No change — FE constants point at `/api/RoleRequest` (which is now live). |

---

## Frontend files affected by each API delta (cross-reference)

| Delta | Frontend file(s) that must change |
| --- | --- |
| `PUT /api/Auth/update-expires-at` (NEW) | Add to `src/utils/constants.ts` under `AUTH`; add a service method; (optional) surface in an admin "Extend trial" widget. |
| `POST /api/Paper/{id}/assign-reviewers-manual` (NEW) | `src/services/paper.service.ts`, `src/utils/constants.ts`, `src/features/publication/api/publication.adapter.ts` (add `assignReviewersManual`), `src/features/publication/admin/AdminPaperSubmissionDetail.tsx` (replace auto-only trigger with a chooser dialog). |
| `POST /api/ReviewRequest/manual-assign` (NEW) | `src/services/reviewRequest.service.ts`, `src/features/publication/api/publication.adapter.ts`. |
| `GET /api/Paper/by-reviewer/{reviewerId}` (NEW) | `src/services/paper.service.ts`, `src/features/publication/reviewer/ReviewerAssignments.tsx` (optional — currently uses a generic list). |
| `PUT /api/PhasedReport/{id}/extend-deadline` (NEW) | Wired. ✅ |
| `GET /api/Seminar/suggested-invitees` (NEW) | Wired. ✅ |
| `PaperCreateRequest` / `PaperUpdateRequest` add REQUIRED `paperType` | `src/services/paper.service.ts:30-53`, `src/features/publication/researcher/ResearcherSubmissionForm.tsx:250`, `src/features/publication/api/publication.adapter.ts:560-606`. |
| `PaperResponse` adds `paperType` | Already wired in `PublicationPaper.paperType` (`src/features/publication/types/publication.ts:68`). ✅ |
| `PhasedReport*` and `TopicPhaseItem` add fields | Already wired in `src/services/phasedReport.service.ts:107-138` and `src/types/researchWorkflowDtos.ts:157-220`. ✅ |
| `DetailedEvaluation*` add fields | Already wired in `src/services/detailedEvaluation.service.ts:37-76`. ✅ |
| `ResearchTopic*` rename `materialsUrl` → `guidanceProjectsUrl` | `src/types/researchWorkflowDtos.ts:91-107`, `src/types/research.ts:36`, `src/services/researchTopic.service.ts:50-126`, `src/services/researchTopic.service.ts:129-138`, `src/pages/Lecturer/ResearchTopics.tsx`, `src/components/lecturer/AssignTopicModal.tsx`, `src/pages/Lecturer/ConfigureMilestones.tsx`, `src/hooks/useResearchTopics.ts`. |
| `ResearchGroup*` add `materialsUrl` | Already wired in `src/types/researchWorkflowDtos.ts:51-81`. ✅ |
| `Seminar*` add `subFieldId` / `subFieldName` | Already wired (commit `6829679`). ✅ |
| `SeminarFeedbackRequest` makes `rating` + `participantEvaluation` required | `src/services/seminar.service.ts:293-307`, `src/components/seminar/SeminarFeedbackModal.tsx`. |

---

## Broken, mocked, or hardcoded behaviour still present

| Behaviour | File(s) | Action required |
| --- | --- | --- |
| `subscriptionService` throws `SubscriptionBackendUnavailableError` from every method | `src/services/subscription.service.ts:32-65` | Leave as-is until BE ships `GET /api/SubscriptionPlan` etc. (PROD-001 stays `DEVELOPMENT_BYPASS`). |
| Admin `RoleRequests`, `AccountsManagement`, `ContentReports`, `TransactionsManagement`, `PremiumPackages`, `AuditLogs` still have mock branches | `src/services/admin.service.ts`, `src/services/adminAuxiliary.service.ts` (`USE_MOCK_DATA`, `USE_WITHDRAWAL_MOCK`) | Flip to live **one at a time**, with the consumer page asserting the wire shape against the new Swagger responses (these endpoints are now live). |
| `tests/unit/services/admin.endpointContract.test.ts:35` reads `e.WITHDRAWALS.GET_ALL` but `ADMIN.WITHDRAWALS` was removed when the wallet was retired | `tests/unit/services/admin.endpointContract.test.ts` | Update or trim the test to match the current `ADMIN` constant shape (or move withdrawals into a `WALLET` placeholder block). |
| `home` and `discover research` cards still render `paper.paperType` as a string but the Admin / Researcher submission adapters forward `paperType` only as an internal field | `src/features/publication/api/publication.adapter.ts` | When fixing GAP-006, also normalise the adapter so `paperType` flows through `paperService.create/update`. |
| `ResearchTopicCreateRequest.materialsUrl` is still sent by `AssignTopicModal` and `ConfigureMilestones` | `src/components/lecturer/AssignTopicModal.tsx`, `src/pages/Lecturer/ConfigureMilestones.tsx`, `src/types/research.ts:36` | When fixing GAP-005, switch to `guidanceProjectsUrl`. The `getResearchTopicMaterialsUrl` helper at `src/services/researchTopic.service.ts:129-138` must be renamed or removed. |
| `WalletResponsePagedResult` is still exported in live Swagger but is unreachable from the FE because the wallet was retired | `swagger_live.json` (component), FE | No FE action — orphan schema on the BE side. |

---

## Security and production-readiness concerns

1. **PROD bypasses remain.** `docs/PRODUCTION_REENABLEMENT_REGISTER.md` lists three `DEVELOPMENT_BYPASS` entries (`PROD-001` subscription gate, `PROD-002` Reviewer ORCID, `PROD-003` OTP skip). None of these changed during the takeover window. **Status: unchanged, no new bypass introduced or removed.** `docs/PRODUCTION_REENABLEMENT_REGISTER.md` was **not** edited by this audit per the instructions.

2. **No JWT / auth / active-account / email-verification / role-approval check was bypassed in FE code during the takeover window.** `git diff HEAD~4 HEAD -- src/store/authSlice.ts src/context/AuthContext.tsx src/services/auth.service.ts` shows only the remember-me + storage split work in commit `bf5f969`. The new `localStorage` write happens **only when `rememberMe === true`** and logout clears both `localStorage` and `sessionStorage`, which matches the Authentication Rules.

3. **ResearchTopic rename (`materialsUrl` → `guidanceProjectsUrl`) is a breaking contract change.** Until the FE is updated, every lecturer that creates or edits a ResearchTopic and attaches materials will silently lose them on the next round-trip. **This is a P0 — flag to the user.**

4. **`PaperCreateRequest.paperType` is now REQUIRED.** Without an update, every researcher submission will return `400 Bad Request` from the BE. **P0 — flag to the user.**

5. **Seminar feedback `rating` + `participantEvaluation` are now REQUIRED.** The modal validates these at the form level, so the user-facing flow is safe today; the service signature is permissive and any test or future programmatic caller could trip the BE.

6. **No real emails were sent, no PayOS payments were initiated, no real user documents were uploaded, no destructive DB actions were performed during the audit.** Only read-only `git`, `node`, `curl`/`Invoke-WebRequest`, and `npx tsc --noEmit` were used.

7. **Dev environment integrity:** The current dev build still respects the locked-out admin endpoints (e.g. `/api/Account`, `/api/ViolationReport`) by routing through the mock fallback (`USE_MOCK_DATA = true`). No `console.warn` sanitisation was removed; no error banner was bypassed.

---

## Test status

| Check | Command | Result |
| --- | --- | --- |
| TypeScript compile | `npx tsc --noEmit` | **PASS** (exit 0). |
| Focused unit test (publication adapter) | `npx vitest run tests/unit/publication/api/publication.adapter.catalog.test.ts` | **PASS** (24 tests pass). |
| Focused unit test (phased report service) | `npx vitest run tests/unit/services/phasedReport.service.test.ts` | **PASS**. |
| Focused unit test (admin endpoint contract) | `npx vitest run tests/unit/services/admin.endpointContract.test.ts` | **1 FAIL**: `every admin endpoint template resolves to a declared swagger path` — references `e.WITHDRAWALS.GET_ALL` / `e.WITHDRAWALS.ACCEPT(1)` / `e.WITHDRAWALS.COMPLETE(1)` / `e.WITHDRAWALS.DENY(1)`, which were removed from `src/utils/constants.ts` when the wallet was retired (commit `3189bc5`, Aug 18 2026). The other two tests in the same file pass. **Pre-existing breakage, unrelated to the BE takeover window.** |

Tests that exercise real credentials, real emails, real PayOS calls, real Firebase uploads, or destructive DB operations were deliberately **not** run, per the task's safety rules.

---

## Exact recommended next task (one only)

After this audit, the next single implementation task is:

> **Fix the two Swagger-driven P0 contract breaks in the FE.**
>
> 1. **Rename `ResearchTopic.materialsUrl` → `ResearchTopic.guidanceProjectsUrl`** across `src/types/researchWorkflowDtos.ts`, `src/types/research.ts`, `src/services/researchTopic.service.ts`, `src/hooks/useResearchTopics.ts`, `src/components/lecturer/AssignTopicModal.tsx`, `src/pages/Lecturer/ResearchTopics.tsx`, `src/pages/Lecturer/ConfigureMilestones.tsx`, plus unit tests. Mirror the same rename on the ResearchGroup side which already had `materialsUrl` (no rename there, just verify it is still sent correctly).
> 2. **Add REQUIRED `paperType: string` to `PaperCreateRequest` and `PaperUpdateRequest`** in `src/services/paper.service.ts`, normalise the value through `publicationAdapter` (the form already provides it; the adapter does not currently forward it through `paperService.create`/`update`), and verify the change does not regress the OpenAlex import flow.

This task is the highest-priority **broken end-to-end P0 workflow caused by a Swagger mismatch** in the priority order given (1 → 5). It must be implemented before any UI/UX redesign of the Lecturer research workspace or the Researcher submission flow.

Other queued work (manual reviewer UI, seminar feedback tightening, subscription/PayOS rollout, `admin.endpointContract.test.ts` cleanup, admin service mock flips) is recorded under "Work still missing" and "Broken/mocked behaviour still present" and can follow once this P0 is merged.

---

## Modified documentation files

This audit **created or modified** the following documentation only:

- `docs/BE_FE_TAKEOVER_AUDIT.md` (this file — new).

This audit **did not modify** the following files (per the task rules):

- `docs/PRODUCTION_REENABLEMENT_REGISTER.md` — no new bypass introduced or removed during the window; the three existing entries remain `DEVELOPMENT_BYPASS`.
- `src/**` — read-only inspection.
- `swagger.json` — not refreshed against the live contract; this is intentional and matches existing repo hygiene (`swagger_live.json` would be the upstream source for any refresh).

---

```text
BE_FE_TAKEOVER_AUDIT_READY
```