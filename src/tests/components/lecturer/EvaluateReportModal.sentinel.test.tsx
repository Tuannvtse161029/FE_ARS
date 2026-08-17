/**
 * Sibling tests for src/components/lecturer/EvaluateReportModal.tsx —
 * dedicated to lineage parsing via the `__LINEAGE__:` sentinel.
 *
 * The 10 existing tests in `EvaluateReportModal.test.tsx` are untouched.
 * This file is a NEW sibling so the lineage-specific branches are isolated
 * for documentation and future regression detection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluateReportModal } from '../../../components/lecturer/EvaluateReportModal';
import type { PhasedReport } from '../../../services/phasedReport.service';

// PdfViewer mocks — mirrors the pattern in the existing
// `EvaluateReportModal.test.tsx` so jsdom is happy.
const { mockGetDocument, mockDoc, mockObserve, mockUnobserve, mockDisconnect } =
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
    return {
      mockGetDocument,
      mockDoc,
      mockObserve,
      mockUnobserve,
      mockDisconnect,
    };
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
global.IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

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

vi.mock('../../../services/phasedReport.service', () => ({
  evaluatePhasedReport: evaluateMock,
  rejectPhasedReport: rejectMock,
}));

const REPORT_BASE: PhasedReport = {
  id: 100,
  researchGroupId: 7,
  status: 'SUBMITTED',
  reportFileUrl: 'https://fb.storage/x.pdf',
  submittedAt: '2025-01-02T10:30:00Z',
};

const renderModal = (report: PhasedReport) =>
  render(
    <EvaluateReportModal
      isOpen
      report={report}
      onClose={vi.fn()}
      onSubmitted={vi.fn()}
    />,
  );

describe('<EvaluateReportModal> — lineage sentinel handling', () => {
  beforeEach(() => {
    evaluateMock.mockReset();
    rejectMock.mockReset();
    mockGetDocument.mockClear();
  });

  it('renders "Previous report #N" row when report.previousReportId === 5', () => {
    const report: PhasedReport = {
      ...REPORT_BASE,
      // The modal's type guard reads `previousReportId` defensively even though
      // it's not on the PhasedReport type. We cast to keep the test honest.
      ...({ previousReportId: 5 } as unknown as PhasedReport),
      lectureFeedback: 4,
      finalOutcomeEvaluation: 'OK',
    };
    renderModal(report);
    expect(screen.getByText(/Previous report:/)).toBeInTheDocument();
    expect(screen.getByText(/#5/)).toBeInTheDocument();
  });

  it('renders "Previous report #N" row when capacityEvaluation starts with __LINEAGE__:Resubmitted from report #5', () => {
    const report: PhasedReport = {
      ...REPORT_BASE,
      capacityEvaluation: '__LINEAGE__:Resubmitted from report #5',
      lectureFeedback: 4,
      finalOutcomeEvaluation: 'OK',
    };
    renderModal(report);
    expect(screen.getByText(/Previous report:/)).toBeInTheDocument();
    expect(screen.getByText(/#5/)).toBeInTheDocument();
  });

  it('renders the remainder AFTER the sentinel in the Notes/Rejection field', () => {
    const report: PhasedReport = {
      ...REPORT_BASE,
      capacityEvaluation:
        '__LINEAGE__:Resubmitted from report #5\nPlease address comments',
      lectureFeedback: 4,
      finalOutcomeEvaluation: '',
    };
    renderModal(report);
    expect(screen.getByText(/Previous report:/)).toBeInTheDocument();
    expect(screen.getByText(/Please address comments/)).toBeInTheDocument();
  });

  it('renders whole string when no sentinel and no previousReportId (existing behavior)', () => {
    const report: PhasedReport = {
      ...REPORT_BASE,
      capacityEvaluation: 'A plain rejection reason',
      lectureFeedback: 4,
      finalOutcomeEvaluation: 'OK',
    };
    renderModal(report);
    expect(screen.getByText(/A plain rejection reason/)).toBeInTheDocument();
    expect(screen.queryByText(/Previous report:/)).not.toBeInTheDocument();
  });

  it('prefers report.previousReportId over sentinel when both are present', () => {
    const report: PhasedReport = {
      ...REPORT_BASE,
      // previousReportId says 9, sentinel says 5 — the field wins.
      ...({ previousReportId: 9 } as unknown as PhasedReport),
      capacityEvaluation: '__LINEAGE__:Resubmitted from report #5',
      lectureFeedback: 4,
      finalOutcomeEvaluation: 'OK',
    };
    renderModal(report);
    expect(screen.getByText(/Previous report:/)).toBeInTheDocument();
    // 9 wins
    expect(screen.getByText(/#9/)).toBeInTheDocument();
    // 5 is not rendered as the lineage id
    expect(screen.queryByText(/Resubmitted from report #5/)).not.toBeInTheDocument();
  });
});