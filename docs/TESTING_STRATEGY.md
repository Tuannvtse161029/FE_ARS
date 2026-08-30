# ARS_FE Test Inventory & Strategy

> Status: **Living document** — updated whenever a new test category or
> curated smoke list entry is added. Authored by `agent-test-strategy-github-ci`
> (PR `test-strategy-github-ci`). Cross-references `docs/GITHUB_CI_SETUP.md`.

## 0. Scope & conventions

This file describes the **frontend-only test stack** of `ARS_FE`. Backend
.NET / DB concerns are out of scope.

- Test roots live at the **project top-level `tests/`** (not under `src/`):
  - `tests/unit/**`           — Vitest, jsdom, JSDOM-isolated
  - `tests/integration/**`    — Vitest, jsdom, multi-module wiring
  - `tests/e2e/**`            — Playwright (Chromium, mocked BE)
  - `tests/helpers/`, `tests/fixtures/`, `tests/mocks/` — supporting code, **not** run directly
  - `tests/setup.ts`          — global Vitest setup (`@testing-library/jest-dom`, cleanup)
  - `tests/probe.test.ts`     — ad-hoc smoke for import paths; explicitly excluded from every CI script
- The repo also carries several other **preserve-as-is** test configs:
  - `vitest.integration.config.ts` — preserved (agent-7/withdrawal); tightened exclude patterns
  - `playwright.config.ts`           — preserved (researcherProduction spec)
  - `playwright.reviewer-flow.config.ts`
  - `playwright.withdrawal-flow.config.ts`
  - `playwright.google-onboarding.config.ts`
  - `playwright.google-onboarding.headed.config.ts`
- New unified configs (introduced by this strategy):
  - `vitest.config.ts`        — combined unit + integration (default `npm test`)
  - `vitest.unit.config.ts`   — unit-only (`test:unit`)
  - `playwright.e2e.config.ts`— all headless e2e specs (`test:e2e`)
  - `scripts/run-smoke.mjs`   — curated smoke runner (`test:smoke`)
  - `scripts/run-affected-tests.mjs` — deterministic affected selection (`test:affected`)
  - `scripts/run-all-tests.mjs`      — full pipeline orchestrator (`test:full`)

These unified configs intentionally map 1:1 to `npm run` scripts (see §3).

---

## 1. Test inventory

### 1.1 Unit tests — `tests/unit/**`

163 files total (73 `.test.ts` + 90 `.test.tsx`). Grouped by role:

| Subtree | Count (approx.) | Purpose |
|---|---|---|
| `tests/unit/pages/**` | ~50 | Page-level rendering + interaction (Login, Register, CheckoutReturn, EarningsWallet, Profile, Papers, PremiumPackages, Lecturer, GraduateStudent, Admin, etc.) |
| `tests/unit/components/**` | ~30 | Modal, banner, table, badge, PDF dropzone, etc. |
| `tests/unit/services/**` | ~25 | Service-layer contracts (auth, googleAuth, payment, withdrawal, email*, admin*, role, etc.) — axios fully mocked |
| `tests/unit/context/**` | 4 | AuthContext.loginWithGoogle, AuthContext.logout |
| `tests/unit/layouts/**` | 8 | MainLayout guest/admin/lecturer/reviewer/grad-student/premium/notification gradients |
| `tests/unit/hooks/**` | ~15 | useEmailVerification, useConfirmedGuard, useLearnerMaterials, usePhasedReports, useVerifyGuard, useReviewerProfile, useConfirmPayment, etc. |
| `tests/unit/admin/**` | 4 | AnnualFees gating / roleGating / policyGate / demoData |
| `tests/unit/routes/**` | 5 | googleAuthRoutes, PublicRoute.admin, paths.premiumPackages |
| `tests/unit/agent30/**` | 5 | First-time Google onboarding invariants (Agent 30) |
| `tests/unit/agent31/**` | 1 | onboarding payload regression |
| `tests/unit/agent32/**` | 1 | state machine focused |
| `tests/unit/utils/**` | 3 | validationRules, registrationRoles, postAuthRoute |
| `tests/unit/App.routes.premium.test.tsx` | 1 | top-level router premium gating |

