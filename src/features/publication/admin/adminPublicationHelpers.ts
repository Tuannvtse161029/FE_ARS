/* Admin Publication helpers
   Pure helpers shared across the admin publication pages. No React,
   no DOM. Kept here (instead of in src/utils) so the helpers stay
   owned by the publication feature. */

import type { PublicationPaper, PublicationStatus, PublicationVisibility } from '../types/publication';

export interface AdminPaperFilters {
  search: string;
  status: PublicationStatus | 'ALL';
  verification: 'ALL' | PublicationPaper['researcherVerificationStatus'];
}

export interface AdminPaperQuery {
  page: number;
  pageSize: number;
  filters: AdminPaperFilters;
}

export interface AdminPaperPaging {
  items: PublicationPaper[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const ADMIN_PAGE_SIZE = 10;

export const DEFAULT_ADMIN_FILTERS: AdminPaperFilters = {
  search: '',
  status: 'ALL',
  verification: 'ALL',
};

/**
 * Normalize free-text for case-insensitive contains matching.
 * Empty / whitespace-only input is treated as the absence of a search term.
 */
const normalize = (value: string | undefined | null): string => (value ?? '').trim().toLowerCase();

/**
 * Resolve the identifiers (DOI / OpenAlex / external) the admin table renders.
 * Returns null when none are supplied so callers can render an "unspecified" state.
 */
export interface PaperIdentifiers {
  doi: string | undefined;
  openAlexId: string | undefined;
  externalIdentifier: string | undefined;
}

export const resolveIdentifiers = (paper: PublicationPaper): PaperIdentifiers => ({
  doi: paper.doi,
  openAlexId: paper.openAlexId,
  externalIdentifier: paper.externalIdentifier,
});

/**
 * Build a stable DOI URL when the supplied DOI looks like a real DOI handle.
 * Falls back to a plain text label for non-canonical DOIs.
 * placeholders). The admin surface never links out to user-supplied URLs.
 */
export const doiHref = (doi: string | undefined): string | null => {
  if (!doi) return null;
  const trimmed = doi.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith('10.')) return `https://doi.org/${trimmed}`;
  return null;
};

/**
 * Search across all of the metadata an Admin might scan for.
 * Title, abstract, identifiers, taxonomy, authors, institutions.
 */
const buildSearchHaystack = (paper: PublicationPaper): string => {
  const identifiers = resolveIdentifiers(paper);
  return [
    paper.title,
    paper.abstract,
    identifiers.doi,
    identifiers.openAlexId,
    identifiers.externalIdentifier,
    paper.domain,
    paper.field,
    paper.subfield,
    paper.paperType,
    paper.adminNote,
    paper.researcherFeedback,
    ...paper.topics,
    ...paper.keywords,
    ...paper.authors.map((author) => author.name),
    ...paper.authors.map((author) => author.orcid ?? ''),
    ...paper.institutions.map((institution) => institution.name),
    paper.reviewer?.reviewerName ?? '',
  ]
    .filter(Boolean)
    .join(' \u2022 ')
    .toLowerCase();
};

export const matchesSearch = (paper: PublicationPaper, term: string): boolean => {
  if (!term) return true;
  return buildSearchHaystack(paper).includes(term);
};

export const matchesStatus = (paper: PublicationPaper, status: PublicationStatus | 'ALL'): boolean => {
  if (status === 'ALL') return true;
  return paper.status === status;
};

export const matchesVerification = (
  paper: PublicationPaper,
  verification: AdminPaperFilters['verification'],
): boolean => {
  if (verification === 'ALL') return true;
  if (verification === 'ALLOW' || verification === 'VERIFIED') {
    return paper.researcherVerificationStatus === 'ALLOW' || paper.researcherVerificationStatus === 'VERIFIED';
  }
  return paper.researcherVerificationStatus === verification;
};

/**
 * Apply admin filters to a paper collection and paginate the result.
 * Paging is performed client-side because the current generic API response does not
 * expose a paginated admin endpoint.
 */
export const paginateAdminPapers = (
  papers: PublicationPaper[],
  query: AdminPaperQuery,
): AdminPaperPaging => {
  const term = normalize(query.filters.search);
  const filtered = papers
    .filter((paper) => matchesStatus(paper, query.filters.status))
    .filter((paper) => matchesVerification(paper, query.filters.verification))
    .filter((paper) => matchesSearch(paper, term));

  const totalCount = filtered.length;
  const safePage = Math.max(1, Math.min(query.page, Math.max(1, Math.ceil(totalCount / query.pageSize))));
  const start = (safePage - 1) * query.pageSize;
  const items = filtered.slice(start, start + query.pageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
  return { items, totalCount, page: safePage, pageSize: query.pageSize, totalPages };
};

/**
 * Status class lookup. Mirrors the badge palette in the shared module.
 */
export const statusBadgeClass = (status: PublicationStatus): string => {
  switch (status) {
    case 'DRAFT': return 'statusDraft';
    case 'SUBMITTED': return 'statusSubmitted';
    case 'ADMIN_SCREENING': return 'statusScreening';
    case 'RESEARCHER_VERIFICATION_REQUIRED': return 'statusVerification';
    case 'READY_FOR_REVIEWER': return 'statusReady';
    case 'REVIEWER_ASSIGNED': return 'statusAssigned';
    case 'UNDER_REVIEW': return 'statusUnderReview';
    case 'REVISION_REQUIRED': return 'statusRevision';
    case 'RESUBMITTED': return 'statusResubmitted';
    case 'REVIEWER_RECOMMENDED_ACCEPT': return 'statusRecommendAccept';
    case 'REVIEWER_RECOMMENDED_REJECT': return 'statusRecommendReject';
    case 'ADMIN_APPROVED': return 'statusApproved';
    case 'PUBLISHED': return 'statusPublished';
    case 'INACTIVE': return 'statusInactive';
    case 'ADMIN_REJECTED': return 'statusRejected';
    case 'WITHDRAWN': return 'statusWithdrawn';
    default: return '';
  }
};

export const verificationBadgeClass = (
  status: PublicationPaper['researcherVerificationStatus'],
): string => {
  switch (status) {
    case 'ALLOW':
    case 'VERIFIED': return 'verificationVerified';
    case 'PENDING': return 'verificationPending';
    case 'REJECTED':
    case 'UNVERIFIED': return 'verificationUnverified';
    default: return 'verificationUnverified';
  }
};

/**
 * Admin-only review content. Reviewer private comments and criterion
 * scores MUST stay Admin-only. The catalog and researcher views already
 * never expose these fields; this helper exists so the admin page
 * itself cannot accidentally render private review content for a
 * published paper into a non-Admin context.
 */
export const isPrivateReview = (paper: PublicationPaper): boolean => {
  if (!paper.reviewer) return false;
  return paper.visibility === ('PRIVATE' satisfies PublicationVisibility)
    || paper.status !== 'PUBLISHED';
};

/**
 * Build the list of action areas an Admin can take for a given status.
 * Returns labels + a small hint message — the actual mutation is left
 * to the page because each admin action lives behind a different backend
 * contract (today only assignment and publish are exposed by the adapter).
 */
export interface AdminActionDescriptor {
  id: 'assign' | 'publish' | 'withdraw' | 'reject' | 'requestRevision';
  label: string;
  hint: string;
}

export const adminActionsForStatus = (paper: PublicationPaper): AdminActionDescriptor[] => {
  const list: AdminActionDescriptor[] = [];
  switch (paper.status) {
    case 'SUBMITTED':
    case 'ADMIN_SCREENING':
    case 'READY_FOR_REVIEWER':
    case 'RESEARCHER_VERIFICATION_REQUIRED':
      list.push({
        id: 'assign',
        label: 'Assign reviewer',
        hint: 'Pick a reviewer and a deadline. The status will advance to Reviewer Assigned.',
      });
      break;
    case 'REVIEWER_ASSIGNED':
    case 'UNDER_REVIEW':
      list.push({
        id: 'assign',
        label: 'Reassign reviewer',
        hint: 'Replace the existing reviewer. The status will reset to Reviewer Assigned.',
      });
      list.push({
        id: 'requestRevision',
        label: 'Request revision',
        hint: 'Send the paper back to the researcher for revisions.',
      });
      list.push({
        id: 'reject',
        label: 'Reject submission',
        hint: 'Terminate the submission with a published reason.',
      });
      break;
    case 'REVISION_REQUIRED':
    case 'RESUBMITTED':
      list.push({
        id: 'assign',
        label: 'Reassign reviewer',
        hint: 'Route the revised submission to a reviewer.',
      });
      list.push({
        id: 'reject',
        label: 'Reject submission',
        hint: 'Terminate the submission with a published reason.',
      });
      break;
    case 'REVIEWER_RECOMMENDED_ACCEPT':
      list.push({
        id: 'publish',
        label: 'Approve and publish',
        hint: 'Promotion to Published. The paper becomes part of the public catalog.',
      });
      list.push({
        id: 'requestRevision',
        label: 'Request revision',
        hint: 'Send the paper back to the researcher for revisions.',
      });
      list.push({
        id: 'reject',
        label: 'Reject submission',
        hint: 'Terminate the submission with a published reason.',
      });
      break;
    case 'REVIEWER_RECOMMENDED_REJECT':
      list.push({
        id: 'reject',
        label: 'Confirm rejection',
        hint: 'Confirm the reviewer recommendation. The submission will be terminated.',
      });
      list.push({
        id: 'requestRevision',
        label: 'Override and request revision',
        hint: 'Override the reviewer recommendation and send back for revisions.',
      });
      break;
    case 'ADMIN_APPROVED':
      list.push({
        id: 'publish',
        label: 'Publish',
        hint: 'Promote to Published. The paper becomes part of the public catalog.',
      });
      list.push({
        id: 'withdraw',
        label: 'Withdraw',
        hint: 'Pull the paper before publication. The submission will be terminated.',
      });
      break;
    case 'PUBLISHED':
      list.push({
        id: 'withdraw',
        label: 'Withdraw publication',
        hint: 'Take the paper off the public catalog. Withdrawal semantics are still BE-policy.',
      });
      break;
    case 'INACTIVE':
    case 'ADMIN_REJECTED':
    case 'WITHDRAWN':
    default:
      break;
  }
  return list;
};

export const canAssignReviewer = (paper: PublicationPaper): boolean => {
  return adminActionsForStatus(paper).some((action) => action.id === 'assign');
};

export const canPublish = (paper: PublicationPaper): boolean => {
  return adminActionsForStatus(paper).some((action) => action.id === 'publish');
};

export const canWithdraw = (paper: PublicationPaper): boolean => {
  return adminActionsForStatus(paper).some((action) => action.id === 'withdraw');
};

export const canRequestRevision = (paper: PublicationPaper): boolean => {
  return adminActionsForStatus(paper).some((action) => action.id === 'requestRevision');
};

export const canReject = (paper: PublicationPaper): boolean => {
  return adminActionsForStatus(paper).some((action) => action.id === 'reject');
};

/**
 * Public identifier policy. The home catalog enforces this on the
 * server side (per PUBLICATION_FLOW_API_BLOCKERS.md §3.7), but the
 * admin views also respect the same rule so an admin viewing the
 * detail page never copies reviewer name into a public surface by
 * accident.
 */
export const publicReviewerName = (paper: PublicationPaper): string | null =>
  paper.reviewerIdentityPublic ? paper.reviewer?.reviewerName ?? null : null;
