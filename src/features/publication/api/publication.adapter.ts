import {
  detailedEvaluationService,
  type DetailedEvaluation,
} from '../../../services/detailedEvaluation.service';
import { paperService, type Paper } from '../../../services/paper.service';
import {
  reviewRequestService,
  type ReviewRequest,
} from '../../../services/reviewRequest.service';
import { storage } from '../../../utils/storage';
import { normalizeReviewRequestStatus } from '../../../utils/reviewRequestPolicy';
import {
  normalizePublicationStatus,
  type CatalogQuery,
  type PagedPublicationResult,
  type PublicationPaper,
  type PublicationStatus,
  type ReviewerRecommendation,
  type SubmissionInput,
} from '../types/publication';
import { notificationService } from '../../../services/notification.service';
import type { FormattedRubricReference, SpecializedCriteriaBundle } from '../reviewer/evaluationCriteriaResolver';
import {
  friendlyAuthorshipVerificationError,
} from '../utils/authorshipVerificationCopy';
import { enrichPublicationMetadata } from './publicationMetadata';

/**
 * Stringify a structured `FormattedRubricReference` for the BE payload.
 *
 * Pre-2026-09 the BE schema (`DetailedEvaluation.evaluationCriteria1..3`)
 * stored a single free-form string. We upgraded the FE to a structured
 * object so we can localize the rendering without Vietnamese leaks, but
 * the BE contract still expects a string. This helper joins the
 * standard references with a localised separator while the page renders
 * them through `useT()` on its own. The reviewer sees i18n-correct copy
 * and the BE continues to receive the canonical string.
 */
const stringifyRubricReference = (ref: FormattedRubricReference | undefined | null): string | null => {
  if (!ref) return null;
  const parts: string[] = [];
  if (Array.isArray(ref.standardReferences) && ref.standardReferences.length > 0) {
    parts.push(ref.standardReferences.join('; '));
  }
  if (typeof ref.maxScore === 'number') {
    parts.push(`max=${ref.maxScore}`);
  }
  return parts.length > 0 ? parts.join(' | ') : null;
};
export class PublicationBackendContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicationBackendContractError';
  }
}

export interface PublicationAdapter {
  getPublicCatalog(query: CatalogQuery): Promise<PagedPublicationResult>;
  getResearcherSubmissions(): Promise<PublicationPaper[]>;
  getReviewerAssignments(): Promise<PublicationPaper[]>;
  getReviewerAssignmentById(assignmentId: string): Promise<PublicationPaper>;
  approveForReview(id: string): Promise<PublicationPaper>;
  reactivatePublishedPaper(id: string): Promise<PublicationPaper>;
  getAdminSubmissions(): Promise<PublicationPaper[]>;
  getPaperById(id: string): Promise<PublicationPaper>;
  createDraft(input: SubmissionInput, submitToAdmin?: boolean): Promise<PublicationPaper>;
  submitPaper(id: string): Promise<PublicationPaper>;
  respondToAssignment(id: string, accepted: boolean): Promise<PublicationPaper>;
  submitReview(
    id: string,
    recommendation: ReviewerRecommendation,
    privateComments: string,
    privateScores?: Record<string, number>,
    privateNotes?: Record<string, string>,
    specializedCriteria?: Partial<SpecializedCriteriaBundle>,
  ): Promise<PublicationPaper>;
  assignReviewer(id: string, reviewerId: number): Promise<PublicationPaper>;
  assignReviewers(id: string, reviewerIds: number[]): Promise<PublicationPaper>;
  assignReviewersAuto(id: string, reviewerCount?: number): Promise<unknown>;
  verifyAuthorship(id: string, allow?: boolean): Promise<PublicationPaper>;
  publishPaper(id: string): Promise<PublicationPaper>;
  rejectPaper(id: string, reason?: string): Promise<PublicationPaper>;
  deactivatePublishedPaper(id: string): Promise<PublicationPaper>;
}

const normalizedText = (value: string | null | undefined): string =>
  (value ?? '').trim().toUpperCase().replace(/[ -]+/g, '_');

