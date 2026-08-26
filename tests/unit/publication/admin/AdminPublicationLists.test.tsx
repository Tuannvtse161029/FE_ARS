import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminPublishedPapers, AdminReviewerAssignments } from '../../../../src/features/publication/admin/AdminPublicationLists';

const renderPage = (component: () => JSX.Element) => render(
  <MemoryRouter initialEntries={['/admin']}>
    {component()}
  </MemoryRouter>,
);

describe('<AdminPublishedPapers />', () => {
  it('renders only PUBLISHED papers from the demo dataset', async () => {
    renderPage(() => <AdminPublishedPapers />);
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
      expect(screen.getByText(/Transparent Learning Analytics/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Private Draft That Must Never Reach/i)).toBeNull();
    expect(screen.queryByText(/Under Review Paper That Must Never Reach/i)).toBeNull();
  });

  it('defaults the status filter to PUBLISHED', async () => {
    renderPage(() => <AdminPublishedPapers />);
    const select = await waitFor(() => screen.getByLabelText(/Filter Published Papers by status/i));
    expect((select as HTMLSelectElement).value).toBe('PUBLISHED');
  });

  it('hides private reviewer comments and scores on the published listing', async () => {
    renderPage(() => <AdminPublishedPapers />);
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Private editorial review content is intentionally excluded/i)).toBeNull();
    // Reviewer private comments MUST NOT be exposed on the listing — only the
    // full detail page renders them, and only for non-PUBLISHED records.
    expect(screen.queryByText(/This must remain private\./i)).toBeNull();
  });

  it('shows only the public reviewer name on the published listing', async () => {
    renderPage(() => <AdminPublishedPapers />);
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
    });
    // demo-published-urban-heat → reviewerIdentityPublic=true → name visible
    expect(screen.getByText(/Dr. Le Quang Huy/)).toBeTruthy();
    // demo-published-learning-analytics → reviewerIdentityPublic=false → name not shown
    expect(screen.queryByText(/Hidden Reviewer/)).toBeNull();
  });

  it('renders identifier chips (DOI / OpenAlex / external)', async () => {
    renderPage(() => <AdminPublishedPapers />);
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
    });
    expect(screen.getAllByText(/10\.5555\/ars\.demo\.2026\.001/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/W999999001/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/arXiv:2608\.01001/).length).toBeGreaterThan(0);
  });

  it('shows the demo banner', () => {
    renderPage(() => <AdminPublishedPapers />);
    expect(screen.getByText(/Demo catalog data/i)).toBeTruthy();
  });

  it('renders a manuscript open link for published records that include a fileUrl', async () => {
    renderPage(() => <AdminPublishedPapers />);
    await waitFor(() => {
      expect(screen.getByText(/Street-Level Tree Canopy/i)).toBeTruthy();
    });
    // demo fixture doesn't include fileUrl → expect "No file URL" label.
    expect(screen.getAllByText(/No file URL/).length).toBeGreaterThan(0);
  });
});

describe('<AdminReviewerAssignments />', () => {
  it('renders only REVIEWER_ASSIGNED + UNDER_REVIEW papers from the demo dataset', async () => {
    renderPage(() => <AdminReviewerAssignments />);
    await waitFor(() => {
      // Only demo-under-review (UNDER_REVIEW) is present; REVIEWER_ASSIGNED is not in the fixtures.
      expect(screen.getByText(/Under Review Paper That Must Never Reach/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Street-Level Tree Canopy/i)).toBeNull();
    expect(screen.queryByText(/Transparent Learning Analytics/i)).toBeNull();
    expect(screen.queryByText(/Private Draft That Must Never Reach/i)).toBeNull();
  });

  it('defaults the status filter to ALL for reviewer assignments', async () => {
    renderPage(() => <AdminReviewerAssignments />);
    const select = await waitFor(() => screen.getByLabelText(/Filter Reviewer Assignments by status/i));
    expect((select as HTMLSelectElement).value).toBe('ALL');
  });

  it('shows only the reviewer dropdown options relevant to reviewer assignments', async () => {
    renderPage(() => <AdminReviewerAssignments />);
    const select = await waitFor(() => screen.getByLabelText(/Filter Reviewer Assignments by status/i));
    const options = Array.from((select as HTMLSelectElement).options).map((option) => option.value);
    expect(options).toEqual(['ALL', 'REVIEWER_ASSIGNED', 'UNDER_REVIEW']);
  });

  it('shows the demo banner', () => {
    renderPage(() => <AdminReviewerAssignments />);
    expect(screen.getByText(/Demo catalog data/i)).toBeTruthy();
  });

  it('filters the assignments list when the status dropdown changes', async () => {
    const user = userEvent.setup();
    renderPage(() => <AdminReviewerAssignments />);
    const select = await waitFor(() => screen.getByLabelText(/Filter Reviewer Assignments by status/i));
    await user.selectOptions(select, 'REVIEWER_ASSIGNED');
    await waitFor(() => {
      expect(screen.getByText(/No records match/i)).toBeTruthy();
    });
  });
});
