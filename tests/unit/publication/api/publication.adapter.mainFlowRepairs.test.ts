import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/storage', () => ({ storage: { getUser: () => ({ id: 42, role: 'Reviewer' }) } }));
vi.mock('../../../../src/services/reviewRequest.service', () => ({ reviewRequestService: { getAll: vi.fn(), getById: vi.fn(), update: vi.fn(), create: vi.fn() } }));
vi.mock('../../../../src/services/paper.service', () => ({ paperService: { verifyAuthorship: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), getAll: vi.fn() } }));
vi.mock('../../../../src/services/detailedEvaluation.service', () => ({ detailedEvaluationService: { create: vi.fn(), getByReviewRequestId: vi.fn() } }));
vi.mock('../../../../src/services/notification.service', () => ({ notificationService: { create: vi.fn().mockResolvedValue({}) } }));

import { publicationAdapter } from '../../../../src/features/publication/api/publication.adapter';
import { reviewRequestService } from '../../../../src/services/reviewRequest.service';
import { paperService } from '../../../../src/services/paper.service';
import { detailedEvaluationService } from '../../../../src/services/detailedEvaluation.service';
import { normalizeReviewRequestStatus } from '../../../../src/utils/reviewRequestPolicy';

const request = { id: 7, paperId: 12, reviewerId: 42, status: 'In Progress' };
const paper = { id: 12, title: 'QA manuscript', abstract: 'QA abstract', status: 'Under Review', paperType: 'Journal', fileUrl: 'https://example.test/document.pdf' };

