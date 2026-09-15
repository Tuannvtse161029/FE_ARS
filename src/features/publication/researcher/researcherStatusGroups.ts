/**
 * researcherStatusGroups.ts — Researcher "My Research Papers" filter buckets
 *
 * Five user-facing buckets are exposed in the filter bar:
 *   Pending       — submitted; waiting on admin/reviewer (all in-flight states)
 *   Verified      — admin verified the paper successfully
 *   Invalid       — admin rejected; missing/incorrect information
 *   Published     — paper is live in the public catalog
 *   Need Revision — reviewer recommended reject; admin decided not to publish
 *
 * `ALL` shows every paper regardless of status (including DRAFT, WITHDRAWN,
 * INACTIVE, REVIEWER_RECOMMENDED_ACCEPT). Selecting a specific bucket shows
 * only the papers whose backend status maps to that bucket.
 *
 * Mapping source-of-truth = this file. Both the filter bar and the row
 * status badge derive from `toResearcherBucket()`.
 */

import type { PublicationStatus } from '../types/publication';

/** Five user-facing bucket ids plus the catch-all 'ALL'. */
export type ResearcherBucket =
  | 'Pending'
  | 'Verified'
  | 'Invalid'
  | 'Published'
  | 'Need Revision'
  | 'ALL';

/** Visual tone used by the status badge — reuses the publication palette. */
export type ResearcherBucketTone =
  | 'pending'    // amber  — waiting on admin/reviewer
  | 'verified'   // blue   — admin approved
  | 'invalid'    // red    — admin rejected
  | 'published'  // green  — published in catalog
  | 'needRevision' // purple — reviewer recommended reject
  | 'other';     // grey   — buckets not in the named set (DRAFT, WITHDRAWN…)

export interface ResearcherBucketMeta {
  value: ResearcherBucket;
  /** i18n key for the bucket label (label only). */
  labelKey: string;
  /** i18n key for the descriptive tooltip / aria-description. */
  descriptionKey: string;
  tone: ResearcherBucketTone;
}

/**
 * Mapping table: canonical PublicationStatus → researcher bucket id.
 * Any status not listed falls through to `null`, meaning it should only
 * be visible under the `ALL` filter (DRAFT, WITHDRAWN, INACTIVE, etc.).
 */
const STATUS_TO_BUCKET: Partial<Record<PublicationStatus, Exclude<ResearcherBucket, 'ALL'>>> = {
  // Pending — covers every in-flight lifecycle state for the researcher.
  SUBMITTED: 'Pending',
  ADMIN_SCREENING: 'Pending',
  RESEARCHER_VERIFICATION_REQUIRED: 'Pending',
  READY_FOR_REVIEWER: 'Pending',
  REVIEWER_ASSIGNED: 'Pending',
  UNDER_REVIEW: 'Pending',
  REVISION_REQUIRED: 'Pending',
  RESUBMITTED: 'Pending',
  // Verified — admin verified the paper successfully.
  ADMIN_APPROVED: 'Verified',
  // Invalid — admin rejected the paper.
  ADMIN_REJECTED: 'Invalid',
  // Published — paper is live in the public catalog.
  PUBLISHED: 'Published',
  // Need Revision — reviewer recommended reject; admin decided not to publish.
  REVIEWER_RECOMMENDED_REJECT: 'Need Revision',
  // Remaining statuses (DRAFT, REVIEWER_RECOMMENDED_ACCEPT, WITHDRAWN,
  // INACTIVE) intentionally fall through to null — they appear only when
  // the user picks the ALL bucket.
};

/** Returns the bucket a backend status falls into, or null if it doesn't. */
export const toResearcherBucket = (
  status: PublicationStatus,
): Exclude<ResearcherBucket, 'ALL'> | null => STATUS_TO_BUCKET[status] ?? null;

/** Returns the visual tone for a backend status under the bucket system. */
export const toResearcherBucketTone = (status: PublicationStatus): ResearcherBucketTone => {
  const bucket = toResearcherBucket(status);
  if (!bucket) return 'other';
  return RESEARCHER_BUCKETS[bucket].tone;
};

/**
 * Ordered filter options displayed in the Researcher's status tab bar.
 * Order matters — this is the rendering order from left to right.
 */
export const RESEARCHER_STATUS_FILTER_OPTIONS: ReadonlyArray<ResearcherBucketMeta> = [
  {
    value: 'ALL',
    labelKey: 'researcher.submissions.bucket.all',
    descriptionKey: 'researcher.submissions.bucket.desc.all',
    tone: 'other',
  },
  {
    value: 'Pending',
    labelKey: 'researcher.submissions.bucket.pending',
    descriptionKey: 'researcher.submissions.bucket.desc.pending',
    tone: 'pending',
  },
  {
    value: 'Verified',
    labelKey: 'researcher.submissions.bucket.verified',
    descriptionKey: 'researcher.submissions.bucket.desc.verified',
    tone: 'verified',
  },
  {
    value: 'Invalid',
    labelKey: 'researcher.submissions.bucket.invalid',
    descriptionKey: 'researcher.submissions.bucket.desc.invalid',
    tone: 'invalid',
  },
  {
    value: 'Published',
    labelKey: 'researcher.submissions.bucket.published',
    descriptionKey: 'researcher.submissions.bucket.desc.published',
    tone: 'published',
  },
  {
    value: 'Need Revision',
    labelKey: 'researcher.submissions.bucket.needRevision',
    descriptionKey: 'researcher.submissions.bucket.desc.needRevision',
    tone: 'needRevision',
  },
];

/** Lookup table for bucket metadata by value. */
export const RESEARCHER_BUCKETS: Record<
  Exclude<ResearcherBucket, 'ALL'>,
  ResearcherBucketMeta
> = {
  Pending: {
    value: 'Pending',
    labelKey: 'researcher.submissions.bucket.pending',
    descriptionKey: 'researcher.submissions.bucket.desc.pending',
    tone: 'pending',
  },
  Verified: {
    value: 'Verified',
    labelKey: 'researcher.submissions.bucket.verified',
    descriptionKey: 'researcher.submissions.bucket.desc.verified',
    tone: 'verified',
  },
  Invalid: {
    value: 'Invalid',
    labelKey: 'researcher.submissions.bucket.invalid',
    descriptionKey: 'researcher.submissions.bucket.desc.invalid',
    tone: 'invalid',
  },
  Published: {
    value: 'Published',
    labelKey: 'researcher.submissions.bucket.published',
    descriptionKey: 'researcher.submissions.bucket.desc.published',
    tone: 'published',
  },
  'Need Revision': {
    value: 'Need Revision',
    labelKey: 'researcher.submissions.bucket.needRevision',
    descriptionKey: 'researcher.submissions.bucket.desc.needRevision',
    tone: 'needRevision',
  },
};

/** Human-readable bucket label for a backend status (or "Other" / raw status). */
export const getResearcherBucketLabel = (
  status: PublicationStatus,
): string => {
  const bucket = toResearcherBucket(status);
  if (!bucket) return 'Other';
  return bucket;
};
