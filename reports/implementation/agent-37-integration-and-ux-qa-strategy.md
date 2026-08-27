# Agent-37 Integration & UX QA — Focused Strategy

> **Role:** agent-37-integration-and-ux-qa
> **Scope:** Frontend only (FE). Research-only deliverable, no file edits.
> **Repository:** `F:\CAPSTONE_PROJECT\ARS_FE`
> **Reference plan / docs:**
> - `docs/TESTING_STRATEGY.md` (SMOKE_LIST, `vitest.*.config.ts`, Playwright configs, PR workflow)
> - `reports/implementation/TESTING.md` and `reports/implementation/research-workflow.test-plan.md`
> - `docs/test-failure-log.md` (baseline / triage notes)
> - `tickets/backend/BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md`
> - `tickets/backend/BE_GOOGLE_OAUTH_LOGIN_TICKET.md`
> - `tickets/backend/BE_REGISTRATION_ORCID_AND_CONSENT_TICKET.md`
> - `tickets/backend/BE_ADMIN_ORCID_LOOKUP_PROXY_TICKET.md`
> - `tickets/backend/BE_REVIEWER_POLICY_MANUSCRIPT_GATE_TICKET.md`
> - `tickets/backend/BE_ROLE_SELECTION_AND_SWITCH_TICKET.md`
> - Swagger: `https://arsplatform.onrender.com/swagger/index.html`

---

## 0. Summary of the 14 Required Checks

The 14 checks consolidate four priority surfaces the FE owns end-to-end:

| Surface | Why it matters now | Touch points |
| --- | --- | --- |
| **Auth & role guards** | Routing regressions surface here first (`duyphuong2000.dpp` bug, Admin landing, multi-role selection). | `AuthContext.tsx`, `PrivateRoute.tsx`, `RoleRouteGuard.tsx`, `postAuthRoute.ts`, `useVerifiedGuard.ts`, `usePermissions.ts`, `roleNormalizer.ts`, `storage.ts`, `authSlice.ts`. |
| **Google OAuth & first-time onboarding** | BE has shifted endpoints and signals (`isNewUser`/`requiresOnboarding`/role-null). Live bug regressions must not return. | `AuthContext.loginWithGoogle`, `GoogleCallback.tsx`, `CompleteGoogleRegistration.tsx`, `googleAuth.service.ts`, `googleLoginGuard.ts`. |
| **Payment / PayOS confirmation + premium gating** | PayOS redirect handling, wallet refetch, premium-packages feature flag, withdrawal feature flag. | `CheckoutReturn.tsx`, `useConfirmPayment.test.ts`, `payment.service.ts`, `App.routes.premium.test.tsx`, `EarningsWallet.test.tsx`, `withdrawalGate.test.tsx`, `AppConfig.features`. |
| **Email workflow + password reset + role normalization** | OTP dedupe, 401 message, BE off-by-one role bug (Admin `roleId: 0`), register consent + inline errors. | `VerifyOtp.dedupe.test.tsx`, `emailWorkflow.test.ts`, `Register.consent.test.tsx`, `Register.inlineErrors.test.tsx`, `validationRules.test.ts`, `auth.service.role.test.ts`, `auth.service.registrationIntegrity.test.ts`. |

Each check below carries:
- **What** to assert (contract-level, not implementation detail)
- **Existing coverage** (smoke-list pointers) — when something already lives in `SMOKE_LIST`, we **reuse it instead of duplicating**
- **Manual check** — the smallest manual exercise that catches the BE-coupled gap
- **Retry / ownership / risk**

> **Convention:** every smoke-listed file is runnable via `npm run test:smoke` (and `npm run test:affected` for PR diffs). Anything outside the curated list is added to the smoke list **only if** it gates a critical user journey (per `docs/TESTING_STRATEGY.md §9`).

---

## 1. QA Strategy Matrix — 14 Checks

