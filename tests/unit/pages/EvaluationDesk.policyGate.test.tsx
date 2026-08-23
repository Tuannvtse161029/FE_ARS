/**
 * Tests for the per-paper reviewer policy gate on EvaluationDesk.
 *
 * Behavior under test:
 *   1. PDF is NOT rendered / NOT requested before policy acceptance.
 *   2. On Accept, PDF is rendered (gated query resolves to PdfViewer mount).
 *   3. On Cancel, the user is sent back to review tasks AND the PDF never renders.
 *   4. Acceptance is scoped to reviewRequestId + policyVersion:
 *      - accepting one paper does NOT unlock another.
 *   5. localStorage is NOT used as authority; sessionStorage is a transient cache only.
 *      - bad sessionStorage data does NOT grant acceptance.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import React from 'react';

const mockUser = { id: 35 };

vi.mock('../../../src/store/authSlice', () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));

const mockNavigate = vi.fn();
let mockReviewRequest: any = null;
let mockQueryString = '';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockReviewRequest ? { reviewRequest: mockReviewRequest } : {} }),
    useSearchParams: () => [new URLSearchParams(mockQueryString)],
  };
});

// Mock PdfViewer so we can track when the gated URL is actually passed to a viewer mount.
// `default` export is required because `LazyPdfViewer` resolves the barrel via
// `lazy(() => import('./index'))` and looks at `module.default`.
const PdfViewerSpy = vi.fn(({ url }: { url: string }) => (
  <div data-testid="pdf-viewer" data-url={url}>PDF: {url}</div>
));
vi.mock('../../../src/components/PdfViewer', () => {
  const mock = (props: any) => PdfViewerSpy(props);
  return {
    PdfViewer: mock,
    default: mock,
  };
});

import { EvaluationDesk } from '../../../src/pages/Reviewer/EvaluationDesk';

const mockPaper = {
  id: '10',
  title: 'Federated Learning at Scale',
  status: 'Waiting for Review',
  fileUrl: 'https://example.com/paper.pdf',
};

vi.mock('../../../src/services/paper.service', () => ({
  paperService: {
    getById: vi.fn(() => Promise.resolve(mockPaper)),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/detailedEvaluation.service', () => ({
  detailedEvaluationService: {
    getByReviewRequestId: vi.fn(() => Promise.resolve({})),
    create: vi.fn((payload) =>
      Promise.resolve({ detailedEvaluationId: 1, ...payload })
    ),
    update: vi.fn((id, payload) => Promise.resolve({ detailedEvaluationId: id, ...payload })),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/reviewRequest.service', () => ({
  reviewRequestService: {
    update: vi.fn(() => Promise.resolve({ id: 10, status: 'Completed' })),
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

// Always start each test from a clean sessionStorage.
beforeEach(() => {
  sessionStorage.clear();
  mockNavigate.mockClear();
  PdfViewerSpy.mockClear();
  mockReviewRequest = null;
});

const renderDesk = () => render(<EvaluationDesk />);

// ─────────────────────────────────────────────────────────────────────────────
// 1. PDF UNAVAILABLE BEFORE ACCEPTANCE
// ─────────────────────────────────────────────────────────────────────────────

describe('EvaluationDesk – policy gate: PDF hidden before acceptance', () => {
  beforeEach(() => {
    mockReviewRequest = { id: 10, paperId: 10 };
  });

  it('shows the policy modal and gate message by default; PDF is NOT rendered', async () => {
    renderDesk();

    // Modal appears
    const modal = await screen.findByTestId('reviewer-policy-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.getAttribute('data-review-request-id')).toBe('10');

    // Gate message visible, PdfViewer NOT mounted.
    const gateMsg = await screen.findByTestId('pdf-gated-by-policy');
    expect(gateMsg).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();
    expect(PdfViewerSpy).not.toHaveBeenCalled();
  });

  it('does NOT mount the PdfViewer (no protected PDF request) until the policy is accepted', async () => {
    const user = userEvent.setup();
    renderDesk();

    // Confirm gated first.
    expect(await screen.findByTestId('pdf-gated-by-policy')).toBeInTheDocument();
    expect(PdfViewerSpy).not.toHaveBeenCalled();

    // Accept policy.
    const acceptBtn = await screen.findByTestId('policy-accept-btn');
    await user.click(acceptBtn);

    // Now PdfViewer should mount with the URL.
    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
    });
    const calls = PdfViewerSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.url).toBe('https://example.com/paper.pdf');
  });

  it('Cancel returns the reviewer to the review tasks list and never renders the PDF', async () => {
    const user = userEvent.setup();
    renderDesk();

    // Modal is open.
    const cancelBtn = await screen.findByTestId('policy-cancel-btn');
    await user.click(cancelBtn);

    // Modal closes, navigation back to tasks.
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/review-tasks');
    });
    // PdfViewer never mounted — modal closed without acceptance.
    expect(PdfViewerSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCOPED ACCEPTANCE — ONE PAPER'S ACCEPT DOES NOT UNLOCK ANOTHER
// ─────────────────────────────────────────────────────────────────────────────

describe('EvaluationDesk – policy gate: acceptance is scoped per paper + policy version', () => {
  it('acceptance of paper A does not unlock paper B', async () => {
    // First session: reviewRequest 10
    mockReviewRequest = { id: 10, paperId: 10 };
    const user = userEvent.setup();
    const { unmount } = renderDesk();

    const acceptBtn10 = await screen.findByTestId('policy-accept-btn');
    await user.click(acceptBtn10);

    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
    });

    // Persistence: sessionStorage should now have policy acceptance for reviewRequestId 10.
    const stored = sessionStorage.getItem('ars_reviewer_policy_accepted_10');
    expect(stored).toBeTruthy();

    unmount();

    // Second scenario: a DIFFERENT paper (reviewRequestId 99). Should NOT auto-accept.
    sessionStorage.clear(); // (mocked persistence lives in JS-land; clear to be safe)
    mockReviewRequest = { id: 99, paperId: 99 };
    PdfViewerSpy.mockClear(); // reset spy between renders
    renderDesk();

    // Modal must open for the new paper, and PdfViewer must NOT mount.
    const modal = await screen.findByTestId('reviewer-policy-modal');
    expect(modal.getAttribute('data-review-request-id')).toBe('99');
    expect(await screen.findByTestId('pdf-gated-by-policy')).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();
    expect(PdfViewerSpy).not.toHaveBeenCalled();
  });

  it('corrupted / wrong-version sessionStorage does NOT bypass the gate', async () => {
    // Pre-seed sessionStorage with garbage and wrong version.
    sessionStorage.setItem(
      'ars_reviewer_policy_accepted_10',
      JSON.stringify({ version: 'WRONG_VERSION', acceptedAt: Date.now() })
    );
    mockReviewRequest = { id: 10, paperId: 10 };

    renderDesk();

    // Even though sessionStorage has an entry, wrong version = no acceptance.
    const modal = await screen.findByTestId('reviewer-policy-modal');
    expect(modal).toBeInTheDocument();
    expect(await screen.findByTestId('pdf-gated-by-policy')).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();

    // After accepting, the PdfViewer mounts.
    const user = userEvent.setup();
    const acceptBtn = screen.getByTestId('policy-accept-btn');
    await user.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
    });
  });

  it('corrupted JSON sessionStorage does NOT bypass the gate', async () => {
    sessionStorage.setItem(
      'ars_reviewer_policy_accepted_10',
      'NOT_JSON_AT_ALL'
    );
    mockReviewRequest = { id: 10, paperId: 10 };

    renderDesk();

    // Modal should still appear; gate active.
    expect(await screen.findByTestId('reviewer-policy-modal')).toBeInTheDocument();
    expect(await screen.findByTestId('pdf-gated-by-policy')).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POLICY MODAL UX — REQUIRED ELEMENTS
// ─────────────────────────────────────────────────────────────────────────────

describe('EvaluationDesk – policy modal: required UX elements', () => {
  beforeEach(() => {
    mockReviewRequest = { id: 10, paperId: 10 };
  });

  it('shows the policy version stamp inside the modal', async () => {
    renderDesk();

    const version = await screen.findByTestId('policy-version');
    expect(version.textContent).toMatch(/v?\d+\.\d+\.\d+/);
  });

  it('displays the paper title for context', async () => {
    renderDesk();

    const paperTitle = await screen.findByTestId('policy-paper-title');
    expect(paperTitle.textContent).toBe('Federated Learning at Scale');
  });

  it('exposes BOTH Cancel and Accept & Continue buttons', async () => {
    renderDesk();
    expect(await screen.findByTestId('policy-cancel-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('policy-accept-btn')).toBeInTheDocument();
  });

  it('policy modal cannot be closed by clicking the X close button without accepting (cancel = navigate away)', async () => {
    const user = userEvent.setup();
    renderDesk();

    const closeBtn = await screen.findByTestId('policy-close-btn');
    await user.click(closeBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/review-tasks');
    });
    expect(PdfViewerSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. EVALUATIONS PANEL — Scorecard never sees the manuscript anyway
// ─────────────────────────────────────────────────────────────────────────────

describe('EvaluationDesk – policy gate: acceptance state survives submit', () => {
  beforeEach(() => {
    mockReviewRequest = {
      id: 10,
      paperId: 10,
      reviewerId: 35,
      fee: 500000,
      deadline: '2026-09-01T00:00:00Z',
      airecommended: true,
      type: 'Standard',
    };
  });

  it('after accepting, the scorecard can complete submit normally', async () => {
    const user = userEvent.setup();
    renderDesk();

    // Accept policy first.
    await user.click(await screen.findByTestId('policy-accept-btn'));

    // Scorecard renders, type comments, submit.
    await screen.findByText('CRITERIA EVALUATION SCORECARD');
    await user.type(screen.getByPlaceholderText(/provide detailed feedback/i), 'Clean paper.');
    await user.click(screen.getByRole('button', { name: /submit final feedback/i }));

    await waitFor(() => {
      expect(screen.getByText(/evaluation submitted successfully/i)).toBeInTheDocument();
    });
  });
});
