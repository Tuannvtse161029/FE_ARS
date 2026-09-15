import { describe, expect, it } from 'vitest';
import {
  PUBLICATION_STATUSES,
  type PublicationStatus,
} from '../../../../src/features/publication/types/publication';
import {
  RESEARCHER_BUCKETS,
  RESEARCHER_STATUS_FILTER_OPTIONS,
  toResearcherBucket,
  toResearcherBucketTone,
  getResearcherBucketLabel,
} from '../../../../src/features/publication/researcher/researcherStatusGroups';

describe('researcherStatusGroups', () => {
  describe('toResearcherBucket — status mapping', () => {
    it('maps every Pending lifecycle status into the Pending bucket', () => {
      const pendingStatuses: PublicationStatus[] = [
        'SUBMITTED',
        'ADMIN_SCREENING',
        'RESEARCHER_VERIFICATION_REQUIRED',
        'READY_FOR_REVIEWER',
        'REVIEWER_ASSIGNED',
        'UNDER_REVIEW',
        'REVISION_REQUIRED',
        'RESUBMITTED',
      ];
      for (const status of pendingStatuses) {
        expect(toResearcherBucket(status)).toBe('Pending');
      }
    });

    it('maps Verified only from ADMIN_APPROVED', () => {
      expect(toResearcherBucket('ADMIN_APPROVED')).toBe('Verified');
    });

    it('maps Invalid only from ADMIN_REJECTED', () => {
      expect(toResearcherBucket('ADMIN_REJECTED')).toBe('Invalid');
    });

    it('maps Published only from PUBLISHED', () => {
      expect(toResearcherBucket('PUBLISHED')).toBe('Published');
    });

    it('maps Need Revision only from REVIEWER_RECOMMENDED_REJECT', () => {
      expect(toResearcherBucket('REVIEWER_RECOMMENDED_REJECT')).toBe('Need Revision');
    });

    it('returns null for statuses that should only appear under ALL', () => {
      const otherStatuses: PublicationStatus[] = ['DRAFT', 'WITHDRAWN', 'INACTIVE', 'REVIEWER_RECOMMENDED_ACCEPT'];
      for (const status of otherStatuses) {
        expect(toResearcherBucket(status)).toBeNull();
      }
    });

    it('covers every PublicationStatus in PUBLICATION_STATUSES', () => {
      // Sanity: ensures no BE status is silently dropped by the mapper.
      for (const status of PUBLICATION_STATUSES) {
        // Either maps to a named bucket or returns null (visible only under ALL).
        expect([null, ...Object.keys(RESEARCHER_BUCKETS)]).toContain(
          toResearcherBucket(status),
        );
      }
    });
  });

  describe('toResearcherBucketTone', () => {
    it('returns "other" for unmapped statuses', () => {
      expect(toResearcherBucketTone('DRAFT')).toBe('other');
      expect(toResearcherBucketTone('WITHDRAWN')).toBe('other');
    });

    it('returns the matching bucket tone for each named bucket', () => {
      expect(toResearcherBucketTone('SUBMITTED')).toBe('pending');
      expect(toResearcherBucketTone('ADMIN_APPROVED')).toBe('verified');
      expect(toResearcherBucketTone('ADMIN_REJECTED')).toBe('invalid');
      expect(toResearcherBucketTone('PUBLISHED')).toBe('published');
      expect(toResearcherBucketTone('REVIEWER_RECOMMENDED_REJECT')).toBe('needRevision');
    });
  });

  describe('RESEARCHER_STATUS_FILTER_OPTIONS', () => {
    it('exposes exactly 6 options (ALL + 5 buckets) in the documented order', () => {
      expect(RESEARCHER_STATUS_FILTER_OPTIONS).toHaveLength(6);
      expect(RESEARCHER_STATUS_FILTER_OPTIONS.map((opt) => opt.value)).toEqual([
        'ALL',
        'Pending',
        'Verified',
        'Invalid',
        'Published',
        'Need Revision',
      ]);
    });

    it('each option carries a labelKey and descriptionKey', () => {
      for (const opt of RESEARCHER_STATUS_FILTER_OPTIONS) {
        expect(typeof opt.labelKey).toBe('string');
        expect(opt.labelKey.length).toBeGreaterThan(0);
        expect(typeof opt.descriptionKey).toBe('string');
        expect(opt.descriptionKey.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getResearcherBucketLabel', () => {
    it('returns the bucket name when mapped', () => {
      expect(getResearcherBucketLabel('PUBLISHED')).toBe('Published');
    });
    it('returns "Other" for unmapped statuses', () => {
      expect(getResearcherBucketLabel('DRAFT')).toBe('Other');
      expect(getResearcherBucketLabel('WITHDRAWN')).toBe('Other');
    });
  });
});
