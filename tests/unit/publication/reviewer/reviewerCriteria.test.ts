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
    // Note: max was updated from 5 to 10 per the reviewer form design requirements
    expect(REVIEWER_CRITERIA.every((c) => c.min >= 1 && c.max <= 10)).toBe(true);
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

  it('seeds an empty evaluation draft with no default recommendation', () => {
    // Pre-2026-09 the form defaulted to 'ACCEPT', which caused the Admin
    // editorial record to surface "Recommendation: ACCEPT" before the
    // reviewer had actually chosen anything. The recommendation is now
    // an explicit reviewer-authored choice, so the empty draft starts
    // blank — submission is blocked until the reviewer picks a real
    // value in requiredFieldsComplete().
    const draft = buildEmptyEvaluationDraft();
    expect(draft.recommendation).toBe('');
    expect(draft.privateComments).toBe('');
    for (const criterion of REVIEWER_CRITERIA) {
      expect(draft.perCriterionNotes[criterion.key]).toBe('');
      expect(draft.scores[criterion.key]).toBe(criterion.min);
    }
  });

  it('localizes criterion label and description keys through the i18n dictionary', () => {
    // The English copy used to ship bilingual labels
    // ("Originality (Tính độc đáo)"), forcing Vietnamese copy into the
    // English UI. Labels and descriptions are now dictionary keys so
    // the active locale controls rendering.
    for (const criterion of REVIEWER_CRITERIA) {
      expect(criterion.label).toMatch(/^reviewer\.criterion\.[a-z]+\.label$/);
      expect(criterion.description).toMatch(
        /^reviewer\.criterion\.[a-z]+\.description$/,
      );
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