Representative file paths (used directly in the curated smoke list, §5):

```
tests/unit/context/AuthContext.loginWithGoogle.test.tsx
tests/unit/context/AuthContext.logout.test.tsx
tests/unit/routes/PublicRoute.admin.test.tsx
tests/unit/routes/googleAuthRoutes.test.ts
tests/unit/App.routes.premium.test.tsx
tests/unit/hooks/useVerifiedGuard.test.ts

tests/unit/pages/Register.test.tsx
tests/unit/pages/Register.consent.test.tsx
tests/unit/pages/Register.inlineErrors.test.tsx
tests/unit/utils/registrationRoles.test.ts

tests/unit/agent30/googleLoginGuard.test.ts
tests/unit/agent30/googleOnboarding.focused.test.ts
tests/unit/agent30/googleOnboarding.regression.test.tsx
tests/unit/agent30/noForbiddenCalls.test.ts
tests/unit/agent30/usePermissions.null.test.ts
tests/unit/agent31/googleOnboarding.payloadRegression.test.tsx
tests/unit/agent32/googleStateMachine.focused.test.ts
tests/unit/pages/GoogleCallback.test.tsx
tests/unit/pages/CompleteGoogleRegistration.onboarding.test.tsx
tests/unit/pages/CompleteGoogleRegistration.routingRegression.test.tsx
tests/unit/services/googleAuth.service.test.ts

tests/unit/services/emailVerification.service.test.ts
tests/unit/services/emailWorkflow.test.ts
tests/unit/pages/EmailVerificationLanding.test.tsx
tests/unit/hooks/useEmailVerification.test.ts

tests/unit/utils/validationRules.test.ts
tests/unit/utils/postAuthRoute.test.ts
tests/unit/pages/VerifyOtp.dedupe.test.tsx

tests/unit/layouts/MainLayout.guestSidebar.test.tsx
tests/unit/layouts/MainLayout.adminSidebar.test.tsx
tests/unit/layouts/MainLayout.lecturerNavigation.test.tsx
tests/unit/layouts/MainLayout.graduateStudentNav.test.tsx
tests/unit/layouts/MainLayout.reviewerAvailability.test.tsx
tests/unit/layouts/MainLayout.notificationCenter.test.tsx
tests/unit/layouts/MainLayout.premiumRoute.test.tsx

tests/unit/pages/EarningsWallet.test.tsx
tests/unit/pages/withdrawalGate.test.tsx
tests/unit/hooks/useConfirmPayment.test.ts
tests/unit/pages/CheckoutReturn.test.tsx

tests/unit/pages/Papers.taxonomy.test.tsx
```

### 1.2 Integration tests — `tests/integration/**`

0 files at the time of writing. The directory exists because
`vitest.integration.config.ts` requires it. When the team adds integration
suites they MUST be saved under `tests/integration/` (no other path is
scanned by `test:integration`).

Conventions for future tests in this directory:

- Multi-module wiring (e.g. service + hook + AuthContext) with axios + Firebase
  fully mocked (`vi.mock('axios')`, `vi.mock('firebase/...')`).
- Setup file `tests/setup.ts` runs before every test file (same as unit).
- Same jsdom environment as unit tests.
- **NOT** expected to be browser-level — that belongs in Playwright.

### 1.3 E2E tests — `tests/e2e/**`

```
tests/e2e/googleOnboarding.spec.ts             # headless; mocked BE; runs in CI
tests/e2e/googleOnboarding.headed.spec.ts      # interactive headed; manual verification only
```

The headed spec is **excluded from every CI workflow** on purpose — it opens
a real headed Chromium window and a human completes the Google consent
screen. It is part of `npm run e2e:google-onboarding:headed` (manual flow).

### 1.4 Helpers & fixtures

