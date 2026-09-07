export const PUBLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ADMIN_SCREENING',
  'RESEARCHER_VERIFICATION_REQUIRED',
  'READY_FOR_REVIEWER',
  'REVIEWER_ASSIGNED',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'RESUBMITTED',
  'REVIEWER_RECOMMENDED_ACCEPT',
  'REVIEWER_RECOMMENDED_REJECT',
  'ADMIN_APPROVED',
  'PUBLISHED',
  'INACTIVE',
  'ADMIN_REJECTED',
  'WITHDRAWN',
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type PublicationVisibility = 'PUBLIC' | 'PRIVATE';
export type ReviewerRecommendation = 'ACCEPT' | 'REVISION_REQUIRED' | 'REJECT';
export type DataSource = 'api' | 'demo';

export interface PublicationAuthor {
  id: string;
  name: string;
  institutionIds: string[];
  orcid?: string;
  order: number;
}

export interface PublicationInstitution {
  id: string;
  name: string;
}

export interface PublicationReview {
  reviewerName: string;
  recommendation: ReviewerRecommendation;
  privateComments: string;
  privateScores: Record<string, number>;
  privateNotes?: Record<string, string>;
  criteria1?: string | null;
  expandedCriteria1?: string | null;
  evaluationCriteria1?: string | null;
  criteria2?: string | null;
  expandedCriteria2?: string | null;
  evaluationCriteria2?: string | null;
  criteria3?: string | null;
  expandedCriteria3?: string | null;
  evaluationCriteria3?: string | null;
  submittedAt?: string;
}

export interface PublicationPaper {
  id: string;
  title: string;
  abstract: string;
  authors: PublicationAuthor[];
  institutions: PublicationInstitution[];
  subFieldId?: number | null;
  authorId?: number | null;
  doi?: string;
  openAlexId?: string;
  externalIdentifier?: string;
  publicationDate?: string;
  paperType: string;
  domain?: string;
  field?: string;
  subfield?: string;
  topics: string[];
  keywords: string[];
  fileUrl?: string;
  version: number | null;
  status: PublicationStatus;
  visibility: PublicationVisibility;
  createdAt: string;
  submittedAt?: string;
  publishedAt?: string;
  reviewer?: PublicationReview;
  reviewerIdentityPublic: boolean;
  researcherVerificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'ALLOW' | 'REJECTED';
  adminNote?: string;
  researcherFeedback?: string;
  reviewRequestId?: number;
  reviewerId?: number;
  reviewDeadline?: string;
  assignmentCreatedAt?: string;
  reviewType?: string | null;
  aiRecommended?: boolean | null;
}

export const isAuthorshipAllowed = (paper?: PublicationPaper | null): boolean => {
  if (!paper) return false;
  const status = (paper.researcherVerificationStatus || '').toUpperCase();
  return status === 'ALLOW' || status === 'ALLOWED' || status === 'VERIFIED';
};

export interface PublicationNotification {
  id: string;
  paperId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface CatalogQuery {
  page: number;
  pageSize: number;
  query?: string;
  domain?: string;
  field?: string;
  subfield?: string;
  topic?: string;
  sort?: 'PUBLISHED_DESC' | 'PUBLISHED_ASC' | 'TITLE_ASC';
}

export interface PagedPublicationResult {
  items: PublicationPaper[];
  totalCount: number;
  page: number;
  pageSize: number;
  dataSource: DataSource;
}

export interface SubmissionInput {
  title: string;
  abstract: string;
  authors: PublicationAuthor[];
  institutions: PublicationInstitution[];
  subFieldId?: number | null;
  doi?: string;
  openAlexId?: string;
  externalIdentifier?: string;
  publicationDate?: string;
  paperType: string;
  domain?: string;
  field?: string;
  subfield?: string;
  topics: string[];
  keywords: string[];
  fileUrl?: string;
}

export const normalizePublicationStatus = (status: string): PublicationStatus | null => {
  const normalized = status.trim().toUpperCase().replace(/[ -]+/g, '_');
  return (PUBLICATION_STATUSES as readonly string[]).includes(normalized)
    ? normalized as PublicationStatus
    : null;
};

export const isTerminalPublicationStatus = (status: PublicationStatus): boolean =>
  status === 'PUBLISHED' || status === 'INACTIVE' || status === 'ADMIN_REJECTED' || status === 'WITHDRAWN';

export const canAppearInPublicCatalog = (paper: PublicationPaper): boolean =>
  normalizePublicationStatus(paper.status) === 'PUBLISHED' && paper.visibility === 'PUBLIC';

export const publicReviewerName = (paper: Pick<PublicationPaper, 'reviewerIdentityPublic' | 'reviewer'>): string | null =>
  paper.reviewerIdentityPublic ? paper.reviewer?.reviewerName ?? null : null;

/**
 * Maps the BE's free-form review-assignment `type` to a human-readable label.
 * The BE currently emits raw enum tokens (e.g. `ManualAssigned`, `Editorial`,
 * `AiRecommended`). Surface friendly copy so the Researcher / Reviewer /
 * Admin surfaces never show token-shaped strings in production UI.
 *
 * Mapping:
 *   - `Editorial` / `ManualAssigned` / `Manual`  → "Assigned by an editor"
 *   - `AiRecommended` / `AI` / `Auto`            → "AI-recommended"
 *   - `Open` / `Public`                          → "Open invitation"
 *   - unknown / empty                              → "" (caller hides the field)
 */
export const reviewTypeLabel = (type: string | null | undefined): string => {
  if (!type) return '';
  const normalized = type.trim().toLowerCase();
  if (
    normalized === 'editorial' ||
    normalized === 'manualassigned' ||
    normalized === 'manual' ||
    normalized === 'editor'
  ) {
    return 'Assigned by an editor';
  }
  if (
    normalized === 'airecommended' ||
    normalized === 'ai' ||
    normalized === 'auto'
  ) {
    return 'AI-recommended';
  }
  if (normalized === 'open' || normalized === 'public') {
    return 'Open invitation';
  }
  // Unknown variant — render as a Title-Cased fallback so we never show
  // the raw token to end users.
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
};

export const statusLabel = (status: PublicationStatus): string => {
  if (status === 'REVIEWER_RECOMMENDED_REJECT') return 'Reviewer recommended rejection';
  if (status === 'REVIEWER_RECOMMENDED_ACCEPT') return 'Reviewer recommended acceptance';
  if (status === 'ADMIN_REJECTED') return 'Rejected';
  if (status === 'INACTIVE') return 'Inactive';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
};
