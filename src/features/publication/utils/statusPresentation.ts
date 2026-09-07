/**
 * statusPresentation.ts — Researcher Submitted Papers status labels
 *
 * Backend contract: the paper `status` field is a canonical PublicationStatus
 * string (SUBMITTED, REVIEWER_ASSIGNED, PUBLISHED, ADMIN_REJECTED,
 * REVIEWER_RECOMMENDED_REJECT, etc.). This module provides a pure label
 * layer for the "My Research Papers" listing surface.
 *
 * Rules:
 *  - No backend values are changed.
 *  - No display labels are sent to the API.
 *  - The five labels below are shown ONLY when the lifecycle semantics match.
 *  - Detailed lifecycle info is preserved in the paper detail view.
 *
 * Mapping:
 *  | Backend State                | Presentation Label                     | Color     |
 *  |------------------------------|---------------------------------------|-----------|
 *  | SUBMITTED                    | Submitted                             | Amber     |
 *  | REVIEWER_ASSIGNED            | Reviewer Assigned                     | Blue      |
 *  | PUBLISHED                    | Published                             | Green     |
 *  | ADMIN_REJECTED               | Admin Rejected                        | Red       |
 *  | REVIEWER_RECOMMENDED_REJECT  | Reviewer Recommended Improvement       | Purple    |
 *
 * All other statuses fall through to a neutral "Unknown" variant.
 */

import type { PublicationStatus } from '../types/publication';

/** The five researcher-list presentation states. */
export type SubmittedPaperTone =
  | 'submitted'   // Amber — waiting for admin action
  | 'assigned'    // Blue  — reviewer has been assigned
  | 'published'   // Green — paper is published in the catalog
  | 'rejected'    // Red   — admin has rejected the paper
  | 'improvement' // Purple — reviewer recommended improvement/revision
  | 'unknown';    // Grey  — catches all other BE states

export interface SubmittedPaperLabel {
  label: string;
  /** CSS variable token used for the badge background and text color */
  tone: SubmittedPaperTone;
}

/** Maps backend PublicationStatus → display label + visual tone.
 *  Unknown statuses fall through to a muted "Unknown" badge. */
export const SUBMITTED_PAPER_STATUS_MAP: Record<
  PublicationStatus,
  SubmittedPaperLabel
> = {
  // ── The five listable researcher-paper states ──────────────────
  SUBMITTED: {
    label: 'Submitted',
    tone: 'submitted',
  },
  REVIEWER_ASSIGNED: {
    label: 'Reviewer Assigned',
    tone: 'assigned',
  },
  PUBLISHED: {
    label: 'Published',
    tone: 'published',
  },
  ADMIN_REJECTED: {
    label: 'Admin Rejected',
    tone: 'rejected',
  },
  REVIEWER_RECOMMENDED_REJECT: {
    label: 'Reviewer Recommended Improvement',
    tone: 'improvement',
  },

  // ── All other BE states — shown as "Unknown" in the list ──────
  // These are still loaded; they surface in the detail view.
  DRAFT:                           { label: 'Draft',                           tone: 'unknown' },
  ADMIN_SCREENING:                 { label: 'Admin Screening',                 tone: 'unknown' },
  RESEARCHER_VERIFICATION_REQUIRED: { label: 'Authorship Verification Needed',  tone: 'unknown' },
  READY_FOR_REVIEWER:              { label: 'Ready for Reviewer',               tone: 'unknown' },
  UNDER_REVIEW:                    { label: 'Under Review',                     tone: 'unknown' },
  REVISION_REQUIRED:               { label: 'Revision Required',                 tone: 'unknown' },
  RESUBMITTED:                     { label: 'Resubmitted',                      tone: 'unknown' },
  REVIEWER_RECOMMENDED_ACCEPT:     { label: 'Reviewer Recommended Accept',      tone: 'unknown' },
  ADMIN_APPROVED:                  { label: 'Admin Approved',                   tone: 'unknown' },
  WITHDRAWN:                       { label: 'Withdrawn',                        tone: 'unknown' },
  INACTIVE:                        { label: 'Inactive',                         tone: 'unknown' },
};

/** Returns the display label for a paper status.
 *  Falls back to the raw BE string formatted as Title Case for unknown values. */
export const getSubmittedPaperLabel = (status: PublicationStatus): string =>
  SUBMITTED_PAPER_STATUS_MAP[status]?.label ??
  status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Returns the visual tone for a paper status. */
export const getSubmittedPaperTone = (status: PublicationStatus): SubmittedPaperTone =>
  SUBMITTED_PAPER_STATUS_MAP[status]?.tone ?? 'unknown';