`tests/helpers/*` and `tests/fixtures/*` are **support files** for the unit
suites. The `tests/mocks/*` directory holds response fixtures used by
existing unit tests (admin mocks, adminAuxiliary mocks). None are entry points
for a test runner.

`tests/probe.test.ts` is a one-off smoke for deep relative imports and is
**explicitly excluded** from every CI script. It is preserved on disk for
developer debugging only.

---

## 2. Test categories

| Category | Runner | Purpose | Default frequency | Required external services |
|---|---|---|---|---|
| **Unit** | Vitest (`test:unit`) | Pure-logic, single-component, jsdom-isolated. Strict mock hygiene. | every PR, on every push to main | None — Firebase fully mocked, axios mocked |
| **Integration** | Vitest (`test:integration`) | Multi-module wiring (service + hook + AuthContext). | nightly + release | None — mocks only |
| **E2E (headless)** | Playwright (`test:e2e`) | Browser-level mocked journey, e.g. Google OAuth onboarding | nightly + release | None — every BE endpoint routed via `page.route()` |
| **E2E (production)** | Playwright (`e2e:production`, `e2e:researcher-reviewer`, `e2e:reviewer-withdrawal`) | Hit the live ARS deployment | nightly + manual dispatch | Live BE — gated by `E2E_RUN_LIVE_*` env, mock by default |
| **Smoke** | Vitest via `scripts/run-smoke.mjs` (`test:smoke`) | Curated critical-path subset, must-pass gate | every PR | None |
| **Affected** | Vitest via `scripts/run-affected-tests.mjs` (`test:affected`) | Runs tests reachable from the diff | every PR | None |
| **Coverage** | Vitest (`test:coverage`) | Code-coverage report (v8 provider, text + html) | nightly + release | None |
| **Full** | `scripts/run-all-tests.mjs` (`test:full`) | unit → integration → e2e → coverage in sequence | release + manual dispatch | None |

---

## 3. Package scripts (cross-platform)

All commands below are designed to be invoked identically from
**Windows PowerShell** and **POSIX shells**. They avoid `&&`-chains in JSON
where a Node-based or `npm run`-nested solution is cleaner.

| Script | Command | Purpose |
|---|---|---|
| `test` | `vitest run --config vitest.config.ts` | Combined unit + integration, single-run |
| `test:watch` | `vitest --config vitest.config.ts` | Combined watch loop for devs |
| `test:affected` | `node scripts/run-affected-tests.mjs` | Deterministic git-diff → vitest related selector |
| `test:unit` | `vitest run --config vitest.unit.config.ts` | `tests/unit/**` only |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | `tests/integration/**` only |
| `test:e2e` | `playwright test --config playwright.e2e.config.ts` | All headless e2e specs |
| `test:e2e:ui` | `playwright test --config playwright.e2e.config.ts --ui` | Playwright UI mode |
| `test:e2e:list` | `playwright test --config playwright.e2e.config.ts --list` | List tests without running |
| `test:smoke` | `node scripts/run-smoke.mjs` | Curated critical-path tests |
| `test:full` | `node scripts/run-all-tests.mjs` | unit → integration → e2e → coverage |
| `test:coverage` | `vitest run --coverage --config vitest.config.ts` | Coverage report |
| `e2e:production` | `playwright test --config playwright.config.ts` | Researcher prod smoke (preserved) |
| `e2e:researcher-reviewer` | `playwright test --config playwright.reviewer-flow.config.ts` | Preserved |
| `e2e:reviewer-withdrawal` | `playwright test --config playwright.withdrawal-flow.config.ts` | Preserved |
| `e2e:google-onboarding` | `playwright test --config playwright.google-onboarding.config.ts` | Preserved |
| `e2e:google-onboarding:headed` | `playwright test --config playwright.google-onboarding.headed.config.ts` | Manual only |

### Why Node scripts (not `&&`)?

`package.json` lets you chain commands with `&&` or use `npm-run-all` /
`concurrently`. We chose plain `.mjs` scripts because:

