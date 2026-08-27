import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPaperPreviewModal } from '../../../../src/features/publication/admin/AdminPaperPreviewModal';
import { demoPublicationPapers } from '../../../../src/features/publication/demo/publication.demo';
import type { PublicationPaper } from '../../../../src/features/publication/types/publication';

const buildPaper = (patch: Partial<PublicationPaper>): PublicationPaper => ({
  ...demoPublicationPapers[0],
  ...patch,
});

describe('<AdminPaperPreviewModal />', () => {
  it('renders title, abstract, and identifiers', () => {
    const onClose = vi.fn();
    render(
      <AdminPaperPreviewModal
        paper={buildPaper({ id: 'modal-paper', title: 'Modal preview paper', abstract: 'Abstract here.' })}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Modal preview paper/i })).toBeTruthy();
    expect(screen.getByText(/Abstract here\./)).toBeTruthy();
  });

  it('does NOT render private reviewer comments', () => {
    const onClose = vi.fn();
    render(
      <AdminPaperPreviewModal
        paper={buildPaper({
          id: 'modal-private',
          title: 'Private preview paper',
          visibility: 'PRIVATE',
          status: 'UNDER_REVIEW',
          reviewerIdentityPublic: false,
          reviewer: { reviewerName: 'Should Stay Private', recommendation: 'ACCEPT', privateComments: 'NEVER SHOW THIS', privateScores: {} },
        })}
        onClose={onClose}
      />,
    );
    // The reviewer privateComments MUST never be visible on the preview
    // modal — that content is reserved for the full editorial detail page.
    expect(screen.queryByText(/NEVER SHOW THIS/)).toBeNull();
    // When reviewerIdentityPublic=false, the public reviewer name must also
    // be hidden so an Admin does not accidentally copy it into a public surface.
    expect(screen.queryByText(/Should Stay Private/)).toBeNull();
  });

  it('shows the public reviewer name only when reviewerIdentityPublic is true', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AdminPaperPreviewModal
        paper={buildPaper({
          id: 'public-id',
          title: 'Public reviewer',
          reviewerIdentityPublic: true,
          reviewer: { reviewerName: 'Public Reviewer', recommendation: 'ACCEPT', privateComments: '', privateScores: {} },
        })}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/Public Reviewer/)).toBeTruthy();
    rerender(
      <AdminPaperPreviewModal
        paper={buildPaper({
          id: 'private-id',
          title: 'Private reviewer',
          reviewerIdentityPublic: false,
          reviewer: { reviewerName: 'Hidden Reviewer', recommendation: 'ACCEPT', privateComments: '', privateScores: {} },
        })}
        onClose={onClose}
      />,
    );
    expect(screen.queryByText(/Hidden Reviewer/)).toBeNull();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(
      <AdminPaperPreviewModal
        paper={buildPaper({ id: 'escape-paper', title: 'Escape paper' })}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <AdminPaperPreviewModal
        paper={buildPaper({ id: 'close-paper', title: 'Close paper' })}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Close preview/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders a manuscript open link when fileUrl is provided', () => {
    const onClose = vi.fn();
    render(
      <AdminPaperPreviewModal
        paper={buildPaper({ id: 'file-paper', title: 'File paper', fileUrl: 'https://example.com/paper.pdf' })}
        onClose={onClose}
      />,
    );
    const link = screen.getByRole('link', { name: /Open in new tab/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://example.com/paper.pdf');
  });
});
