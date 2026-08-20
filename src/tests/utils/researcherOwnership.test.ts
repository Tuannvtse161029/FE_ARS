/**
 * Tests for src/utils/researcherOwnership.ts — defense-in-depth
 * cross-account ownership predicates.
 *
 * These tests cover the documented ownership contract used by the
 * Researcher Paper and Review Request flows to filter records the BE
 * returns that do NOT belong to the authenticated researcher.
 */
import { describe, it, expect } from 'vitest';
import {
  isPaperOwnedBy,
  isPaperOwnedByOrUntagged,
  isReviewRequestOwnedBy,
  buildOwnedPaperIds,
} from '../../utils/researcherOwnership';
import type { Paper } from '../../services/paper.service';
import type { ReviewRequest } from '../../services/reviewRequest.service';

const makePaper = (overrides: Partial<Paper> = {}): Paper => ({
  id: '1',
  title: 'Untitled',
  status: 'Waiting for Review',
  ...overrides,
});

describe('isPaperOwnedBy', () => {
  it('returns true when paper.userId matches the authenticated user', () => {
    expect(isPaperOwnedBy(makePaper({ userId: 22 }), 22)).toBe(true);
  });

  it('returns true when only the legacy authorId matches', () => {
    expect(isPaperOwnedBy(makePaper({ authorId: 22 }), 22)).toBe(true);
  });

  it('returns false when ownership field disagrees with the authenticated user', () => {
    expect(isPaperOwnedBy(makePaper({ userId: 27 }), 22)).toBe(false);
  });

  it('returns false when both ownership fields disagree', () => {
    expect(
      isPaperOwnedBy(makePaper({ userId: 27, authorId: 27 }), 22),
    ).toBe(false);
  });

  it('returns false when the ownership field is missing (data leak signal)', () => {
    expect(isPaperOwnedBy(makePaper({ id: '99' }), 22)).toBe(false);
  });

  it('returns false when authenticatedUserId is null (no session)', () => {
    expect(isPaperOwnedBy(makePaper({ userId: 22 }), null)).toBe(false);
  });

  it('returns false when the record is null/undefined', () => {
    expect(isPaperOwnedBy(null, 22)).toBe(false);
    expect(isPaperOwnedBy(undefined, 22)).toBe(false);
  });

  it('accepts string-encoded numeric ids', () => {
    expect(isPaperOwnedBy(makePaper({ userId: '22' as unknown as number }), 22)).toBe(
      true,
    );
  });

  it('rejects mismatched string ids', () => {
    expect(
      isPaperOwnedBy(makePaper({ userId: '22abc' as unknown as number }), 22),
    ).toBe(false);
  });

  it('prioritises userId over authorId when both are present', () => {
    // userId disagrees, authorId agrees → drop (data leak signal).
    expect(
      isPaperOwnedBy(makePaper({ userId: 27, authorId: 22 }), 22),
    ).toBe(false);
  });
});

describe('isPaperOwnedByOrUntagged', () => {
  it('drops records that explicitly belong to another user', () => {
    expect(isPaperOwnedByOrUntagged(makePaper({ userId: 27 }), 22)).toBe(false);
  });

  it('keeps records without an ownership field (legacy BE behaviour)', () => {
    expect(isPaperOwnedByOrUntagged(makePaper({ id: '42' }), 22)).toBe(true);
  });

  it('still refuses when authenticatedUserId is null', () => {
    expect(isPaperOwnedByOrUntagged(makePaper({ id: '42' }), null)).toBe(false);
  });
});

describe('isReviewRequestOwnedBy', () => {
  const ownedPaperIds = new Set<number>([101, 102, 103]);

  it('returns true when paperId is in the owned set', () => {
    expect(
      isReviewRequestOwnedBy(
        { id: 1, paperId: 101, reviewerId: 7 } as ReviewRequest,
        ownedPaperIds,
      ),
    ).toBe(true);
  });

  it('returns false when paperId is not in the owned set (cross-account)', () => {
    expect(
      isReviewRequestOwnedBy(
        { id: 1, paperId: 999, reviewerId: 7 } as ReviewRequest,
        ownedPaperIds,
      ),
    ).toBe(false);
  });

  it('does NOT consider reviewerId as ownership', () => {
    // The reviewerId identifies the assigned reviewer, not the requester.
    // A request whose paperId is owned by us but whose reviewerId is
    // someone else is still ours.
    expect(
      isReviewRequestOwnedBy(
        { id: 1, paperId: 101, reviewerId: 999 } as ReviewRequest,
        ownedPaperIds,
      ),
    ).toBe(true);
  });

  it('returns false when the request has no paperId', () => {
    expect(
      isReviewRequestOwnedBy(
        { id: 1, reviewerId: 7 } as ReviewRequest,
        ownedPaperIds,
      ),
    ).toBe(false);
  });

  it('returns false when ownedPaperIds is empty', () => {
    expect(
      isReviewRequestOwnedBy(
        { id: 1, paperId: 101 } as ReviewRequest,
        new Set<number>(),
      ),
    ).toBe(false);
  });

  it('returns false for null/undefined request', () => {
    expect(isReviewRequestOwnedBy(null, ownedPaperIds)).toBe(false);
    expect(isReviewRequestOwnedBy(undefined, ownedPaperIds)).toBe(false);
  });
});

describe('buildOwnedPaperIds', () => {
  it('builds a Set of numeric ids from owned papers', () => {
    const ids = buildOwnedPaperIds(
      [
        makePaper({ id: '1', userId: 22 }),
        makePaper({ id: '2', authorId: 22 }),
        makePaper({ id: '3', userId: 27 }), // excluded
      ],
      22,
    );
    expect(ids).toEqual(new Set([1, 2]));
  });

  it('returns an empty set when authenticatedUserId is null', () => {
    const ids = buildOwnedPaperIds([makePaper({ userId: 22 })], null);
    expect(ids.size).toBe(0);
  });

  it('skips records without an id', () => {
    const ids = buildOwnedPaperIds(
      [makePaper({ id: '', userId: 22 })],
      22,
    );
    expect(ids.size).toBe(0);
  });
});