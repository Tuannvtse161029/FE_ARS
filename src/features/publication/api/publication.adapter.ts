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
import { demoPublicationPapers } from '../demo/publication.demo';

import { notificationService } from '../../../services/notification.service';
import type { SpecializedCriteriaBundle } from '../reviewer/evaluationCriteriaResolver';

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
    specializedCriteria?: Partial<SpecializedCriteriaBundle>,
  ): Promise<PublicationPaper>;
  assignReviewer(id: string, reviewerId: number): Promise<PublicationPaper>;
  assignReviewersAuto(id: string, reviewerCount?: number): Promise<unknown>;
  publishPaper(id: string): Promise<PublicationPaper>;
  rejectPaper(id: string, reason?: string): Promise<PublicationPaper>;
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
  const subFieldId = paper.subFieldId ?? paper.subfieldId;
  const authorName = paper.authorName?.trim();
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

  return {
    id: String(paper.id),
    title: paper.title?.trim() || `Paper #${paper.id}`,
    abstract: paper.abstract?.trim() || 'No abstract was supplied.',
    subFieldId: subFieldId ?? null,
    authorId: authorId ?? null,
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

const catalogMatches = (paper: PublicationPaper, query: CatalogQuery): boolean => {
  const term = query.query?.trim().toLowerCase();
  const haystack = [
    paper.title,
    paper.abstract,
    paper.doi,
    paper.openAlexId,
    paper.externalIdentifier,
    paper.domain,
    paper.field,
    paper.subfield,
    ...paper.topics,
    ...paper.keywords,
    ...paper.authors.map((author) => author.name),
    ...paper.institutions.map((institution) => institution.name),
  ].filter(Boolean).join(' ').toLowerCase();
  if (term && !haystack.includes(term)) return false;
  if (query.domain && paper.domain !== query.domain) return false;
  if (query.field && paper.field !== query.field) return false;
  if (query.subfield && paper.subfield !== query.subfield) return false;
  if (query.topic && !paper.topics.includes(query.topic)) return false;
  return true;
};

const demoCatalog = (query: CatalogQuery): PagedPublicationResult => {
  const filtered = demoPublicationPapers
    .filter((paper) => catalogMatches(paper, query))
    .sort((left, right) => {
      if (query.sort === 'TITLE_ASC') return left.title.localeCompare(right.title);
      const leftDate = new Date(left.publishedAt ?? left.createdAt).getTime();
      const rightDate = new Date(right.publishedAt ?? right.createdAt).getTime();
      return query.sort === 'PUBLISHED_ASC' ? leftDate - rightDate : rightDate - leftDate;
    });
  const start = Math.max(0, (query.page - 1) * query.pageSize);
  return {
    items: filtered.slice(start, start + query.pageSize),
    totalCount: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
    dataSource: 'demo',
  };
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
    let papers: PublicationPaper[] = [];
    try {
      papers = (await listAllPapers())
        .filter((paper) => normalizedText(paper.status) === 'PUBLISHED')
        .map((paper) => toPublicationPaper(paper));
    } catch {
      return demoCatalog(query);
    }
    // The live Paper API currently has no published catalog rows/contract.
    // Keep the screen useful for product review while the BE implements it.
    if (papers.length === 0) return demoCatalog(query);

    const searchTerm = query.query?.trim().toLowerCase();
    const filtered = papers
      .filter((paper) => {
        if (searchTerm) {
          const haystack = [
            paper.title,
            paper.abstract,
            ...paper.authors.map((author) => author.name),
          ].join(' ').toLowerCase();
          if (!haystack.includes(searchTerm)) return false;
        }
        return true;
      })
      .sort((left, right) => {
        if (query.sort === 'TITLE_ASC') return left.title.localeCompare(right.title);
        const leftDate = new Date(left.publishedAt ?? left.createdAt ?? 0).getTime();
        const rightDate = new Date(right.publishedAt ?? right.createdAt ?? 0).getTime();
        return query.sort === 'PUBLISHED_ASC' ? leftDate - rightDate : rightDate - leftDate;
      });

    const start = Math.max(0, (query.page - 1) * query.pageSize);
    return {
      items: filtered.slice(start, start + query.pageSize),
      totalCount: filtered.length,
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
    specializedCriteria?: Partial<SpecializedCriteriaBundle>,
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
      criteria1: specializedCriteria?.criteria1 ?? null,
      expandedCriteria1: specializedCriteria?.expandedCriteria1 ?? null,
      evaluationCriteria1: specializedCriteria?.evaluationCriteria1 ?? null,
      criteria2: specializedCriteria?.criteria2 ?? null,
      expandedCriteria2: specializedCriteria?.expandedCriteria2 ?? null,
      evaluationCriteria2: specializedCriteria?.evaluationCriteria2 ?? null,
      criteria3: specializedCriteria?.criteria3 ?? null,
      expandedCriteria3: specializedCriteria?.expandedCriteria3 ?? null,
      evaluationCriteria3: specializedCriteria?.evaluationCriteria3 ?? null,
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

  async assignReviewersAuto(id: string, reviewerCount = 3): Promise<unknown> {
    return paperService.assignReviewers(id, reviewerCount);
  }

  async publishPaper(id: string): Promise<PublicationPaper> {
    const current = await paperService.getById(id);
    const updated = await paperService.update(id, {
      title: current.title,
      abstract: current.abstract ?? '',
      fileUrl: current.fileUrl ?? null,
      status: 'Published',
    });
    const authorId = updated.authorId ?? current.authorId ?? current.userId;
    if (authorId) {
      try {
        await notificationService.create({
          userId: authorId,
          message: `Bài báo "${current.title}" của bạn đã được xuất bản chính thức lên Discover RESEARCH!`,
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
      title: current.title,
      abstract: current.abstract ?? '',
      fileUrl: current.fileUrl ?? null,
      status: 'Rejected',
    });
    const authorId = updated.authorId ?? current.authorId ?? current.userId;
    if (authorId) {
      try {
        await notificationService.create({
          userId: authorId,
          message: `Bài báo "${current.title}" của bạn đã bị từ chối xuất bản. ${reason ? `Lý do: ${reason}` : ''}`,
        });
      } catch (err) {
        console.warn('Failed to send rejection notification:', err);
      }
    }
    return toPublicationPaper(updated);
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
