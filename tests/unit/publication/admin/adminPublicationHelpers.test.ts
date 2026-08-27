import { describe, expect, it } from 'vitest';
import { demoPublicationPapers } from '../../../../src/features/publication/demo/publication.demo';
import type { PublicationPaper } from '../../../../src/features/publication/types/publication';
import {
  adminActionsForStatus,
  canAssignReviewer,
  canPublish,
  canReject,
  canRequestRevision,
  canWithdraw,
  doiHref,
  isPrivateReview,
  paginateAdminPapers,
  publicReviewerName,
  resolveIdentifiers,
  statusBadgeClass,
  verificationBadgeClass,
} from '../../../../src/features/publication/admin/adminPublicationHelpers';

const clone = <Value,>(value: Value): Value => structuredClone(value);

const basePaper: PublicationPaper = clone(demoPublicationPapers[0]);

const buildPaper = (patch: Partial<PublicationPaper>): PublicationPaper => ({
  ...basePaper,
  id: 'synthetic',
  title: 'Synthetic',
  abstract: '',
  authors: [],
  institutions: [],
  topics: [],
  keywords: [],
  paperType: 'Research article',
  version: 1,
  visibility: 'PRIVATE',
  createdAt: '2026-08-01T00:00:00.000Z',
  reviewerIdentityPublic: false,
  researcherVerificationStatus: 'PENDING',
  ...patch,
});

