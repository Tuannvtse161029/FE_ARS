/**
 * Integration tests for the DiscoverReviewers (Researcher) flow.
 *
 * Covers:
 *   1. Idle state — tabs render, paper selector hint visible, no cards
 *   2. Paper selection — reviewer list appears with seeded profiles
 *   3. Wallet insufficient funds — Add Fund button shows instead of Request Review
 *   4. Create-request screen — escrow policy gate, validation errors
 *   5. Successful submission — wallet deducts, success modal, navigates to My Requests
 *   6. My Review Requests tab — list rendered with status pill
 *   7. Refresh button — re-fetches profiles + papers, shows spinning icon
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { DiscoverReviewers } from '../../pages/Researcher/DiscoverReviewers';

// ─── Service mocks ────────────────────────────────────────────────────────────

const mockReviewerProfiles = [
  {
    userId: 34,
    orcidId: '0000-0001-0000-0034',
    hindex: 18,
    totalCitations: 1200,
    publicationCount: 45,
    syncStatus: 'synced',
    reviewFee: 500000,
    fullName: 'Dr. Nguyen Van A',
    title: 'Senior Lecturer',
    avatarBg: '#1D2A4A',
    reviews: 142,
    tags: ['#ComputerScience', '#DistributedSystems'],
    specializations: ['Machine Learning', 'Data Science'],
    isAvailable: true,
  },
  {
    userId: 35,
    orcidId: '0000-0001-0000-0035',
    hindex: 24,
    totalCitations: 3200,
    publicationCount: 78,
    syncStatus: 'synced',
    reviewFee: 750000,
    fullName: 'Prof. Tran Minh B',
    title: 'Associate Professor',
    avatarBg: '#3b82f6',
    reviews: 203,
    tags: ['#SoftwareEngineering', '#CloudComputing'],
    specializations: ['Distributed Systems', 'Cloud Computing'],
    isAvailable: true,
  },
  {
    userId: 36,
    orcidId: '0000-0001-0000-0036',
    hindex: 11,
    totalCitations: 480,
    publicationCount: 22,
    syncStatus: 'synced',
    reviewFee: 400000,
    fullName: 'Dr. Le Thi C',
    title: 'Research Fellow',
    avatarBg: '#f59e0b',
    reviews: 89,
    tags: ['#DistributedSystems', '#NetworkSystems'],
    specializations: ['Mobile Networks', 'IoT Protocols'],
    isAvailable: true,
  },
];

const mockPapers = {
  items: [
    { id: '1', title: 'Quantum Routing Protocols', status: 'Waiting for Review' },
    { id: '2', title: 'Federated Learning at Scale', status: 'Waiting for Review' },
  ],
};

const mockRequests = [
  {
    id: 100,
    paperId: 1,
    paperTitle: 'Quantum Routing Protocols',
    reviewerId: 35,
    reviewerName: 'Prof. Tran Minh B',
    fee: 775000,
    status: 'Pending',
    createdAt: '2026-07-15T10:00:00Z',
  },
];

vi.mock('../../services/reviewer.service', () => ({
  reviewerService: {
    getAll: vi.fn(() => Promise.resolve(mockReviewerProfiles)),
  },
}));

vi.mock('../../services/paper.service', () => ({
  paperService: {
    getAll: vi.fn(() => Promise.resolve(mockPapers)),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../services/reviewRequest.service', () => ({
  reviewRequestService: {
    getAll: vi.fn(() => Promise.resolve(mockRequests)),
    create: vi.fn((payload) =>
      Promise.resolve({ id: 999, ...payload, status: payload.status ?? 'Pending', createdAt: new Date().toISOString() })
    ),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// The page now reads the wallet from BE — stub it to return a fixed balance.
vi.mock('../../services/wallet.service', () => ({
  walletService: {
    getAll: vi.fn(() => Promise.resolve([{ id: 1, userId: 1, balance: 5000000 }])),
    getById: vi.fn(),
  },
}));

// Follow API is best-effort; the page swallows failures so a no-op is fine.
vi.mock('../../services/follower.service', () => ({
  followerService: {
    getAll: vi.fn(() => Promise.resolve([])),
    follow: vi.fn(() => Promise.resolve({ id: 1, followerId: 1, followedId: 34 })),
    unfollow: vi.fn(() => Promise.resolve()),
  },
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

const renderDiscover = () => render(<DiscoverReviewers />);

// Switch into create-request screen for a given reviewer.
// Three reviewer cards each have a "Request Review" button, so we scope the
// click to the card whose heading contains the reviewer's name.
const goToCreateRequest = async (
  user: ReturnType<typeof userEvent.setup>,
  reviewerName: string
) => {
  const selects = await screen.findAllByRole('combobox');
  // The Discover tab's paper selector is the FIRST select on the page.
  await user.selectOptions(selects[0], '1');

  // Wait until the reviewer cards have rendered, then scope the click to one card
  const reviewerHeading = await screen.findByText(reviewerName);
  const card = reviewerHeading.closest('div[class*="reviewerCard"]') as HTMLElement;
  const requestBtn = within(card).getByRole('button', { name: /request review/i });
  await user.click(requestBtn);

  // Wait for the create-request screen to render
  await screen.findByText('Create Peer Review Request');
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DiscoverReviewers – idle state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders page title', () => {
    renderDiscover();
    expect(screen.getByText('Reviewers List')).toBeInTheDocument();
  });

  it('renders both tabs', () => {
    renderDiscover();
    expect(screen.getByRole('button', { name: /discover reviewers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my review requests/i })).toBeInTheDocument();
  });

  it('shows the paper selector prompt', () => {
    renderDiscover();
    expect(screen.getByText(/please select a paper above to discover reviewers/i)).toBeInTheDocument();
  });

  it('populates the paper dropdown', async () => {
    renderDiscover();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Quantum Routing Protocols' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Federated Learning at Scale' })).toBeInTheDocument();
    });
  });
});

describe('DiscoverReviewers – reviewer cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders one card per seeded reviewer after selecting a paper', async () => {
    const user = userEvent.setup();
    renderDiscover();

    const selects = await screen.findAllByRole('combobox');
    await user.selectOptions(selects[0], '1');

    expect(await screen.findByText('Dr. Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByText('Prof. Tran Minh B')).toBeInTheDocument();
    expect(screen.getByText('Dr. Le Thi C')).toBeInTheDocument();
  });

  it('shows H-Index, Publications, Reviews counts on each card', async () => {
    const user = userEvent.setup();
    renderDiscover();
    const selects = await screen.findAllByRole('combobox');
    await user.selectOptions(selects[0], '1');

    await screen.findByText('Dr. Nguyen Van A');

    const hIndexLabels = screen.getAllByText('H-Index');
    expect(hIndexLabels.length).toBeGreaterThanOrEqual(3);

    expect(screen.getAllByText('Publications').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('Reviews').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the review fee in VND on each card', async () => {
    const user = userEvent.setup();
    renderDiscover();
    const selects = await screen.findAllByRole('combobox');
    await user.selectOptions(selects[0], '1');

    await screen.findByText('Dr. Nguyen Van A');
    expect(screen.getByText(/500\.000 VND/)).toBeInTheDocument();
    expect(screen.getByText(/750\.000 VND/)).toBeInTheDocument();
    expect(screen.getByText(/400\.000 VND/)).toBeInTheDocument();
  });

  it('shows "Add Fund to Wallet" when wallet balance is below reviewer fee', async () => {
    // Re-mock the wallet service to return balance 0 for this case.
    const { walletService } = await import('../../services/wallet.service');
    vi.mocked(walletService.getAll).mockResolvedValueOnce([{ id: 1, userId: 1, balance: 0 }]);

    const user = userEvent.setup();
    renderDiscover();
    const selects = await screen.findAllByRole('combobox');
    await user.selectOptions(selects[0], '1');

    await screen.findByText('Dr. Nguyen Van A');
    const addFundButtons = screen.getAllByRole('button', { name: /add fund to wallet/i });
    expect(addFundButtons.length).toBe(3);
  });

  it('hides reviewers flagged as unavailable by the BE', async () => {
    // Re-mock reviewers with user 36 marked unavailable for this case.
    const { reviewerService } = await import('../../services/reviewer.service');
    vi.mocked(reviewerService.getAll).mockResolvedValueOnce([
      ...mockReviewerProfiles.slice(0, 2),
      { ...mockReviewerProfiles[2], isAvailable: false },
    ]);

    const user = userEvent.setup();
    renderDiscover();
    const selects = await screen.findAllByRole('combobox');
    await user.selectOptions(selects[0], '1');

    await screen.findByText('Dr. Nguyen Van A');
    expect(screen.queryByText('Dr. Le Thi C')).not.toBeInTheDocument();
  });
});

describe('DiscoverReviewers – create request screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Start with enough funds for all reviewers
    localStorage.setItem('ars_wallet', '5000000');
  });

  it('opens create-request screen with reviewer summary', async () => {
    const user = userEvent.setup();
    renderDiscover();
    await goToCreateRequest(user, 'Dr. Nguyen Van A');

    expect(screen.getByText('Create Peer Review Request')).toBeInTheDocument();
    expect(screen.getByText('ORCID:')).toBeInTheDocument();
  });

  it('shows the Escrow & Refund Policy card', async () => {
    const user = userEvent.setup();
    renderDiscover();
    await goToCreateRequest(user, 'Dr. Nguyen Van A');

    expect(screen.getAllByText(/escrow & refund policy/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/funds will be locked in escrow/i)).toBeInTheDocument();
  });

  it('disables Submit until the policy is accepted', async () => {
    const user = userEvent.setup();
    renderDiscover();
    await goToCreateRequest(user, 'Dr. Nguyen Van A');

    const submit = screen.getByRole('button', { name: /confirm & submit request/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(submit).not.toBeDisabled();
  });

  it('returns to the list when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderDiscover();
    await goToCreateRequest(user, 'Dr. Nguyen Van A');

    await user.click(screen.getByRole('button', { name: /^cancel/i }));
    expect(screen.getByText('Reviewers List')).toBeInTheDocument();
  });
});

describe('DiscoverReviewers – successful submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Wallet balance is now server-driven; tests assume a 5,000,000 VND wallet.
  });

  it('submits the request and shows the success modal', async () => {
    const user = userEvent.setup();
    renderDiscover();

    const selects = await screen.findAllByRole('combobox');
    await user.selectOptions(selects[0], '1');

    const reviewerHeading = await screen.findByText('Dr. Nguyen Van A');
    const card = reviewerHeading.closest('div[class*="reviewerCard"]') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: /request review/i }));

    await screen.findByText('Create Peer Review Request');

    const notes = screen.getByPlaceholderText(/describe your review requirements/i);
    await user.type(notes, 'Please focus on the methodology section.');

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /confirm & submit request/i }));

    expect(await screen.findByText(/review request submitted successfully/i)).toBeInTheDocument();
  });

  it('navigates to My Review Requests when "Go to My Review Requests" is clicked', async () => {
    const user = userEvent.setup();
    renderDiscover();
    const selects = await screen.findAllByRole('combobox');
    await user.selectOptions(selects[0], '1');

    const reviewerHeading = await screen.findByText('Dr. Nguyen Van A');
    const card = reviewerHeading.closest('div[class*="reviewerCard"]') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: /request review/i }));
    await screen.findByText('Create Peer Review Request');

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /confirm & submit request/i }));

    const goToBtn = await screen.findByRole('button', { name: /go to my review requests/i });
    await user.click(goToBtn);

    expect(screen.getByRole('button', { name: /my review requests/i })).toHaveClass(/tabBtnActive/);
  });
});

describe('DiscoverReviewers – My Review Requests tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the requests table with seeded requests', async () => {
    const user = userEvent.setup();
    renderDiscover();

    await user.click(screen.getByRole('button', { name: /my review requests/i }));

    await waitFor(() => {
      expect(screen.getByText('Quantum Routing Protocols')).toBeInTheDocument();
    });

    expect(screen.getByText('Prof. Tran Minh B')).toBeInTheDocument();
    expect(screen.getByText(/775\.000 VND/)).toBeInTheDocument();
  });
});
