/**
 * Integration tests for the Papers upload flow.
 *
 * Tests cover:
 *   1. Idle state: upload zone renders correctly
 *   2. File selection: opens Preview Phase modal
 *   3. Preview Phase: research field selection, Add field dropdown, Upload/Delete/Cancel buttons
 *   4. Confirm Phase: popup shows correct metadata
 *   5. Delete Phase: confirmation popup behavior
 *   6. Filter tabs work correctly
 */
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { Papers } from '../../pages/Papers/Papers';

// ─── Firebase storage mock ─────────────────────────────────────────────────────

vi.mock('../../firebase', () => ({
  storage: {},
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(),
}));

// ─── PdfViewer mock ────────────────────────────────────────────────────────────

vi.mock('../../components/PdfViewer', () => ({
  PdfViewer: ({ url }: { url: string | File | null }) => (
    <div data-testid="pdf-viewer" data-url={typeof url === 'string' ? url : url?.name ?? ''}>
      PDF Viewer: {typeof url === 'string' ? url : url?.name}
    </div>
  ),
}));

// ─── ScorecardModal mock ───────────────────────────────────────────────────────

vi.mock('../../pages/Dashboard/components/ScorecardModal', () => ({
  ScorecardModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="scorecard-modal">
      Scorecard Modal
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// ─── Fixture helpers ───────────────────────────────────────────────────────────

const makePdfFile = (name = 'test-paper.pdf'): File =>
  new File(['%PDF-1.4 test content'], name, { type: 'application/pdf' });

// ─── Render helper ─────────────────────────────────────────────────────────────

const renderPapers = () => render(<Papers />);

// ─── Open preview modal helper ─────────────────────────────────────────────────

const openPreviewModal = async (user: ReturnType<typeof userEvent.setup>, filename = 'test-paper.pdf') => {
  const input = screen.getByTestId('papers-file-input') as HTMLInputElement;
  await act(async () => {
    await user.upload(input, makePdfFile(filename));
  });
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Papers – idle state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title', () => {
    renderPapers();
    expect(screen.getByText('Research Paper List')).toBeInTheDocument();
  });

  it('renders the upload zone', () => {
    renderPapers();
    expect(screen.getByText(/click to upload or drag & drop/i)).toBeInTheDocument();
    expect(screen.getByText('Browse Files')).toBeInTheDocument();
  });

  it('renders filter tabs', () => {
    renderPapers();
    expect(screen.getByText('All Research Paper')).toBeInTheDocument();
    expect(screen.getByText('Waiting For Review')).toBeInTheDocument();
    expect(screen.getByText('Accept Paper')).toBeInTheDocument();
    expect(screen.getByText('Reject Paper')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders the papers table with initial data', () => {
    renderPapers();
    expect(screen.getByText('Framework_Design.pdf')).toBeInTheDocument();
    expect(screen.getByText('Cloud_Routing_v1.pdf')).toBeInTheDocument();
  });

  it('does not render the upload preview modal in idle state', () => {
    renderPapers();
    expect(screen.queryByText('Upload Paper Preview')).not.toBeInTheDocument();
  });

  it('does not render confirm or delete popups in idle state', () => {
    renderPapers();
    expect(screen.queryByRole('heading', { name: 'Confirm Upload' })).not.toBeInTheDocument();
    expect(screen.queryByText(/remove this paper/i)).not.toBeInTheDocument();
  });
});

describe('Papers – file selection opens preview modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the preview modal when a PDF file is selected', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);
    expect(screen.getByText('Upload Paper Preview')).toBeInTheDocument();
  });

  it('preview modal shows the PDF viewer', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);
    expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
  });

  it('shows AI recommended research fields in preview modal', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    expect(screen.getByText('AI Recommended Research Fields')).toBeInTheDocument();

    // Check each field exists as a field tag button
    const fieldTagButtons = screen.getAllByRole('button', { name: 'Machine Learning' });
    // Should appear at least once as a tag button (may also appear as chip if selected)
    expect(fieldTagButtons.length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByRole('button', { name: 'NLP' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Computer Vision' }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Add field button in preview modal', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);
    expect(screen.getByRole('button', { name: 'Add field' })).toBeInTheDocument();
  });

  it('shows Upload Paper and Delete buttons in preview modal', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    expect(screen.getByRole('button', { name: /upload paper/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });
});

describe('Papers – research field selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with Machine Learning pre-selected as a field tag', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    // The hint "(1 selected)" shows Machine Learning is pre-selected
    expect(screen.getByText(/\(1 selected\)/)).toBeInTheDocument();
  });

  it('toggles a field tag on click (deselects it)', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    // Click Machine Learning to deselect it
    const mlTagButtons = screen.getAllByRole('button', { name: 'Machine Learning' });
    const mlTag = mlTagButtons.find(b => b.className.includes('fieldTag'));
    if (mlTag) await user.click(mlTag);

    // After deselecting ML, upload should be disabled (only ML was selected)
    const uploadBtn = screen.getByRole('button', { name: /upload paper/i }) as HTMLButtonElement;
    expect(uploadBtn).toBeDisabled();
  });

  it('opens Add field dropdown on click', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    await user.click(screen.getByRole('button', { name: 'Add field' }));
    expect(screen.getByText('Deep Learning')).toBeInTheDocument();
    expect(screen.getByText('Reinforcement Learning')).toBeInTheDocument();
    expect(screen.getByText('Graph Neural Networks')).toBeInTheDocument();
  });

  it('closes Add field dropdown after selecting a subfield', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await user.click(screen.getByRole('button', { name: 'Deep Learning' }));

    // Dropdown should close – subfields should not be visible anymore
    expect(screen.queryByText('Graph Neural Networks')).not.toBeInTheDocument();
  });

  it('disables Upload Paper when no fields are selected', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    // Deselect the pre-selected Machine Learning by clicking the tag button
    const mlTagButtons = screen.getAllByRole('button', { name: 'Machine Learning' });
    const mlTag = mlTagButtons.find(b => b.className.includes('fieldTag'));
    if (mlTag) await user.click(mlTag);

    const uploadBtn = screen.getByRole('button', { name: /upload paper/i }) as HTMLButtonElement;
    expect(uploadBtn).toBeDisabled();
  });

  it('enables Upload Paper when at least one field is selected', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    const uploadBtn = screen.getByRole('button', { name: /upload paper/i }) as HTMLButtonElement;
    expect(uploadBtn).not.toBeDisabled();
  });
});

