import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReviewerAssignments } from '../../../../src/features/publication/reviewer/ReviewerAssignments';
import { publicationAdapter } from '../../../../src/features/publication/api/publication.adapter';
import type { PublicationPaper } from '../../../../src/features/publication/types/publication';

vi.mock('../../../../src/features/publication/api/publication.adapter', () => ({
  publicationAdapter: {
    getReviewerAssignments: vi.fn(),
  },
}));

const buildAssignedPaper = (
  overrides: Partial<PublicationPaper>,
): PublicationPaper => ({
  id: 'assigned-1',
  title: 'Assigned manuscript for review',
  abstract: 'Manuscript awaiting reviewer evaluation.',
  authors: [{ id: 'a-1', name: 'Assigned Author', institutionIds: ['i-1'], order: 1 }],
  institutions: [{ id: 'i-1', name: 'Assigned Institution' }],
  paperType: 'Research article',
  topics: ['Topic A'],
  keywords: ['kw'],
  version: 1,
  status: 'UNDER_REVIEW',
  visibility: 'PRIVATE',
  createdAt: '2026-08-01T00:00:00.000Z',
  submittedAt: '2026-08-05T00:00:00.000Z',
  assignmentCreatedAt: '2026-08-06T00:00:00.000Z',
  reviewDeadline: '2026-08-20T00:00:00.000Z',
  reviewFee: 50000,
  reviewType: 'Editorial',
  aiRecommended: true,
  reviewerIdentityPublic: false,
  researcherVerificationStatus: 'VERIFIED',
  reviewer: {
    reviewerName: 'Prior Reviewer',
    recommendation: 'REVISION_REQUIRED',
    // Strings that must NOT escape into the list rendering — proves the
    // privacy contract from PUBLICATION_FLOW_ARCHITECTURE_REVIEW §10.
    privateComments: 'PRIVATE-COMMENTS-DO-NOT-LEAK',
    privateScores: { originality: 1, methodology: 1, clarity: 1, significance: 1, references: 1 },
    submittedAt: '2026-08-07T00:00:00.000Z',
  },
  ...overrides,
});

const renderList = () =>
  render(
    <MemoryRouter>
      <ReviewerAssignments />
    </MemoryRouter>,
  );

describe('ReviewerAssignments list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an assigned paper as an actionable row', async () => {
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [buildAssignedPaper({})],
    );

    renderList();

    const row = await screen.findByTestId('assignment-row');
    expect(within(row).getByText('Assigned manuscript for review')).toBeInTheDocument();
    expect(within(row).getByText(/Under Review/i)).toBeInTheDocument();
    expect(within(row).getByText(/Ready for evaluation/i)).toBeInTheDocument();
    expect(within(row).getByText(/Assigned: 2026-08-06/i)).toBeInTheDocument();
    expect(within(row).getByText(/Deadline: 2026-08-20/i)).toBeInTheDocument();
    expect(row).toHaveTextContent(/Review type:\s*Editorial/i);
    expect(row).toHaveTextContent(/Fee:\s*50.000 VND/i);
    expect(row).toHaveTextContent(/AI recommended:\s*Yes/i);
    expect(within(row).getByRole('link', { name: /Open assignment/i })).toHaveAttribute(
      'href',
      '/reviewer/assignments/assigned-1',
    );
  });

  it('renders an empty-state when no assignments exist', async () => {
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    renderList();

    expect(await screen.findByTestId('empty-assignments')).toHaveTextContent(
      /No reviewer assignments are ready/i,
    );
  });

  it('never exposes private reviewer comments or scores in the list', async () => {
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [
        buildAssignedPaper({}),
      ],
    );

    const { container } = renderList();
    await screen.findByTestId('assignment-row');

    expect(container.textContent).not.toContain('PRIVATE-COMMENTS-DO-NOT-LEAK');
    // Sanity: the private score map must also be absent from the DOM.
    expect(container.textContent).not.toMatch(/originality:\s*1/);
    // Sanity: the private reviewer name string is still ok to show as a
    // reviewer identity label in a UI that opts in — but our list does
    // NOT render it (no field on the page renders `reviewer.reviewerName`).
    // The `assigned` row only carries paper metadata + status.
    expect(container.querySelector('[data-testid="prior-reviewer"]')).toBeNull();
  });

  it('shows the awaiting-response label for REVIEWER_ASSIGNED status', async () => {
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [
        buildAssignedPaper({ id: 'assigned-awaiting', status: 'REVIEWER_ASSIGNED' }),
      ],
    );

    renderList();
    const row = await screen.findByTestId('assignment-row');
    expect(within(row).getByText(/Awaiting your response/i)).toBeInTheDocument();
  });

  it('shows the awaiting-Admin label for REVIEWER_RECOMMENDED_* status', async () => {
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [
        buildAssignedPaper({
          id: 'assigned-submitted',
          status: 'REVIEWER_RECOMMENDED_ACCEPT',
        }),
      ],
    );

    renderList();
    const row = await screen.findByTestId('assignment-row');
    expect(within(row).getByText(/Review submitted · awaiting Admin/i)).toBeInTheDocument();
  });
});
