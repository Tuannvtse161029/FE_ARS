/**
 * Component tests for src/components/lecturer/EvaluateReportModal.tsx.
 *
 * Per test-plan question #4: PdfViewer is rendered lazily — clicking
 * "Preview PDF Inline" — so the modal itself does NOT need an
 * IntersectionObserver polyfill. We do exercise that branch.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvaluateReportModal } from '../../../src/components/lecturer/EvaluateReportModal';
import type { PhasedReport } from '../../../src/services/phasedReport.service';

// PdfViewer uses IntersectionObserver + pdfjs-dist. We mock both at the
// module boundary so jsdom is happy. This mirrors the local polyfill
// pattern used by src/tests/components/PdfViewer.test.tsx — kept local to
// this file per the prep matrix.
const { mockObserve, mockUnobserve, mockDisconnect, mockGetDocument, mockDoc } =
  vi.hoisted(() => {
    const mockObserve = vi.fn();
    const mockUnobserve = vi.fn();
    const mockDisconnect = vi.fn();
    const mockPage = {
      getViewport: vi.fn(() => ({ width: 595, height: 842, scale: 1 })),
      render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    };
    const mockDoc = {
      numPages: 5,
      getPage: vi.fn(() => Promise.resolve(mockPage)),
      destroy: vi.fn(),
    };
    const mockGetDocument = vi.fn(() => ({
      promise: Promise.resolve(mockDoc),
      on: vi.fn(),
      destroy: vi.fn(),
    }));
    return { mockObserve, mockUnobserve, mockDisconnect, mockGetDocument, mockDoc };
  });

class MockIntersectionObserver {
  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = vi.fn(() => []);
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

vi.mock('pdfjs-dist', () => ({
  getDocument: mockGetDocument,
  GlobalWorkerOptions: { workerSrc: '' },
  version: '3.11.174',
}));

const mockCanvasContext = {
  setTransform: vi.fn(),
  scale: vi.fn(),
};
const originalGetContext = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function () {
    return mockCanvasContext;
  } as typeof HTMLCanvasElement.prototype.getContext;
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

const { evaluateMock, rejectMock } = vi.hoisted(() => ({
  evaluateMock: vi.fn(),
  rejectMock: vi.fn(),
}));

vi.mock('../../../src/services/phasedReport.service', () => ({
  evaluatePhasedReport: evaluateMock,
  rejectPhasedReport: rejectMock,
}));

const REPORT: PhasedReport = {
  id: 5,
  researchGroupId: 7,
  status: 'SUBMITTED',
  reportFileUrl: 'https://fb.storage/x.pdf',
  submittedAt: '2025-01-02T10:30:00Z',
  phaseNumber: 3,
  milestoneTitle: 'Phase 3 — Reading Comprehension',
  groupName: 'NLP Lab Group A',
  topicTitle: 'Reading Comprehension',
};

const renderModal = (overrides: Partial<{ isOpen: boolean; report: PhasedReport | null }> = {}) =>
  render(
    <EvaluateReportModal
      isOpen={overrides.isOpen ?? true}
      report={overrides.report ?? REPORT}
      onClose={vi.fn()}
      onSubmitted={vi.fn()}
    />,
  );

describe('<EvaluateReportModal>', () => {
  beforeEach(() => {
    evaluateMock.mockReset();
    rejectMock.mockReset();
    mockGetDocument.mockClear();
  });

  it('renders nothing when isOpen=false', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders the title and subtitle with report meta', () => {
    renderModal();
    // Title is the phase/milestone context, not a generic modal title.
    expect(screen.getByText(/Phase 3/)).toBeInTheDocument();
    // Subtitle shows group + topic context rather than raw IDs.
    expect(screen.getByText(/NLP Lab Group A/)).toBeInTheDocument();
    // Topic title appears in the subtitle line.
    expect(screen.getAllByText(/Reading Comprehension/).length).toBeGreaterThan(0);
  });

  it('shows the status badge', () => {
    renderModal();
    expect(screen.getByLabelText(/Status: SUBMITTED/)).toBeInTheDocument();
  });

  it('renders "Open in New Tab" link when PDF is present', () => {
    renderModal();
    const link = screen.getByRole('link', { name: /Open in New Tab/i });
    expect(link).toHaveAttribute('href', 'https://fb.storage/x.pdf');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does NOT mount <PdfViewer> on first render (lazy per test-plan #4)', () => {
    renderModal();
    expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();
  });

  it('mounts <PdfViewer> after clicking "Preview PDF Inline"', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /Preview PDF Inline/i }));
    expect(await screen.findByTestId('pdf-viewer')).toBeInTheDocument();
  });

  it('approve submit calls evaluatePhasedReport with EVALUATED payload', async () => {
    evaluateMock.mockResolvedValueOnce({
      ...REPORT,
      status: 'EVALUATED',
      lectureFeedback: 9,
      finalOutcomeEvaluation: 'Solid work',
    });
    const onSubmitted = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <EvaluateReportModal
        isOpen={true}
        report={REPORT}
        onClose={onClose}
        onSubmitted={onSubmitted}
      />,
    );

    // Default mode is "approve"
    const textarea = screen.getByLabelText(/Outcome notes/);
    await user.type(textarea, 'Solid work');
    await user.clear(screen.getByLabelText(/Grade/));
    await user.type(screen.getByLabelText(/Grade/), '9');
    // The submit button shares its label with the mode-tab "Approve & Evaluate".
    // Use the allBy* variant to grab the actual submit button (the second match).
    const buttons = screen.getAllByRole('button', { name: /Approve & Evaluate/i });
    const submitBtn = buttons[buttons.length - 1]!;
    await user.click(submitBtn);

    await waitFor(() =>
      expect(evaluateMock).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          lectureFeedback: 9,
          finalOutcomeEvaluation: 'Solid work',
        }),
      ),
    );
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('reject mode without reason or outcome is a no-op (UX-side guard)', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /Reject with Feedback/i }));
    // Reject submit button should not call the service when both fields are blank
    await user.click(screen.getByRole('button', { name: /Request Revision/i }));
    expect(rejectMock).not.toHaveBeenCalled();
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it('reject mode with rejectionReason calls rejectPhasedReport', async () => {
    rejectMock.mockResolvedValueOnce({
      ...REPORT,
      status: 'REJECTED',
      capacityEvaluation: 'Needs more detail',
    });
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /Reject with Feedback/i }));
    const reason = screen.getByLabelText(/What needs to change/);
    await user.type(reason, 'Needs more detail');
    await user.click(screen.getByRole('button', { name: /Request Revision/i }));

    await waitFor(() =>
      expect(rejectMock).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ rejectionReason: 'Needs more detail' }),
      ),
    );
  });

  it('grade outside 0..10 is a no-op', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.clear(screen.getByLabelText(/Grade/));
    await user.type(screen.getByLabelText(/Grade/), '11');
    const buttons = screen.getAllByRole('button', { name: /Approve & Evaluate/i });
    const submitBtn = buttons[buttons.length - 1]!;
    await user.click(submitBtn);
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it('shows existing feedback when report already has lectureFeedback', () => {
    renderModal({
      report: {
        ...REPORT,
        lectureFeedback: 7,
        finalOutcomeEvaluation: 'OK',
        capacityEvaluation: 'previous reason',
      },
    });
    expect(screen.getByText(/EXISTING FEEDBACK ON RECORD/)).toBeInTheDocument();
    expect(screen.getByText(/7 \/ 10/)).toBeInTheDocument();
  });

  it('shows error banner when service throws', async () => {
    evaluateMock.mockRejectedValueOnce(new Error('Server exploded'));
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/Outcome notes/), 'OK');
    const buttons = screen.getAllByRole('button', { name: /Approve & Evaluate/i });
    const submitBtn = buttons[buttons.length - 1]!;
    await user.click(submitBtn);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Server exploded/));
  });
});