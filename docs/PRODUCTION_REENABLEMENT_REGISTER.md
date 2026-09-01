# Production Re-enablement Register

This register records every **intentional** difference between the current
development build and the official production behaviour of the ARS frontend.

Each entry documents what is temporarily different, why development needs the
bypass, the exact files/functions affected, the feature flag (or other
control) used, the production behaviour that must be restored, the trigger
that should re-enable production behaviour, the evidence required before
re-enabling, and the current status.

The register is append-only for completed entries — never overwrite a shipped
entry, only update its status. New temporary development-only changes MUST add
a new row before they ship to the development branch.

## Register

| ID | Development difference | Production behaviour | Control | Files | Re-enable trigger | Required evidence | Status |
|---|---|---|---|---|---|---|---|
| **PROD-001** | Annual subscription gate temporarily bypassed for Researcher and Lecturer | Subscription entitlement restricts access when the feature is launched | `src/config/app.ts` — `AppConfig.features.enableSubscriptionAccess` (default `false`) | `src/config/app.ts`, `src/layouts/MainLayout.tsx`, `src/pages/Lecturer/*` (subscription-aware views) | Backend subscription/payment API complete and production launch approved | Backend entitlement enforcement, payment verification, automated tests, product-owner approval | `DEVELOPMENT_BYPASS` |
| **PROD-002** | ORCID is optional for Reviewer registration and Reviewer-role request to support dummy Reviewer test accounts (current development default) | ORCID must be connected and validated before Reviewer role access | `VITE_REQUIRE_REVIEWER_ORCID` (env var); code fallback in `src/config/featureFlags.ts` — current default is `false` (ORCID optional). To enforce in production set the fallback to `true` AND/OR the env var to `true`. | `src/config/featureFlags.ts` (new), `src/pages/Register/Register.tsx`, `src/pages/CompleteGoogleRegistration/CompleteGoogleRegistration.tsx`, `src/components/orcid/OrcidIdentityPanel.tsx`, `src/pages/Register/Register.module.css` (`.orcidDevNotice`), `src/pages/CompleteGoogleRegistration/CompleteGoogleRegistration.module.css` (`.orcidDevNotice`), `.env.example`, `tests/unit/config/featureFlags.test.ts` (new), `tests/unit/pages/Register.orcidBypass.test.tsx` (new) | When the user instructs the assistant to implement production (or production launch is otherwise approved) AND ORCID backend/API validation is confirmed via Swagger contract | Production flag value `true`, backend validation confirmed, automated registration + role-access tests pass, manual smoke test on at least one dummy account, register status updated to `REENABLED` | `DEVELOPMENT_BYPASS` |
| **PROD-003** | OTP verification is bypassed for development to support dummy account creation without email service (current development default) | OTP must be entered before registration can be completed; "Skip for development" button is hidden | `VITE_REQUIRE_REGISTRATION_OTP` (env var); code fallback in `src/config/featureFlags.ts` — current default is `false` (OTP bypass allowed in dev). To enforce in production set the fallback to `true` AND/OR the env var to `true`. | `src/config/featureFlags.ts` (`registrationOtpBypassAllowed()`), `src/pages/Auth/EmailVerificationLanding.tsx` (`handleSkipForDev()`), `src/pages/Auth/EmailVerificationLanding.module.css` (`.devSkipBlock`), `.env.example` | When the user instructs the assistant to implement production AND the email service OTP flow is fully operational | Production flag value `true`, backend OTP delivery confirmed, automated verification tests pass, manual smoke test completes, register status updated to `REENABLED` | `DEVELOPMENT_BYPASS` |

## Required fields for every future temporary bypass

When adding a new entry to this register, every row must include:

- **Unique ID** — sequential `PROD-NNN` identifier; never reuse a retired ID.
- **Exact behaviour changed** — what the code does today in dev that it
  must NOT do in production.
- **Why development needs the bypass** — the concrete scenario that would
  otherwise be blocked (e.g. dummy test accounts, missing BE feature, etc).
- **Exact files/functions affected** — every file touched, with the line range
  or function name where the bypass is implemented.
- **Feature flag or control used** — the env var, config key, or runtime
  switch that gates the bypass. The default MUST be the production-safe
  value.
- **Production behaviour to restore** — what the code must do once the
  bypass is re-enabled.
- **Trigger** — the production event that authorises re-enabling
  (production launch, backend API complete, AI integration complete, etc.).
- **Required backend/API evidence** — the artefacts that prove the BE-side
  counterpart is ready (Swagger doc links, contract test results, etc.).
- **Required automated and manual tests** — which Vitest / Playwright /
  smoke tests must pass.
- **Owner** — the named human responsible for re-enabling production
  behaviour.
- **Status** — one of `DEVELOPMENT_BYPASS`, `READY_TO_REENABLE`,
  `REENABLED`, or `RETIRED`.

## Status legend

- `DEVELOPMENT_BYPASS` — currently active in dev builds; production
  behaviour is gated behind a flag and is OFF.
- `READY_TO_REENABLE` — the trigger condition is satisfied and the required
  evidence has been collected; awaiting owner sign-off to flip the flag.
- `REENABLED` — the flag has been flipped to its production-safe value in
  all environments and the bypass code path is no longer reachable.
- `RETIRED` — the bypass code has been removed entirely; the entry remains
  for historical record only.

## Related references

- `docs/ORCID_OPENALEX_SWAGGER_CONTRACT.md` — the BE ORCID contract that
  PROD-002 is gated against.
- `src/config/featureFlags.ts` — the canonical home for all production
  feature flags.
- `.env.example` — the documented template for every `VITE_*` flag.

## Change history

| Date | ID | Change | Author |
| --- | --- | --- | --- |
| 2026-09-01 | PROD-001 | Initial entry (subscription gate bypass). | FE platform owner |
| 2026-09-01 | PROD-002 | New entry (Reviewer ORCID bypass via `VITE_REQUIRE_REVIEWER_ORCID`). | FE platform owner |
| 2026-09-02 | PROD-003 | New entry (Email OTP bypass via `VITE_REQUIRE_REGISTRATION_OTP`). | FE platform owner |