const paperStatus = (value: string | null | undefined): PublicationStatus => {
  const direct = value ? normalizePublicationStatus(value) : null;
  if (direct) return direct;
  switch (normalizedText(value)) {
    case 'DRAFT':
      return 'DRAFT';
    case 'ACCEPTED':
    case 'APPROVED':
      return 'ADMIN_APPROVED';
    case 'INACTIVE':
      return 'INACTIVE';
    case 'REJECTED':
      return 'ADMIN_REJECTED';
    default:
      return 'SUBMITTED';
  }
};

const recommendationStatus = (
  evaluation: DetailedEvaluation | null,
): PublicationStatus => {
  const decision = normalizedText(evaluation?.finalDecision);
  return decision === 'REJECT'
    ? 'REVIEWER_RECOMMENDED_REJECT'
    : decision === 'REVISION_REQUIRED'
      ? 'REVISION_REQUIRED'
      : decision === 'ACCEPT' ? 'REVIEWER_RECOMMENDED_ACCEPT' : 'UNDER_REVIEW';
};

const assignmentStatus = (
  request: ReviewRequest | undefined,
  evaluation: DetailedEvaluation | null,
): PublicationStatus | null => {
  if (!request) return null;
  switch (normalizeReviewRequestStatus(request.status)) {
    case 'PENDING':
    case 'UNKNOWN':
      return 'REVIEWER_ASSIGNED';
    case 'IN_PROGRESS':
      return 'UNDER_REVIEW';
    case 'COMPLETED':
      return recommendationStatus(evaluation);
    case 'DECLINED':
    case 'CANCELLED':
      return 'READY_FOR_REVIEWER';
  }
};

/**
 * toPublicationPaper
 *
 * Maps the BE Paper response (and optional ReviewRequest / DetailedEvaluation
 * rows) onto the shared PublicationPaper shape used by every publication
 * surface. The mapping is intentionally additive — it never invents data,
 * it never reads from localStorage, and it never falls back to a fabricated
 * value when the BE column is missing.
 *
 * The pre-2026-09 implementation stored domain / field / subfield metadata
 * in localStorage as a workaround for the BE Paper response not returning
 * those columns. That workaround:
 *   1. Persisted across account / role changes, meaning a different user
 *      could see the previous user's locally-pinned classification text.
 *   2. Caused researcher metadata to vanish after logout/login because the
 *      localStorage key was scoped to the browser session, not the paper.
 *   3. Lost data whenever the user cleared browser storage.
 *
 * The mapping now returns `undefined` for domain / field / subfield when
 * the BE doesn't ship them, and surfaces the gap through the editorial
 * detail. If the BE cannot persist those columns, that is a contract gap
 * (see BACKEND_REQUESTS.md §3.2) — the FE does NOT paper over it with
 * localStorage anymore.
 */
