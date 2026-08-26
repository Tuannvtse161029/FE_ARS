// Reviewer evaluation criteria and local-only helpers.
//
// Coordinator authority: `docs/UI_PUBLICATION_FLOW_DECISIONS.md` §3 and
// `docs/PUBLICATION_FLOW_API_BLOCKERS.md` §3.4. The shared types in
// `src/features/publication/types/publication.ts` are frozen by the
// publication feature ownership matrix (§7 of UI_PUBLICATION_FLOW_DECISIONS.md)
// so this file lives under `reviewer/` and ONLY contributes additive
// constants used by the reviewer paper-view + evaluation form. It does
// not modify shared types, the adapter contract, or any path the
// Lead/Phase C contract owns.
//
// Each criterion carries:
//   - key: stable string used in the form state and as the dictionary
//     key on `PublicationReview.privateScores` (see publication.ts).
//   - label: human-readable label rendered in the UI.
//   - description: short guidance shown next to the input.
//   - min/max: integer score bounds (1-5 inclusive by default).
//
// Why these five? They are the standard peer-review rubric for academic
// research submissions across the venue types ARS supports (research
// article, methodology article, review). They mirror what an Admin
// expects to read in the private review panel that
// `AdminPaperSubmissionDetail` already surfaces.

export type ReviewerCriterionKey =
  | 'originality'
  | 'methodology'
  | 'clarity'
  | 'significance'
  | 'references';

export interface ReviewerCriterion {
  key: ReviewerCriterionKey;
  label: string;
  description: string;
  min: number;
  max: number;
}

export const REVIEWER_CRITERIA: ReadonlyArray<ReviewerCriterion> = [
  {
    key: 'originality',
    label: 'Originality',
    description: 'Novelty of the contribution; how much new ground the work covers.',
    min: 1,
    max: 5,
  },
  {
    key: 'methodology',
    label: 'Methodology',
    description: 'Soundness of the research design, methods, and analysis.',
    min: 1,
    max: 5,
  },
  {
    key: 'clarity',
    label: 'Clarity',
    description: 'Quality of writing, structure, figures, and reproducibility of the description.',
    min: 1,
    max: 5,
  },
  {
    key: 'significance',
    label: 'Significance',
    description: 'Importance and likely impact on the field and the target audience.',
    min: 1,
    max: 5,
  },
  {
    key: 'references',
    label: 'References',
    description: 'Coverage and balance of related work; appropriate citations.',
    min: 1,
    max: 5,
  },
];

export type ReviewerCriterionScores = Record<ReviewerCriterionKey, number>;

export const REVIEWER_RECOMMENDATIONS = [
  { value: 'ACCEPT', label: 'Accept' },
  { value: 'REVISION_REQUIRED', label: 'Revision required' },
  { value: 'REJECT', label: 'Reject' },
] as const;

export type ReviewerRecommendationValue =
  (typeof REVIEWER_RECOMMENDATIONS)[number]['value'];

export const DEFAULT_REVIEWER_RECOMMENDATION: ReviewerRecommendationValue =
  'ACCEPT';

export const buildEmptyCriterionScores = (): ReviewerCriterionScores => {
  const scores = {} as ReviewerCriterionScores;
  for (const criterion of REVIEWER_CRITERIA) {
    scores[criterion.key] = criterion.min;
  }
  return scores;
};

export const isCriterionScoreValid = (
  criterion: ReviewerCriterion,
  value: unknown,
): value is number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return value >= criterion.min && value <= criterion.max;
};

export const areAllCriterionScoresValid = (
  scores: Partial<Record<ReviewerCriterionKey, number>>,
): scores is ReviewerCriterionScores =>
  REVIEWER_CRITERIA.every((criterion) =>
    isCriterionScoreValid(criterion, scores[criterion.key]),
  );

// Local type for the form state. Lives here, not in shared types.
export interface ReviewerEvaluationDraft {
  scores: ReviewerCriterionScores;
  perCriterionNotes: Record<ReviewerCriterionKey, string>;
  privateComments: string;
  recommendation: ReviewerRecommendationValue;
}

export const buildEmptyEvaluationDraft = (): ReviewerEvaluationDraft => ({
  scores: buildEmptyCriterionScores(),
  perCriterionNotes: REVIEWER_CRITERIA.reduce(
    (acc, criterion) => ({ ...acc, [criterion.key]: '' }),
    {} as Record<ReviewerCriterionKey, string>,
  ),
  privateComments: '',
  recommendation: DEFAULT_REVIEWER_RECOMMENDATION,
});

// Privacy: this helper returns true when the reviewer should NOT see
// ANY pre-existing private review data on the page. The publication
// rule (`docs/PUBLICATION_FLOW_ARCHITECTURE_REVIEW.md` §10) keeps review
// content private to Admin + the submitting researcher. Reviewers see
// the paper metadata + their own form only; they must not read each
// other's bodies.
export const shouldRenderPrivatePriorReview = (status: string): boolean =>
  false;

// Status predicates — centralised so the detail page and the tests
// agree on what "actionable for evaluation" means.
//
// Actionable means:
//   - Admin has assigned the reviewer (REVIEWER_ASSIGNED), AND
//   - The reviewer has accepted (status advanced to UNDER_REVIEW).
// "Submitted" terminal states (REVIEWER_RECOMMENDED_*) must NOT show
// the form again — instead we render the post-submit awaiting-Admin
// copy (`docs/UI_PUBLICATION_FLOW_DECISIONS.md` §3).
export const isAwaitingReviewerResponse = (status: string): boolean =>
  status === 'REVIEWER_ASSIGNED';

export const isReviewerActionable = (status: string): boolean =>
  status === 'UNDER_REVIEW';

export const isReviewerSubmitted = (status: string): boolean =>
  status === 'REVIEWER_RECOMMENDED_ACCEPT' ||
  status === 'REVIEWER_RECOMMENDED_REJECT';