### Check 1 — First-time Google user (role-null) routes to `/complete-google-registration`, never `/forum`
- **Contract:** `resolvePostAuthRoute` AND-clause (`isNewUser=true ∧ requiresOnboarding=true ∧ effectiveRole=null ∧ approved roles empty`); role-null/roleId-null compat fallback fires only when `approvedRoles` is empty.
- **Existing coverage (SMOKE_LIST):**
  - `tests/unit/utils/postAuthRoute.test.ts`
  - `tests/unit/agent30/googleOnboarding.focused.test.ts`
  - `tests/unit/agent30/googleOnboarding.regression.test.tsx` (covers the `duyphuong2000.dpp` payload)
  - `tests/unit/agent31/googleOnboarding.payloadRegression.test.tsx`
  - `tests/unit/agent32/googleStateMachine.focused.test.ts`
  - `tests/unit/context/AuthContext.loginWithGoogle.test.tsx`
  - `tests/unit/pages/GoogleCallback.test.tsx`
  - `tests/unit/pages/CompleteGoogleRegistration.routingRegression.test.tsx`
  - `tests/unit/routes/PublicRoute.admin.test.tsx`
- **Minimal new test (only if needed):** none — the AND-clause is already pinned by 9 SMOKE files. If a regression slips, add an Agent-30 regression spec to `tests/unit/agent30/`.
- **Manual check (BE-coupled):** on staging, run Google sign-in with a brand-new email; expect onboarding page to render with the FIREBASE-uploaded `pdfUrl` populated.
- **Retry policy:** `vitest run tests/unit/utils/postAuthRoute.test.ts tests/unit/agent30 tests/unit/agent31 tests/unit/agent32 tests/unit/pages/GoogleCallback.test.tsx tests/unit/pages/CompleteGoogleRegistration.routingRegression.test.tsx` with `--retry=1`. If a Playwright `tests/e2e/googleOnboarding.spec.ts` ever exists, retry up to 2 (rare).
- **Ownership:** `agent-test-strategy-github-ci` (test infra) + the routing agent that owns `AuthContext.tsx`/`postAuthRoute.ts` for any contract drift.

### Check 2 — Duplicate Google callback / remount produces ONE `POST /api/Auth/google-login`
- **Contract:** shared in-flight guard keyed by the credential; slot clears on settlement; retries after a 5xx re-enter the BE.
- **Existing coverage:**
  - `tests/unit/agent30/googleLoginGuard.test.ts` (state machine, dedupe, settlement)
  - `tests/unit/agent30/googleOnboarding.regression.test.tsx` (`Agent 30 — duplicate GIS callback produces exactly one POST` and the retry-after-failure spec)
  - `tests/unit/agent31/googleOnboarding.payloadRegression.test.tsx` (test "one Google credential → one POST → one auth-state update")
  - `tests/unit/agent32/googleStateMachine.focused.test.ts` (case 7: 3 concurrent callers → 1 POST)
- **Minimal new test:** none.
- **Manual check:** on staging, click the Google button twice quickly; `network` panel must show a single `POST /api/Auth/google-login`. Refresh the consent screen — still one POST.
- **Retry policy:** `--retry=1` for the affected specs; never auto-retry in CI beyond that — concurrency bugs are real when they appear.
- **Ownership:** routing agent for `AuthContext.loginWithGoogle` / `utils/googleLoginGuard.ts`.

### Check 3 — `verificationStatus: null` is preserved on the persisted user (no coercion to `'Pending'`)
- **Contract:** `useVerifiedGuard` and `usePermissions` must treat `null` as "no Admin-review request submitted" (i.e. unverified), not as `'Pending'`. Persisted blob keeps `verificationStatus: null` verbatim.
- **Existing coverage:**
  - `tests/unit/agent30/usePermissions.null.test.ts`
  - `tests/unit/agent30/googleOnboarding.regression.test.tsx` (persists verbatim + storage/authStore agree)
  - `tests/unit/pages/GoogleCallback.test.tsx` (the screenshot state set, `data-status` assertions on `?token=jwt-screenshot&...&isNewUser=true&requiresOnboarding=true`)
- **Minimal new test:** none — three existing specs already pin this. **Do not weaken the storage-vs-authStore agreement assertion.**
- **Manual check:** in DevTools, after a fresh Google login that returns `verificationStatus: null`, `JSON.parse(localStorage.ars_user).verificationStatus === null`. Reload — the value stays `null`.
- **Retry policy:** `--retry=0` (this is deterministic).
- **Ownership:** routing agent.

