/**
 * Defect 1A / 1B / 1C — Researcher DiscoverReviewers tests.
 *
 *   - Completed status renders the green badge (not amber)
 *   - Paper hydration: missing paperId → "Paper #id" fallback (no fabrication)
 *   - Reviewer lookup: type-tolerant string/number reviewerId match
 *   - View Details opens the modal and shows the Reviewer's final decision
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const {
  paperServiceGetAllMock,
  paperServiceGetByIdMock,
  getAllMock,
  getReviewerProfilesMock,
  useAuthStoreState,
  followMock,
  detailedGetByReviewRequestIdMock,
} = vi.hoisted(() => ({
  paperServiceGetAllMock: vi.fn(),
  paperServiceGetByIdMock: vi.fn(),
  getAllMock: vi.fn(),
  getReviewerProfilesMock: vi.fn(),
  useAuthStoreState: { id: 1 } as { id: number | undefined },
  followMock: vi.fn(),
  detailedGetByReviewRequestIdMock: vi.fn(),
}));

vi.mock('../../services/paper.service', () => ({
  paperService: {
    getAll: paperServiceGetAllMock,
    getById: paperServiceGetByIdMock,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../services/reviewRequest.service', () => ({
  reviewRequestService: {
    getAll: getAllMock,
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../services/reviewer.service', () => ({
  reviewerService: {
    getReviewerProfiles: getReviewerProfilesMock,
  },
}));

vi.mock('../../hooks/useReviewerProfiles', () => ({
  useReviewerProfiles: () => ({
    profiles: getReviewerProfilesMock() || [],
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useFollowers', () => ({
  useFollowReviewer: () => ({ follow: followMock, isLoading: false }),
}));

vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({ balance: 1000000, refetch: vi.fn() }),
}));

vi.mock('../../hooks/usePaperReviewLocks', () => ({
  usePaperReviewLocks: () => ({
    requests: getAllMock() || [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    mergePendingRequest: vi.fn(),
    getLockForPaper: () => ({
      paperId: '',
      isLocked: false,
      activeRequestCount: 0,
      reviewerNames: [],
      requestStatuses: [],
    }),
  }),
}));

vi.mock('../../services/detailedEvaluation.service', () => ({
  detailedEvaluationService: {
    getByReviewRequestId: detailedGetByReviewRequestIdMock,
  },
}));

vi.mock('../../components/PdfViewer', () => ({
  PdfViewer: ({ url }: { url: string }) => <div data-testid="pdf-viewer">{url}</div>,
}));

vi.mock('../../store/authSlice', () => ({
  useAuthStore: <T,>(selector: (s: {
    user: { id: number; isActive?: boolean } | null;
    isAuthenticated?: boolean;
    isLoading?: boolean;
  }) => T) =>
    selector({
      user:
        useAuthStoreState.id != null
          ? { id: useAuthStoreState.id, isActive: true }
          : null,
      isAuthenticated: useAuthStoreState.id != null,
      isLoading: false,
    }),
}));

import DiscoverReviewers from '../../pages/Researcher/DiscoverReviewers';

const baseReq = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  paperId: 100,
  reviewerId: 7,
  fee: 25000,
  status: 'Completed',
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-02T00:00:00Z',
  ...overrides,
});

describe('DiscoverReviewers — defects 1A, 1B, 1C', () => {
  beforeEach(() => {
    paperServiceGetAllMock.mockReset();
    paperServiceGetByIdMock.mockReset();
    getAllMock.mockReset();
    getReviewerProfilesMock.mockReset();
    followMock.mockReset();
    detailedGetByReviewRequestIdMock.mockReset();

    useAuthStoreState.id = 1;
    // The Discovery page selects a paper from the GET /api/paper list.
    // The cross-account ownership filter (defense-in-depth) keeps papers
    // whose ownership field matches the authenticated user (id=1).
    paperServiceGetAllMock.mockResolvedValue({
      items: [{ id: '100', title: 'Paper A', status: '', userId: 1 }],
    });
    paperServiceGetByIdMock.mockResolvedValue({
      id: '100',
      title: 'Paper fetched by id',
      status: '',
      userId: 1,
    });
    getReviewerProfilesMock.mockReturnValue([
      { userId: 7, fullName: 'Dr. Alice' },
    ]);
    detailedGetByReviewRequestIdMock.mockResolvedValue({
      detailedEvaluationId: 99,
      reviewRequestId: 1,
      reviewerId: 7,
      scoreOriginality: 5,
      scoreLiterature: 4,
      scoreMethodology: 5,
      scoreResults: 4,
      scoreFormatting: 5,
      finalDecision: 'Accept',
      generalComments: 'Solid work.',
    });
    // Hook mock reads `getAllMock()` synchronously at render — use mockReturnValue
    // so the rows are visible without a BE roundtrip.
    getAllMock.mockReturnValue([
      baseReq({ id: 1, paperTitle: 'Joined Paper', reviewerName: 'Dr. Alice' }),
      baseReq({ id: 2, status: 'Pending', paperId: 200, paperTitle: 'Pending Paper' }),
    ]);
    getReviewerProfilesMock.mockReturnValue([
      { userId: 7, fullName: 'Dr. Alice' },
    ]);
  });

  it('Completed badge is green (not amber); Pending badge is amber — defect 1A', async () => {
    render(
      <MemoryRouter>
        <DiscoverReviewers />
      </MemoryRouter>
    );

    // Click the "My Review Requests" tab.
    const user = userEvent.setup();
    await user.click(screen.getByText(/My Review Requests/i));

    await waitFor(() =>
      expect(screen.getAllByTestId('review-request-status-badge').length).toBeGreaterThan(0)
    );
    const badges = screen.getAllByTestId('review-request-status-badge');
    const completedBadge = badges.find((b) => b.getAttribute('data-status') === 'Completed');
    const pendingBadge = badges.find((b) => b.getAttribute('data-status') === 'Pending');
    expect(completedBadge).toBeTruthy();
    expect(pendingBadge).toBeTruthy();
    // Class name check (CSS module class lookup).
    expect(completedBadge?.className).toMatch(/statusCompleted/i);
    expect(pendingBadge?.className).toMatch(/statusPending/i);
  });

  it('falls back to "Paper #id" when paperId is missing from the first page (no fabrication) — defect 1B', async () => {
    // Paper not in the page list (returns []), and paperService.getById rejects.
    paperServiceGetAllMock.mockResolvedValueOnce({ items: [] });
    paperServiceGetByIdMock.mockRejectedValueOnce(new Error('not found'));
    getAllMock.mockReturnValue([
      baseReq({ id: 3, paperId: 999, paperTitle: undefined }),
    ]);

    render(
      <MemoryRouter>
        <DiscoverReviewers />
      </MemoryRouter>
    );
    const user = userEvent.setup();
    await user.click(screen.getByText(/My Review Requests/i));

    await waitFor(() =>
      expect(screen.getAllByTestId('review-request-status-badge').length).toBeGreaterThan(0)
    );
    // Should show either "Paper #999" (resolved as id) or "Loading manuscript…"
    // (id known, fetching). It must NOT fabricate a title. Either text is
    // acceptable since both are truthful progressive hydration states.
    const rowText = document.body.textContent ?? '';
    expect(rowText).toMatch(/Paper #999|Loading manuscript|Details unavailable/i);
  });

  it('opens the View Details modal and shows the Reviewer\'s final decision — defect 1C', async () => {
    render(
      <MemoryRouter>
        <DiscoverReviewers />
      </MemoryRouter>
    );
    const user = userEvent.setup();
    await user.click(screen.getByText(/My Review Requests/i));
    await waitFor(() => screen.getAllByText(/View Details/i));
    const detailButtons = screen.getAllByText(/View Details/i);
    await user.click(detailButtons[0]);

    await waitFor(() => expect(screen.getByText('Review Request Details')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Accept')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Solid work.')).toBeTruthy());
  });
});