const toPublicationPaper = async (
  paper: Paper,
  request?: ReviewRequest,
  evaluation: DetailedEvaluation | null = null,
): Promise<PublicationPaper> => {
  // The paper record is authoritative for terminal editorial states. However, a
  // paper with an active review request should never be shown as "Inactive" to
  // the researcher — the INACTIVE state is only meant for published papers that
  // have been taken offline. If a review request exists and the paper hasn't
  // been published/rejected/withdrawn, use the assignment status instead.
  const persistedStatus = paperStatus(paper.status);
  const hasActiveReviewRequest = request != null;
  const isTerminalEditorialState =
    ['PUBLISHED', 'INACTIVE', 'ADMIN_REJECTED', 'WITHDRAWN'].includes(persistedStatus);
  const status = isTerminalEditorialState
    ? persistedStatus
    : hasActiveReviewRequest
      ? assignmentStatus(request, evaluation) ?? persistedStatus
      : persistedStatus;
  const authorId = paper.authorId ?? (paper as unknown as { userId?: number }).userId;
  const subFieldId = paper.subFieldId ?? (paper as unknown as { subfieldId?: number }).subfieldId;
  const reviewerName = request?.reviewerName?.trim();
  const scores: Record<string, number> = {};
  const notes: Record<string, string> = {};
  if (evaluation) {
    scores.originality = evaluation.scoreOriginality ?? 0;
    scores.references = evaluation.scoreLiterature ?? 0;
    scores.methodology = evaluation.scoreMethodology ?? 0;
    scores.significance = evaluation.scoreResults ?? 0;
    scores.clarity = evaluation.scoreFormatting ?? 0;

    notes.originality = evaluation.notesOriginality ?? '';
    notes.references = evaluation.notesLiterature ?? '';
    notes.methodology = evaluation.notesMethodology ?? '';
    notes.significance = evaluation.notesResults ?? '';
    notes.clarity = evaluation.notesFormatting ?? '';
  }

  return enrichPublicationMetadata({
    id: String(paper.id),
    title: paper.title?.trim() || `Paper #${paper.id}`,
    abstract: paper.abstract?.trim() || 'No abstract was supplied.',
    subFieldId: subFieldId ?? null,
    authorId: authorId ?? null,
    submitterName: paper.authorName?.trim() || undefined,
    doi: paper.doi ?? undefined,
    openAlexId: paper.openAlexWorkId ?? undefined,
    publicationDate: paper.publicationDate ?? undefined,
    sourceName: paper.sourceName ?? undefined,
    issnValue: paper.issnValue ?? undefined,
    authors: paper.authors?.length ? paper.authors.map((author) => ({
      id: String(author.paperAuthorId), name: author.authorName,
      orcid: author.orcidId ?? undefined, order: author.authorOrder, institutionIds: [],
    })) : [],
    institutions: [],
    paperType: paper.paperType ?? 'Not supplied',
    // domain / field / subfield are intentionally NOT backfilled from
    // localStorage. The FE surfaces whatever the BE returns (which today
    // is only subFieldId); consumers that need human-readable names render
    // a "Subfield #N" placeholder rather than reading from a per-user cache.
    subfield: undefined,
    domain: undefined,
    field: undefined,
    topics: [],
    keywords: [],
    fileUrl: paper.fileUrl ?? undefined,
    version: null,
    status,
    visibility: status === 'PUBLISHED' ? 'PUBLIC' : 'PRIVATE',
    createdAt: paper.createdAt ?? '',
    submittedAt: undefined,
    publishedAt: undefined,
    reviewer: request
      ? {
          reviewerName:
            reviewerName ||
            (request.reviewerId ? `Reviewer #${request.reviewerId}` : 'Assigned reviewer'),
          recommendation:
            normalizedText(evaluation?.finalDecision) === 'REJECT'
              ? 'REJECT'
              : normalizedText(evaluation?.finalDecision) === 'REVISION_REQUIRED'
                ? 'REVISION_REQUIRED'
                : normalizedText(evaluation?.finalDecision) === 'ACCEPT' ? 'ACCEPT' : undefined,
          privateComments: evaluation?.generalComments ?? '',
          privateScores: scores,
          privateNotes: notes,
          criteria1: evaluation?.criteria1 ?? null,
          expandedCriteria1: evaluation?.expandedCriteria1 ?? null,
          evaluationCriteria1: evaluation?.evaluationCriteria1 ?? null,
          criteria2: evaluation?.criteria2 ?? null,
          expandedCriteria2: evaluation?.expandedCriteria2 ?? null,
          evaluationCriteria2: evaluation?.evaluationCriteria2 ?? null,
          criteria3: evaluation?.criteria3 ?? null,
          expandedCriteria3: evaluation?.expandedCriteria3 ?? null,
          evaluationCriteria3: evaluation?.evaluationCriteria3 ?? null,
          submittedAt: evaluation?.createdAt,
        }
      : undefined,
    reviewerIdentityPublic: false,
    researcherVerificationStatus: (() => {
      // Editorial status-based inference:
      // When admin rejects a paper, the researcher identity should also be
      // considered rejected — the paper cannot advance to reviewer assignment.
      // Show REJECTED so the UI hides the Accept/Reject buttons via
      // isIdentityTerminal() and the badge reads "Rejected" instead of
      // "Awaiting review".
      //
      // We no longer read from localStorage here: that cache made the
      // verification badge appear to flip correctly even when the BE never
      // accepted the verification columns (so a different researcher on a
      // shared browser could see the previous researcher's decision), and
      // it lost data on logout/login.
      const rawAuthStatus = (paper as unknown as { authorshipVerificationStatus?: string }).authorshipVerificationStatus;

      if (rawAuthStatus) {
        const norm = rawAuthStatus.trim().toUpperCase();
        if (norm === 'ALLOW' || norm === 'ALLOWED' || norm === 'VERIFIED') {
          return 'VERIFIED';
        }
        if (norm === 'REJECTED' || norm === 'DENIED') {
          return 'REJECTED';
        }
      }

      return 'PENDING';
    })(),
    authorshipVerificationReason: paper.authorshipVerificationReason ?? undefined,
    reviewRequestId: request?.id,
    reviewRequestStatus: request?.status ?? undefined,
    reviewerId: request?.reviewerId ?? undefined,
    reviewDeadline: request?.deadline ?? undefined,
    assignmentCreatedAt: request?.createdAt,
    reviewType: request?.type ?? null,
    aiRecommended: request?.airecommended ?? null,
  });
};

