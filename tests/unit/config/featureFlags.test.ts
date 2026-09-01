/**
 * Tests for src/config/featureFlags.ts
 *
 * Verifies that the development default (ORCID optional) is honoured and
 * that the explicit env var override path and the test-only override hook
 * can flip the flag for development and production scenarios.
 *
 * Implementation note: Vite statically replaces `import.meta.env.KEY`
 * references at transform time, and Vitest's `vi.stubEnv` does not drive
 * Vite's per-module import.meta.env proxy reliably. These tests therefore
 * exercise the env-driven path through the test-only override hook
 * (`__setRequireReviewerOrcidForTests`), which is the supported override
 * mechanism. The hook calls the same internal `resolveReviewerOrcidRequired`
 * function that `parseBooleanEnv(readRawEnvValue(), fallback)` would, so
 * the production code path is identical when a real env var is supplied.
 */
import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';

type FlagModule = typeof import('../../../src/config/featureFlags');

const reloadFlagsModule = async () => {
  vi.resetModules();
  return await import('../../../src/config/featureFlags');
};

describe('featureFlags – requireReviewerOrcid', () => {
  let flags: FlagModule;

  beforeEach(async () => {
    flags = await reloadFlagsModule();
    flags.__setRequireReviewerOrcidForTests(null);
  });
  afterEach(() => {
    flags.__setRequireReviewerOrcidForTests(null);
  });

  test('CURRENT DEVELOPMENT DEFAULT: ORCID is optional when env var is missing', () => {
    // The current build of the app runs with the development default of
    // `false` (ORCID optional). When the user instructs the assistant to
    // implement production, this test must be updated (and the production
    // register must move PROD-002 to `REENABLED`).
    expect(flags.requireReviewerOrcid()).toBe(false);
    expect(flags.reviewerOrcidBypassAllowed()).toBe(true);
  });

  test('env-var-equivalent: production gate ON (VITE_REQUIRE_REVIEWER_ORCID=true)', () => {
    // The env var path runs through `parseBooleanEnv(readRawEnvValue(), false)`,
    // so the supported way to test it is via the override hook which calls
    // the same resolver.
    flags.__setRequireReviewerOrcidForTests(true);
    expect(flags.requireReviewerOrcid()).toBe(true);
    expect(flags.reviewerOrcidBypassAllowed()).toBe(false);
  });

  test('env-var-equivalent: development bypass stays on (VITE_REQUIRE_REVIEWER_ORCID=false)', () => {
    flags.__setRequireReviewerOrcidForTests(false);
    expect(flags.requireReviewerOrcid()).toBe(false);
    expect(flags.reviewerOrcidBypassAllowed()).toBe(true);
  });

  test('test override can force the ORCID requirement OFF (development mode)', () => {
    flags.__setRequireReviewerOrcidForTests(false);
    expect(flags.requireReviewerOrcid()).toBe(false);
    expect(flags.reviewerOrcidBypassAllowed()).toBe(true);
  });

  test('test override can force the ORCID requirement ON (production mode)', () => {
    flags.__setRequireReviewerOrcidForTests(true);
    expect(flags.requireReviewerOrcid()).toBe(true);
    expect(flags.reviewerOrcidBypassAllowed()).toBe(false);
  });

  test('clearing the override restores the development default', () => {
    flags.__setRequireReviewerOrcidForTests(true);
    expect(flags.reviewerOrcidBypassAllowed()).toBe(false);
    flags.__setRequireReviewerOrcidForTests(null);
    // Without an override, the current default is ORCID optional. Flip back
    // to `true` together with this file's first test once production is
    // implemented.
    expect(flags.requireReviewerOrcid()).toBe(false);
    expect(flags.reviewerOrcidBypassAllowed()).toBe(true);
  });

  test('reviewerOrcidBypassAllowed is the inverse of requireReviewerOrcid', () => {
    flags.__setRequireReviewerOrcidForTests(true);
    expect(flags.requireReviewerOrcid()).toBe(true);
    expect(flags.reviewerOrcidBypassAllowed()).toBe(false);
    flags.__setRequireReviewerOrcidForTests(false);
    expect(flags.requireReviewerOrcid()).toBe(false);
    expect(flags.reviewerOrcidBypassAllowed()).toBe(true);
  });
});

/**
 * PROD-003 tests: Email registration OTP bypass.
 *
 * The `VITE_REQUIRE_REGISTRATION_OTP` flag controls whether OTP verification
 * is required before completing registration. In development (default: false),
 * the "Skip for development" button appears on the email verification page.
 *
 * Note: Unlike `requireReviewerOrcid`, the OTP bypass flag does not have a
 * test-only override hook (the ORCID one uses `__setRequireReviewerOrcidForTests`).
 * The OTP bypass is controlled directly by the `import.meta.env` lookup inside
 * `requireRegistrationOtp()`. Tests should use `vi.stubGlobal('import.meta', { env: { ... } })`
 * or similar Vite mocking strategies to test both modes.
 *
 * The development default is `false` (OTP bypass allowed).
 */
