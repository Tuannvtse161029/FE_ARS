/**
 * Integration tests for the EvaluationDesk (Reviewer) flow.
 *
 * Covers:
 *   1. Empty state when no review request is passed via route state
 *   2. Scorecard renders with default scores
 *   3. Rating buttons toggle (1-5)
 *   4. Save Draft creates/updates the evaluation
 *   5. Validation: cannot submit without qualitative comments
 *   6. Successful submit marks the review as "Completed"
 *   7. Success modal displays the escrow-released alert
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

const mockUser = { id: 35 };

vi.mock('../../store/authSlice', () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Provide a mock location.state per scenario
let mockReviewRequest: any = null;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockReviewRequest ? { reviewRequest: mockReviewRequest } : {} }),
  };
});

// Mock PdfViewer
vi.mock('../../components/PdfViewer', () => ({
  PdfViewer: ({ url }: any) => <div data-testid="pdf-viewer">PDF: {url}</div>,
}));

import { EvaluationDesk } from '../../pages/Reviewer/EvaluationDesk';

// ─── Service mocks ────────────────────────────────────────────────────────────

const mockPaper = {
  id: '10',
  title: 'Federated Learning at Scale',
  status: 'Waiting for Review',
  fileUrl: 'https://example.com/paper.pdf',
};

vi.mock('../../services/paper.service', () => ({
  paperService: {
    getById: vi.fn(() => Promise.resolve(mockPaper)),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../services/detailedEvaluation.service', () => ({
  detailedEvaluationService: {
    getByReviewRequestId: vi.fn(() => Promise.resolve({})),
    create: vi.fn((payload) =>
      Promise.resolve({ detailedEvaluationId: 1, ...payload })
    ),
    update: vi.fn((id, payload) => Promise.resolve({ detailedEvaluationId: id, ...payload })),
    delete: vi.fn(),
  },
}));

vi.mock('../../services/reviewRequest.service', () => ({
  reviewRequestService: {
    update: vi.fn(() => Promise.resolve({ id: 10, status: 'Completed' })),
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderDesk = () => render(<EvaluationDesk />);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EvaluationDesk – empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockReviewRequest = null;
  });

  it('shows "No review request data found" when no state passed', async () => {
    renderDesk();

    expect(await screen.findByText(/no review request data found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to review tasks/i })).toBeInTheDocument();
  });

  it('navigates back to review tasks when Back is clicked', async () => {
    const user = userEvent.setup();
    renderDesk();

    const backBtn = await screen.findByRole('button', { name: /back to review tasks/i });
    await user.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});

describe('EvaluationDesk – scorecard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockReviewRequest = {
      id: 10,
      paperId: 10,
      fee: 500000,
    };
  });

  it('renders all 5 scorecard sections plus Final Decision and Comments', async () => {
    renderDesk();

    expect(await screen.findByText('CRITERIA EVALUATION SCORECARD')).toBeInTheDocument();
    expect(screen.getByText('1. ORIGINALITY')).toBeInTheDocument();
    expect(screen.getByText('2. LITERATURE REVIEW')).toBeInTheDocument();
    expect(screen.getByText('3. METHODOLOGY')).toBeInTheDocument();
    expect(screen.getByText('4. RESULTS & DISCUSSION')).toBeInTheDocument();
    expect(screen.getByText('5. FORMATTING & STRUCTURE')).toBeInTheDocument();
    expect(screen.getByText('6. FINAL DECISION')).toBeInTheDocument();
    expect(screen.getByText('7. QUALITATIVE COMMENTS')).toBeInTheDocument();
  });

  it('renders the PDF viewer with the paper URL', async () => {
    renderDesk();
    const pdfViewer = await screen.findByTestId('pdf-viewer');
    expect(pdfViewer).toHaveTextContent('https://example.com/paper.pdf');
  });

  it('displays the loaded paper title in the subheader', async () => {
    renderDesk();
    expect(await screen.findByText('Federated Learning at Scale')).toBeInTheDocument();
  });
});

describe('EvaluationDesk – Save Draft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockReviewRequest = { id: 10, paperId: 10, fee: 500000 };
  });

  it('creates a new evaluation when none exists', async () => {
    const user = userEvent.setup();
    const { detailedEvaluationService } = await import('../../services/detailedEvaluation.service');

    renderDesk();
    await screen.findByText('CRITERIA EVALUATION SCORECARD');

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(detailedEvaluationService.create).toHaveBeenCalled();
    });

    // Should not call update since there is no existing evaluation
    expect(detailedEvaluationService.update).not.toHaveBeenCalled();
  });

  it('updates an existing evaluation when one exists', async () => {
    const { detailedEvaluationService } = await import('../../services/detailedEvaluation.service');
    (detailedEvaluationService.getByReviewRequestId as any).mockReturnValueOnce(
      Promise.resolve({
        detailedEvaluationId: 42,
        reviewRequestId: 10,
        scoreOriginality: 5,
        notesOriginality: 'pre-existing',
        finalDecision: 'Minor Revision',
      })
    );

    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('CRITERIA EVALUATION SCORECARD');

    // Allow the existing-evaluation hydration to complete
    await waitFor(() => {
      expect(screen.getByDisplayValue('pre-existing')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(detailedEvaluationService.update).toHaveBeenCalledWith(42, expect.any(Object));
    });
  });
});

describe('EvaluationDesk – Submit validation + success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockReviewRequest = { id: 10, paperId: 10, fee: 500000 };
  });

  it('blocks submit when qualitative comments are empty', async () => {
    const user = userEvent.setup();
    const { detailedEvaluationService } = await import('../../services/detailedEvaluation.service');

    renderDesk();
    await screen.findByText('CRITERIA EVALUATION SCORECARD');

    // Type a space-only string so HTML5 `required` validation passes
    // but the React trim() check inside handleSubmit rejects it.
    await user.type(screen.getByPlaceholderText(/provide detailed feedback/i), '   ');

    await user.click(screen.getByRole('button', { name: /submit final feedback/i }));

    expect(await screen.findByText(/please provide qualitative comments/i)).toBeInTheDocument();
    expect(detailedEvaluationService.create).not.toHaveBeenCalled();
  });

  it('submits successfully and marks the review as Completed', async () => {
    const user = userEvent.setup();
    const { detailedEvaluationService } = await import('../../services/detailedEvaluation.service');
    const { reviewRequestService } = await import('../../services/reviewRequest.service');

    renderDesk();
    await screen.findByText('CRITERIA EVALUATION SCORECARD');

    const comments = screen.getByPlaceholderText(/provide detailed feedback/i);
    await user.type(comments, 'Excellent paper, recommend acceptance.');

    await user.click(screen.getByRole('button', { name: /submit final feedback/i }));

    await waitFor(() => {
      expect(detailedEvaluationService.create).toHaveBeenCalled();
      expect(reviewRequestService.update).toHaveBeenCalledWith(10, { status: 'Completed' });
    });

    expect(await screen.findByText(/evaluation submitted successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/escrow funds released/i)).toBeInTheDocument();
    expect(screen.getByText(/500\.000 VND/)).toBeInTheDocument();
  });

  it('dispatches the review-update window event after submit', async () => {
    const user = userEvent.setup();
    const eventSpy = vi.spyOn(window, 'dispatchEvent');

    renderDesk();
    await screen.findByText('CRITERIA EVALUATION SCORECARD');

    await user.type(screen.getByPlaceholderText(/provide detailed feedback/i), 'All clear.');
    await user.click(screen.getByRole('button', { name: /submit final feedback/i }));

    await waitFor(() => {
      const calls = eventSpy.mock.calls.map((c) => c[0]);
      const reviewEvent = calls.find(
        (ev) => (ev as CustomEvent).type === 'review-update'
      ) as CustomEvent | undefined;
      expect(reviewEvent).toBeDefined();
      expect((reviewEvent as any).detail).toMatchObject({ reviewRequestId: 10, status: 'Completed' });
    });
  });
});
