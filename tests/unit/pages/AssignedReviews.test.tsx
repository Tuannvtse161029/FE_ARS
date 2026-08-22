/**
 * Integration tests for the AssignedReviews (Reviewer) flow.
 *
 * Covers:
 *   1. Tabs render with counts
 *   2. Pending tab — only pending items shown
 *   3. Completed tab — completed items shown with "View Scorecard"
 *   4. Refresh button re-fetches
 *   5. Error state renders when fetch throws
 *   6. Filtering by reviewerId (current user only)
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

// Mock the auth store BEFORE importing the component
const mockUser = { id: 35 };

vi.mock('../../../src/store/authSlice', () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: undefined }),
  };
});

import { AssignedReviews } from '../../../src/pages/Reviewer/AssignedReviews';

// ─── Service mocks ────────────────────────────────────────────────────────────

const allRequests = [
  {
    id: 1,
    paperId: 10,
    reviewerId: 35,
    fee: 500000,
    status: 'Pending',
    deadline: '2026-09-01T00:00:00Z',
    type: 'Peer Review',
    createdAt: '2026-07-10T00:00:00Z',
  },
  {
    id: 2,
    paperId: 11,
    reviewerId: 35,
    fee: 750000,
    status: 'InProgress',
    deadline: '2026-08-30T00:00:00Z',
    type: 'Peer Review',
    createdAt: '2026-07-12T00:00:00Z',
  },
  {
    id: 3,
    paperId: 12,
    reviewerId: 35,
    fee: 600000,
    status: 'Completed',
    deadline: '2026-08-15T00:00:00Z',
    type: 'Peer Review',
    createdAt: '2026-07-01T00:00:00Z',
  },
  {
    id: 4,
    paperId: 13,
    reviewerId: 99,
    fee: 400000,
    status: 'Pending',
    deadline: '2026-09-10T00:00:00Z',
    type: 'Peer Review',
    createdAt: '2026-07-15T00:00:00Z',
  },
];

const mockPapersById: Record<string, any> = {
  10: { id: '10', title: 'Federated Learning at Scale', status: 'Waiting for Review' },
  11: { id: '11', title: 'Modular Monolith Patterns', status: 'In Review' },
  12: { id: '12', title: 'Compiler Optimizations', status: 'Accepted' },
};

vi.mock('../../../src/services/reviewRequest.service', () => ({
  reviewRequestService: {
    getAll: vi.fn(() => Promise.resolve(allRequests)),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/paper.service', () => ({
  paperService: {
    getById: vi.fn((id: string) => {
      const p = mockPapersById[String(id)];
      return p ? Promise.resolve(p) : Promise.reject(new Error('not found'));
    }),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderAssigned = () => render(<AssignedReviews />);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AssignedReviews – page shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders the page title and subtitle', async () => {
    renderAssigned();
    // The text "Review Paper" appears in both the breadcrumb and the H1.
    // Use a heading-specific selector to avoid duplicates.
    expect(screen.getByRole('heading', { name: 'Review Paper', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/manage your review assignments/i)).toBeInTheDocument();
  });

  it('renders all three tabs with counts', async () => {
    renderAssigned();
    await waitFor(() => {
      expect(screen.getByText(/Pending \/ Action Required \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/In Progress \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Completed \(1\)/)).toBeInTheDocument();
    });
  });

  it('filters the list to only the current user (reviewerId=35)', async () => {
    renderAssigned();
    await waitFor(() => {
      // The requests with reviewerId=99 should NEVER appear
      expect(screen.queryByText('Paper #13')).not.toBeInTheDocument();
    });
  });
});

describe('AssignedReviews – Pending tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('shows the pending item with title, deadline and "Evaluate Paper" button', async () => {
    renderAssigned();
    await waitFor(() => {
      expect(screen.getByText('Federated Learning at Scale')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /evaluate paper/i })).toBeInTheDocument();
  });

  it('shows the Locked badge with the fee', async () => {
    renderAssigned();
    await waitFor(() => {
      expect(screen.getByText(/500\.000 VND \(Locked\)/)).toBeInTheDocument();
    });
  });

  it('navigates to the evaluation route when "Evaluate Paper" is clicked', async () => {
    const user = userEvent.setup();
    renderAssigned();
    await waitFor(() => screen.getByText('Federated Learning at Scale'));

    await user.click(screen.getByRole('button', { name: /evaluate paper/i }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/evaluation/),
      expect.objectContaining({ state: expect.anything() })
    );
  });
});

describe('AssignedReviews – Completed tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('shows the completed item with "View Scorecard" button', async () => {
    const user = userEvent.setup();
    renderAssigned();

    // Wait for the initial Pending tab to render the Federated Learning row
    await waitFor(() => screen.getByText('Federated Learning at Scale'));

    await user.click(screen.getByRole('button', { name: /^completed/i }));

    expect(await screen.findByText(/view scorecard/i)).toBeInTheDocument();
    expect(screen.getByText('Compiler Optimizations')).toBeInTheDocument();
  });

  it('shows the "Fee Released" badge instead of "Locked"', async () => {
    const user = userEvent.setup();
    renderAssigned();

    await waitFor(() => screen.getByText('Federated Learning at Scale'));
    await user.click(screen.getByRole('button', { name: /^completed/i }));

    expect(await screen.findByText(/600\.000 VND Released/)).toBeInTheDocument();
  });
});

describe('AssignedReviews – empty + error states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('shows empty state message on the Completed tab when there are none', async () => {
    // Empty the requests array for this test to force the empty state.
    const { reviewRequestService } = await import('../../../src/services/reviewRequest.service');
    (reviewRequestService.getAll as any).mockReturnValueOnce(Promise.resolve([]));

    const user = userEvent.setup();
    renderAssigned();

    await waitFor(() => screen.getByText(/Completed \(0\)/));
    await user.click(screen.getByRole('button', { name: /^completed/i }));

    expect(await screen.findByText(/no completed reviews yet/i)).toBeInTheDocument();
  });

  it('renders an error message when the fetch fails', async () => {
    const { reviewRequestService } = await import('../../../src/services/reviewRequest.service');
    (reviewRequestService.getAll as any).mockImplementationOnce(() =>
      Promise.reject(new Error('Network down'))
    );

    renderAssigned();

    expect(await screen.findByText('Network down')).toBeInTheDocument();
  });
});

describe('AssignedReviews – Refresh button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('re-fetches and updates the list when Refresh is clicked', async () => {
    const user = userEvent.setup();
    const { reviewRequestService } = await import('../../../src/services/reviewRequest.service');

    renderAssigned();
    await waitFor(() => screen.getByText('Federated Learning at Scale'));

    // The Refresh button's accessible name contains the icon "↻" + text "Refresh".
    // Use a partial-match regex.
    const refreshBtn = await screen.findByRole('button', { name: /refresh/i });
    await user.click(refreshBtn);

    expect(reviewRequestService.getAll).toHaveBeenCalledTimes(2);
  });
});

describe('AssignedReviews – deadline display (agent-19 fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('does NOT render "No deadline set" when the BE sends deadline=null', async () => {
    const { reviewRequestService } = await import('../../../src/services/reviewRequest.service');
    (reviewRequestService.getAll as any).mockResolvedValueOnce([
      {
        id: 5,
        paperId: 20,
        reviewerId: 35,
        fee: 300000,
        status: 'Pending',
        deadline: null,   // BE never sets deadline — the fix: no "No deadline set" shown
        type: 'Peer Review',
        createdAt: '2026-08-01T00:00:00Z',
      },
    ]);

    renderAssigned();
    await waitFor(() => screen.getByText('Paper #20'));

    // The "No deadline set" text must NOT appear anywhere on the page.
    // Previously this was rendered even when deadline=null.
    expect(screen.queryByText(/no deadline set/i)).not.toBeInTheDocument();
  });

  it('renders the deadline date when the BE sends a real deadline', async () => {
    renderAssigned();
    await waitFor(() => screen.getByText('Federated Learning at Scale'));
    // The seed data has deadline: '2026-09-01T00:00:00Z'.
    // formatDeadline returns "Deadline: 2026-09-01 • X Days Remaining".
    expect(screen.getByText(/deadline:/i)).toBeInTheDocument();
    // "No deadline set" must still not appear for rows that have a deadline.
    expect(screen.queryByText(/no deadline set/i)).not.toBeInTheDocument();
  });
});
