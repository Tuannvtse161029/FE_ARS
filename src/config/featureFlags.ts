/**
 * Feature flags used to gate *development-only* behaviour.
 *
 * These flags exist so we can keep production behaviour authoritative while
 * unblocking legitimate developer / QA scenarios (e.g. registering a dummy
 * Reviewer account without a real ORCID during local testing).
 *
 * Rules:
 *   - Each flag has a single source of truth (the fallback in
 *     `resolveReviewerOrcidRequired()` etc.).
 *   - The current development default for `VITE_REQUIRE_REVIEWER_ORCID` is
 *     `false` (ORCID optional) so dummy Reviewer accounts can be created
 *     without a real ORCID. When the user explicitly tells the assistant to
 *     implement production, flip the fallback to `true` and update
 *     `docs/PRODUCTION_REENABLEMENT_REGISTER.md` so PROD-002 is marked
 *     `REENABLED`.
 *   - Setting `VITE_REQUIRE_REVIEWER_ORCID=true` / `false` in
 *     `.env` / `.env.*.local` is the explicit way to override the default.
 *   - The ORCID connection flow itself is NEVER modified — we only relax
 *     the *frontend requirement* that the user must complete it. We never
 *     fake, fabricate, or shortcut a verified ORCID record on the server.
 *   - If the BE later enforces ORCID server-side, this flag will no longer
 *     produce a usable bypass; the BE will still reject the submission.
 *
 * Implementation note: Vite statically replaces `import.meta.env.KEY`
 * references at transform time. To make the value overridable in tests we
 * read it via dynamic property lookup, then expose the lookup through a
 * small mutable override (`__setRequireReviewerOrcidForTests`) that tests
 * can use to force a specific value.
 */

/**
 * Returns the raw env-var value or `undefined` if not set. The lookup is
 * intentionally a function so it can be evaluated at call time. We use a
 * dynamic property access against `import.meta.env` so Vite's compile-time
 * `define` substitution does NOT inline the build-time value. (See
 * `docs/ORCID_OPENALEX_SWAGGER_CONTRACT.md` for the BE contract that this
 * flag gates.)
 */
const readRawEnvValue = (): string | undefined => {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (!metaEnv) return undefined;
  // Dynamic lookup: `metaEnv['KEY']` is NOT statically replaced by Vite.
  return metaEnv['VITE_REQUIRE_REVIEWER_ORCID' as keyof typeof metaEnv] as
    | string
    | undefined;
};

const parseBooleanEnv = (raw: string | undefined, fallback: boolean): boolean => {
  if (typeof raw !== 'string') return fallback;
  const normalised = raw.trim().toLowerCase();
  if (normalised === 'true' || normalised === '1' || normalised === 'yes' || normalised === 'on') {
    return true;
  }
  if (normalised === 'false' || normalised === '0' || normalised === 'no' || normalised === 'off') {
    return false;
  }
  return fallback;
};

/**
 * Test-only override hook. When set to a boolean it short-circuits the env
 * lookup so tests can force a specific `requireReviewerOrcid()` value
 * without depending on Vite's transform-time env handling. The value is the
 * *required* flag itself: `true` = ORCID required (production),
 * `false` = ORCID bypass allowed (development). `null` = clear the override.
 * Never used outside test files.
 */
let testRequireReviewerOrcid: boolean | null = null;

/**
 * @internal Exported ONLY for tests. Do not import from production code.
 */
export const __setRequireReviewerOrcidForTests = (value: boolean | null): void => {
  testRequireReviewerOrcid = value;
};

const resolveReviewerOrcidRequired = (): boolean => {
  if (testRequireReviewerOrcid !== null) return testRequireReviewerOrcid;
  // CURRENT DEFAULT (development): ORCID is OPTIONAL for Reviewer
  // registration / role request so that dummy test accounts can be created
  // without a real ORCID connection. When you instruct the assistant to
  // implement production, this default becomes `true` and the FE will
  // block Reviewer submissions unless an ORCID is connected.
  // When the env var `VITE_REQUIRE_REVIEWER_ORCID` is missing the flag
  // falls back to this default.
  return parseBooleanEnv(readRawEnvValue(), false);
};

/**
 * When `true`, the Reviewer registration and Reviewer-role upgrade flows
 * REQUIRE a verified ORCID connection before the user can submit. This is
 * the production behaviour.
 *
 * When `false` (the current development default), the FE still surfaces the
 * existing ORCID connection UI for users who want to connect — but
 * submission is permitted without ORCID. This is intended ONLY for local
 * dummy Reviewer test accounts.
 *
 * Control: `VITE_REQUIRE_REVIEWER_ORCID` in `.env` / `.env.*.local`.
 *   - `true` / `1` / `yes` / `on`  → ORCID required (production)
 *   - `false` / `0` / `no` / `off` → ORCID optional (development, current)
 *   - missing / unrecognised       → development default (false)
 *
 * When you are ready to ship production, change the fallback in
 * `resolveReviewerOrcidRequired()` to `true` (and update
 * `docs/PRODUCTION_REENABLEMENT_REGISTER.md` so PROD-002 moves to
 * `REENABLED`).
 */
export const requireReviewerOrcid = (): boolean => resolveReviewerOrcidRequired();

/**
 * Convenience flag: `true` whenever the FE is permitted to let a user submit
 * a Reviewer-role request without an ORCID connection. Useful as a single
 * source of truth inside the validation / submission paths.
 */
export const reviewerOrcidBypassAllowed = (): boolean => !resolveReviewerOrcidRequired();

/**
 * When `true` (production), the email verification page requires a valid
 * OTP code before letting the user complete registration. The page hides
 * its "Skip for development" affordance and `handleSkipForDev()` is a
 * no-op.
 *
 * When `false` (current development default), the FE permits a
 * "Skip for development" button on the OTP screen so dummy accounts can
 * be created without going through the email service. This is the
 * development default — flip to `true` when the user instructs the
 * assistant to implement production.
 *
 * Control: `VITE_REQUIRE_REGISTRATION_OTP` in `.env` / `.env.*.local`.
 * Default (when unset): `false` (development — skip allowed).
 */
export const requireRegistrationOtp = (): boolean => {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (!metaEnv) return false;
  const raw = metaEnv['VITE_REQUIRE_REGISTRATION_OTP' as keyof typeof metaEnv] as
    | string
    | undefined;
  if (typeof raw !== 'string') return false;
  const normalised = raw.trim().toLowerCase();
  if (normalised === 'true' || normalised === '1' || normalised === 'yes' || normalised === 'on') {
    return true;
  }
  if (normalised === 'false' || normalised === '0' || normalised === 'no' || normalised === 'off') {
    return false;
  }
  return false;
};

export const registrationOtpBypassAllowed = (): boolean => !requireRegistrationOtp();
