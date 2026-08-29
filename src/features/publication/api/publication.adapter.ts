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
  getAdminSubmissions(): Promise<PublicationPaper[]>;
  createDraft(input: SubmissionInput): Promise<PublicationPaper>;
  submitPaper(id: string): Promise<PublicationPaper>;
  respondToAssignment(id: string, accepted: boolean): Promise<PublicationPaper>;
  submitReview(
    id: string,
    recommendation: ReviewerRecommendation,
    privateComments: string,
    privateScores?: Record<string, number>,
    privateNotes?: Record<string, string>,
  ): Promise<PublicationPaper>;
  assignReviewer(id: string, reviewerId: number): Promise<PublicationPaper>;
  publishPaper(id: string): Promise<PublicationPaper>;
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
      : 'REVIEWER_RECOMMENDED_ACCEPT';
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

const toPublicationPaper = (
  paper: Paper,
  request?: ReviewRequest,
  evaluation: DetailedEvaluation | null = null,
): PublicationPaper => {
  const status = assignmentStatus(request, evaluation) ?? paperStatus(paper.status);
  const authorId = paper.authorId ?? paper.userId;
  const authorName = paper.authorName?.trim();
  const reviewerName = request?.reviewerName?.trim();
  const scores: Record<string, number> = {};
  if (evaluation) {
    scores.originality = evaluation.scoreOriginality ?? 0;
    scores.references = evaluation.scoreLiterature ?? 0;
    scores.methodology = evaluation.scoreMethodology ?? 0;
    scores.significance = evaluation.scoreResults ?? 0;
    scores.clarity = evaluation.scoreFormatting ?? 0;
  }

  return {
    id: String(paper.id),
    title: paper.title?.trim() || `Paper #${paper.id}`,
    abstract: paper.abstract?.trim() || 'No abstract was supplied.',
    authors: authorId || authorName
      ? [{
          id: String(authorId ?? 'unknown'),
          name: authorName || `Author #${authorId}`,
          institutionIds: [],
          order: 1,
        }]
      : [],
    institutions: [],
    paperType: 'Not supplied',
    topics: [],
    keywords: [],
    fileUrl: paper.fileUrl,
    version: null,
    status,
    visibility: status === 'PUBLISHED' ? 'PUBLIC' : 'PRIVATE',
    createdAt: paper.createdAt ?? '',
    submittedAt: request?.createdAt ?? paper.createdAt,
    publishedAt: status === 'PUBLISHED' ? paper.updatedAt ?? paper.createdAt : undefined,
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
                : 'ACCEPT',
          privateComments: evaluation?.generalComments ?? '',
          privateScores: scores,
          submittedAt: evaluation?.createdAt,
        }
      : undefined,
    reviewerIdentityPublic: false,
    researcherVerificationStatus: 'PENDING',
    reviewRequestId: request?.id,
    reviewerId: request?.reviewerId ?? undefined,
    reviewDeadline: request?.deadline ?? undefined,
    assignmentCreatedAt: request?.createdAt,
    reviewFee: request?.fee ?? null,
    reviewType: request?.type ?? null,
    aiRecommended: request?.airecommended ?? null,
  };
};

const listAllPapers = async (): Promise<Paper[]> => {
  const result = await paperService.getAll({ pageNumber: 1, pageSize: 1000 });
  return Array.isArray(result?.items) ? result.items : [];
};

const currentUserId = (): number | null => storage.getUser()?.id ?? null;

const latestRequestByPaper = (requests: ReviewRequest[]): Map<string, ReviewRequest> => {
  const result = new Map<string, ReviewRequest>();
  for (const request of requests) {
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
    void query;
    throw new PublicationBackendContractError(
      'The public catalog is unavailable until the backend ships a status- and visibility-scoped publication endpoint. See tickets/backend/BE_PUBLICATION_WORKFLOW_API_TICKET.md.',
    );
  }

  async getResearcherSubmissions(): Promise<PublicationPaper[]> {
    const userId = currentUserId();
    if (!userId) return [];
    const [papers, requests] = await Promise.all([
      listAllPapers(),
      reviewRequestService.getAll(),
    ]);
    const requestMap = latestRequestByPaper(requests);
    return papers
      .filter((paper) => paper.authorId === userId || paper.userId === userId)
      .map((paper) => toPublicationPaper(paper, requestMap.get(String(paper.id))));
  }

  async getReviewerAssignments(): Promise<PublicationPaper[]> {
    const userId = currentUserId();
    if (!userId) return [];
    const requests = await reviewRequestService.getForReviewer(userId);
    return Promise.all(
      requests.map(async (request) => {
        const [paper, evaluation] = await Promise.all([
          paperService.getById(String(request.paperId)),
          evaluationFor(request),
        ]);
        return toPublicationPaper(paper, request, evaluation);
      }),
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
        return toPublicationPaper(paper, request, await evaluationFor(request));
      }),
    );
  }

  async createDraft(input: SubmissionInput): Promise<PublicationPaper> {
    const created = await paperService.create({
      title: input.title,
      abstract: input.abstract,
      fileUrl: input.fileUrl,
    });
    const draft = await paperService.update(created.id, {
      title: input.title,
      abstract: input.abstract,
      fileUrl: input.fileUrl ?? null,
      status: 'Draft',
    });
    return toPublicationPaper(draft);
  }

  async submitPaper(id: string): Promise<PublicationPaper> {
    const current = await paperService.getById(id);
    return toPublicationPaper(await paperService.update(id, {
      title: current.title,
      abstract: current.abstract ?? '',
      fileUrl: current.fileUrl ?? null,
      status: 'Waiting for Review',
    }));
  }

  async respondToAssignment(
    id: string,
    accepted: boolean,
  ): Promise<PublicationPaper> {
    const request = await this.findCurrentReviewerRequest(id);
    const updated = await reviewRequestService.update(request.id!, {
      status: accepted ? 'In Progress' : 'Declined',
    });
    return toPublicationPaper(
      await paperService.getById(id),
      { ...request, ...updated, id: request.id },
    );
  }

  async submitReview(
    id: string,
    recommendation: ReviewerRecommendation,
    privateComments: string,
    privateScores: Record<string, number> = {},
    privateNotes: Record<string, string> = {},
  ): Promise<PublicationPaper> {
    const request = await this.findCurrentReviewerRequest(id);
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
    });
    const updated = await reviewRequestService.update(request.id!, {
      status: 'Completed',
    });
    return toPublicationPaper(
      await paperService.getById(id),
      { ...request, ...updated, id: request.id },
      evaluation,
    );
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

  async publishPaper(id: string): Promise<PublicationPaper> {
    void id;
    throw new PublicationBackendContractError(
      'Final publication is unavailable until the backend ships the Admin publication transition endpoint. See tickets/backend/BE_PUBLICATION_WORKFLOW_API_TICKET.md.',
    );
  }

  private async findCurrentReviewerRequest(paperId: string): Promise<ReviewRequest> {
    const userId = currentUserId();
    const request = (await reviewRequestService.getAll()).find(
      (item) =>
        String(item.paperId) === paperId &&
        item.reviewerId === userId &&
        item.id != null,
    );
    if (!request) {
      throw new PublicationBackendContractError(
        'This review assignment is not available to the signed-in reviewer.',
      );
    }
    return request;
  }
}

export const publicationAdapter: PublicationAdapter = new ApiPublicationAdapter();
