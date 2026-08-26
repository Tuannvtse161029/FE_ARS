import { demoPublicationPapers } from '../demo/publication.demo';
import {
  canAppearInPublicCatalog,
  type CatalogQuery,
  type PagedPublicationResult,
  type PublicationNotification,
  type PublicationPaper,
  type ReviewerRecommendation,
  type SubmissionInput,
} from '../types/publication';

export interface PublicationAdapter {
  getPublicCatalog(query: CatalogQuery): Promise<PagedPublicationResult>;
  getResearcherSubmissions(): Promise<PublicationPaper[]>;
  getReviewerAssignments(): Promise<PublicationPaper[]>;
  getAdminSubmissions(): Promise<PublicationPaper[]>;
  getNotifications(): Promise<PublicationNotification[]>;
  createDraft(input: SubmissionInput): Promise<PublicationPaper>;
  submitPaper(id: string): Promise<PublicationPaper>;
  respondToAssignment(id: string, accepted: boolean): Promise<PublicationPaper>;
  submitReview(id: string, recommendation: ReviewerRecommendation, privateComments: string): Promise<PublicationPaper>;
  assignReviewer(id: string, reviewerName: string): Promise<PublicationPaper>;
  publishPaper(id: string): Promise<PublicationPaper>;
}

const delay = async (): Promise<void> => {
  await new Promise((resolve) => window.setTimeout(resolve, 120));
};

const clone = <Value,>(value: Value): Value => structuredClone(value);

const matches = (paper: PublicationPaper, query: CatalogQuery): boolean => {
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

class DemoPublicationAdapter implements PublicationAdapter {
  private papers = clone(demoPublicationPapers);

  async getPublicCatalog(query: CatalogQuery): Promise<PagedPublicationResult> {
    await delay();
    const filtered = this.papers
      .filter(canAppearInPublicCatalog)
      .filter((paper) => matches(paper, query))
      .sort((left, right) => {
        if (query.sort === 'TITLE_ASC') return left.title.localeCompare(right.title);
        const leftDate = new Date(left.publishedAt ?? 0).getTime();
        const rightDate = new Date(right.publishedAt ?? 0).getTime();
        return query.sort === 'PUBLISHED_ASC' ? leftDate - rightDate : rightDate - leftDate;
      });
    const start = (query.page - 1) * query.pageSize;
    return {
      items: clone(filtered.slice(start, start + query.pageSize)),
      totalCount: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
      dataSource: 'demo',
    };
  }

  async getResearcherSubmissions(): Promise<PublicationPaper[]> {
    await delay();
    return clone(this.papers);
  }

  async getReviewerAssignments(): Promise<PublicationPaper[]> {
    await delay();
    return clone(this.papers.filter((paper) => paper.status === 'REVIEWER_ASSIGNED' || paper.status === 'UNDER_REVIEW'));
  }

  async getAdminSubmissions(): Promise<PublicationPaper[]> {
    await delay();
    return clone(this.papers);
  }

  async getNotifications(): Promise<PublicationNotification[]> {
    await delay();
    return clone(this.papers.filter((paper) => paper.status === 'PUBLISHED').map((paper) => ({
      id: `demo-notification-${paper.id}`,
      paperId: paper.id,
      message: `Your submission "${paper.title}" is published in the ARS catalog.`,
      createdAt: paper.publishedAt ?? paper.createdAt,
      read: false,
    })));
  }

  async createDraft(input: SubmissionInput): Promise<PublicationPaper> {
    await delay();
    const paper: PublicationPaper = {
      id: `demo-draft-${Date.now()}`,
      ...input,
      version: 1,
      status: 'DRAFT',
      visibility: 'PRIVATE',
      createdAt: new Date().toISOString(),
      reviewerIdentityPublic: false,
      researcherVerificationStatus: 'PENDING',
    };
    this.papers.unshift(paper);
    return clone(paper);
  }

  async submitPaper(id: string): Promise<PublicationPaper> {
    return this.updatePaper(id, (paper) => ({ ...paper, status: 'SUBMITTED', submittedAt: new Date().toISOString() }));
  }

  async respondToAssignment(id: string, accepted: boolean): Promise<PublicationPaper> {
    return this.updatePaper(id, (paper) => ({ ...paper, status: accepted ? 'UNDER_REVIEW' : 'READY_FOR_REVIEWER' }));
  }

  async submitReview(id: string, recommendation: ReviewerRecommendation, privateComments: string): Promise<PublicationPaper> {
    return this.updatePaper(id, (paper) => ({
      ...paper,
      status: recommendation === 'REJECT' ? 'REVIEWER_RECOMMENDED_REJECT' : 'REVIEWER_RECOMMENDED_ACCEPT',
      reviewer: {
        reviewerName: paper.reviewer?.reviewerName ?? 'Assigned reviewer',
        recommendation,
        privateComments,
        privateScores: {},
        submittedAt: new Date().toISOString(),
      },
    }));
  }

  async assignReviewer(id: string, reviewerName: string): Promise<PublicationPaper> {
    return this.updatePaper(id, (paper) => ({
      ...paper,
      status: 'REVIEWER_ASSIGNED',
      reviewer: {
        reviewerName,
        recommendation: 'REVISION_REQUIRED',
        privateComments: '',
        privateScores: {},
      },
    }));
  }

  async publishPaper(id: string): Promise<PublicationPaper> {
    return this.updatePaper(id, (paper) => ({
      ...paper,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: new Date().toISOString(),
    }));
  }

  private async updatePaper(id: string, update: (paper: PublicationPaper) => PublicationPaper): Promise<PublicationPaper> {
    await delay();
    const index = this.papers.findIndex((paper) => paper.id === id);
    if (index < 0) throw new Error('Demo publication record was not found.');
    this.papers[index] = update(this.papers[index]);
    return clone(this.papers[index]);
  }
}

export const publicationAdapter: PublicationAdapter = new DemoPublicationAdapter();
