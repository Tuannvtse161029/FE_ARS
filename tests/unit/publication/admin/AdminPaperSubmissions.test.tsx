import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminPaperSubmissions } from '../../../../src/features/publication/admin/AdminPaperSubmissions';
import { demoPublicationPapers } from '../../../../src/features/publication/demo/publication.demo';
import type { PublicationPaper } from '../../../../src/features/publication/types/publication';

const clone = <Value,>(value: Value): Value => structuredClone(value);

const renderPage = () => render(
  <MemoryRouter initialEntries={['/admin/paper-submissions']}>
    <AdminPaperSubmissions />
  </MemoryRouter>,
);

const findRow = (container: HTMLElement, title: string) => {
  const rows = Array.from(container.querySelectorAll('tbody tr'));
  return rows.find((row) => row.textContent?.includes(title)) ?? null;
};

describe('<AdminPaperSubmissions />', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders every demo paper including drafts and under-review records', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
      expect(screen.getByText(/Transparent Learning Analytics/i)).toBeTruthy();
      expect(screen.getByText(/Private Draft That Must Never Reach/i)).toBeTruthy();
      expect(screen.getByText(/Under Review Paper That Must Never Reach/i)).toBeTruthy();
    });
  });

  it('renders the demo banner', async () => {
    renderPage();
    expect(screen.getByText(/Demo catalog data/i)).toBeTruthy();
  });

  it('keeps private reviewer comments and scores out of the public-visible table', async () => {
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Private Draft That Must Never Reach/i)).toBeTruthy();
    });
    const underReviewRow = findRow(container, 'Under Review Paper That Must Never Reach');
    expect(underReviewRow).not.toBeNull();
    // Private reviewer privateComments + privateScores values must not be
    // visible on the admin submissions table — only the full detail page
    // may render them.
    expect(underReviewRow!.textContent).not.toContain('This must remain private.');
    expect(underReviewRow!.textContent).not.toContain('methodology: 2');
  });

  it('shows only the public reviewer name when reviewerIdentityPublic is true', async () => {
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
    });
    const publicReviewerRow = findRow(container, 'Street-Level Tree Canopy');
    expect(publicReviewerRow).not.toBeNull();
    expect(publicReviewerRow!.textContent).toContain('Dr. Le Quang Huy');

    const privateReviewerRow = findRow(container, 'Transparent Learning Analytics');
    // The reviewer name on the private-review fixture must NOT be shown.
    expect(privateReviewerRow!.textContent).not.toContain('Hidden Reviewer');
  });

  it('filters by status when the dropdown changes', async () => {
    const user = userEvent.setup();
    renderPage();
    const select = await waitFor(() => screen.getByLabelText(/Filter admin submissions by status/i));
    await user.selectOptions(select, 'PUBLISHED');
    await waitFor(() => {
      expect(screen.queryByText(/Private Draft That Must Never Reach/i)).toBeNull();
      expect(screen.queryByText(/Under Review Paper That Must Never Reach/i)).toBeNull();
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
    });
  });

  it('filters by free-text search', async () => {
    const user = userEvent.setup();
    renderPage();
    const search = await waitFor(() => screen.getByLabelText(/Search admin paper submissions/i));
    await user.type(search, 'learning');
    await waitFor(() => {
      expect(screen.getByText(/Transparent Learning Analytics/i)).toBeTruthy();
      expect(screen.queryByText(/Street-Level Tree Canopy/i)).toBeNull();
    });
  });

  it('opens the preview modal when Preview is clicked and closes it on Escape', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
    });
    const previewButtons = await screen.findAllByLabelText(/Preview/i);
    await user.click(previewButtons[0]);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('renders identifier chips for DOI / OpenAlex / external', async () => {
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
    });
    const publicRow = findRow(container, 'Street-Level Tree Canopy');
    expect(publicRow).not.toBeNull();
    expect(publicRow!.textContent).toContain('10.5555/ars.demo.2026.001');

    const privateRow = findRow(container, 'Transparent Learning Analytics');
    expect(privateRow!.textContent).toContain('W999999001');
    expect(privateRow!.textContent).toContain('arXiv:2608.01001');
  });

  it('renders status badges for every lifecycle value present in the demo dataset', async () => {
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
    });
    // Demo fixtures cover DRAFT, UNDER_REVIEW, PUBLISHED.
    const statusCells = Array.from(container.querySelectorAll('tbody tr')).map((row) => {
      const cell = row.querySelector('[data-label="Status"]');
      return cell?.textContent ?? '';
    });
    expect(statusCells.some((text) => text.toUpperCase().includes('PUBLISHED'))).toBe(true);
    expect(statusCells.some((text) => text.toUpperCase().includes('DRAFT'))).toBe(true);
    expect(statusCells.some((text) => text.toUpperCase().includes('UNDER REVIEW'))).toBe(true);
  });

  it('does not leak any demo paper beyond what getAdminSubmissions returns', async () => {
    const papers: PublicationPaper[] = clone(demoPublicationPapers);
    renderPage();
    await waitFor(() => {
      for (const paper of papers) {
        expect(screen.getByText(paper.title)).toBeTruthy();
      }
    });
  });
});

describe('<AdminPaperSubmissions /> with adapter override', () => {
  it('renders the empty-state message when the adapter returns nothing', async () => {
    const adapter = await import('../../../../src/features/publication/api/publication.adapter');
    const original = adapter.publicationAdapter.getAdminSubmissions;
    adapter.publicationAdapter.getAdminSubmissions = async () => [];
    try {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/No admin submissions match/i)).toBeTruthy();
      });
    } finally {
      adapter.publicationAdapter.getAdminSubmissions = original;
    }
  });
});