const listAllPapers = async (): Promise<Paper[]> => {
  const result = await paperService.getAll({ pageNumber: 1, pageSize: 1000 });
  return Array.isArray(result?.items) ? result.items : [];
};

const matchesCatalogQuery = (paper: PublicationPaper, query: CatalogQuery): boolean => {
  const needle = query.query?.trim().toLowerCase();
  if (needle) {
    const searchableText = [
      paper.title,
      paper.abstract,
      paper.doi,
      paper.authors.map((author) => author.name).join(' '),
      paper.institutions.map((institution) => institution.name).join(' '),
      paper.topics.join(' '),
      paper.keywords.join(' '),
    ].filter(Boolean).join(' ').toLowerCase();
    if (!searchableText.includes(needle)) return false;
  }

  // The only taxonomy field exposed by the Paper BE response is `subFieldId`.
  // MajorField is filtered indirectly: the catalog UI always renders
  // SubField options scoped under the selected MajorField, so the resulting
  // subFieldId pick already implies its parent MajorField.
  return !query.subFieldId || paper.subFieldId === query.subFieldId;
};

const compareCatalogPapers = (
  left: PublicationPaper,
  right: PublicationPaper,
  sort: CatalogQuery['sort'],
): number => {
  if (sort === 'TITLE_ASC') return left.title.localeCompare(right.title);
  const leftDate = left.publishedAt ?? left.createdAt;
  const rightDate = right.publishedAt ?? right.createdAt;
  const chronological = leftDate.localeCompare(rightDate);
  return sort === 'PUBLISHED_ASC' ? chronological : -chronological;
};

const currentUserId = (): number | null => {
  const user = storage.getUser();
  const id = user?.id ?? (user as unknown as { userId?: number })?.userId;
  return id && id > 0 ? Number(id) : null;
};

/**
 * Reviewer workspaces only expose active assignments and their immediately
 * post-submission state. Terminal editorial records may retain a historical
 * review request, but they are never work for a reviewer to reopen.
 */
const isVisibleReviewerAssignment = (paper: PublicationPaper): boolean =>
  [
    'REVIEWER_ASSIGNED',
    'UNDER_REVIEW',
    'REVISION_REQUIRED',
    'RESUBMITTED',
    'REVIEWER_RECOMMENDED_ACCEPT',
    'REVIEWER_RECOMMENDED_REJECT',
  ].includes(paper.status);

const latestRequestByPaper = (requests: ReviewRequest[]): Map<string, ReviewRequest> => {
  const result = new Map<string, ReviewRequest>();
  for (const request of [...requests].sort((a, b) => (Date.parse(a.createdAt ?? '') || 0) - (Date.parse(b.createdAt ?? '') || 0) || (a.id ?? 0) - (b.id ?? 0))) {
    if (request.paperId == null) continue;
    result.set(String(request.paperId), request);
  }
  return result;
};

const evaluationFor = async (
  request: ReviewRequest | undefined,
): Promise<DetailedEvaluation | null> => {
  if (!request?.id || normalizeReviewRequestStatus(request.status) !== 'COMPLETED') {
    return null;
  }
  const evaluation = await detailedEvaluationService.getByReviewRequestId(request.id);
  return evaluation?.detailedEvaluationId ? evaluation : null;
};