### Check 4 — Approved + active Admin lands on `/admin` (not `/forum`)
- **Contract:** dual-signal Admin detection (`isAdminUser` checks both `roleName` and `roleId`), `landingRouteForRoleName` honors `isAdminOverride`, `PublicRoute` (authed branch) routes Admin to `/admin`.
- **Existing coverage:**
  - `tests/unit/routes/PublicRoute.admin.test.tsx` (defect 3A)
  - `tests/unit/services/auth.service.role.test.ts` (BE off-by-one role-mapping bug; both scenarios)
  - `tests/unit/utils/postAuthRoute.test.ts` (approved Admin → `/admin`)
  - `tests/unit/layouts/MainLayout.adminSidebar.test.tsx` (defect 3B active-item pinning)
- **Manual check:** sign in as the seeded Admin (`UserId 18`); landing must be `/admin`, sidebar must show exactly one active item per route, no `FORUM` link in the Admin sidebar.
- **Retry policy:** `--retry=1` for the sidebar layout; otherwise deterministic.
- **Ownership:** routing agent + Admin-suite agent.

### Check 5 — Role-route guard (`RoleRouteGuard`) blocks cross-role access via direct URL
- **Contract:** typing `/research-group` as a Graduate Student redirects to the role landing (not the Lecturer page); Admins do not see `/papers` or `/reviewers`.
- **Existing coverage:**
  - `tests/unit/layouts/MainLayout.guestSidebar.test.tsx` (Guest sidebar shows Forums only — and the `effectiveRole='Guest'` variant)
  - `tests/unit/layouts/MainLayout.graduateStudentNav.test.tsx`
  - `tests/unit/layouts/MainLayout.adminSidebar.test.tsx`
  - `tests/unit/layouts/MainLayout.lecturerNavigation.test.tsx`
  - `tests/unit/layouts/MainLayout.premiumRoute.test.tsx` (premium gate per role)
  - `tests/unit/routes/PublicRoute.admin.test.tsx`
  - `tests/unit/App.routes.premium.test.tsx`
- **Minimal new test:** none — direct-URL RBAC is covered transitively via sidebar negative assertions + the Admin guard tests. If a new shared route is added, write one `RoleRouteGuard.allow=<…>` test mirroring `MainLayout.guestSidebar.test.tsx`.
- **Manual check:** sign in as Graduate Student, paste `/research-group` into the URL bar, expect redirect to `/forum`. Paste `/admin` — same.
- **Retry policy:** `--retry=0`.
- **Ownership:** layout / routing agents.

### Check 6 — Verified-guard bounce (`useVerifiedGuard`) sends unapproved users to `/forum`
- **Contract:** unverified users (no `isActive`, or `verificationStatus !== 'Accepted'/'Approved'`) are redirected to `/forum`; Admin bypasses; preserved `null` `verificationStatus` does NOT trip the bounce for non-Admins.
- **Existing coverage:**
  - `tests/unit/hooks/useVerifiedGuard.test.ts` (Pending, accepted, undefined-isActive, partial-true cases)
  - `tests/unit/agent30/usePermissions.null.test.ts`
- **Manual check:** sign in as the seeded pending Researcher (`verificationStatus='Pending'`); land on `/forum` with the "Pending Admin verification" banner.
- **Retry policy:** `--retry=0`.
- **Ownership:** routing agent + permissions/guards agent.

### Check 7 — Logout cleans BOTH storage buckets, resets Zustand + welcome signal, redirects to `/login` with `replace:true`
- **Contract:** `clearAuthSession()` runs even on Guest sessions; idempotent under double-invocation via `logoutInFlightRef`; null-safe when `user=null/token=null`.
- **Existing coverage:**
  - `tests/unit/context/AuthContext.logout.test.tsx` (Agent 53 contract)
  - `tests/unit/services/auth.service.sessionCleanup.test.ts`
- **Manual check:** open the app as any role, click Sign out, hit Back — must stay on `/login`. Inspect `localStorage` and `sessionStorage` for `ars_token`/`ars_user` — both must be `null`.
- **Retry policy:** `--retry=0`.
- **Ownership:** Agent 53 owner + auth context owner.

