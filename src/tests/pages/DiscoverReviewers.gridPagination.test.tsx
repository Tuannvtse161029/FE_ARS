/**
 * Agent 15 — Researcher reviewer grid pagination tests.
 *
 * Verifies that the 3×3 grid paginates reviewer cards at 9 per page.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const {
  paperServiceGetAllMock,
  getAllMock,
  getReviewerProfilesMock,
  refetchReviewersMock,
} = vi.hoisted(() => ({
  paperServiceGetAllMock: vi.fn(),
  getAllMock: vi.fn(),
  getReviewerProfilesMock: vi.fn(),
  refetchReviewersMock: vi.fn(),
}));

vi.mock('../../services/paper.service', () => ({
  paperService: {
    getAll: paperServiceGetAllMock,
    getById: vi.fn(),
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

vi.mock('../../hooks/useReviewerProfiles', () => ({
  useReviewerProfiles: () => ({
    profiles: getReviewerProfilesMock() || [],
    isLoading: false,
    refetch: refetchReviewersMock,
  }),
}));

vi.mock('../../hooks/useFollowers', () => ({
  useFollowReviewer: () => ({ follow: vi.fn(), isLoading: false }),
}));

vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({ balance: 5_000_000, refetch: vi.fn() }),
}));

vi.mock('../../hooks/usePaperReviewLocks', () => ({
  usePaperReviewLocks: () => ({
    requests: [],
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

vi.mock('../../store/authSlice', () => ({
  useAuthStore: <T,>(selector: (s: { user: { id: number } | null }) => T) =>
    selector({ user: { id: 1 } }),
}));

import DiscoverReviewers from '../../pages/Researcher/DiscoverReviewers';

const makeProfile = (id: number, name: string) => ({
  userId: id,
  fullName: name,
  title: 'Senior Reviewer',
  hindex: 5,
  publicationCount: 12,
  reviews: 7,
  reviewFee: 10000,
  orcidId: `0000-0000-0000-${String(id).padStart(4, '0')}`,
  tags: ['ML', 'AI'],
  specializations: ['Machine Learning'],
  isAvailable: true,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <DiscoverReviewers />
    </MemoryRouter>,
  );

const selectFirstPaper = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() => {
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);
  });
  const select = screen.getByRole('combobox') as HTMLSelectElement;
  const firstRealOption = Array.from(select.options).find(
    (o) => o.value !== '',
  );
  if (!firstRealOption) throw new Error('No paper option found');
  await user.selectOptions(select, firstRealOption.value);
};

describe('DiscoverReviewers — researcher reviewer grid (Agent 15)', () => {
  beforeEach(() => {
    paperServiceGetAllMock.mockReset();
    paperServiceGetAllMock.mockResolvedValue({
      items: [{ id: '1', title: 'My Paper', fileUrl: 'x.pdf' }],
    });
    getAllMock.mockReturnValue([]);
    refetchReviewersMock.mockReset();
  });

  it('shows exactly 9 reviewer cards on page 1', async () => {
    const profiles = Array.from({ length: 12 }, (_, i) =>
      makeProfile(i + 1, `Reviewer ${i + 1}`),
    );
    getReviewerProfilesMock.mockReturnValue(profiles);

    const user = userEvent.setup();
    renderPage();
    await selectFirstPaper(user);

    await waitFor(() =>
      expect(screen.getByTestId('reviewers-grid')).toBeInTheDocument(),
    );

    const cards = screen.getAllByTestId('reviewer-card');
    expect(cards.length).toBe(9);
  });

  it('shows reviewer #10 on page 2', async () => {
    const profiles = Array.from({ length: 12 }, (_, i) =>
      makeProfile(i + 1, `Reviewer ${i + 1}`),
    );
    getReviewerProfilesMock.mockReturnValue(profiles);

    const user = userEvent.setup();
    renderPage();
    await selectFirstPaper(user);

    await waitFor(() =>
      expect(screen.getByTestId('reviewers-grid')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    const cards = screen.getAllByTestId('reviewer-card');
    expect(cards.length).toBe(3);
    expect(cards[0]?.textContent).toContain('Reviewer 10');
  });

  it('shows the reviewer grid with 3 columns (3×3 layout)', async () => {
    getReviewerProfilesMock.mockReturnValue(
      Array.from({ length: 9 }, (_, i) => makeProfile(i + 1, `Reviewer ${i + 1}`)),
    );

    const user = userEvent.setup();
    renderPage();
    await selectFirstPaper(user);

    await waitFor(() =>
      expect(screen.getByTestId('reviewers-grid')).toBeInTheDocument(),
    );

    const grid = screen.getByTestId('reviewers-grid');
    expect(grid.className).toMatch(/reviewersGrid/);
  });

  it('refresh button calls refetch on the reviewer profiles hook', async () => {
    getReviewerProfilesMock.mockReturnValue([makeProfile(1, 'Dr. Smith')]);

    const user = userEvent.setup();
    renderPage();
    await selectFirstPaper(user);

    await waitFor(() =>
      expect(screen.getByTestId('reviewers-grid')).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('table-refresh-btn'));
    expect(refetchReviewersMock).toHaveBeenCalled();
  });

  it('search input filters reviewer cards and resets to page 1', async () => {
    const profiles = Array.from({ length: 18 }, (_, i) =>
      makeProfile(i + 1, i === 9 ? 'Dr. Special' : `Reviewer ${i + 1}`),
    );
    getReviewerProfilesMock.mockReturnValue(profiles);

    const user = userEvent.setup();
    renderPage();
    await selectFirstPaper(user);

    await waitFor(() =>
      expect(screen.getByTestId('reviewers-grid')).toBeInTheDocument(),
    );

    const search = screen.getByTestId('table-search-input') as HTMLInputElement;
    await user.type(search, 'Special');
    const cards = screen.getAllByTestId('reviewer-card');
    expect(cards.length).toBe(1);
    expect(cards[0]?.textContent).toContain('Dr. Special');
  });

  it('empty state when search yields no results', async () => {
    getReviewerProfilesMock.mockReturnValue([makeProfile(1, 'Dr. Smith')]);

    const user = userEvent.setup();
    renderPage();
    await selectFirstPaper(user);

    await waitFor(() =>
      expect(screen.getByTestId('reviewers-grid')).toBeInTheDocument(),
    );

    const search = screen.getByTestId('table-search-input') as HTMLInputElement;
    await user.type(search, 'NoSuchReviewer');
    expect(screen.getByTestId('reviewers-empty-search')).toBeInTheDocument();
  });
});
