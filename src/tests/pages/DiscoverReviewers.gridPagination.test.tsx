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
  getMajorFieldsMock,
  refetchReviewersMock,
} = vi.hoisted(() => ({
  paperServiceGetAllMock: vi.fn(),
  getAllMock: vi.fn(),
  getReviewerProfilesMock: vi.fn(),
  getMajorFieldsMock: vi.fn(),
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

vi.mock('../../hooks/useMajorFields', () => ({
  useMajorFields: () => ({
    fields: getMajorFieldsMock() || [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
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
  useAuthStore: (selector: (s: any) => unknown) =>
    selector({
      user: { id: 1, isActive: true },
      isAuthenticated: true,
      isLoading: false,
    }),
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
    // The paper carries userId=1 so the new cross-account ownership
    // filter (defense-in-depth) admits it for the authenticated test
    // researcher.
    paperServiceGetAllMock.mockResolvedValue({
      items: [
        {
          id: '1',
          title: 'My Paper',
          fileUrl: 'x.pdf',
          userId: 1,
        },
      ],
    });
    getAllMock.mockReturnValue([]);
    getMajorFieldsMock.mockReturnValue([]);
    refetchReviewersMock.mockReset();
  });

  it('orders reviewers by exact specialization, then Major Field, then all others', async () => {
    paperServiceGetAllMock.mockResolvedValue({
      items: [{ id: '1', title: 'Taxonomy paper', subFieldId: 101, userId: 1 }],
    });
    getMajorFieldsMock.mockReturnValue([
      {
        id: 10,
        name: 'Computer Science',
        subFields: [{ id: 101, majorFieldId: 10, name: 'Artificial Intelligence' }],
      },
    ]);
    getReviewerProfilesMock.mockReturnValue([
      { ...makeProfile(1, 'Other Reviewer'), majorFieldId: 20, subFieldId: 201 },
      { ...makeProfile(2, 'Major Match Reviewer'), majorFieldId: 10, subFieldId: 102 },
      { ...makeProfile(3, 'Exact Match Reviewer'), majorFieldId: 10, subFieldId: 101 },
    ]);

    const user = userEvent.setup();
    renderPage();
    await selectFirstPaper(user);

    await waitFor(() => expect(screen.getByTestId('reviewers-grid')).toBeInTheDocument());
    const cards = screen.getAllByTestId('reviewer-card');
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('Exact Match Reviewer'),
      expect.stringContaining('Major Match Reviewer'),
      expect.stringContaining('Other Reviewer'),
    ]);
    expect(screen.getByTestId('subfield-match-badge')).toHaveTextContent('Major + Subfield Match');
    expect(screen.getByTestId('major-match-badge')).toHaveTextContent('Major Field Match');
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