### Check 8 — `Remember Me` storage bucket (sessionStorage default, localStorage when checked)
- **Contract:** `storage.setToken` / `setUser` honor the `ars_remember` flag set BEFORE the writes; logout clears BOTH buckets.
- **Existing coverage:**
  - `tests/unit/services/auth.service.sessionCleanup.test.ts` (covers bucket flipping via `ars_remember`)
  - `tests/unit/context/AuthContext.logout.test.tsx` (clear-from-both invariant)
  - Manual-only: `tests/unit/pages/Login.test.tsx` smoke-renders the "Remember me" checkbox
- **Manual check:** register a new user with "Remember me" **off** → close the tab → must be signed out on reopen. Re-register with **on** → close the tab → must remain signed in.
- **Retry policy:** `--retry=0`.
- **Ownership:** auth context owner (per `auth-login-rules.mdc`).

### Check 9 — Register form: email field, consent gate, inline server errors, payload shape
- **Contract:** email-only login/registration; consent checkbox unchecks → submit disabled; payload contains only documented Swagger fields (no `consent`/`acceptedPrivacyPolicy` echoes); BE field errors surface inline with `aria-invalid`/`aria-describedby`; Vietnamese-name validation regex is anchored.
- **Existing coverage:**
  - `tests/unit/pages/Register.test.tsx`
  - `tests/unit/pages/Register.consent.test.tsx`
  - `tests/unit/pages/Register.inlineErrors.test.tsx`
  - `tests/unit/utils/validationRules.test.ts`
- **Minimal new test:** none — coverage is exhaustive. If a new BE field appears, extend the payload-shape assertion to whitelist it.
- **Manual check:** register a new account, then try the same email — server error must map to the email field's inline message, not a generic toast.
- **Retry policy:** `--retry=1` (form rendering occasionally flaked in past runs).
- **Ownership:** form-validation audit agent.

### Check 10 — Verify OTP dedupe (rapid double submit + double resend) and 401 production-not-ready messaging
- **Contract:** in-flight guard; OTP value NEVER persisted in `localStorage`/`sessionStorage`; 401 surfaces a stable user-friendly message.
- **Existing coverage:**
  - `tests/unit/pages/VerifyOtp.dedupe.test.tsx`
  - `tests/unit/services/emailWorkflow.test.ts`
  - `tests/unit/services/emailVerification.service.test.ts`
  - `tests/unit/pages/EmailVerificationLanding.test.tsx`
  - `tests/unit/hooks/useEmailVerification.test.ts`
- **Manual check:** on Forgot Password, click Resend rapidly; only one request must leave the browser. Hit `/forgot-password/verify` with a malformed token — should render the failure screen with no BE call.
- **Retry policy:** `--retry=0`.
- **Ownership:** email-workflow agent.

### Check 11 — PayOS `/payment/return` handles PAID / CANCELLED / PENDING / missing-orderCode / BE-error / wallet-refetch failure
- **Contract:** the page calls `/api/Payment/success` on PAID, `/api/Payment/cancel` on CANCELLED, treats PENDING as cancel-with-retry; missing `orderCode` shows failure immediately; wallet-refetch failures do NOT block the success screen.
- **Existing coverage:**
  - `tests/unit/pages/CheckoutReturn.test.tsx`
  - `tests/unit/hooks/useConfirmPayment.test.ts`
- **Manual check:** on staging, complete a real top-up. After PayOS redirects back, the success screen must show the refreshed balance; cancel and pending screens must route to `/forum`.
- **Retry policy:** `--retry=0`.
- **Ownership:** payment/PayOS agent.

### Check 12 — Centralized withdrawal feature gate (`AppConfig.features.enableWithdrawals`) short-circuits every withdrawal surface
- **Contract:** when `enableWithdrawals === false`, `withdrawalService.{getAll,getById,create,updateStatus}` throw `WithdrawalFeatureDisabledError`; Reviewer `EarningsWallet` shows the disabled notice (no Create button); Admin `TransactionsManagement` hides the Withdrawal tab and disables modals; `WalletTopUpModal` keeps working.
- **Existing coverage:**
  - `tests/unit/pages/withdrawalGate.test.tsx` (covers every gate path)
  - `tests/unit/pages/EarningsWallet.test.tsx` (force-enabled UI mechanics)
- **Manual check:** set `enableWithdrawals = false` in `src/config/app.ts`; Reviewer EarningsWallet must show the disabled notice and **never** call `withdrawalService.*`.
- **Retry policy:** `--retry=0`.
- **Ownership:** withdrawal agent.

