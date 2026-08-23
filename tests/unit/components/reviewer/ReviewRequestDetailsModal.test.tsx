import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { getByReviewRequestIdMock, paperServiceGetByIdMock } = vi.hoisted(() => ({
  getByReviewRequestIdMock: vi.fn(),
  paperServiceGetByIdMock: vi.fn(),
}));

vi.mock('../../../../../src/services/detailedEvaluation.service', () => ({
  detailedEvaluationService: {
    getByReviewRequestId: getByReviewRequestIdMock,
  },
}));

vi.mock('../../../../../src/services/paper.service', () => ({
  paperService: {
    getById: paperServiceGetByIdMock,
  },
}));

vi.mock('../../../../../src/components/PdfViewer', () => {
  const Mock = ({ url }: { url: string }) => <div data-testid="pdf-viewer">{url}</div>;
  return {
    PdfViewer: Mock,
    default: Mock,
  };
});

import { ReviewRequestDetailsModal } from '../../../../../src/components/reviewer/ReviewRequestDetailsModal';
import type { ReviewRequest } from '../../../../../src/services/reviewRequest.service';
import type { Paper } from '../../../../../src/services/paper.service';
import type { DetailedEvaluation } from '../../../../../src/services/detailedEvaluation.service';

const makeReq = (overrides: Partial<ReviewRequest> = {}): ReviewRequest => ({
  id: 99,
  paperId: 100,
  reviewerId: 7,
  fee: 50000,
  status: 'Completed',
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-02T00:00:00Z',
  paperTitle: 'My Paper',
  reviewerName: 'Alice Reviewer',
  ...overrides,
});

const makeEval = (overrides: Partial<DetailedEvaluation> = {}): DetailedEvaluation => ({
  detailedEvaluationId: 1,
  reviewRequestId: 99,
  reviewerId: 7,
  scoreOriginality: 5,
  notesOriginality: 'novel',
  scoreLiterature: 4,
  notesLiterature: 'thorough',
  scoreMethodology: 5,
  notesMethodology: 'solid',
  scoreResults: 4,
  notesResults: 'good',
  scoreFormatting: 3,
  notesFormatting: 'minor issues',
  finalDecision: 'Accept',
  generalComments: 'Great paper overall.',
  createdAt: '2026-02-02T00:00:00Z',
  ...overrides,
});

const reviewerLookup = (req: Pick<ReviewRequest, 'reviewerId' | 'reviewerName'>) => {
  if (req.reviewerName) {
    return { name: req.reviewerName, initials: 'AR', avatarBg: '#1D2A4A' };
  }
  return null;
};

describe('<ReviewRequestDetailsModal /> (defect 1C)', () => {
  beforeEach(() => {
    getByReviewRequestIdMock.mockReset();
    paperServiceGetByIdMock.mockReset();
  });

  it('renders manuscript title, reviewer name, id, dates, fee, status — and the evaluation', async () => {
    getByReviewRequestIdMock.mockResolvedValueOnce(makeEval());
    paperServiceGetByIdMock.mockResolvedValueOnce({
      id: '100',
      title: 'My Paper',
      status: '',
      fileUrl: 'https://example.com/p.pdf',
    } as Paper);

    render(
      <ReviewRequestDetailsModal
        isOpen
        request={makeReq()}
        papersById={new Map()}
        extraPapersById={new Map()}
        reviewerLookup={reviewerLookup}
        onClose={() => undefined}
      />
    );

    expect(screen.getByText('Review Request Details')).toBeTruthy();
    expect(screen.getByText('#99')).toBeTruthy();
    expect(screen.getByText('My Paper')).toBeTruthy();
    expect(screen.getByText('Alice Reviewer')).toBeTruthy();
    expect(screen.getByText(/50\.000 VND/)).toBeTruthy();
    // Wait for the evaluation to render.
    await waitFor(() => expect(screen.getByText('Great paper overall.')).toBeTruthy());
    expect(screen.getByText('Accept')).toBeTruthy();
  });

  it('renders the truthful inconsistency warning when status=Completed but no evaluation can be loaded', async () => {
    // BE returns no evaluation row.
    getByReviewRequestIdMock.mockResolvedValueOnce(null);
    render(
      <ReviewRequestDetailsModal
        isOpen
        request={makeReq({ status: 'Completed' })}
        papersById={new Map()}
        reviewerLookup={reviewerLookup}
        onClose={() => undefined}
      />
    );
    await waitFor(() =>
      expect(
        screen.getByText(/This review is marked Completed but the associated Detailed Evaluation could not be loaded/i)
      ).toBeTruthy()
    );
  });

  it('renders the "not submitted yet" hint when status is Pending and no evaluation exists', async () => {
    getByReviewRequestIdMock.mockResolvedValueOnce(null);
    render(
      <ReviewRequestDetailsModal
        isOpen
        request={makeReq({ status: 'Pending' })}
        papersById={new Map()}
        reviewerLookup={reviewerLookup}
        onClose={() => undefined}
      />
    );
    await waitFor(() =>
      expect(screen.getByText(/has not submitted an evaluation yet/i)).toBeTruthy()
    );
  });

  it('renders the error banner when the BE fetch fails', async () => {
    getByReviewRequestIdMock.mockRejectedValueOnce(new Error('Network 500'));
    render(
      <ReviewRequestDetailsModal
        isOpen
        request={makeReq({ status: 'Completed' })}
        papersById={new Map()}
        reviewerLookup={reviewerLookup}
        onClose={() => undefined}
      />
    );
    await waitFor(() => expect(screen.getByText('Network 500')).toBeTruthy());
  });

  it('does NOT render anything when isOpen is false', () => {
    render(
      <ReviewRequestDetailsModal
        isOpen={false}
        request={makeReq()}
        papersById={new Map()}
        reviewerLookup={reviewerLookup}
        onClose={() => undefined}
      />
    );
    expect(screen.queryByText('Review Request Details')).toBeNull();
  });

  it('invokes onClose when the Close button is clicked', async () => {
    getByReviewRequestIdMock.mockResolvedValueOnce(makeEval());
    const onClose = vi.fn();
    render(
      <ReviewRequestDetailsModal
        isOpen
        request={makeReq()}
        papersById={new Map()}
        reviewerLookup={reviewerLookup}
        onClose={onClose}
      />
    );
    const user = userEvent.setup();
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});