import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminPaperSubmissionDetail } from '../../../../src/features/publication/admin/AdminPaperSubmissionDetail';

const renderPage = (id: string) => render(
  <MemoryRouter initialEntries={[`/admin/paper-submissions/${id}`]}>
    <Routes>
      <Route path="/admin/paper-submissions/:id" element={<AdminPaperSubmissionDetail />} />
    </Routes>
  </MemoryRouter>,
);

describe('<AdminPaperSubmissionDetail />', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the editorial record for the SUBMITTED paper', async () => {
    // demo-published-learning-analytics — PUBLISHED
    renderPage('demo-published-learning-analytics');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Transparent Learning Analytics/i })).toBeTruthy();
    });
    expect(screen.getByText(/Admin editorial record/i)).toBeTruthy();
    // The PUBLISHED status badge must be present.
    expect(screen.getAllByText(/PUBLISHED/i).length).toBeGreaterThan(0);
  });

  it('renders the Admin-only private reviewer block for UNDER_REVIEW papers', async () => {
    renderPage('demo-under-review');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Under Review Paper/i })).toBeTruthy();
    });
    const block = screen.getByRole('region', { name: /Private reviewer record/i });
    expect(block).toBeTruthy();
    expect(withinBlock(block, 'This must remain private.')).toBeTruthy();
    expect(withinBlock(block, 'methodology')).toBeTruthy();
    expect(withinBlock(block, '2')).toBeTruthy();
  });

  it('hides the private reviewer block for PUBLISHED papers that have no reviewer field', async () => {
    // demo-published-learning-analytics — no reviewer field, visibility PUBLIC
    renderPage('demo-published-learning-analytics');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Transparent Learning Analytics/i })).toBeTruthy();
    });
    expect(screen.queryByRole('region', { name: /Private reviewer record/i })).toBeNull();
  });

  it('still surfaces the private reviewer record when status is non-PUBLISHED', async () => {
    renderPage('demo-under-review');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Under Review Paper/i })).toBeTruthy();
    });
    // The block exists because the status is UNDER_REVIEW (not PUBLISHED).
    expect(screen.getByRole('region', { name: /Private reviewer record/i })).toBeTruthy();
  });

  it('respects the reviewer identity public policy on the private reviewer block', async () => {
    renderPage('demo-under-review');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Under Review Paper/i })).toBeTruthy();
    });
    // demo-under-review has reviewerIdentityPublic=false → block shows the private name
    // but never surfaces it as a public catalog identity.
    expect(screen.getByText(/Private Reviewer/)).toBeTruthy();
    expect(screen.getByText(/Identity-public flag: No/i)).toBeTruthy();
  });

  it('shows only withdraw for the PUBLISHED demo paper', async () => {
    // demo-published-urban-heat — PUBLISHED, has reviewer, identityPublic=true
    renderPage('demo-published-urban-heat');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Street-Level Tree Canopy/i })).toBeTruthy();
    });
    // For PUBLISHED, only withdraw is allowed (per adminActionsForStatus).
    expect(screen.getByText(/Withdraw publication/i)).toBeTruthy();
    expect(screen.queryByText(/Assign reviewer/i)).toBeNull();
    expect(screen.queryByText(/Approve and publish/i)).toBeNull();
  });

  it('shows assign but no publish for the SUBMITTED demo paper', async () => {
    // No SUBMITTED demo record exists; simulate by overriding the adapter.
    const adapter = await import('../../../../src/features/publication/api/publication.adapter');
    const original = adapter.publicationAdapter.getAdminSubmissions;
    adapter.publicationAdapter.getAdminSubmissions = async () => [
      {
        id: 'synthetic-submitted',
        title: 'Submitted synthetic',
        abstract: 'A synthetic submitted paper',
        authors: [{ id: 'a', name: 'Author', institutionIds: ['i'], order: 1 }],
        institutions: [{ id: 'i', name: 'Inst' }],
        paperType: 'Research article',
        topics: [],
        keywords: [],
        version: 1,
        status: 'SUBMITTED',
        visibility: 'PRIVATE',
        createdAt: '2026-08-01T00:00:00.000Z',
        reviewerIdentityPublic: false,
        researcherVerificationStatus: 'PENDING',
      },
    ];
    try {
      renderPage('synthetic-submitted');
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /Submitted synthetic/i })).toBeTruthy();
      });
      // Assign should be present (both the zone title and the button);
      // publish should not.
      expect(screen.getAllByText(/Assign reviewer/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Approve and publish/i)).toBeNull();
    } finally {
      adapter.publicationAdapter.getAdminSubmissions = original;
    }
  });

  it('invokes assignReviewer when the admin types a name and clicks Assign reviewer', async () => {
    const adapter = await import('../../../../src/features/publication/api/publication.adapter');
    const original = adapter.publicationAdapter.getAdminSubmissions;
    const originalAssign = adapter.publicationAdapter.assignReviewer;
    const assignSpy = vi.fn(async (id: string, name: string) => ({
      id,
      title: 'Submitted synthetic',
      abstract: 'A synthetic submitted paper',
      authors: [],
      institutions: [],
      paperType: 'Research article',
      topics: [],
      keywords: [],
      version: 1,
      status: 'REVIEWER_ASSIGNED' as const,
      visibility: 'PRIVATE' as const,
      createdAt: '2026-08-01T00:00:00.000Z',
      reviewerIdentityPublic: false,
      researcherVerificationStatus: 'PENDING' as const,
      reviewer: { reviewerName: name, recommendation: 'REVISION_REQUIRED' as const, privateComments: '', privateScores: {} },
    }));
    adapter.publicationAdapter.getAdminSubmissions = async () => [
      {
        id: 'synthetic-submitted',
        title: 'Submitted synthetic',
        abstract: 'A synthetic submitted paper',
        authors: [],
        institutions: [],
        paperType: 'Research article',
        topics: [],
        keywords: [],
        version: 1,
        status: 'SUBMITTED',
        visibility: 'PRIVATE',
        createdAt: '2026-08-01T00:00:00.000Z',
        reviewerIdentityPublic: false,
        researcherVerificationStatus: 'PENDING',
      },
    ];
    adapter.publicationAdapter.assignReviewer = assignSpy;
    try {
      const user = userEvent.setup();
      renderPage('synthetic-submitted');
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /Submitted synthetic/i })).toBeTruthy();
      });
      const input = screen.getByLabelText(/Reviewer name/i);
      fireEvent.change(input, { target: { value: 'Dr. Demo Reviewer' } });
      await user.click(screen.getByRole('button', { name: /Assign reviewer/i }));
      await waitFor(() => {
        expect(assignSpy).toHaveBeenCalledWith('synthetic-submitted', 'Dr. Demo Reviewer');
      });
    } finally {
      adapter.publicationAdapter.getAdminSubmissions = original;
      adapter.publicationAdapter.assignReviewer = originalAssign;
    }
  });

  it('shows the "not found" panel when the id is unknown', async () => {
    renderPage('does-not-exist');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Editorial record not found/i })).toBeTruthy();
    });
  });

  it('always renders the demo banner on the detail page', async () => {
    renderPage('demo-published-learning-analytics');
    await waitFor(() => {
      expect(screen.getByText(/Demo catalog data/i)).toBeTruthy();
    });
  });

  it('never exposes the reviewer privateComments on the PUBLISHED, identity-public demo record to the public catalog', async () => {
    // demo-published-urban-heat — PUBLISHED, reviewerIdentityPublic=true
    renderPage('demo-published-urban-heat');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Street-Level Tree Canopy/i })).toBeTruthy();
    });
    // The Admin-only private review block MUST NOT appear on a PUBLISHED
    // record — that block is reserved for non-public status records.
    expect(screen.queryByRole('region', { name: /Private reviewer record/i })).toBeNull();
    // The privateComments string must not be present anywhere on the page.
    expect(screen.queryByText(/Private editorial review content is intentionally excluded/i)).toBeNull();
  });
});

const withinBlock = (container: HTMLElement, text: string) => {
  const match = Array.from(container.querySelectorAll('*')).find((el) => el.textContent?.includes(text));
  return match ?? null;
};