### Check 13 — Premium-packages gating (centralized flag hides user surface but keeps admin `/admin/packages`)
- **Contract:** when `premiumPackagesEnabled === false`, every non-Admin sidebar hides `/premium-packages`; Admin keeps `/admin/packages` and never sees `/premium-packages`; direct URL navigation to `/premium-packages` redirects to `/forum` (not `/login`) for an authenticated user; unauthenticated still bounces to `/login`.
- **Existing coverage:**
  - `tests/unit/App.routes.premium.test.tsx`
  - `tests/unit/admin/AnnualFees.routeGating.test.tsx`
  - `tests/unit/layouts/MainLayout.premiumRoute.test.tsx`
  - `tests/unit/admin/AnnualFees.gating.test.tsx`
  - `tests/unit/admin/AnnualFees.demoData.test.ts`
- **Manual check:** as a Researcher, paste `/premium-packages` into the URL bar — must redirect to `/forum` (not `/login`).
- **Retry policy:** `--retry=0`.
- **Ownership:** admin-annual-fees agent + layout agent.

### Check 14 — Notification routing map honors role + feature flags
- **Contract:** withdrawal-prefixed notifications redirect to `/earnings-wallet` only when `enableWithdrawals === true` (else `/forum`); notification dropdown renders exactly one bell; role-restricted notifications never deep-link into a forbidden route.
- **Existing coverage:**
  - `tests/unit/layouts/MainLayout.notificationCenter.test.tsx` (single bell, role coverage, ARIA wiring)
- **Minimal new test:** a dedicated `tests/unit/utils/notificationRouteMap.test.ts` for the route mapping logic (currently exists as `notificationRouteMap.ts` but has no dedicated test file in the listing). **Recommend adding one focused unit test file** if not present, since the map is now a cross-cutting dependency. (Listing verification in §2.)
- **Manual check:** as a Reviewer, click a withdrawal notification while `enableWithdrawals === false`; the dropdown must NOT navigate to `/earnings-wallet` and must show the disabled-notice UI instead.
- **Retry policy:** `--retry=0`.
- **Ownership:** notification agent.

---

## 2. Gaps & Blockers

### 2.1 Gaps

| Gap | Severity | Recommended fix |
| --- | --- | --- |
| **No dedicated unit test for `src/utils/notificationRouteMap.ts`** | Medium | Add `tests/unit/utils/notificationRouteMap.test.ts` that pins: (a) withdrawal route respects `enableWithdrawals`, (b) role-restricted prefixes bounce to `/forum` for the wrong role, (c) the map never produces `/login` for an authenticated user. Then add to `SMOKE_LIST`. |
| **Notification dropdown click → role-restricted route guard** | Low | The bell renders; the click handler is exercised manually. Capture the handler under `MainLayout.notificationCenter.test.tsx` to lock the contract. |
| **Premium gate when `premiumPackagesEnabled` flips back to `true`** | Low | The `MainLayout.premiumRoute.test.tsx` already documents the conditional. Add a `flag=true` positive test case mirroring the existing `flag=false` matrix. |
| **Swagger drift for review-policy gate / ORCID proxy / multi-role switch** | Medium | The FE has no live integration tests because the BE endpoints are still pending (`tickets/backend/BE_REVIEWER_POLICY_MANUSCRIPT_GATE_TICKET.md`, `BE_ADMIN_ORCID_LOOKUP_PROXY_TICKET.md`, `BE_ROLE_SELECTION_AND_SWITCH_TICKET.md`). Until the BE ships, FE coverage stays at the service-contract + manual UI tests. |
| **Stub `useConfirmPayment` lives in `useCreatePaymentLink.ts`** | Informational | The test file is `tests/unit/hooks/useConfirmPayment.test.ts` but the source is `useCreatePaymentLink.ts`. Confirmed via `Read useConfirmPayment.test.ts → import { useConfirmPayment } from '.../src/hooks/useCreatePaymentLink'`. The path mismatch is intentional (re-export). Document the convention in `docs/TESTING_STRATEGY.md` if a future maintainer stumbles. |

### 2.2 Blockers (must be addressed before tests can run in CI)

