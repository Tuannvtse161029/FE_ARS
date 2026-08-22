/**
 * Tests for the ScorecardModal (Reviewer) component — live-data version.
 *
 * Covers:
 *   1. Returns null when isOpen is false
 *   2. Renders the Accept branch when evaluation.finalDecision === 'Accept'
 *   3. Renders the Reject branch when evaluation.finalDecision === 'Reject'
 *   4. Renders all 5 criteria + Final Decision when `evaluation` is supplied
 *   5. Closes modal when Close button is clicked
 *   6. Loading / error / empty states when caller does NOT supply `evaluation`
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

const { getByReviewRequestIdMock } = vi.hoisted(() => ({
  getByReviewRequestIdMock: vi.fn(),
}));

vi.mock('../../../src/services/detailedEvaluation.service', () => ({
  detailedEvaluationService: {
    getByReviewRequestId: getByReviewRequestIdMock,
  },
}));

import { ScorecardModal } from '../../../src/pages/Reviewer/components/ScorecardModal';
import type { DetailedEvaluation } from '../../../src/services/detailedEvaluation.service';
import type { ReviewRequest } from '../../../src/services/reviewRequest.service';

const acceptEval: DetailedEvaluation = {
  detailedEvaluationId: 1,
  reviewRequestId: 1,
  reviewerId: 7,
  scoreOriginality: 5,
  notesOriginality: 'novel',
  scoreLiterature: 4,
  notesLiterature: 'thorough',
  scoreMethodology: 5,
  notesMethodology: 'solid',
  scoreResults: 4,
  notesResults: 'good',
  scoreFormatting: 5,
  notesFormatting: 'clean',
  finalDecision: 'Accept',
  generalComments: 'Great paper.',
  createdAt: '2026-07-20T00:00:00Z',
};

const rejectEval: DetailedEvaluation = {
  ...acceptEval,
  finalDecision: 'Reject',
  generalComments: 'Significant methodological issues.',
};

describe('ScorecardModal – live data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getByReviewRequestIdMock.mockReset();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <ScorecardModal
        isOpen={false}
        onClose={() => undefined}
        evaluation={acceptEval}
      />
    );
    expect(screen.queryByText(/criteria evaluation scorecard/i)).not.toBeInTheDocument();
  });

  it('renders the Accept branch when the supplied evaluation has finalDecision = Accept', () => {
    render(
      <ScorecardModal
        isOpen
        onClose={() => undefined}
        evaluation={acceptEval}
      />
    );
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('ACCEPT')).toBeInTheDocument();
  });

  it('renders the Reject branch when the supplied evaluation has finalDecision = Reject', () => {
    render(
      <ScorecardModal
        isOpen
        onClose={() => undefined}
        evaluation={rejectEval}
      />
    );
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('REJECT')).toBeInTheDocument();
  });

  it('renders all 5 numbered criteria + Final Decision row', () => {
    render(
      <ScorecardModal
        isOpen
        onClose={() => undefined}
        evaluation={acceptEval}
      />
    );
    expect(screen.getByText('1. ORIGINALITY')).toBeInTheDocument();
    expect(screen.getByText('2. LITERATURE REVIEW')).toBeInTheDocument();
    expect(screen.getByText('3. METHODOLOGY')).toBeInTheDocument();
    expect(screen.getByText('4. RESULTS & DISCUSSION')).toBeInTheDocument();
    expect(screen.getByText('5. FORMATTING & STRUCTURE')).toBeInTheDocument();
    expect(screen.getByText('6. FINAL DECISION')).toBeInTheDocument();
  });

  it('renders the submission date in the footer', () => {
    render(
      <ScorecardModal
        isOpen
        onClose={() => undefined}
        evaluation={acceptEval}
      />
    );
    expect(screen.getByText(/2026-07-20/)).toBeInTheDocument();
  });

  it('calls onClose when the footer Close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ScorecardModal
        isOpen
        onClose={onClose}
        evaluation={acceptEval}
      />
    );
    await user.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state when reviewRequest is provided but no evaluation exists', async () => {
    const req: Pick<ReviewRequest, 'id' | 'paperId'> = { id: 11, paperId: 100 };
    getByReviewRequestIdMock.mockResolvedValueOnce(null);
    render(
      <ScorecardModal
        isOpen
        onClose={() => undefined}
        reviewRequest={req}
      />
    );
    await waitFor(() =>
      expect(screen.getByText(/has not submitted an evaluation/i)).toBeInTheDocument()
    );
  });

  it('renders the loading state when the evaluation is in flight', async () => {
    const req: Pick<ReviewRequest, 'id' | 'paperId'> = { id: 12, paperId: 100 };
    let resolve!: (eval_: DetailedEvaluation) => void;
    getByReviewRequestIdMock.mockReturnValueOnce(
      new Promise<DetailedEvaluation>((r) => {
        resolve = r;
      })
    );
    render(
      <ScorecardModal
        isOpen
        onClose={() => undefined}
        reviewRequest={req}
      />
    );
    expect(screen.getByText(/Loading evaluation/i)).toBeInTheDocument();
    resolve(acceptEval);
    await waitFor(() => expect(screen.getByText('Accept')).toBeInTheDocument());
  });

  it('renders the error banner when the BE call rejects', async () => {
    const req: Pick<ReviewRequest, 'id' | 'paperId'> = { id: 13, paperId: 100 };
    getByReviewRequestIdMock.mockRejectedValueOnce(new Error('Network 500'));
    render(
      <ScorecardModal
        isOpen
        onClose={() => undefined}
        reviewRequest={req}
      />
    );
    await waitFor(() => expect(screen.getByText('Network 500')).toBeInTheDocument());
  });
});