1. **Cross-platform by construction** — Node invokes the right shell for the
   OS, no PowerShell-vs-sh quoting surprises.
2. **Structured exit codes** — `npm run` returns the last command's exit
   code when using `&&`; with our scripts we can return specific codes
   (`2` = "smoke was empty", `3` = "no test-relevant changes") that the
   workflows interpret precisely.
3. **No new runtime deps** — every workflow already runs Node 20+, so we
   don't need to add `npm-run-all` or `concurrently` to `package.json`.

The single-step Vitest scripts (`test:unit`, `test:integration`) stay as
direct invocations because there's no pipeline to orchestrate.

---

## 4. Affected-test selection

**Default behaviour** — `npm run test:affected` runs `scripts/run-affected-tests.mjs`,
which:

1. Resolves `BASE_REF` (defaults to `origin/main`) to a real merge-base.
2. Reads `git diff --name-only` between that base and `HEAD`.
3. Filters files via `isTestRelevant` (keeps `src/**`, `tests/**`, the
   vitest/vite/tsconfig files; drops `docs/**`, `.github/**`, `scripts/**`,
   `.env*`, `*.md`).
4. Compares against `SHARED_HIGH_IMPACT` globs. **If any match**, the
   script runs the entire unit suite (because shared-file impact ripples
   to dozens of consumers).
5. Otherwise hands the filtered list to `vitest related ... --run --config vitest.unit.config.ts`.

### Shared-file impact rules

Touching any of these paths forces the **full unit suite** to run because
import-graph analysis cannot reason about every indirect consumer:

```
src/routes/**
src/layouts/**
src/context/**
src/store/**
src/services/axios.*
src/services/auth.service.*
src/services/googleAuth.service.*
src/services/payment.service.*
src/services/wallet*
src/utils/validationRules?.*
src/utils/validation/**
src/types/(dto|shared|common)/**
vitest*.config.ts
vite.config.ts
tests/setup.ts
```

(Implemented in `scripts/run-affected-tests.mjs` as `SHARED_HIGH_IMPACT`.)

### Exit codes

| Code | Meaning | What the workflow does |
|---|---|---|
| 0 | Tests selected and passed | green ✓ |
| 1 | Tests selected and **failed** | red ✗ — block PR |
| 2 | No tests selected **AND** test-relevant changes were detected | red ✗ — block PR; the workflow prints `##[error]No tests selected for ${diff}` |
| 3 | No tests selected **AND** no test-relevant changes (`docs/**`, `scripts/**`, comments) | green ✓ — there is nothing test-relevant in the diff |

The GitHub workflow surfaces code 2 as a job failure because that's the
"silent default to nothing" failure mode that affected-test is designed to
expose.

### Why not just `vitest --changed origin/main`?

`vitest --changed` requires a base commit that resolves in the local repo.
The ARS_FE runner is a shallow checkout, so `origin/main` is not always
fetched. When that happens `vitest --changed` errors out instead of
returning "nothing selected", and the workflow can't distinguish between
a real Vitest failure and an infrastructure failure.

Our wrapper (`run-affected-tests.mjs`) implements the same intent and falls
back to `git merge-base` → `HEAD~1` → "run full unit suite", always producing
a meaningful exit code.

---

## 5. Smoke command — curated list

`npm run test:smoke` runs **exactly** the file list below, hand-curated to
mirror the requirement set: auth/route guards, registration, Google OAuth
callback/onboarding, email workflow service, password reset/OTP, main
navigation, payment/wallet protection, paper submission validation.

> ❗ The list is **explicit, not a glob**. A filename pattern would risk
> sweeping in unrelated slow tests. Update both this section and
> `scripts/run-smoke.mjs` (the constant `SMOKE_LIST`) together.