describe('Publication incident contract guards', () => {
  it('calls the dedicated verification operation and confirms the persisted decision', async () => {
    vi.mocked(paperService.getById).mockResolvedValueOnce({ ...paper, openAlexWorkId: 'W123' }).mockResolvedValueOnce({ ...paper, authorshipVerificationStatus: 'VERIFIED' });
    vi.mocked(paperService.verifyAuthorship).mockResolvedValue({ paperId: 12, authorshipVerificationStatus: 'VERIFIED' });
    const result = await publicationAdapter.verifyAuthorship('12', true);
    expect(paperService.verifyAuthorship).toHaveBeenCalledWith('12', 'W123');
    expect(paperService.update).not.toHaveBeenCalled();
    expect(result.researcherVerificationStatus).toBe('VERIFIED');
  });

  it('does not invent verification when the backend ignores the sent decision', async () => {
    vi.mocked(paperService.verifyAuthorship).mockResolvedValue({ paperId: 12, authorshipVerificationStatus: 'PENDING_ADMIN_REVIEW' });
    // The friendly mapper rewrites structured tokens like
    // PENDING_ADMIN_REVIEW into a human-readable phrase (e.g. "Awaiting
    // admin review"). The contract guarded here is that the adapter still
    // throws — never invents a verified Paper — when the BE does not
    // confirm verification, regardless of what the user-visible message
    // looks like.
    await expect(publicationAdapter.verifyAuthorship('12', true)).rejects.toThrow(/Awaiting admin review/i);
    expect(paperService.verifyAuthorship).toHaveBeenCalledWith('12', null);
    expect(paperService.update).not.toHaveBeenCalled();
  });
  it('does not send manual rejection to the automatic verification endpoint', async () => {
    await expect(publicationAdapter.verifyAuthorship('12', false)).rejects.toThrow(/Manual authorship rejection/);
    expect(paperService.verifyAuthorship).not.toHaveBeenCalled();
    expect(paperService.update).not.toHaveBeenCalled();
  });
  it('keeps a directly submitted create response without attempting a Draft transition', async () => {
    vi.mocked(paperService.create).mockResolvedValue({ ...paper, status: 'Submitted' });
    const result = await publicationAdapter.createDraft({ title: paper.title, abstract: paper.abstract, paperType: 'Journal', authors: [], institutions: [], topics: [], keywords: [] }, true);
    expect(result.status).toBe('SUBMITTED');
    expect(paperService.create).toHaveBeenCalledTimes(1);
    expect(paperService.update).not.toHaveBeenCalled();
  });

  it('does not claim successful submission for an unexpected create status', async () => {
    vi.mocked(paperService.create).mockResolvedValue({ ...paper, status: 'Pending' });
    await expect(publicationAdapter.createDraft({ title: paper.title, abstract: paper.abstract, paperType: 'Conference', authors: [], institutions: [], topics: [], keywords: [] }, true)).rejects.toThrow(/created but submission was not confirmed/);
    expect(paperService.update).not.toHaveBeenCalled();
  });
  it('does not equate an Accepted request with a completed evaluation', () => {
    expect(normalizeReviewRequestStatus('Accepted')).not.toBe('COMPLETED');
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(reviewRequestService.getById).mockResolvedValue(request);
    vi.mocked(paperService.getById).mockResolvedValue(paper);
    vi.mocked(detailedEvaluationService.getByReviewRequestId).mockResolvedValue(null as never);
    vi.mocked(detailedEvaluationService.create).mockResolvedValue({ id: 1, finalDecision: 'ACCEPT' } as never);
  });

  it('uses the exact assignment ID, never the paper ID, for evaluation mutations', async () => {
    vi.mocked(reviewRequestService.getById).mockResolvedValueOnce(request).mockResolvedValueOnce({ ...request, status: 'Completed' });
    await publicationAdapter.submitReview('7', 'ACCEPT', 'QA feedback', { originality: 8 });
    expect(reviewRequestService.getById).toHaveBeenCalledWith(7);
    expect(detailedEvaluationService.create).toHaveBeenCalledWith(expect.objectContaining({ reviewRequestId: 7, reviewerId: 42 }));
    expect(reviewRequestService.update).toHaveBeenCalledWith(7, { status: 'Completed' });
    expect(reviewRequestService.getAll).not.toHaveBeenCalled();
  });

  it('rejects another reviewer even when the paper matches', async () => {
    vi.mocked(reviewRequestService.getById).mockResolvedValue({ ...request, reviewerId: 99 });
    await expect(publicationAdapter.submitReview('7', 'ACCEPT', 'QA feedback')).rejects.toThrow(/not available/i);
    expect(detailedEvaluationService.create).not.toHaveBeenCalled();
    expect(reviewRequestService.update).not.toHaveBeenCalled();
  });

  it('rejects a response containing a different assignment ID', async () => {
    vi.mocked(reviewRequestService.getById).mockResolvedValue({ ...request, id: 8 });
    await expect(publicationAdapter.respondToAssignment('7', true)).rejects.toThrow(/not available/i);
    expect(reviewRequestService.update).not.toHaveBeenCalled();
  });

  it('does not submit an evaluation before the assignment is accepted', async () => {
    vi.mocked(reviewRequestService.getById).mockResolvedValue({ ...request, status: 'Pending' });
    await expect(publicationAdapter.submitReview('7', 'ACCEPT', 'QA feedback')).rejects.toThrow(/in-progress/i);
    expect(detailedEvaluationService.create).not.toHaveBeenCalled();
  });

  it('does not mark the request completed when saving the evaluation fails', async () => {
    vi.mocked(detailedEvaluationService.create).mockRejectedValue(new Error('Save failed'));
    await expect(publicationAdapter.submitReview('7', 'ACCEPT', 'QA feedback')).rejects.toThrow('Save failed');
    expect(reviewRequestService.update).not.toHaveBeenCalled();
  });

  it('rejects unconfirmed assignment acceptance', async () => {
    vi.mocked(reviewRequestService.getById).mockResolvedValue({ ...request, status: 'Pending' });
    await expect(publicationAdapter.respondToAssignment('7', true)).rejects.toThrow(/did not confirm/i);
  });

  it('does not invent ACCEPT before any evaluation exists', async () => {
    const result = await publicationAdapter.getReviewerAssignmentById('7');
    expect(result.reviewer?.recommendation).toBeUndefined();
  });

  it('does not infer bibliographic authors or lifecycle dates from account metadata', async () => {
    vi.mocked(paperService.getById).mockResolvedValue({ ...paper, authorId: 123, authorName: 'Account name', updatedAt: '2026-09-01T00:00:00Z' } as never);
    const result = await publicationAdapter.getReviewerAssignmentById('7');
    expect(result.authors).toEqual([]);
    expect(result.submittedAt).toBeUndefined();
    expect(result.publishedAt).toBeUndefined();
  });

  it('blocks undocumented approval and reactivation without writing a paper', async () => {
    await expect(publicationAdapter.approveForReview('12')).rejects.toThrow(/unavailable/i);
    await expect(publicationAdapter.reactivatePublishedPaper('12')).rejects.toThrow(/unavailable/i);
    expect(paperService.update).not.toHaveBeenCalled();
  });

  it('requires the confirmed paperType before issuing a create request', async () => {
    await expect(publicationAdapter.createDraft({ paperType: 'Research article', authors: [] } as never)).rejects.toThrow(/Journal or Conference/i);
    expect(paperService.create).not.toHaveBeenCalled();
  });

  it('sends every author and the selected paper type to the create API', async () => {
    vi.mocked(paperService.create).mockResolvedValue(paper);
    vi.mocked(paperService.update).mockResolvedValue({ ...paper, status: 'Draft' });
    await publicationAdapter.createDraft({ title: paper.title, abstract: paper.abstract, paperType: 'Journal', authors: [{ id: 'a', name: 'Author A', order: 1, institutionIds: [], orcid: '0000-0000-0000-0001' }, { id: 'b', name: 'Author B', order: 2, institutionIds: [] }], institutions: [], topics: [], keywords: [] } as never);
    expect(paperService.create).toHaveBeenCalledWith(expect.objectContaining({ paperType: 'Journal', authors: [{ authorName: 'Author A', orcidId: '0000-0000-0000-0001' }, { authorName: 'Author B', orcidId: null }] }));
  });
});
