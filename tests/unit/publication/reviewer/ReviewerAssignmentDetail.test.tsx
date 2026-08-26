import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReviewerAssignmentDetail } from '../../../../src/features/publication/reviewer/ReviewerAssignmentDetail';
import { publicationAdapter } from '../../../../src/features/publication/api/publication.adapter';
import type { PublicationPaper } from '../../../../src/features/publication/types/publication';

vi.mock('../../../../src/features/publication/api/publication.adapter', () => ({
  publicationAdapter: {
    getReviewerAssignments: vi.fn(),
    getAdminSubmissions: vi.fn(),
    respondToAssignment: vi.fn(),
    submitReview: vi.fn(),
  },
}));

const buildUnderReviewPaper = (
  overrides: Partial<PublicationPaper> = {},
): PublicationPaper => ({
  id: 'under-review-1',
  title: 'Manuscript for Reviewer Evaluation',
  abstract: 'A submission that requires a full reviewer evaluation.',
  authors: [
    { id: 'a-1', name: 'Lead Author', institutionIds: ['i-1'], orcid: '0000-0000-0000-0001', order: 1 },
    { id: 'a-2', name: 'Co Author', institutionIds: ['i-1'], order: 2 },
  ],
  institutions: [{ id: 'i-1', name: 'University of ARS' }],
  doi: '10.5555/test.001',
  openAlexId: 'W000000001',
  publicationDate: '2026-08-22',
  paperType: 'Research article',
  domain: 'Computer science',
  field: 'Software engineering',
  subfield: 'Formal methods',
  topics: ['Topic A', 'Topic B'],
  keywords: ['kw1', 'kw2'],
  fileUrl: 'https://example.test/manuscript.pdf',
  version: 2,
  status: 'UNDER_REVIEW',
  visibility: 'PRIVATE',
  createdAt: '2026-08-01T00:00:00.000Z',
  submittedAt: '2026-08-05T00:00:00.000Z',
  reviewerIdentityPublic: false,
  researcherVerificationStatus: 'VERIFIED',
  ...overrides,
});

const buildAwaitingPaper = (): PublicationPaper =>
  buildUnderReviewPaper({ id: 'awaiting-1', status: 'REVIEWER_ASSIGNED' });

const renderAt = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/reviewer/assignments/:id" element={<ReviewerAssignmentDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ReviewerAssignmentDetail — privacy & metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders required paper metadata and PDF view affordance for an assigned UNDER_REVIEW paper', async () => {
    const paper = buildUnderReviewPaper({});
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [paper],
    );

    renderAt('/reviewer/assignments/under-review-1');

    // Title
    expect(
      await screen.findByRole('heading', { name: /Manuscript for Reviewer Evaluation/i }),
    ).toBeInTheDocument();

    // Authors + institutions
    expect(screen.getByText(/Lead Author/)).toBeInTheDocument();
    expect(screen.getByText(/Co Author/)).toBeInTheDocument();
    expect(screen.getByText(/University of ARS/)).toBeInTheDocument();

    // Identifiers — DOI, OpenAlex, paper type, version, verification
    expect(screen.getByText(/10.5555\/test.001/)).toBeInTheDocument();
    expect(screen.getByText(/W000000001/)).toBeInTheDocument();
    expect(screen.getByText(/Research article/)).toBeInTheDocument();
    expect(screen.getByText(/VERIFIED/)).toBeInTheDocument();

    // PDF view: iframe present + download anchor
    const pdf = await screen.findByTestId('pdf-frame');
    expect(pdf).toBeInTheDocument();
    const iframe = within(pdf).getByTitle(/PDF preview/i);
    expect(iframe).toHaveAttribute('src', 'https://example.test/manuscript.pdf');
    const link = within(pdf).getByRole('link', { name: /Download manuscript/i });
    expect(link).toHaveAttribute('download');
    expect(link).toHaveAttribute('href', 'https://example.test/manuscript.pdf');
  });

  it('shows a "no file URL" notice when the paper does not carry a fileUrl', async () => {
    const paper = buildUnderReviewPaper({ fileUrl: undefined });
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [paper],
    );

    renderAt('/reviewer/assignments/under-review-1');

    expect(
      await screen.findByText(/No manuscript file URL is available/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-frame')).toBeNull();
  });

  it('never renders prior reviewer private comments or scores', async () => {
    const paper = buildUnderReviewPaper({
      reviewer: {
        reviewerName: 'Prior Reviewer',
        recommendation: 'REVISION_REQUIRED',
        // The strings below MUST NOT appear anywhere on the page.
        privateComments: 'PRIVATE-LEAK-GUARD-COMMENTS',
        privateScores: { originality: 1, methodology: 1, clarity: 1, significance: 1, references: 1 },
      },
    });
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [paper],
    );

    const { container } = renderAt('/reviewer/assignments/under-review-1');
    await screen.findByRole('heading', { name: /Manuscript for Reviewer Evaluation/i });
    expect(container.textContent).not.toContain('PRIVATE-LEAK-GUARD-COMMENTS');
    expect(container.textContent).not.toMatch(/originality:\s*1/);
  });
});