```
tests/unit/context/AuthContext.loginWithGoogle.test.tsx
tests/unit/context/AuthContext.logout.test.tsx
tests/unit/routes/PublicRoute.admin.test.tsx
tests/unit/routes/googleAuthRoutes.test.ts
tests/unit/App.routes.premium.test.tsx
tests/unit/hooks/useVerifiedGuard.test.ts

tests/unit/pages/Register.test.tsx
tests/unit/pages/Register.consent.test.tsx
tests/unit/pages/Register.inlineErrors.test.tsx
tests/unit/utils/registrationRoles.test.ts

tests/unit/agent30/googleLoginGuard.test.ts
tests/unit/agent30/googleOnboarding.focused.test.ts
tests/unit/agent30/googleOnboarding.regression.test.tsx
tests/unit/agent30/noForbiddenCalls.test.ts
tests/unit/agent30/usePermissions.null.test.ts
tests/unit/agent31/googleOnboarding.payloadRegression.test.tsx
tests/unit/agent32/googleStateMachine.focused.test.ts
tests/unit/pages/GoogleCallback.test.tsx
tests/unit/pages/CompleteGoogleRegistration.onboarding.test.tsx
tests/unit/pages/CompleteGoogleRegistration.routingRegression.test.tsx
tests/unit/services/googleAuth.service.test.ts

tests/unit/services/emailVerification.service.test.ts
tests/unit/services/emailWorkflow.test.ts
tests/unit/pages/EmailVerificationLanding.test.tsx
tests/unit/hooks/useEmailVerification.test.ts

tests/unit/utils/validationRules.test.ts
tests/unit/utils/postAuthRoute.test.ts
tests/unit/pages/VerifyOtp.dedupe.test.tsx

tests/unit/layouts/MainLayout.guestSidebar.test.tsx
tests/unit/layouts/MainLayout.adminSidebar.test.tsx
tests/unit/layouts/MainLayout.lecturerNavigation.test.tsx
tests/unit/layouts/MainLayout.graduateStudentNav.test.tsx
tests/unit/layouts/MainLayout.reviewerAvailability.test.tsx
tests/unit/layouts/MainLayout.notificationCenter.test.tsx
tests/unit/layouts/MainLayout.premiumRoute.test.tsx

tests/unit/pages/EarningsWallet.test.tsx
tests/unit/pages/withdrawalGate.test.tsx
tests/unit/hooks/useConfirmPayment.test.ts
tests/unit/pages/CheckoutReturn.test.tsx

tests/unit/pages/Papers.taxonomy.test.tsx
```

Run with: `node scripts/run-smoke.mjs` or `npm run test:smoke`.

Expected runtime on a 4-vCPU CI runner: **< 90 seconds** cold. The script
fails immediately (exit 1) if any path in the list no longer exists, so a
delete-rename of a test by another agent is caught loudly.

---

## 6. Workflow categories

| Workflow | Trigger | Required checks | Optional checks |
|---|---|---|---|
| `pr-fast.yml` | `pull_request` | `npm ci`, `build`, `lint`, `test:affected`, `test:smoke` | — |
| `main-nightly.yml` | `push` to main, nightly cron, `workflow_dispatch` | `unit`, `integration`, `e2e` (matrix), `coverage` (artifact) | — |
| `release-verify.yml` | release tags, `workflow_dispatch` | Full regression: unit, integration, e2e, coverage, build | — |

Concurrency: PR runs cancel obsolete older runs for the same PR
(`concurrency.group = ${{ github.workflow }}-${{ github.event.pull_request.number }}`
with `cancel-in-progress: true`). Main/release do **not** cancel.

Path filters: **none**. Required checks must run on every PR. We do not
restrict by `paths:` because the routing/auth layers are intertwined with
docs/config changes and a missed filter would silently leave a required
check permanently pending.

External services: **none**. CI runs against fully mocked BE / Firebase
/ SMTP / VNPay / OTP / Firebase Storage. Workflows assert this with
`actions/github-script` setup steps that fail loudly if a forbidden URL
appears in `axios` mocks.

---

## 7. Failure behavior

