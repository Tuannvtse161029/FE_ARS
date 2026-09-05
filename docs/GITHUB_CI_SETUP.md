# GitHub CI Setup — Beginner's Guide

> Audience: a new contributor or maintainer who has never touched the
> `.github/workflows/` directory of `ARS_FE`. You should be able to read
> this end-to-end and (a) understand why each workflow exists, (b) set up
> branch protection, (c) recover when something goes red, (d) avoid
> accidentally sending real emails / payments from CI.

The strategy that drives this guide lives in
[`docs/TESTING_STRATEGY.md`](./TESTING_STRATEGY.md). Read that first if you
need the why; this doc is the how.

---

## 1. Where the workflows live

```
.github/workflows/
├── pr-fast.yml          # required checks on every pull request
├── main-nightly.yml     # nightly + on push to main
└── release-verify.yml   # release tag / branch / manual dispatch
```

| Workflow | Trigger | Required? | Cancellable? |
|---|---|---|---|
| `pr-fast.yml` | every `pull_request` to `main` | yes | yes (per-PR) |
| `main-nightly.yml` | `push` to `main`, **nightly cron** (`0 2 * * *`), `workflow_dispatch` | optional | no |
| `release-verify.yml` | tag `v*.*.*`, branch `release/**`, `workflow_dispatch` | required for releases | no |

There is **no `paths:` filter** on any workflow. The smoke + affected +
build + lint suite is fast enough to run on every PR, and a filter that
excluded `docs/` or `.github/` would silently leave required checks
"pending" forever.

---

## 2. Node version

All workflows pin `actions/setup-node@v4` to **`node-version: '24'`**.

Why Node 24:

- It is the project's selected LTS line and matches the local development toolchain.
- It matches the version declared in `.nvmrc` and the `engines` field in `package.json`.
- Node 24 provides the runtime features and performance profile required by the project's Vite and Vitest tooling.
- The CI cache key (`npm cache npm`) requires the same major version across the runner; pinning here keeps that cache hit-rate predictable.

If you want to upgrade, change **all workflow files**, `.nvmrc`, and the
`package.json` `engines` field in one PR. Mismatched Node versions will
produce "works for me, broken for you" situations.

---

## 3. Required checks (branch protection)

Open the repository → **Settings → Branches → Branch protection rules →
`main`** and add:

| Check name (exact) | Required on PR? | Required on release? |
|---|---|---|
| `PR fast / PR fast` | ✅ | n/a (release runs separately) |
| `Main nightly / Unit (Vitest)` | ❌ (informational) | informational |
| `Main nightly / Integration (Vitest)` | ❌ | informational |
| `Main nightly / E2E (Playwright headless)` | ❌ | informational |
| `Main nightly / Coverage (Vitest v8)` | ❌ | informational |
| `Release verify / Build + Lint` | n/a | ✅ |
| `Release verify / Unit (Vitest)` | n/a | ✅ |
| `Release verify / Integration (Vitest)` | n/a | ✅ |
| `Release verify / E2E (Playwright headless)` | n/a | ✅ |
| `Release verify / Coverage (Vitest v8)` | n/a | ✅ |

> The `Main nightly / E2E` check **must not** be marked required on PRs.
> Marking it required blocks every PR when a Chromium binary has a hiccup.
> E2E is enforced through `Release verify` instead.

Also enable:

- "Require status checks to pass before merging"
- "Require branches to be up to date before merging"
- "Require linear history" (recommended)
- "Do not allow bypassing the above settings" (admins included)

---

## 4. Inspecting artifacts

| Workflow job | Artifact name | Contents |
|---|---|---|
| `PR fast / PR fast` | `pr-fast-coverage` | `coverage/` (HTML + text) |
| `Main nightly / Unit (Vitest)` | `unit-report` | coverage + test results |
| `Main nightly / Integration (Vitest)` | `integration-report` | coverage + test results |
| `Main nightly / E2E (Playwright headless)` | `playwright-report` | HTML report + traces |
| `Main nightly / Coverage (Vitest v8)` | `coverage-report` | coverage/ |
| `Release verify / *` | `release-*` | per-suite |

To inspect:

1. Open the failing run on GitHub.
2. Scroll to **Artifacts**.
3. Download the `.zip`.
4. Unpack and open `coverage/index.html` or
   `playwright-report/index.html` directly in a browser.

Retention is set per workflow (7 / 14 / 30 / 60 / 90 days). Increase it via
`retention-days:` if you need long-running forensics.

---

## 5. Preventing real emails / payments / Firebase uploads from CI

**Rule**: every external system call must be mocked at module import time.
CI never has real credentials for:

- SMTP / email sending
- VNPay payment requests
- Firebase uploads (Storage, Auth)
- OTP generation
- OAuth provider round-trips

How each workflow keeps it that way:

1. **No live URLs in env.** `VITE_API_BASE_URL` is set to a non-routable
   `http://127.0.0.1:4173` — the vite preview server started by
   `webServer` in `playwright.google-onboarding.config.ts` and the local
   `vitest preview` server. Any test that tried to hit a real BE would
   either time out or get a 127.0.0.1 response.
2. **`E2E_RUN_LIVE_*` flags stay off.** The two production E2E configs
   (`playwright.reviewer-flow.config.ts`, `playwright.withdrawal-flow.config.ts`)
   have Mode A interception (mock by default, live only when explicitly
   opted in). The workflows do **not** set `E2E_RUN_LIVE_*`, so they fall
   into mock mode automatically.