describe('admin publication helpers', () => {
  describe('status-dependent actions', () => {
    it('exposes assign + no publish for SUBMITTED', () => {
      const paper = buildPaper({ status: 'SUBMITTED' });
      const ids = adminActionsForStatus(paper).map((action) => action.id);
      expect(ids).toContain('assign');
      expect(ids).not.toContain('publish');
      expect(canAssignReviewer(paper)).toBe(true);
      expect(canPublish(paper)).toBe(false);
    });

    it('exposes publish + revision + reject for REVIEWER_RECOMMENDED_ACCEPT', () => {
      const paper = buildPaper({ status: 'REVIEWER_RECOMMENDED_ACCEPT' });
      const ids = adminActionsForStatus(paper).map((action) => action.id);
      expect(ids).toEqual(expect.arrayContaining(['publish', 'requestRevision', 'reject']));
      expect(ids).not.toContain('assign');
      expect(canPublish(paper)).toBe(true);
      expect(canReject(paper)).toBe(true);
      expect(canRequestRevision(paper)).toBe(true);
      expect(canAssignReviewer(paper)).toBe(false);
    });

    it('exposes withdraw only for PUBLISHED', () => {
      const paper = buildPaper({ status: 'PUBLISHED', visibility: 'PUBLIC' });
      const ids = adminActionsForStatus(paper).map((action) => action.id);
      expect(ids).toEqual(['withdraw']);
      expect(canWithdraw(paper)).toBe(true);
      expect(canAssignReviewer(paper)).toBe(false);
      expect(canPublish(paper)).toBe(false);
    });

    it('exposes no actions for ADMIN_REJECTED or WITHDRAWN', () => {
      const rejected = buildPaper({ status: 'ADMIN_REJECTED' });
      const withdrawn = buildPaper({ status: 'WITHDRAWN' });
      expect(adminActionsForStatus(rejected)).toHaveLength(0);
      expect(adminActionsForStatus(withdrawn)).toHaveLength(0);
      expect(canPublish(rejected)).toBe(false);
      expect(canPublish(withdrawn)).toBe(false);
    });

    it('exposes publish for ADMIN_APPROVED and keeps withdraw available', () => {
      const paper = buildPaper({ status: 'ADMIN_APPROVED' });
      const ids = adminActionsForStatus(paper).map((action) => action.id);
      expect(ids).toEqual(expect.arrayContaining(['publish', 'withdraw']));
      expect(canPublish(paper)).toBe(true);
      expect(canWithdraw(paper)).toBe(true);
    });
  });

  describe('private review visibility', () => {
    it('treats draft / under-review papers as private review context', () => {
      expect(isPrivateReview(buildPaper({ status: 'DRAFT' }))).toBe(true);
      expect(isPrivateReview(buildPaper({ status: 'UNDER_REVIEW' }))).toBe(true);
      expect(isPrivateReview(buildPaper({ status: 'REVIEWER_ASSIGNED' }))).toBe(true);
    });

    it('treats PUBLISHED papers as non-private review context', () => {
      const published = buildPaper({ status: 'PUBLISHED', visibility: 'PUBLIC' });
      expect(isPrivateReview(published)).toBe(false);
    });

    it('returns false when there is no reviewer record', () => {
      const submitted = buildPaper({ status: 'SUBMITTED', reviewer: undefined });
      expect(isPrivateReview(submitted)).toBe(false);
    });
  });

  describe('reviewer identity public policy', () => {
    it('returns the reviewer name only when identity is public', () => {
      const publicReview = buildPaper({ status: 'PUBLISHED', visibility: 'PUBLIC', reviewerIdentityPublic: true, reviewer: { reviewerName: 'Dr. Le Quang Huy', recommendation: 'ACCEPT', privateComments: '', privateScores: {} } });
      const privateReview = buildPaper({ status: 'PUBLISHED', visibility: 'PUBLIC', reviewerIdentityPublic: false, reviewer: { reviewerName: 'Dr. Hidden', recommendation: 'ACCEPT', privateComments: '', privateScores: {} } });
      expect(publicReviewerName(publicReview)).toBe('Dr. Le Quang Huy');
      expect(publicReviewerName(privateReview)).toBeNull();
    });

    it('returns null when there is no reviewer record', () => {
      expect(publicReviewerName(buildPaper({ status: 'SUBMITTED' }))).toBeNull();
    });
  });

  describe('identifier resolution + DOI href', () => {
    it('builds a DOI URL only for canonical 10.* handles', () => {
      expect(doiHref('10.5555/ars.demo.2026.001')).toBe('https://doi.org/10.5555/ars.demo.2026.001');
      expect(doiHref('not-a-doi')).toBeNull();
      expect(doiHref(undefined)).toBeNull();
      expect(doiHref('   ')).toBeNull();
    });

    it('resolves identifiers off the paper', () => {
      const paper = buildPaper({ doi: '10.1/x', openAlexId: 'W123', externalIdentifier: 'arXiv:1' });
      expect(resolveIdentifiers(paper)).toEqual({ doi: '10.1/x', openAlexId: 'W123', externalIdentifier: 'arXiv:1' });
    });
  });

  describe('badge class lookups', () => {
    it('returns a defined badge class for every known status', () => {
      const allStatuses = [
        'DRAFT', 'SUBMITTED', 'ADMIN_SCREENING', 'RESEARCHER_VERIFICATION_REQUIRED',
        'READY_FOR_REVIEWER', 'REVIEWER_ASSIGNED', 'UNDER_REVIEW', 'REVISION_REQUIRED',
        'RESUBMITTED', 'REVIEWER_RECOMMENDED_ACCEPT', 'REVIEWER_RECOMMENDED_REJECT',
        'ADMIN_APPROVED', 'PUBLISHED', 'ADMIN_REJECTED', 'WITHDRAWN',
      ] as const;
      for (const status of allStatuses) {
        expect(statusBadgeClass(status)).toMatch(/^status/);
      }
    });

    it('maps verification values to a CSS class', () => {
      expect(verificationBadgeClass('VERIFIED')).toBe('verificationVerified');
      expect(verificationBadgeClass('PENDING')).toBe('verificationPending');
      expect(verificationBadgeClass('UNVERIFIED')).toBe('verificationUnverified');
    });
  });

  describe('paginateAdminPapers', () => {
    const papers: PublicationPaper[] = [
      buildPaper({ id: 'a', status: 'SUBMITTED', title: 'Alpha paper', researcherVerificationStatus: 'VERIFIED' }),
      buildPaper({ id: 'b', status: 'UNDER_REVIEW', title: 'Beta paper', researcherVerificationStatus: 'PENDING' }),
      buildPaper({ id: 'c', status: 'PUBLISHED', visibility: 'PUBLIC', title: 'Gamma paper', researcherVerificationStatus: 'UNVERIFIED' }),
      buildPaper({ id: 'd', status: 'ADMIN_REJECTED', title: 'Delta paper' }),
      buildPaper({ id: 'e', status: 'REVIEWER_ASSIGNED', title: 'Epsilon paper' }),
    ];

    it('respects the status filter', () => {
      const result = paginateAdminPapers(papers, { page: 1, pageSize: 50, filters: { search: '', status: 'UNDER_REVIEW', verification: 'ALL' } });
      expect(result.items.map((paper) => paper.id)).toEqual(['b']);
      expect(result.totalCount).toBe(1);
    });

    it('respects the verification filter', () => {
      const result = paginateAdminPapers(papers, { page: 1, pageSize: 50, filters: { search: '', status: 'ALL', verification: 'VERIFIED' } });
      expect(result.items.map((paper) => paper.id)).toEqual(['a']);
    });

    it('combines status + verification + search', () => {
      const result = paginateAdminPapers(papers, { page: 1, pageSize: 50, filters: { search: 'gamma', status: 'ALL', verification: 'UNVERIFIED' } });
      expect(result.items.map((paper) => paper.id)).toEqual(['c']);
    });

    it('paginates correctly', () => {
      const result = paginateAdminPapers(papers, { page: 2, pageSize: 2, filters: { search: '', status: 'ALL', verification: 'ALL' } });
      expect(result.items.map((paper) => paper.id)).toEqual(['c', 'd']);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(result.totalCount).toBe(5);
    });

    it('clamps page to the last valid page when overflowing', () => {
      const result = paginateAdminPapers(papers, { page: 99, pageSize: 2, filters: { search: '', status: 'ALL', verification: 'ALL' } });
      expect(result.page).toBe(3);
      expect(result.items.map((paper) => paper.id)).toEqual(['e']);
    });

    it('returns zero results for empty dataset', () => {
      const result = paginateAdminPapers([], { page: 1, pageSize: 10, filters: { search: '', status: 'ALL', verification: 'ALL' } });
      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(1);
    });
  });
});