A workflow job fails (and stays failed; no "warning mode") on:

- TypeScript compile errors surfaced by `npm run build` (`tsc -b && vite build`).
- ESLint errors surfaced by `npm run lint`.
- Real test failures (`vitest` non-zero exit; `playwright` non-zero exit).
- Empty `test:affected` selection **when** test-relevant files were changed
  (exit code `2` from `run-affected-tests.mjs`). The workflow surfaces this
  as `##[error]test:affected produced no tests for: ...`.
- Unavailable required infrastructure (`npm ci` cannot resolve packages,
  no network, Playwright browser deps missing — the workflow explicitly
  documents expected behaviour for the latter; see §8 CI limitations).

The workflow does **not** downgrade failures to warnings. A red ✗ is always
a red ✗.

---

## 8. CI limitations

- **Browser binaries in CI**: Playwright flows must `npx playwright install --with-deps chromium`
  on every workflow runner. The base image does not ship a Chromium that
  matches `@playwright/test@1.62.x`. The `pr-fast.yml` workflow runs only
  Vitest, so it does not need Chromium — keep it that way.
- **Headed Google OAuth**: `tests/e2e/googleOnboarding.headed.spec.ts`
  requires an interactive browser session. It is **never** invoked from CI;
  it is invoked manually via `npm run e2e:google-onboarding:headed` for
  visual verification.
- **Mock vs live**: the production BE E2E specs (`e2e:production`,
  `e2e:researcher-reviewer`, `e2e:reviewer-withdrawal`) hit the live ARS
  deployment unless the corresponding `E2E_RUN_LIVE_*` env is unset, in
  which case they fall back to `page.route()` interception. CI leaves those
  flags off.
- **Coverage vs node v8 quirks**: `--coverage` requires the binary to be
  compiled with V8 coverage support. The repo currently uses
  `@vitest/coverage-v8`, which is the supported path. If that ever flips
  to `coverage-istanbul` the coverage job's HTML output path will change.
- **Shallow git history**: `npm run test:affected` may fall back to
  `HEAD~1` if `origin/main` cannot be resolved. Documented in §4.
- **No VNPay / Firebase / SMTP from CI**: every spec that talks to those
  mocks the SDK at module-import time. CI does not provision real Firebase
  credentials; the test config does not reference them.

---

## 9. Adding a new test

When you add a new test:

1. **Pick the right directory**:
   - Pure single-component / single-service? → `tests/unit/`
   - Multi-module / store / context wiring? → `tests/integration/`
   - Browser-level journey with mocked BE? → `tests/e2e/`
2. **Run** the new file under `npm run test:unit` or `test:integration` to
   verify the include glob picks it up.
3. If the test gates a critical user journey (auth, payments, paper upload,
   onboarding), append it to `SMOKE_LIST` in `scripts/run-smoke.mjs` and
   mirror the entry in §5 of this doc.
4. If the test depends on shared services, mark the file in a comment as
   `// SHARED-IMPACT` so the next maintainer knows touching it ripples to
   many test files.
5. If the test relies on real Firebase/VNPay/SMTP, **stop** — the requirement
   is that all external systems are mocked in CI. Convert to mock + assertion
   on the call instead.

---

## 10. References

- `docs/GITHUB_CI_SETUP.md` — beginner-friendly workflow + branch-protection
  guide for maintainers and contributors.
- `swagger.json` — locked-in BE API contract (verified against
  https://arsplatform.onrender.com/swagger/index.html).
- `vitest.config.ts`, `vitest.unit.config.ts`, `vitest.integration.config.ts`
  — Vitest configuration.
- `scripts/run-smoke.mjs`, `scripts/run-affected-tests.mjs`,
  `scripts/run-all-tests.mjs` — orchestrators.
- `.github/workflows/pr-fast.yml`, `.github/workflows/main-nightly.yml`,
  `.github/workflows/release-verify.yml` — workflow entries.

**End exactly: TEST_STRATEGY_AND_GITHUB_CI_READY**