describe('ReviewerAssignmentDetail — Evaluate Paper gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Accept / Decline and NOT the Evaluate Paper form for REVIEWER_ASSIGNED', async () => {
    const paper = buildAwaitingPaper();
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [paper],
    );

    renderAt('/reviewer/assignments/awaiting-1');

    expect(await screen.findByRole('button', { name: /Accept assignment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decline assignment/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit private review to Admin/i })).toBeNull();
    expect(screen.queryByTestId('evaluate-form')).toBeNull();
  });

  it('renders the Evaluate Paper form with all criteria + recommendation + private comments for UNDER_REVIEW', async () => {
    const paper = buildUnderReviewPaper({});
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [paper],
    );

    renderAt('/reviewer/assignments/under-review-1');

    const form = await screen.findByTestId('evaluate-form');
    expect(form).toBeInTheDocument();

    // All five criteria inputs present (one fieldset per criterion).
    expect(screen.getByRole('group', { name: /Originality/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Methodology/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Clarity/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Significance/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /References/i })).toBeInTheDocument();

    // Private comments textarea
    expect(screen.getByLabelText(/Private review feedback for Admin/i)).toBeInTheDocument();

    // Recommendation select contains all three options
    const select = screen.getByLabelText(/Recommendation/i) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toEqual(expect.arrayContaining(['ACCEPT', 'REVISION_REQUIRED', 'REJECT']));

    // Submit button
    expect(screen.getByRole('button', { name: /Submit private review to Admin/i })).toBeInTheDocument();
  });

  it('blocks submission until private comments are filled', async () => {
    const user = userEvent.setup();
    const paper = buildUnderReviewPaper({});
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [paper],
    );
    const submit = vi.fn();
    (publicationAdapter.submitReview as unknown as ReturnType<typeof vi.fn>).mockImplementation(submit);

    renderAt('/reviewer/assignments/under-review-1');

    const submitButton = await screen.findByRole('button', { name: /Submit private review to Admin/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Private comments for Admin are required/i,
      );
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits the evaluation and transitions to awaiting-Admin copy', async () => {
    const user = userEvent.setup();
    const paper = buildUnderReviewPaper({});
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [paper],
    );
    const submitted: PublicationPaper = {
      ...paper,
      status: 'REVIEWER_RECOMMENDED_ACCEPT',
      reviewer: {
        reviewerName: 'Assigned reviewer',
        recommendation: 'ACCEPT',
        privateComments: 'Looks good overall.',
        privateScores: {},
        submittedAt: '2026-08-25T00:00:00.000Z',
      },
    };
    (publicationAdapter.submitReview as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(submitted);

    renderAt('/reviewer/assignments/under-review-1');

    const form = await screen.findByTestId('evaluate-form');
    await user.type(
      within(form).getByLabelText(/Private review feedback for Admin/i),
      'Strong contribution with minor revision suggestions.',
    );
    const recommendationSelect = within(form).getByLabelText(/Recommendation/i);
    await user.selectOptions(recommendationSelect, 'ACCEPT');

    await user.click(within(form).getByRole('button', { name: /Submit private review to Admin/i }));

    const banner = await screen.findByTestId('submitted-banner');
    expect(banner).toHaveTextContent(/Review submitted/i);
    expect(banner).toHaveTextContent(/Awaiting Admin decision/i);

    // Form is gone, Accept/Decline buttons are gone, post-submit banner is visible.
    expect(screen.queryByTestId('evaluate-form')).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit private review to Admin/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Accept assignment/i })).toBeNull();

    // submitReview was called once with the reviewer's recommendation + comments
    expect(publicationAdapter.submitReview).toHaveBeenCalledTimes(1);
    const [idArg, recArg, commentsArg] = (publicationAdapter.submitReview as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(idArg).toBe('under-review-1');
    expect(recArg).toBe('ACCEPT');
    expect(commentsArg as string).toMatch(/Strong contribution with minor revision suggestions/);
  });

  it('submits with REVISION_REQUIRED and the post-submit copy is the same', async () => {
    const user = userEvent.setup();
    const paper = buildUnderReviewPaper({});
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [paper],
    );
    const submitted: PublicationPaper = {
      ...paper,
      status: 'REVIEWER_RECOMMENDED_ACCEPT',
      reviewer: {
        reviewerName: 'Assigned reviewer',
        recommendation: 'REVISION_REQUIRED',
        privateComments: 'Needs revision',
        privateScores: {},
        submittedAt: '2026-08-25T00:00:00.000Z',
      },
    };
    (publicationAdapter.submitReview as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(submitted);

    renderAt('/reviewer/assignments/under-review-1');

    const form = await screen.findByTestId('evaluate-form');
    await user.type(
      within(form).getByLabelText(/Private review feedback for Admin/i),
      'Methodology section needs more detail.',
    );
    const recommendationSelect = within(form).getByLabelText(/Recommendation/i);
    await user.selectOptions(recommendationSelect, 'REVISION_REQUIRED');

    await user.click(within(form).getByRole('button', { name: /Submit private review to Admin/i }));

    const banner = await screen.findByTestId('submitted-banner');
    expect(banner).toHaveTextContent(/Awaiting Admin decision/i);
    expect((publicationAdapter.submitReview as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toBe(
      'REVISION_REQUIRED',
    );
  });

  it('renders the post-submit awaiting-Admin banner without re-mounting the form', async () => {
    const user = userEvent.setup();
    const paper = buildUnderReviewPaper({});
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [paper],
    );
    const submitted: PublicationPaper = {
      ...paper,
      status: 'REVIEWER_RECOMMENDED_REJECT',
      reviewer: {
        reviewerName: 'Assigned reviewer',
        recommendation: 'REJECT',
        privateComments: 'Not suitable for the venue.',
        privateScores: {},
        submittedAt: '2026-08-25T00:00:00.000Z',
      },
    };
    (publicationAdapter.submitReview as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(submitted);

    renderAt('/reviewer/assignments/under-review-1');

    const form = await screen.findByTestId('evaluate-form');
    await user.type(
      within(form).getByLabelText(/Private review feedback for Admin/i),
      'Not suitable for the venue.',
    );
    const recommendationSelect = within(form).getByLabelText(/Recommendation/i);
    await user.selectOptions(recommendationSelect, 'REJECT');

    await user.click(within(form).getByRole('button', { name: /Submit private review to Admin/i }));

    const banner = await screen.findByTestId('submitted-banner');
    expect(banner).toHaveTextContent(/Review submitted/i);
    // The form must NOT be in the DOM after submit.
    expect(screen.queryByTestId('evaluate-form')).toBeNull();
  });
});

describe('ReviewerAssignmentDetail — authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the unauthorized notice when the assignment id is not in the reviewer list', async () => {
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [buildUnderReviewPaper({ id: 'someone-elses-assignment' })],
    );

    renderAt('/reviewer/assignments/not-mine');

    const notice = await screen.findByTestId('unauthorized-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(/not available to you/i);

    // The Evaluate Paper form must NEVER be shown for an unauthorised id.
    expect(screen.queryByTestId('evaluate-form')).toBeNull();
    expect(screen.queryByTestId('pdf-frame')).toBeNull();
  });

  it('does not call getAdminSubmissions — privacy boundary', async () => {
    (publicationAdapter.getReviewerAssignments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [buildUnderReviewPaper({})],
    );

    renderAt('/reviewer/assignments/under-review-1');

    await screen.findByRole('heading', { name: /Manuscript for Reviewer Evaluation/i });
    expect(publicationAdapter.getAdminSubmissions).not.toHaveBeenCalled();
  });
});
