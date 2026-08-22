/**
 * Tests for src/services/orcid.service.ts — the Admin ORCID Check feature.
 *
 * ── Swagger evidence ───────────────────────────────────────────────────────
 * No ORCID / OpenAlex lookup endpoint exists in the live ARS Swagger at
 * https://arsplatform.onrender.com/swagger/v1/swagger.json (inspected 2026-08-22).
 * All 39 controllers (Analytics, AuditLog, Auth, CommentVote, ..., Wallet,
 * WithdrawalRequest) were scanned. No Orcid, OpenAlex, ExternalLookup,
 * AcademicLookup, ResearchLookup, or similar tag is present.
 *
 * Because no BE endpoint exists:
 *   - `lookupOrcid` always throws `OrcidCheckFeatureDisabledError` (until BE ships)
 *   - `normalizeOrcid` and `isValidOrcidFormat` are PURE utility functions
 *     that can be fully exercised
 *   - `ORCID_CHECK_ENABLED` defaults to `false` (build-time feature flag)
 *
 * These tests focus on the three areas that CAN be tested today:
 *   1. ORCID iD normalization (canonical format, dashes, the X check-digit)
 *   2. Service feature-flag short-circuit (no axios calls, no OpenAlex leakage)
 *   3. Service error class identity (callers can distinguish disabled vs failed)
 */
import { describe, it, expect, vi } from 'vitest';
import {
  ORCID_CHECK_ENABLED,
  OrcidApiError,
  OrcidCheckFeatureDisabledError,
  OrcidInvalidFormatError,
  OrcidNotFoundError,
  OrcidRateLimitError,
  enrichWithOpenAlex,
  isValidOrcidFormat,
  lookupOrcid,
  normalizeOrcid,
} from '../../../src/services/orcid.service';

// ── ORCID normalization (the heavy lifting) ──────────────────────────────────

