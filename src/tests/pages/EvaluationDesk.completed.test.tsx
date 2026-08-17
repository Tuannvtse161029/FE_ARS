/**
 * Defect 2A / 2B — EvaluationDesk tests.
 *
 *   - Read-only mode when status === Completed (Save/Submit hidden)
 *   - URL-param fallback (`?reviewRequestId=…`) rehydrates the request
 *   - Submit failure does NOT mark the request Completed
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const {
  getAllMock,
  getByIdMock,
  updateMock,
  detailedCreateMock,
  detailedUpdateMock,
  detailedGetByReviewRequestIdMock,
  paperServiceGetByIdMock,
} = vi.hoisted(() => ({
  getAllMock: vi.fn(),
  getByIdMock: vi.fn(),
  updateMock: vi.fn(),
  detailedCreateMock: vi.fn(),
  detailedUpdateMock: vi.fn(),
  detailedGetByReviewRequestIdMock: vi.fn(),
  paperServiceGetByIdMock: vi.fn(),
}));

vi.mock('../../services/reviewRequest.service', () => ({
  reviewRequestService: {
    getAll: getAllMock,
    getById: getByIdMock,
    create: vi.fn(),
    update: updateMock,
    remove: vi.fn(),
  },
}));

vi.mock('../../services/detailedEvaluation.service', () => ({
  detailedEvaluationService: {
    create: detailedCreateMock,
    update: detailedUpdateMock,
    getByReviewRequestId: detailedGetByReviewRequestIdMock,
  },
}));

vi.mock('../../services/paper.service', () => ({
  paperService: {
    getAll: vi.fn().mockResolvedValue({ items: [] }),
    getById: paperServiceGetByIdMock,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../store/authSlice', () => ({
  useAuthStore: <T,>(selector: (s: { user: { id: number } | null }) => T) =>
    selector({ user: { id: 7 } }),
}));

vi.mock('../../components/PdfViewer', () => ({
  PdfViewer: () => <div data-testid="pdf-viewer-stub" />,
}));

import { EvaluationDesk } from '../../pages/Reviewer/EvaluationDesk';

const baseReq = () => ({
  id: 11,
  paperId: 100,
  reviewerId: 7,
  fee: 50000,
  status: 'Completed',
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-02T00:00:00Z',
});

describe('<EvaluationDesk /> (defect 2A/2B)', () => {
  beforeEach(() => {
    getAllMock.mockReset();
    getByIdMock.mockReset();
    updateMock.mockReset();
    detailedCreateMock.mockReset();
    detailedUpdateMock.mockReset();
    detailedGetByReviewRequestIdMock.mockReset();
    paperServiceGetByIdMock.mockReset();

    detailedGetByReviewRequestIdMock.mockResolvedValue({
      detailedEvaluationId: 1,
      reviewRequestId: 11,
      reviewerId: 7,
      scoreOriginality: 5,
      scoreLiterature: 4,
      scoreMethodology: 5,
      scoreResults: 4,
      scoreFormatting: 5,
      finalDecision: 'Accept',
      generalComments: 'Great paper.',
    });
    paperServiceGetByIdMock.mockResolvedValue({
      id: '100',
      title: 'Test Paper',
      status: '',
    });
    getByIdMock.mockResolvedValue(baseReq());
  });

  it('renders in read-only mode when status is Completed — Save/Submit are hidden, "Back to Review Tasks" is shown', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/review/evaluation', state: { reviewRequest: baseReq() } },
        ]}
      >
        <Routes>
          <Route path="/review/evaluation" element={<EvaluationDesk />} />
          <Route path="/review/tasks" element={<div>Tasks</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText('Test Paper').length).toBeGreaterThan(0));

    // The Save Draft / Submit buttons should not be in the DOM.
    expect(screen.queryByText(/Save Draft/)).toBeNull();
    expect(screen.queryByText(/Submit Final Feedback/)).toBeNull();
    // The "Back to Review Tasks" CTA should be present.
    expect(screen.getByText(/Back to Review Tasks/)).toBeTruthy();
  });

  it('rehydrates the request via ?reviewRequestId=… when location.state is missing (refresh-safe)', async () => {
    render(
      <MemoryRouter initialEntries={['/review/evaluation?reviewRequestId=11']}>
        <Routes>
          <Route path="/review/evaluation" element={<EvaluationDesk />} />
          <Route path="/review/tasks" element={<div>Tasks</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(getByIdMock).toHaveBeenCalledWith(11));
    await waitFor(() => expect(screen.getAllByText('Test Paper').length).toBeGreaterThan(0));
  });

  it('does NOT mark the request Completed when evaluation persistence fails (defect 2A item 5)', async () => {
    // Re-render in EDIT mode (status=Pending). The default `beforeEach` mock
    // returns a `detailedEvaluationId`, so the page enters UPDATE flow.
    // Force it to the CREATE flow so we can verify the BE rejection path.
    detailedGetByReviewRequestIdMock.mockResolvedValueOnce(null);
    const pendingReq = { ...baseReq(), status: 'Pending' };
    detailedCreateMock.mockRejectedValueOnce(new Error('Failed to persist evaluation'));
    updateMock.mockResolvedValue(pendingReq);

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/review/evaluation', state: { reviewRequest: pendingReq } },
        ]}
      >
        <Routes>
          <Route path="/review/evaluation" element={<EvaluationDesk />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText('Test Paper').length).toBeGreaterThan(0));

    // Fill the required field and submit.
    const user = userEvent.setup();
    const textarea = screen.getByPlaceholderText(/Provide detailed feedback/i);
    await user.type(textarea, 'Test comment');
    await user.click(screen.getByText(/Submit Final Feedback/i));

    await waitFor(() => expect(screen.getByText(/Failed to persist/i)).toBeTruthy());

    // CRITICAL: the BE must not have been called to mark Completed when the
    // evaluation persistence failed.
    expect(updateMock).not.toHaveBeenCalled();
  });
});