describe('featureFlags – requireRegistrationOtp (PROD-003)', () => {
  let flags: FlagModule;
  let originalMetaEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    // Store original env
    originalMetaEnv = (import.meta as { env?: Record<string, string | undefined> }).env || {};
  });

  afterEach(() => {
    // Restore original env
    (import.meta as { env?: Record<string, string | undefined> }).env = originalMetaEnv;
  });

  test('CURRENT DEVELOPMENT DEFAULT: OTP bypass allowed when env var is missing', async () => {
    // Reset modules to get fresh flag values
    vi.resetModules();

    // Ensure env var is not set
    (import.meta as { env?: Record<string, string | undefined> }).env = {};

    const freshFlags = await import('../../../src/config/featureFlags');

    // Development default should be false (OTP bypass allowed)
    expect(freshFlags.requireRegistrationOtp()).toBe(false);
    expect(freshFlags.registrationOtpBypassAllowed()).toBe(true);
  });

  test('production mode: VITE_REQUIRE_REGISTRATION_OTP=true requires OTP', async () => {
    vi.resetModules();

    // Set env var to production mode
    (import.meta as { env?: Record<string, string | undefined> }).env = {
      VITE_REQUIRE_REGISTRATION_OTP: 'true',
    };

    const prodFlags = await import('../../../src/config/featureFlags');

    expect(prodFlags.requireRegistrationOtp()).toBe(true);
    expect(prodFlags.registrationOtpBypassAllowed()).toBe(false);
  });

  test('development mode: VITE_REQUIRE_REGISTRATION_OTP=false allows OTP bypass', async () => {
    vi.resetModules();

    // Set env var to development mode
    (import.meta as { env?: Record<string, string | undefined> }).env = {
      VITE_REQUIRE_REGISTRATION_OTP: 'false',
    };

    const devFlags = await import('../../../src/config/featureFlags');

    expect(devFlags.requireRegistrationOtp()).toBe(false);
    expect(devFlags.registrationOtpBypassAllowed()).toBe(true);
  });

  test('accepts truthy values: true, 1, yes, on', async () => {
    vi.resetModules();

    for (const truthyValue of ['true', '1', 'yes', 'on']) {
      (import.meta as { env?: Record<string, string | undefined> }).env = {
        VITE_REQUIRE_REGISTRATION_OTP: truthyValue,
      };

      const tFlags = await import('../../../src/config/featureFlags');
      expect(tFlags.requireRegistrationOtp()).toBe(true);
      expect(tFlags.registrationOtpBypassAllowed()).toBe(false);
    }
  });

  test('accepts falsy values: false, 0, no, off', async () => {
    vi.resetModules();

    for (const falsyValue of ['false', '0', 'no', 'off']) {
      (import.meta as { env?: Record<string, string | undefined> }).env = {
        VITE_REQUIRE_REGISTRATION_OTP: falsyValue,
      };

      const fFlags = await import('../../../src/config/featureFlags');
      expect(fFlags.requireRegistrationOtp()).toBe(false);
      expect(fFlags.registrationOtpBypassAllowed()).toBe(true);
    }
  });

  test('unrecognised values fall back to development default (bypass allowed)', async () => {
    vi.resetModules();

    (import.meta as { env?: Record<string, string | undefined> }).env = {
      VITE_REQUIRE_REGISTRATION_OTP: 'invalid-value',
    };

    const fallbackFlags = await import('../../../src/config/featureFlags');

    // Should fall back to false (development default)
    expect(fallbackFlags.requireRegistrationOtp()).toBe(false);
    expect(fallbackFlags.registrationOtpBypassAllowed()).toBe(true);
  });

  test('missing env var falls back to development default (bypass allowed)', async () => {
    vi.resetModules();

    (import.meta as { env?: Record<string, string | undefined> }).env = {};

    const missingFlags = await import('../../../src/config/featureFlags');

    expect(missingFlags.requireRegistrationOtp()).toBe(false);
    expect(missingFlags.registrationOtpBypassAllowed()).toBe(true);
  });

  test('registrationOtpBypassAllowed is the inverse of requireRegistrationOtp', async () => {
    vi.resetModules();

    // Test true case
    (import.meta as { env?: Record<string, string | undefined> }).env = {
      VITE_REQUIRE_REGISTRATION_OTP: 'true',
    };
    const trueFlags = await import('../../../src/config/featureFlags');
    expect(trueFlags.requireRegistrationOtp()).toBe(true);
    expect(trueFlags.registrationOtpBypassAllowed()).toBe(false);

    // Test false case
    vi.resetModules();
    (import.meta as { env?: Record<string, string | undefined> }).env = {
      VITE_REQUIRE_REGISTRATION_OTP: 'false',
    };
    const falseFlags = await import('../../../src/config/featureFlags');
    expect(falseFlags.requireRegistrationOtp()).toBe(false);
    expect(falseFlags.registrationOtpBypassAllowed()).toBe(true);
  });
});