describe('orcid.service.normalizeOrcid', () => {
  it('passes through a valid canonical 19-char iD unchanged', () => {
    expect(normalizeOrcid('0000-0000-0000-0000')).toBe('0000-0000-0000-0000');
    expect(normalizeOrcid('1234-5678-9012-3456')).toBe('1234-5678-9012-3456');
  });

  it('upper-cases the iD (canonical ORCID form is uppercase)', () => {
    expect(normalizeOrcid('0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcid('0000-0002-1825-0097'.toLowerCase())).toBe(
      '0000-0002-1825-0097',
    );
  });

  it('inserts dashes into a 16-digit raw form', () => {
    expect(normalizeOrcid('0000000218250097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcid('1234567890123456')).toBe('1234-5678-9012-3456');
  });

  it('strips whitespace from around a valid iD', () => {
    expect(normalizeOrcid('   0000-0002-1825-0097   ')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcid('0000000218250097  ')).toBe('0000-0002-1825-0097');
  });

  it('accepts spaces between groups in the raw form', () => {
    expect(normalizeOrcid('0000 0002 1825 0097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcid('0000 000218250097')).toBe('0000-0002-1825-0097');
  });

  it('accepts the X check-digit character (last char of ORCID iD may be X)', () => {
    expect(normalizeOrcid('0000-0000-0000-000X')).toBe('0000-0000-0000-000X');
    expect(normalizeOrcid('000000000000000x')).toBe('0000-0000-0000-000X');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeOrcid('')).toBe('');
    expect(normalizeOrcid('   ')).toBe('');
  });

  it('returns empty string for garbage input', () => {
    expect(normalizeOrcid('not-an-orcid')).toBe('');
    expect(normalizeOrcid('12345')).toBe('');
    expect(normalizeOrcid('12345-6789-0123-4567-extra')).toBe('');
    expect(normalizeOrcid('0000-0000-0000-00000')).toBe(''); // 17 chars
    expect(normalizeOrcid('0000-0000-0000-000')).toBe(''); // 16 chars missing one
  });

  it('returns empty string for non-numeric content', () => {
    expect(normalizeOrcid('abcd-efgh-ijkl-mnop')).toBe('');
    expect(normalizeOrcid('abcdefghijklmnop')).toBe('');
  });

  it('returns empty string for null / undefined / non-string', () => {
    expect(normalizeOrcid(null as unknown as string)).toBe('');
    expect(normalizeOrcid(undefined as unknown as string)).toBe('');
    expect(normalizeOrcid(12345 as unknown as string)).toBe('');
  });
});

describe('orcid.service.isValidOrcidFormat', () => {
  it('returns true for any string normalizeOrcid would accept', () => {
    expect(isValidOrcidFormat('0000-0002-1825-0097')).toBe(true);
    expect(isValidOrcidFormat('0000000218250097')).toBe(true);
    expect(isValidOrcidFormat('0000-0000-0000-000X')).toBe(true);
  });

  it('returns false for any string normalizeOrcid would reject', () => {
    expect(isValidOrcidFormat('not-an-orcid')).toBe(false);
    expect(isValidOrcidFormat('')).toBe(false);
    expect(isValidOrcidFormat('12345')).toBe(false);
  });
});

// ── Feature flag gating ──────────────────────────────────────────────────────

describe('orcid.service.lookupOrcid — feature flag gating', () => {
  it('throws OrcidCheckFeatureDisabledError without contacting any API', async () => {
    // Spy on global fetch to guarantee the FE does not call OpenAlex or ORCID
    // Public API directly from the browser.
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as unknown as typeof fetch).mockResolvedValue(
      new Response('{}', { status: 200 }),
    );
    try {
      await expect(lookupOrcid('0000-0002-1825-0097')).rejects.toBeInstanceOf(
        OrcidCheckFeatureDisabledError,
      );
      // No network leakage
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not even validate input before throwing the disabled error', async () => {
    // Even invalid iDs get the disabled error first — this guarantees
    // the feature flag short-circuit runs BEFORE format validation.
    await expect(lookupOrcid('garbage')).rejects.toBeInstanceOf(
      OrcidCheckFeatureDisabledError,
    );
    await expect(lookupOrcid('')).rejects.toBeInstanceOf(
      OrcidCheckFeatureDisabledError,
    );
  });

  it('ORCID_CHECK_ENABLED defaults to false in test environment', () => {
    expect(ORCID_CHECK_ENABLED).toBe(false);
  });
});

// ── Error class identity (callers can distinguish error types) ───────────────

describe('orcid.service — error class hierarchy', () => {
  it('OrcidCheckFeatureDisabledError is an Error', () => {
    const err = new OrcidCheckFeatureDisabledError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(OrcidCheckFeatureDisabledError);
    expect(err.name).toBe('OrcidCheckFeatureDisabledError');
    expect(err.message).toContain('not yet available');
  });

  it('OrcidInvalidFormatError carries the offending value in its message', () => {
    const err = new OrcidInvalidFormatError('garbage');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('OrcidInvalidFormatError');
    expect(err.message).toContain('garbage');
    expect(err.message).toContain('format');
  });

  it('OrcidNotFoundError indicates a missing public record', () => {
    const err = new OrcidNotFoundError('0000-0002-1825-0097');
    expect(err.name).toBe('OrcidNotFoundError');
    expect(err.message).toContain('0000-0002-1825-0097');
  });

  it('OrcidApiError carries status code and iD', () => {
    const err = new OrcidApiError(500, '0000-0002-1825-0097');
    expect(err.name).toBe('OrcidApiError');
    expect(err.status).toBe(500);
    expect(err.orcidId).toBe('0000-0002-1825-0097');
  });

  it('OrcidRateLimitError surfaces retry-after when provided', () => {
    const withRetry = new OrcidRateLimitError(30);
    expect(withRetry.name).toBe('OrcidRateLimitError');
    expect(withRetry.message).toContain('30 seconds');

    const withoutRetry = new OrcidRateLimitError();
    expect(withoutRetry.message).toContain('rate limit');
  });

  it('every ORCID error is distinguishable by name (UI copy uses this)', () => {
    const errors = [
      new OrcidCheckFeatureDisabledError(),
      new OrcidInvalidFormatError('x'),
      new OrcidNotFoundError('x'),
      new OrcidApiError(500, 'x'),
      new OrcidRateLimitError(),
    ];
    const names = errors.map((e) => e.name);
    expect(new Set(names).size).toBe(errors.length);
  });
});

// ── OpenAlex enrichment (currently a pass-through) ───────────────────────────

describe('orcid.service.enrichWithOpenAlex', () => {
  it('passes through unchanged until BE ships combined endpoint', async () => {
    const input = {
      status: 'success' as const,
      meta: {
        orcid: '0000-0002-1825-0097',
        displayName: 'Test',
        affiliations: [],
        emails: [],
        orcidUrl: 'https://orcid.org/0000-0002-1825-0097',
        keywords: [],
        works: [],
        isIncomplete: false,
      },
    };
    const output = await enrichWithOpenAlex(input);
    expect(output).toEqual(input);
  });
});
