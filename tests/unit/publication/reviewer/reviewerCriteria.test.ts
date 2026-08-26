import { describe, expect, it, vi } from 'vitest';
import { REVIEWER_CRITERIA } from '../../../../src/features/publication/reviewer/reviewerCriteria';
import {
  areAllCriterionScoresValid,
  buildEmptyCriterionScores,
  buildEmptyEvaluationDraft,
  isAwaitingReviewerResponse,
  isCriterionScoreValid,
  isReviewerActionable,
  isReviewerSubmitted,
  shouldRenderPrivatePriorReview,
} from '../../../../src/features/publication/reviewer/reviewerCriteria';

describe('Reviewer criteria module', () => {
  it('exposes the five canonical peer-review criteria', () => {
    expect(REVIEWER_CRITERIA.map((c) => c.key)).toEqual([
      'originality',
      'methodology',
      'clarity',
      'significance',
      'references',
    ]);
    expect(REVIEWER_CRITERIA.every((c) => c.min >= 1 && c.max <= 5)).toBe(true);
  });

  it('builds an empty score record with all criteria defaulted to min', () => {
    const scores = buildEmptyCriterionScores();
    for (const criterion of REVIEWER_CRITERIA) {
      expect(scores[criterion.key]).toBe(criterion.min);
    }
  });

  it('validates criterion scores inside the [min, max] range', () => {
    const criterion = REVIEWER_CRITERIA[0]!;
    expect(isCriterionScoreValid(criterion, criterion.min)).toBe(true);
    expect(isCriterionScoreValid(criterion, criterion.max)).toBe(true);
    expect(isCriterionScoreValid(criterion, criterion.max + 1)).toBe(false);
    expect(isCriterionScoreValid(criterion, criterion.min - 1)).toBe(false);
    expect(isCriterionScoreValid(criterion, Number.NaN)).toBe(false);
    expect(isCriterionScoreValid(criterion, '3' as unknown as number)).toBe(false);
  });

  it('reports all scores valid only when every criterion has a valid score', () => {
    const scores = buildEmptyCriterionScores();
    expect(areAllCriterionScoresValid(scores)).toBe(true);
    const broken: Record<string, number> = { ...scores, methodology: 99 };
    expect(areAllCriterionScoresValid(broken)).toBe(false);
  });

  it('seeds an empty evaluation draft with default recommendation', () => {
    const draft = buildEmptyEvaluationDraft();
    expect(draft.recommendation).toBe('ACCEPT');
    expect(draft.privateComments).toBe('');
    for (const criterion of REVIEWER_CRITERIA) {
      expect(draft.perCriterionNotes[criterion.key]).toBe('');
      expect(draft.scores[criterion.key]).toBe(criterion.min);
    }
  });

  it('classifies status predicates consistently with coordinator spec', () => {
    expect(isAwaitingReviewerResponse('REVIEWER_ASSIGNED')).toBe(true);
    expect(isAwaitingReviewerResponse('UNDER_REVIEW')).toBe(false);
    expect(isReviewerActionable('UNDER_REVIEW')).toBe(true);
    expect(isReviewerActionable('REVIEWER_ASSIGNED')).toBe(false);
    expect(isReviewerSubmitted('REVIEWER_RECOMMENDED_ACCEPT')).toBe(true);
    expect(isReviewerSubmitted('REVIEWER_RECOMMENDED_REJECT')).toBe(true);
    expect(isReviewerSubmitted('UNDER_REVIEW')).toBe(false);
  });

  it('never allows prior reviewer private content to render', () => {
    expect(shouldRenderPrivatePriorReview('UNDER_REVIEW')).toBe(false);
    expect(shouldRenderPrivatePriorReview('REVIEWER_ASSIGNED')).toBe(false);
    expect(shouldRenderPrivatePriorReview('REVIEWER_RECOMMENDED_ACCEPT')).toBe(false);
    expect(shouldRenderPrivatePriorReview('REVIEWER_RECOMMENDED_REJECT')).toBe(false);
    expect(shouldRenderPrivatePriorReview('PUBLISHED')).toBe(false);
  });

  // Sanity: we never accidentally bind `vi` to unused names by importing
  // the default; this keeps the test module ESM-compatible with the
  // rest of the suite.
  it('imports vi from vitest', () => {
    expect(vi).toBeTypeOf('object');
  });
});
