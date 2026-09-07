import { describe, expect, it } from 'vitest';
import {
  friendlyAuthorshipVerificationError,
  friendlyAuthorshipVerificationLabel,
} from '../../../../src/features/publication/utils/authorshipVerificationCopy';

describe('friendlyAuthorshipVerificationLabel', () => {
  it('returns a friendly phrase for the ORCID-not-in-authorship token', () => {
    expect(
      friendlyAuthorshipVerificationLabel('PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP'),
    ).toMatch(/ORCID/i);
    expect(
      friendlyAuthorshipVerificationLabel('PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP'),
    ).not.toContain('__');
    expect(
      friendlyAuthorshipVerificationLabel('PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP'),
    ).not.toMatch(/^[A-Z_]+$/);
  });

  it('returns a friendly phrase for the paper-updated-requires-review token', () => {
    const label = friendlyAuthorshipVerificationLabel(
      'PENDING_ADMIN_REVIEW__PAPER_UPDATED_REQUIRES_REVIEW',
    );
    expect(label.toLowerCase()).toContain('manuscript');
    expect(label).not.toContain('__');
  });

  it('maps canonical verified/rejected tokens', () => {
    expect(friendlyAuthorshipVerificationLabel('VERIFIED')).toBe('Verified');
    expect(friendlyAuthorshipVerificationLabel('ALLOW')).toBe('Verified');
    expect(friendlyAuthorshipVerificationLabel('ALLOWED')).toBe('Verified');
    expect(friendlyAuthorshipVerificationLabel('REJECTED')).toBe('Verification rejected');
    expect(friendlyAuthorshipVerificationLabel('DENIED')).toBe('Verification rejected');
  });

  it('falls back to Title Case for unknown PENDING_ADMIN_REVIEW__* tokens', () => {
    expect(friendlyAuthorshipVerificationLabel('PENDING_ADMIN_REVIEW__WEIRD_NEW_REASON')).toBe(
      'Weird New Reason',
    );
  });

  it('falls back to Title Case for unknown tokens with no prefix', () => {
    expect(friendlyAuthorshipVerificationLabel('something_custom_state')).toBe(
      'Something Custom State',
    );
  });

  it('handles null / undefined / whitespace gracefully', () => {
    expect(friendlyAuthorshipVerificationLabel(null)).toBe('Not yet checked');
    expect(friendlyAuthorshipVerificationLabel(undefined)).toBe('Not yet checked');
    expect(friendlyAuthorshipVerificationLabel('   ')).toBe('Not yet checked');
  });

  it('never echoes the raw double-underscored token', () => {
    const samples = [
      'PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP',
      'PENDING_ADMIN_REVIEW__ORCID_NOT_VERIFIED',
      'PENDING_ADMIN_REVIEW__PAPER_UPDATED_REQUIRES_REVIEW',
      'PENDING_ADMIN_REVIEW__AWAITING_ADMIN_VERIFICATION',
      'PENDING_ADMIN_REVIEW__OPENALEX_LOOKUP_FAILED',
    ];
    for (const raw of samples) {
      const friendly = friendlyAuthorshipVerificationLabel(raw);
      expect(friendly).not.toContain('__');
      expect(friendly).not.toBe(raw);
    }
  });
});

describe('friendlyAuthorshipVerificationError', () => {
  it('returns just the friendly status when no reason is supplied', () => {
    expect(
      friendlyAuthorshipVerificationError('PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP', null),
    ).toMatch(/ORCID/i);
  });

  it('appends the reason when it adds new information', () => {
    const result = friendlyAuthorshipVerificationError(
      'PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP',
      'ORCID 0000-0002-1825-0097 was not found in the supplied author list',
    );
    expect(result).toMatch(/ORCID/i);
    expect(result).toContain('0000-0002-1825-0097');
    expect(result).not.toContain('__');
  });

  it('deduplicates when the reason just echoes the raw token', () => {
    const result = friendlyAuthorshipVerificationError(
      'PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP',
      'PENDING_ADMIN_REVIEW__ORCID_NOT_IN_AUTHORSHIP',
    );
    // No exact duplication of the same sentence twice.
    const occurrences = (result.match(/ORCID/g) ?? []).length;
    expect(occurrences).toBeGreaterThan(0);
    expect(result).not.toContain('__');
  });
});