class ApiPublicationAdapter implements PublicationAdapter {
  async getPublicCatalog(query: CatalogQuery): Promise<PagedPublicationResult> {
    const catalog = (await Promise.all((await listAllPapers())
      .filter((paper) => paperStatus(paper.status) === 'PUBLISHED')
      .map((paper) => toPublicationPaper(paper))))
      .filter((paper) => paper.status === 'PUBLISHED' && paper.visibility === 'PUBLIC')
      .filter((paper) => matchesCatalogQuery(paper, query))
      .sort((left, right) => compareCatalogPapers(left, right, query.sort));
    const start = (query.page - 1) * query.pageSize;

    return {
      items: catalog.slice(start, start + query.pageSize),
      totalCount: catalog.length,
      page: query.page,
      pageSize: query.pageSize,
      dataSource: 'api',
    };
  }

  async getResearcherSubmissions(): Promise<PublicationPaper[]> {
    const userId = currentUserId();
    if (!userId) return [];
    const [papers, requests] = await Promise.all([
      listAllPapers(),
      reviewRequestService.getAll(),
    ]);
    const requestMap = latestRequestByPaper(requests);
    return (await Promise.all(papers
      .filter((paper) => paper.authorId === userId)
      .map(async (paper) => {
        const request = requestMap.get(String(paper.id));
        const mapped = await toPublicationPaper(paper, request, await evaluationFor(request));
        return { ...mapped, reviewer: undefined };
      })))
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return Number(b.id) - Number(a.id);
      });
  }

  async getReviewerAssignments(): Promise<PublicationPaper[]> {
    const user = storage.getUser();
    const userId = Number(user?.id ?? (user as unknown as { userId?: number })?.userId);
    if (!userId) return [];

    const allRequests = await reviewRequestService.getAll();
    const myRequests = allRequests.filter(
      (request) =>
        userId > 0 && request.reviewerId === userId && !!request.id && !!request.paperId,
    );

    const assignments = await Promise.all(
      myRequests.map(async (request) => {
        try {
          const [paper, evaluation] = await Promise.all([
            paperService.getById(String(request.paperId)),
            evaluationFor(request),
          ]);
          return toPublicationPaper(paper, request, evaluation);
        } catch {
          throw new PublicationBackendContractError('An assigned paper or evaluation could not be loaded. Refresh the assignment list or contact support; no assignments have been changed.');
        }
      }),
    );

    return assignments.filter(
      (paper): paper is PublicationPaper =>
        paper !== null && isVisibleReviewerAssignment(paper),
    );
  }

  async getAdminSubmissions(): Promise<PublicationPaper[]> {
    const [papers, requests] = await Promise.all([
      listAllPapers(),
      reviewRequestService.getAll(),
    ]);
    const requestMap = latestRequestByPaper(requests);
    return Promise.all(
      papers.map(async (paper) => {
        const request = requestMap.get(String(paper.id));
        return toPublicationPaper(await paperService.getById(paper.id), request, await evaluationFor(request));
      }),
    );
  }

  async getPaperById(id: string): Promise<PublicationPaper> {
    const [paper, requests] = await Promise.all([
      paperService.getById(id),
      reviewRequestService.getAll(),
    ]);
    const request = latestRequestByPaper(requests).get(String(id));
    const evaluation = await evaluationFor(request);
    return toPublicationPaper(paper, request, evaluation);
  }

  async createDraft(input: SubmissionInput, submitToAdmin = false): Promise<PublicationPaper> {
    if (input.paperType !== 'Journal' && input.paperType !== 'Conference') {
      throw new PublicationBackendContractError('Select Journal or Conference before saving the paper.');
    }
    const created = await paperService.create({
      paperType: input.paperType,
      publicationDate: input.publicationDate ?? null,
      authors: input.authors.map((author) => ({ authorName: author.name, orcidId: author.orcid ?? null })),
      title: input.title,
      abstract: input.abstract,
      fileUrl: input.fileUrl,
      subFieldId: input.subFieldId ?? null,
      openAlexWorkId: input.openAlexId ?? null,
      doi: input.doi ?? null,
    });
    // The live create endpoint submits immediately. Never demote a successful
    // direct submission to Draft before sending it to the same queue again.
    if (submitToAdmin) {
      const status = normalizedText(created.status);
      if (status !== 'SUBMITTED' && status !== 'WAITING_FOR_REVIEW') {
        throw new PublicationBackendContractError(`Paper #${created.id} was created but submission was not confirmed. Open My Research Papers before retrying.`);
      }
      return toPublicationPaper(created);
    }
    const draft = await paperService.update(created.id, {
      title: input.title,
      abstract: input.abstract,
      fileUrl: input.fileUrl ?? null,
      subFieldId: input.subFieldId ?? created.subFieldId ?? null,
      openAlexWorkId: input.openAlexId ?? created.openAlexWorkId ?? null,
      doi: input.doi ?? created.doi ?? null,
      status: 'Draft',
    });
    // domain / field / subfield are no longer mirrored to localStorage.
    // If the BE contract does not accept them today, that gap is owned by
    // the BE team and tracked in BACKEND_REQUESTS.md — the FE never
    // re-creates metadata from a per-browser cache because that cache
    // would not survive logout/login or different accounts on a shared
    // browser.
    return toPublicationPaper(draft);
  }

  async submitPaper(id: string): Promise<PublicationPaper> {
    const current = await paperService.getById(id);
    return toPublicationPaper(await paperService.update(id, {
      title: current.title ?? '',
      abstract: current.abstract ?? '',
      fileUrl: current.fileUrl ?? null,
      subFieldId: current.subFieldId ?? null,
      openAlexWorkId: current.openAlexWorkId ?? null,
      doi: current.doi ?? null,
      status: 'Waiting for Review',
    }));
  }

  async respondToAssignment(
    id: string,
    accepted: boolean,
  ): Promise<PublicationPaper> {
    // Re-fetch the canonical request after the BE round-trip so we never
    // rely on a stale local snapshot — the BE may rewrite reviewerId,
    // deadline, type, or aiRecommended on update, and those fields drive
    // every downstream detail/Admin view.
    const current = await this.findCurrentReviewerRequest(id);
    await reviewRequestService.update(current.id!, {
      status: accepted ? 'In Progress' : 'Declined',
    });
    const refreshed = await this.findCurrentReviewerRequest(id);
    if (normalizeReviewRequestStatus(refreshed.status) !== (accepted ? 'IN_PROGRESS' : 'DECLINED')) {
      throw new PublicationBackendContractError('The backend did not confirm the assignment response.');
    }
    const paper = await paperService.getById(String(current.paperId));
    return toPublicationPaper(paper, refreshed);
  }

  async submitReview(
    id: string,
    recommendation: ReviewerRecommendation,
    privateComments: string,
    privateScores: Record<string, number> = {},
    privateNotes: Record<string, string> = {},
    specializedCriteria?: Partial<SpecializedCriteriaBundle>,
  ): Promise<PublicationPaper> {
    const request = await this.findCurrentReviewerRequest(id);
    if (normalizeReviewRequestStatus(request.status) !== 'IN_PROGRESS') {
      throw new PublicationBackendContractError('Only an accepted, in-progress assignment can be submitted.');
    }
    const evaluation = await detailedEvaluationService.create({
      reviewRequestId: request.id,
      reviewerId: request.reviewerId,
      scoreOriginality: privateScores.originality,
      notesOriginality: privateNotes.originality,
      scoreLiterature: privateScores.references,
      notesLiterature: privateNotes.references,
      scoreMethodology: privateScores.methodology,
      notesMethodology: privateNotes.methodology,
      scoreResults: privateScores.significance,
      notesResults: privateNotes.significance,
      scoreFormatting: privateScores.clarity,
      notesFormatting: privateNotes.clarity,
      generalComments: privateComments,
      finalDecision: recommendation,
      criteria1: specializedCriteria?.criteria1 ?? null,
      expandedCriteria1: specializedCriteria?.expandedCriteria1 ?? null,
      evaluationCriteria1: stringifyRubricReference(specializedCriteria?.evaluationCriteria1),
      criteria2: specializedCriteria?.criteria2 ?? null,
      expandedCriteria2: specializedCriteria?.expandedCriteria2 ?? null,
      evaluationCriteria2: stringifyRubricReference(specializedCriteria?.evaluationCriteria2),
      criteria3: specializedCriteria?.criteria3 ?? null,
      expandedCriteria3: specializedCriteria?.expandedCriteria3 ?? null,
      evaluationCriteria3: stringifyRubricReference(specializedCriteria?.evaluationCriteria3),
    });
    await reviewRequestService.update(request.id!, {
      status: 'Completed',
    });
    const currentPaper = await paperService.getById(String(request.paperId));
    const authorId = currentPaper.authorId ?? (currentPaper as unknown as { userId?: number }).userId;
    if (authorId) {
      try {
        await notificationService.create({
          userId: authorId,
          message: `The review of your paper "${currentPaper.title}" has been submitted for editorial consideration.`,
        });
      } catch (err) {
        console.warn('Failed to send reviewer submission notification:', err);
      }
    }
    // Always re-fetch the canonical review request after the BE mutations so
    // we never carry a stale snapshot through to the returned PublicationPaper.
    const refreshedRequest = await this.findCurrentReviewerRequest(id);
    if (normalizeReviewRequestStatus(refreshedRequest.status) !== 'COMPLETED') {
      throw new PublicationBackendContractError('The backend did not confirm that the review was completed.');
    }
    return toPublicationPaper(currentPaper, refreshedRequest, evaluation);
  }

  async assignReviewer(id: string, reviewerId: number): Promise<PublicationPaper> {
    if (!Number.isInteger(reviewerId) || reviewerId <= 0) {
      throw new PublicationBackendContractError('Select a valid reviewer account ID.');
    }
    const request = await reviewRequestService.create({
      paperId: Number(id),
      reviewerId,
      status: 'Pending',
      deadline: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      airecommended: false,
      type: 'Editorial',
    });
    return toPublicationPaper(await paperService.getById(id), request);
  }

  async assignReviewers(id: string, reviewerIds: number[]): Promise<PublicationPaper> {
    const normalizedIds = Array.from(
      new Set(reviewerIds.filter((reviewerId) => Number.isInteger(reviewerId) && reviewerId > 0)),
    );
    if (normalizedIds.length === 0) {
      throw new PublicationBackendContractError('Select at least one reviewer.');
    }
    if (normalizedIds.length > 3) {
      throw new PublicationBackendContractError('A paper can have at most 3 reviewers.');
    }

    // The BE manual-assignment contract accepts reviewerIds[] and returns an
    // assignment summary rather than a full PaperResponse. Fetch the canonical
    // paper after the mutation so callers receive the same PublicationPaper
    // shape as assignReviewer and other adapter mutations.
    await paperService.assignReviewersManual(Number(id), {
      paperId: Number(id),
      reviewerIds: normalizedIds,
    });
    return this.getPaperById(id);
  }

  async assignReviewersAuto(id: string, reviewerCount = 3): Promise<unknown> {
    return paperService.assignReviewers(id, reviewerCount);
  }

  async verifyAuthorship(id: string, _allow = true): Promise<PublicationPaper> {
    // Uses PUT /api/Paper/test-update-no-verify/{id} — a manual verification
    // endpoint that bypasses OpenAlex/ORCID checks, allowing admins to verify
    // authorship for papers that have no OpenAlex ID.
    const verification = await paperService.testUpdateNoVerify(id);
    if (verification.paperId !== Number(id)) {
      throw new PublicationBackendContractError('The verification response did not identify the requested paper. Refresh the paper before retrying.');
    }
    const updated = await paperService.getById(id);
    const decision = normalizedText(updated.authorshipVerificationStatus);
    const confirmed = ['ALLOW', 'ALLOWED', 'VERIFIED'].includes(decision);
    if (!confirmed) {
      const rawStatus =
        updated.authorshipVerificationStatus ??
        verification.authorshipVerificationStatus ??
        null;
      const rawReason =
        updated.authorshipVerificationReason ??
        verification.authorshipVerificationReason ??
        null;
      throw new PublicationBackendContractError(
        friendlyAuthorshipVerificationError(rawStatus, rawReason),
      );
    }
    return toPublicationPaper(updated);
  }

  async approveForReview(_id: string): Promise<PublicationPaper> {
    throw new PublicationBackendContractError('Approve for review is unavailable: the backend has not documented this editorial transition.');
  }

  async reactivatePublishedPaper(_id: string): Promise<PublicationPaper> {
    throw new PublicationBackendContractError('Reactivation is unavailable: the backend has no documented independent publication activity field or reactivation endpoint.');
  }

  async getReviewerAssignmentById(assignmentId: string): Promise<PublicationPaper> {
    const request = await this.findCurrentReviewerRequest(assignmentId);
    return toPublicationPaper(await paperService.getById(String(request.paperId)), request, await evaluationFor(request));
  }

  async publishPaper(id: string): Promise<PublicationPaper> {
    const editorial = await this.getPaperById(id);
    if (editorial.status !== 'ADMIN_APPROVED' && editorial.status !== 'REVIEWER_RECOMMENDED_ACCEPT') {
      throw new PublicationBackendContractError('Publication requires a confirmed editorial approval or submitted acceptance recommendation. Inactive papers cannot be republished as reactivation.');
    }
    const current = await paperService.getById(id);
    const updated = await paperService.update(id, {
      title: current.title ?? '',
      abstract: current.abstract ?? '',
      fileUrl: current.fileUrl ?? null,
      subFieldId: current.subFieldId ?? null,
      openAlexWorkId: current.openAlexWorkId ?? null,
      doi: current.doi ?? null,
      status: 'Published',
    });
    const authorId = updated.authorId ?? current.authorId ?? (current as unknown as { userId?: number }).userId;
    if (authorId) {
      try {
        await notificationService.create({
          userId: authorId,
          message: `Your paper "${current.title}" has been published in Discover Research.`,
        });
      } catch (err) {
        console.warn('Failed to send published notification:', err);
      }
    }
    return toPublicationPaper(updated);
  }

  async rejectPaper(id: string, reason?: string): Promise<PublicationPaper> {
    const current = await paperService.getById(id);
    const updated = await paperService.update(id, {
      title: current.title ?? '',
      abstract: current.abstract ?? '',
      fileUrl: current.fileUrl ?? null,
      subFieldId: current.subFieldId ?? null,
      openAlexWorkId: current.openAlexWorkId ?? null,
      doi: current.doi ?? null,
      status: 'Rejected',
    });
    const authorId = updated.authorId ?? current.authorId ?? (current as unknown as { userId?: number }).userId;
    if (authorId) {
      try {
        await notificationService.create({
          userId: authorId,
          message: `Your paper "${current.title}" was rejected for publication.${reason ? ` Reason: ${reason}` : ''}`,
        });
      } catch (err) {
        console.warn('Failed to send rejection notification:', err);
      }
    }
    return toPublicationPaper(updated);
  }

  async deactivatePublishedPaper(_id: string): Promise<PublicationPaper> {
    throw new PublicationBackendContractError('Deactivation is unavailable: the backend has no documented independent publication activity field or deactivation endpoint.');
  }

  private async findCurrentReviewerRequest(assignmentId: string): Promise<ReviewRequest> {
    const user = storage.getUser();
    const userId = Number(user?.id ?? (user as unknown as { userId?: number })?.userId);
    const requestId = Number(assignmentId);
    if (!Number.isInteger(requestId) || requestId <= 0 || !userId) {
      throw new PublicationBackendContractError('A valid review assignment and signed-in reviewer are required.');
    }
    const request = await reviewRequestService.getById(requestId);
    if (request.id !== requestId || request.reviewerId !== userId || !request.paperId) {
      throw new PublicationBackendContractError(
        'This review assignment is not available to the signed-in reviewer.',
      );
    }

    return request;
  }
}

export const publicationAdapter: PublicationAdapter = new ApiPublicationAdapter();