| Blocker | Type | Workaround |
| --- | --- | --- |
| **Playwright Chromium not installed in the dev sandbox** | Environment | `npx playwright install --with-deps chromium` (per `docs/TESTING_STRATEGY.md §8`). The repo's `pr-fast.yml` only runs Vitest, so PR CI is unaffected; nightly / release workflows depend on this. |
| **Shallow git history affects `test:affected`** | Environment | `scripts/run-affected-tests.mjs` already falls back to `HEAD~1` (see `docs/TESTING_STRATEGY.md §4`). Documented. |
| **`enableWithdrawals` is currently `false` in `AppConfig`** | Configuration | All withdrawal-gate tests explicitly flip the flag in `vi.mock('../../../src/config/app', ...)`. Manual checks must coordinate with the payment-withdrawal agent. |
| **`premiumPackagesEnabled` is currently `false`** | Configuration | Same pattern — every premium-gate spec mocks `app.ts`. |

### 2.3 Outstanding BE-coupled risks (out of FE scope, but flagged)

- `BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md` (idempotency, ORCID normalization, request status) — the FE consumes the contract; once Swagger ships the response shape, the existing focused tests will catch drift only if the JSON-shape assertions are extended. **Recommend adding JSON-schema assertions in `googleOnboarding.regression.test.tsx` when Swagger ships.**
- `BE_ROLE_SELECTION_AND_SWITCH_TICKET.md` — multi-role selection UI lives in `Login.tsx` / `AuthContext.confirmRoleSelection`; the FE has unit coverage but no live e2e until `/api/auth/switch-role` ships.
- `BE_ADMIN_ORCID_LOOKUP_PROXY_TICKET.md` and `BE_REVIEWER_POLICY_MANUSCRIPT_GATE_TICKET.md` — Admin-side calls (`adminService.*` / `policyGate` UI on `EvaluationDesk`) rely on the BE to enforce. The FE coverage stops at the service contract; runtime requires BE support.

---

## 3. Retry Policy

Default per `docs/TESTING_STRATEGY.md §7` (CI does NOT downgrade failures to warnings):

| Scenario | Vitest retries | Playwright retries |
| --- | --- | --- |
| Deterministic routing / guard / dedupe logic | **0** | n/a |
| Form rendering, `userEvent` flows | **1** (CI) | n/a |
| Layout tests with `findBy*` async assertions | **1** | n/a |
| Wallet / PayOS hook tests | **1** | n/a |
| Playwright `tests/e2e/googleOnboarding.spec.ts` (when re-enabled) | n/a | **2** (per `playwright.config.ts`) |
| `pr-fast.yml` overall | n/a (no Playwright) | n/a |

`npm run test:affected` exit-code semantics (per `docs/TESTING_STRATEGY.md §4`):
- `0` — passed
- `1` — real failure (block PR)
- `2` — empty selection + test-relevant diff (block PR; workflow surfaces `##[error]No tests selected for ${diff}`)
- `3` — empty selection + non-test-relevant diff (allow)

---

## 4. Test Ownership (by surface)

| Owner agent (per `tickets/backend/*.md` and repo conventions) | Files they should own |
| --- | --- |
| **Routing agent (Agent 30/52/54)** | `tests/unit/utils/postAuthRoute.test.ts`, `tests/unit/agent30/*`, `tests/unit/agent31/*`, `tests/unit/agent32/*`, `tests/unit/context/AuthContext.loginWithGoogle.test.tsx`, `tests/unit/context/AuthContext.logout.test.tsx`, `tests/unit/pages/GoogleCallback.test.tsx`, `tests/unit/pages/CompleteGoogleRegistration.*`, `tests/unit/routes/PublicRoute.admin.test.tsx`, `tests/unit/hooks/useVerifiedGuard.test.ts`, `tests/unit/agent30/usePermissions.null.test.ts`. |
| **Layout / RBAC agent** | `tests/unit/layouts/MainLayout.*`, `tests/unit/routes/RoleRouteGuard.tsx` consumer tests. |
| **Admin-suite agent** | `tests/unit/admin/*`, `tests/unit/services/admin.endpointContract.test.ts`. |
| **Payment / PayOS agent** | `tests/unit/pages/CheckoutReturn.test.tsx`, `tests/unit/hooks/useConfirmPayment.test.ts`, `tests/unit/services/payment.service.test.ts` (if any). |
| **Withdrawal agent** | `tests/unit/pages/EarningsWallet.test.tsx`, `tests/unit/pages/withdrawalGate.test.tsx`. |
| **Email workflow agent (Agent 20)** | `tests/unit/pages/VerifyOtp.dedupe.test.tsx`, `tests/unit/pages/EmailVerificationLanding.test.tsx`, `tests/unit/services/emailVerification.service.test.ts`, `tests/unit/services/emailWorkflow.test.ts`, `tests/unit/hooks/useEmailVerification.test.ts`. |
| **Form-validation audit agent** | `tests/unit/pages/Register.*`, `tests/unit/utils/validationRules.test.ts`. |
| **Test-strategy / CI agent** | `docs/TESTING_STRATEGY.md`, `scripts/run-smoke.mjs`, `scripts/run-affected-tests.mjs`, vitest / playwright configs, `SMOKE_LIST` maintenance. |
| **Notification agent** | (proposed) `tests/unit/utils/notificationRouteMap.test.ts`, `tests/unit/layouts/MainLayout.notificationCenter.test.tsx`. |