describe('Papers – Confirm Phase popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows confirm popup when Upload Paper is clicked', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    await user.click(screen.getByRole('button', { name: /upload paper/i }));

    // Both the heading title and the confirm button contain "Confirm Upload"
    const confirmHeadings = screen.getAllByRole('heading', { name: /confirm upload/i });
    expect(confirmHeadings.length).toBeGreaterThan(0);
  });

  it('shows file name in confirm popup', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user, 'my-paper.pdf');

    await user.click(screen.getByRole('button', { name: /upload paper/i }));

    expect(screen.getByText('my-paper.pdf')).toBeInTheDocument();
  });

  it('shows submission date in confirm popup', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    await user.click(screen.getByRole('button', { name: /upload paper/i }));

    const today = new Date().toISOString().split('T')[0];
    expect(screen.getByText(today)).toBeInTheDocument();
  });

  it('shows selected research fields in confirm popup', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    // Machine Learning is pre-selected
    await user.click(screen.getByRole('button', { name: /upload paper/i }));

    expect(screen.getAllByText('Machine Learning').length).toBeGreaterThan(0);
  });

  it('shows Confirm Upload and Cancel buttons in confirm popup', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    await user.click(screen.getByRole('button', { name: /upload paper/i }));

    expect(screen.getByRole('button', { name: /confirm upload/i })).toBeInTheDocument();
    // Two Cancel buttons exist (one in preview modal footer, one in popup)
    const cancelBtns = screen.getAllByRole('button', { name: /^cancel$/i });
    expect(cancelBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('returns to preview modal when Cancel is clicked in confirm popup', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    await user.click(screen.getByRole('button', { name: /upload paper/i }));

    // Both Cancel buttons should return to preview — click the first one found
    const cancelBtns = screen.getAllByRole('button', { name: /^cancel$/i });
    await user.click(cancelBtns[0]);

    // Preview modal should still be visible
    expect(screen.getByText('Upload Paper Preview')).toBeInTheDocument();
  });
});

describe('Papers – Delete Phase popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows delete confirmation popup when Delete is clicked', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(screen.getByText(/remove this paper/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, Remove' })).toBeInTheDocument();
  });

  it('shows the file name in delete confirmation popup', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user, 'to-delete.pdf');

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(screen.getByText('to-delete.pdf')).toBeInTheDocument();
  });

  it('closes preview modal when Yes, Remove is clicked', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: 'Yes, Remove' }));

    expect(screen.queryByText('Upload Paper Preview')).not.toBeInTheDocument();
  });

  it('returns to preview modal when Cancel is clicked in delete popup', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    // Click the Cancel in the delete popup
    const cancelBtns = screen.getAllByRole('button', { name: /^cancel$/i });
    await user.click(cancelBtns[0]);

    expect(screen.getByText('Upload Paper Preview')).toBeInTheDocument();
  });
});

describe('Papers – filter tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all five filter tabs', () => {
    renderPapers();
    expect(screen.getByText('All Research Paper')).toBeInTheDocument();
    expect(screen.getByText('Waiting For Review')).toBeInTheDocument();
    expect(screen.getByText('Accept Paper')).toBeInTheDocument();
    expect(screen.getByText('Reject Paper')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows all papers when All tab is active', () => {
    renderPapers();
    expect(screen.getByText('Framework_Design.pdf')).toBeInTheDocument();
    expect(screen.getByText('Cloud_Routing_v1.pdf')).toBeInTheDocument();
    expect(screen.getByText('Microservice_Consensus_v3.pdf')).toBeInTheDocument();
    expect(screen.getByText('EdgeNet_Protocol_v2.pdf')).toBeInTheDocument();
  });

  it('shows only Waiting for Review papers when tab is clicked', async () => {
    const user = userEvent.setup();
    renderPapers();

    await user.click(screen.getByText('Waiting For Review'));

    expect(screen.getByText('Framework_Design.pdf')).toBeInTheDocument();
    expect(screen.queryByText('Cloud_Routing_v1.pdf')).not.toBeInTheDocument();
  });

  it('shows manuscript count in section header', () => {
    renderPapers();
    // Count says "4 manuscripts" when all are shown
    expect(screen.getByText(/4 manuscripts?/i)).toBeInTheDocument();
  });
});

describe('Papers – close preview modal via X button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes preview modal when X button is clicked', async () => {
    const user = userEvent.setup();
    renderPapers();
    await openPreviewModal(user);

    expect(screen.getByText('Upload Paper Preview')).toBeInTheDocument();

    // Click the X close button
    await user.click(screen.getByTestId('close-upload-btn'));

    expect(screen.queryByText('Upload Paper Preview')).not.toBeInTheDocument();
  });
});
