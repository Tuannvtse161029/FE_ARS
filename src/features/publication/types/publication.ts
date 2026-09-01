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
  researcherVerificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
  adminNote?: string;
  researcherFeedback?: string;
  reviewRequestId?: number;
  reviewerId?: number;
  reviewDeadline?: string;
  assignmentCreatedAt?: string;
  reviewType?: string | null;
  aiRecommended?: boolean | null;
}

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
  status === 'PUBLISHED' || status === 'ADMIN_REJECTED' || status === 'WITHDRAWN';

export const canAppearInPublicCatalog = (paper: PublicationPaper): boolean =>
  normalizePublicationStatus(paper.status) === 'PUBLISHED' && paper.visibility === 'PUBLIC';

export const publicReviewerName = (paper: Pick<PublicationPaper, 'reviewerIdentityPublic' | 'reviewer'>): string | null =>
  paper.reviewerIdentityPublic ? paper.reviewer?.reviewerName ?? null : null;

export const statusLabel = (status: PublicationStatus): string => {
  if (status === 'REVIEWER_RECOMMENDED_REJECT') return 'Reviewer Recommended Reject (Đề xuất từ chối)';
  if (status === 'REVIEWER_RECOMMENDED_ACCEPT') return 'Reviewer Recommended Accept (Đề xuất chấp nhận)';
  if (status === 'ADMIN_REJECTED') return 'Denied (Bị từ chối)';
  if (status === 'PUBLISHED') return 'Published (Đã xuất bản)';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
};