---

## 5. Recommended CI Commands (per `docs/TESTING_STRATEGY.md §3`)

| Phase | Command | Expected runtime |
| --- | --- | --- |
| PR fast lane | `npm run test:affected` + `npm run test:smoke` + `npm run lint` + `npm run build` | < 90 s smoke; < 3 min affected |
| Nightly | `npm run test:full` (unit → integration → e2e → coverage) | ~15 min on 4 vCPU |
| Release | same as nightly + manual smoke of PayOS redirect | n/a |

Manual exercises (cannot be CI'd because they require BE cooperation or human eyes):

1. **Google OAuth real consent** — `npm run e2e:google-onboarding:headed` (Chromium binary installed)
2. **PayOS round-trip on staging** — complete a top-up, watch DevTools for `getSuccess`/`getCancel` and the wallet refetch
3. **Admin cross-role guards** — log in as Admin, verify the sidebar never exposes `/papers` or `/reviewers`
4. **Multi-role selection UI** — log in as a dual-role account, verify the picker appears and `confirmRoleSelection` posts to `/api/auth/switch-role` (when BE ships)
5. **Withdrawal-flag manual toggle** — flip `enableWithdrawals = false` in `src/config/app.ts`, verify Reviewer sees the disabled notice

---

## 6. Out-of-Scope (intentionally not in the 14 checks)

The following are tracked elsewhere and intentionally excluded from this strategy:

- Database / EF migrations / SQL — BE only (`fe-role-only` rule)
- VNPay sandbox credentials — never committed; payment agent owns those tests
- Firebase Storage real uploads — every test mocks `useFirebaseUpload` / `firebase/storage`; the integration suite (`tests/integration/`) is gated behind `npm run test:integration`
- Email OTP generation — owned by BE per `BE_REGISTRATION_ORCID_AND_CONSENT_TICKET.md`; FE only forwards the request
- New dashboard charts (`AdminDashboard`, `Analytics`) — covered by their own agent; not part of the 14 integration & UX checks
- Server-side rendering / i18n — not implemented; not in scope
- E2E headed Google OAuth (`tests/e2e/googleOnboarding.headed.spec.ts`) — manual-only; not CI'd

---

## 7. Final recommendations (prioritized)

1. **Add `tests/unit/utils/notificationRouteMap.test.ts`** and wire into `SMOKE_LIST` to close Check 14's coverage gap. Estimated effort: ~30 lines.
2. **Add positive `flag=true` cases** to `MainLayout.premiumRoute.test.tsx` and `withdrawalGate.test.tsx` so we catch regressions when BE flips the flags back on.
3. **Add JSON-schema assertions** to `googleOnboarding.regression.test.tsx` once `BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md` ships Swagger — this protects us from silent response-shape drift.
4. **Document the path mismatch** between `useConfirmPayment.test.ts` and `src/hooks/useCreatePaymentLink.ts` in `docs/TESTING_STRATEGY.md` so a future maintainer doesn't rename the test or the source by accident.
5. **Confirm** the configuration of `enableWithdrawals` and `premiumPackagesEnabled` with the relevant agents before tagging a release — both are currently `false` and any "positive-path" E2E will need a temporary flip.

---

**End of QA strategy — ready for sign-off by the parent agent.**