3. **`npm ci --ignore-scripts`** prevents any postinstall hook from
   reaching out to a real Firebase project, signing keys, or telemetry.
   The scripts that DO need to run are explicitly allow-listed in
   `package.json` `allowScripts`.
4. **No secrets stored.** The workflows only need
   `VITE_API_BASE_URL` (now moot — hardcoded to the localhost dev server),
   and `GITHUB_TOKEN` (automatic). No `VNP_HASH_SECRET`, no
   `VITE_FIREBASE_API_KEY`, no `SENDGRID_API_KEY` is ever injected.

If you need to test something that **requires** a real vendor, do it
**manually** outside CI. Never bake a live secret into `.github/`.

---

## 6. Updating test categories when adding new tests

### 6.1 Where to put a new test

| Test type | Directory | Script | Notes |
|---|---|---|---|
| Component / service / hook / context / page | `tests/unit/<role>/...` | `npm run test:unit` | jsdom, single-component |
| Multi-module, store, AuthContext wiring | `tests/integration/...` | `npm run test:integration` | jsdom, multi-module |
| Browser-level journey with mocked BE | `tests/e2e/*.spec.ts` | `npm run test:e2e` | Playwright |
| Manual interactive headed verification | `tests/e2e/*.headed.spec.ts` | `npm run e2e:google-onboarding:headed` | Local-only, never run from CI |

### 6.2 Smoke-list bookkeeping

If your test gates a critical journey (auth, payments, paper upload,
onboarding):

1. Add the file path to `SMOKE_LIST` in
   `scripts/run-smoke.mjs` (constant near the top).
2. Mirror it under "## 5. Smoke command — curated list" in
   `docs/TESTING_STRATEGY.md`.
3. Open a small PR titled `chore(smoke): add <test-purpose> to curated list`.

### 6.3 Renaming a file

If you rename a smoke-list entry, the `run-smoke.mjs` script will fail on
the next run with `[smoke] FAIL — the following curated files are missing on disk`.
That is intentional — it forces the curator to update the list.

### 6.4 Adding a new shared-file hot path

If you introduce a new shared-impact path (e.g. `src/utils/featureFlags.ts`
that every component reads), add the regex to `SHARED_HIGH_IMPACT` in
`scripts/run-affected-tests.mjs`. The next PR touching that path will then
be forced through the full unit suite instead of the narrowing related
selector.

---

## 7. Troubleshooting

### 7.1 "test:affected produced no tests for: src/..."

Cause: the diff actually contains test-relevant files but `vitest related`
found no dependent unit test files (rare — usually means a brand-new module
that has no test). The script returned exit code **2**. The PR job fails.

Fix:

1. Write a unit test for the new module under `tests/unit/...`.
2. Re-run `npm run test:affected`.

### 7.2 "smoke failed because curated file does not exist on disk"

Cause: a curator removed or renamed a smoke-list entry without updating
`scripts/run-smoke.mjs`.

Fix:

- Update `SMOKE_LIST` in `scripts/run-smoke.mjs` AND §5 of
  `docs/TESTING_STRATEGY.md` together.

### 7.3 Playwright "Executable doesn't exist"

Cause: the runner image does not ship the Chromium binary expected by
`@playwright/test@1.62.x`. The nightly / release workflows install it via
`npx playwright install --with-deps chromium`. The PR-fast workflow **must
not** depend on this — it runs Vitest only.

Fix:

- Confirm the workflow includes the
  `npx playwright install --with-deps chromium` step.
- If still failing, switch the runner to `ubuntu-22.04` (or newer) —
  Playwright's deps assume GLIBC 2.31+.

### 7.4 "npm run build" fails with TS errors

Cause: type drift between `src/` and the latest Vitest test file. CI
treats TS errors as a hard failure (same as production).

Fix:

- Run `npm run build` locally; fix the errors; push.

### 7.5 Coverage report is empty

Cause: `--coverage` was not paired with the v8 provider or no files matched
the `coverage.include` glob in `vite.config.ts`. Check the `coverage/`
artifact on the nightly run; if it is empty there too, the Vitest plugin
configuration has drifted.

---

## 8. CI limitations (a TL;DR; full list in TESTING_STRATEGY.md §8)

- **Headed Google OAuth e2e** never runs in CI. It is interactive and is
  invoked manually via `npm run e2e:google-onboarding:headed`.
- **Production E2E** (researcher / withdrawal flows) only hits the live BE
  when the `E2E_RUN_LIVE_*` env is set; CI leaves them off, so the specs run
  in Mode A interception.
- **Shallow git history** can break `vitest --changed`. The
  `scripts/run-affected-tests.mjs` fallback (`git merge-base` → `HEAD~1`)
  keeps the PR job meaningful even if origin/main has never been fetched.
- **No Node version bump without a coordinated PR.** Bumping the version
  means changing all workflow files, `.nvmrc`, and `package.json` together.

---

## 9. References

- [`docs/TESTING_STRATEGY.md`](./TESTING_STRATEGY.md)
- [`vitest.config.ts`](../vitest.config.ts), [`vitest.unit.config.ts`](../vitest.unit.config.ts),
  [`vitest.integration.config.ts`](../vitest.integration.config.ts)
- [`playwright.e2e.config.ts`](../playwright.e2e.config.ts) and the preserved
  specialized configs next to it
- [`scripts/run-smoke.mjs`](../scripts/run-smoke.mjs),
  [`scripts/run-affected-tests.mjs`](../scripts/run-affected-tests.mjs),
  [`scripts/run-all-tests.mjs`](../scripts/run-all-tests.mjs)

**End exactly: TEST_STRATEGY_AND_GITHUB_CI_READY**
