/**
 * Focused tests for the new Reviewer "Additional Subfield Evaluation" section.
 *
 * Covers:
 *   1. Renders only when the Paper has a subFieldId AND the fetched SubField
 *      carries a non-empty gradingRubric.
 *   2. Renders no section and no payload entries when the subField is missing
 *      or carries no usable rubric.
 *   3. Renders criteria ordered ascending by `order` (tie-break: by code).
 *   4. Maps the per-criterion UI answers into SpecializedEvaluationItemRequest
 *      fields with EXACT names: criterionCode, criterionTitle, maxScore,
 *      score, notes, standardReferences.
 *   5. Submits with general + specialized fields merged; preserves all
 *      original evaluation fields.
 *   6. Validation: out-of-range score blocks submit and surfaces an inline
 *      error message; service.create is NOT called.
 *   7. Double-click (race): the second invocation is a no-op — exactly one
 *      create request is dispatched.
 *   8. Pre-existing specializedEvaluation entries seed the form.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ─── Stable mocks the rest of the component depends on ────────────────────
const mockUser = { id: 35 };

vi.mock('../../../src/store/authSlice', () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));

const mockNavigate = vi.fn();
let mockReviewRequest: any = null;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: mockReviewRequest ? { reviewRequest: mockReviewRequest } : {},
    }),
    useSearchParams: () => [new URLSearchParams(''), vi.fn()],
  };
});

vi.mock('../../../src/components/PdfViewer', () => ({
  PdfViewer: () => <div data-testid="pdf-viewer-stub" />,
}));

// Hoist the mock handles so the `vi.mock(...)` factory closures can reach
// them safely (the hoisting causes those factories to run before this file's
// top-level `const` bindings exist).
const {
  subFieldServiceGetByIdMock,
  paperServiceGetByIdMock,
  detailedEvaluationCreateMock,
  detailedEvaluationUpdateMock,
  detailedEvaluationGetByReviewRequestIdMock,
  reviewRequestServiceUpdateMock,
} = vi.hoisted(() => ({
  subFieldServiceGetByIdMock: vi.fn(),
  paperServiceGetByIdMock: vi.fn(),
  detailedEvaluationCreateMock: vi.fn(),
  detailedEvaluationUpdateMock: vi.fn(),
  detailedEvaluationGetByReviewRequestIdMock: vi.fn(),
  reviewRequestServiceUpdateMock: vi.fn(),
}));

vi.mock('../../../src/services/subField.service', () => ({
  subFieldService: {
    getById: subFieldServiceGetByIdMock,
  },
}));

vi.mock('../../../src/services/paper.service', () => ({
  paperService: {
    getById: paperServiceGetByIdMock,
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/detailedEvaluation.service', () => ({
  detailedEvaluationService: {
    getByReviewRequestId: detailedEvaluationGetByReviewRequestIdMock,
    create: detailedEvaluationCreateMock,
    update: detailedEvaluationUpdateMock,
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/reviewRequest.service', () => ({
  reviewRequestService: {
    update: reviewRequestServiceUpdateMock,
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

import { EvaluationDesk } from '../../../src/pages/Reviewer/EvaluationDesk';

const baseReq = (overrides: Partial<any> = {}) => ({
  id: 10,
  paperId: 10,
  reviewerId: 35,
  fee: 500000,
  status: 'Pending',
  deadline: '2026-09-01T00:00:00Z',
  airecommended: false,
  type: 'Standard',
  ...overrides,
});

// Ordered criteria (order 3, 1, 2 → sorts to 1, 2, 3)
const unsortedRubric = [
  {
    code: 'Z3',
    title: 'Reproducibility',
    description: 'Can the results be reproduced?',
    maxScore: 5,
    order: 3,
    standardReferences: ['IEEE 1012-2016'],
  },
  {
    code: 'A1',
    title: 'Methodological rigor',
    description: 'Are the methods sound?',
    maxScore: 10,
    order: 1,
    standardReferences: ['ACM 2020', 'ISO/IEC 25010'],
  },
  {
    code: 'M2',
    title: 'Statistical validity',
    description: 'Statistical tests applied correctly.',
    maxScore: 8,
    order: 2,
    standardReferences: [],
  },
];

const sortedRubricCodes = ['A1', 'M2', 'Z3'];

// Auto-accept the reviewer policy for reviewRequestId 10 before each render
// so the modal does not block the scorecard in tests that don't care about the
// gate. The dedicated `tests/unit/pages/EvaluationDesk.policyGate.test.tsx`
// exercises the gate itself end-to-end.
const renderDesk = () => {
  sessionStorage.setItem(
    'ars_reviewer_policy_accepted_10',
    JSON.stringify({ version: 'v1.0.0', acceptedAt: Date.now() })
  );
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/review/evaluation', state: { reviewRequest: mockReviewRequest } },
      ]}
    >
      <Routes>
        <Route path="/review/evaluation" element={<EvaluationDesk />} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  subFieldServiceGetByIdMock.mockReset();
  paperServiceGetByIdMock.mockReset();
  detailedEvaluationCreateMock.mockReset();
  detailedEvaluationUpdateMock.mockReset();
  detailedEvaluationGetByReviewRequestIdMock.mockReset();
  reviewRequestServiceUpdateMock.mockReset();
  mockNavigate.mockClear();
  // Policy gate uses sessionStorage as transient cache; clear so accept state
  // does not bleed across tests.
  sessionStorage.clear();

  detailedEvaluationGetByReviewRequestIdMock.mockResolvedValue({});
  // Marks the request Completed so the success modal flow can play out.
  reviewRequestServiceUpdateMock.mockResolvedValue({
    id: 10,
    paperId: 10,
    reviewerId: 35,
    fee: 500000,
    status: 'Completed',
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 1. Renders the section only when gradingRubric is non-empty
// ─────────────────────────────────────────────────────────────────────────
describe('EvaluationDesk — Additional Subfield Evaluation: rendering', () => {
  beforeEach(() => {
    mockReviewRequest = baseReq();
  });

  it('renders the section when the paper has a subFieldId and the rubric is non-empty', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: unsortedRubric,
    });
    detailedEvaluationCreateMock.mockResolvedValue({
      detailedEvaluationId: 100,
    });

    renderDesk();

    expect(
      await screen.findByTestId('subfield-evaluation-section')
    ).toBeInTheDocument();
    expect(screen.getByText(/ADDITIONAL SUBFIELD EVALUATION/i)).toBeInTheDocument();
    expect(screen.getByText('Distributed Systems')).toBeInTheDocument();
  });

  it('does NOT render the section when the paper has no subFieldId', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      // no subFieldId
    });
    detailedEvaluationCreateMock.mockResolvedValue({ detailedEvaluationId: 100 });

    renderDesk();

    // Wait for the page to settle (paper loaded)
    expect(await screen.findByText('CRITERIA EVALUATION SCORECARD')).toBeInTheDocument();
    expect(screen.queryByTestId('subfield-evaluation-section')).toBeNull();
    expect(subFieldServiceGetByIdMock).not.toHaveBeenCalled();
  });

  it('does NOT render the section when the subfield has no gradingRubric', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: [], // empty
    });
    detailedEvaluationCreateMock.mockResolvedValue({ detailedEvaluationId: 100 });

    renderDesk();

    expect(await screen.findByText('CRITERIA EVALUATION SCORECARD')).toBeInTheDocument();
    expect(screen.queryByTestId('subfield-evaluation-section')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Ordered criteria: ascending by `order`, tie-break by `code`
// ─────────────────────────────────────────────────────────────────────────
describe('EvaluationDesk — Additional Subfield Evaluation: criteria ordering', () => {
  beforeEach(() => {
    mockReviewRequest = baseReq();
  });

  it('sorts criteria ascending by order (tie-break by code)', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: unsortedRubric,
    });
    detailedEvaluationCreateMock.mockResolvedValue({ detailedEvaluationId: 100 });

    renderDesk();

    const section = await screen.findByTestId('subfield-evaluation-section');
    const children = Array.from(section.querySelectorAll(
      '[data-testid^="subfield-criterion-"]'
    ));
    const codes = children.map((el) =>
      (el as HTMLElement).getAttribute('data-testid')?.replace('subfield-criterion-', '')
    );
    // Ascending by `order` → A1 (1), M2 (2), Z3 (3)
    expect(codes).toEqual(sortedRubricCodes);
  });

  it('shows max score and standard references for each criterion', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: unsortedRubric,
    });
    detailedEvaluationCreateMock.mockResolvedValue({ detailedEvaluationId: 100 });

    renderDesk();

    // A1 (order=1, maxScore=10) renders its code / title / description / max / refs.
    const a1 = await screen.findByTestId('subfield-criterion-A1');
    expect(a1).toHaveTextContent('A1');
    expect(a1).toHaveTextContent('Methodological rigor');
    expect(a1).toHaveTextContent('Are the methods sound?');
    expect(a1).toHaveTextContent('Max: 10');
    // A1's standardReferences are ['ACM 2020', 'ISO/IEC 25010']
    expect(a1).toHaveTextContent('ACM 2020');
    expect(a1).toHaveTextContent('ISO/IEC 25010');
    expect(a1).not.toHaveTextContent('IEEE 1012-2016'); // that belongs to Z3

    // Z3 (order=3, maxScore=5) renders its own refs.
    const z3 = screen.getByTestId('subfield-criterion-Z3');
    expect(z3).toHaveTextContent('Reproducibility');
    expect(z3).toHaveTextContent('Max: 5');
    expect(z3).toHaveTextContent('IEEE 1012-2016');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. SpecializedEvaluation mapping + preservation of general fields
// ─────────────────────────────────────────────────────────────────────────
describe('EvaluationDesk — Additional Subfield Evaluation: payload mapping', () => {
  beforeEach(() => {
    mockReviewRequest = baseReq();
  });

  it('sends exactly the field names required by the Swagger contract when submitting', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: unsortedRubric,
    });
    detailedEvaluationCreateMock.mockResolvedValue({ detailedEvaluationId: 100 });

    const user = userEvent.setup();
    renderDesk();

    // Fill in the specialized section. The score inputs use
    // `<input type="number">` with min/max; userEvent.type emits keystrokes
    // that respect those bounds, which is exactly what we want here because
    // every score is within range.
    const a1Score = await screen.findByTestId('subfield-score-A1');
    await user.type(a1Score, '8');
    const a1Notes = screen.getByTestId('subfield-notes-A1');
    await user.type(a1Notes, 'Good methodological grounding.');

    const m2Score = screen.getByTestId('subfield-score-M2');
    await user.type(m2Score, '6');
    const m2Notes = screen.getByTestId('subfield-notes-M2');
    await user.type(m2Notes, 'Some p-value issues');

    // z3 left blank → score sent as null
    const z3Score = screen.getByTestId('subfield-score-Z3');
    expect((z3Score as HTMLInputElement).value).toBe('');

    // Provide the required general field.
    const general = screen.getByPlaceholderText(/provide detailed feedback/i);
    await user.type(general, 'Detailed feedback');

    // Wait a microtask so the final input onChange flushes before the
    // submit handler reads form state. React state updates scheduled by
    // input events settle asynchronously under the synthetic event
    // pipeline; without this flush, handleSubmit can observe a stale
    // (empty) comments value and fail validation silently.
    await new Promise((r) => setTimeout(r, 0));

    await user.click(screen.getByRole('button', { name: /submit final feedback/i }));

    await waitFor(() => {
      expect(detailedEvaluationCreateMock).toHaveBeenCalledTimes(1);
    });

    const callArg = detailedEvaluationCreateMock.mock.calls[0][0];
    // Exactly the field names per swagger SpecializedEvaluationItemRequest:
    expect(Array.isArray(callArg.specializedEvaluation)).toBe(true);
    expect(callArg.specializedEvaluation).toHaveLength(3);

    const byCode = Object.fromEntries(
      callArg.specializedEvaluation.map((c: any) => [c.criterionCode, c])
    );

    // First three criteria after sorting — verify order matches sortedRubricCodes
    expect(callArg.specializedEvaluation.map((c: any) => c.criterionCode)).toEqual(
      sortedRubricCodes
    );

    // Exact field names only — no `maxScore` (== null allowed), exactly
    // criterionCode, criterionTitle, maxScore, score, notes, standardReferences.
    for (const item of callArg.specializedEvaluation) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'criterionCode',
          'criterionTitle',
          'maxScore',
          'score',
          'notes',
          'standardReferences',
        ].sort()
      );
    }

    // A1: score 8, notes 'Good methodological grounding.', max 10, refs non-null
    expect(byCode.A1.score).toBe(8);
    expect(byCode.A1.notes).toBe('Good methodological grounding.');
    expect(byCode.A1.maxScore).toBe(10);
    expect(byCode.A1.criterionTitle).toBe('Methodological rigor');
    expect(byCode.A1.standardReferences).toEqual(['ACM 2020', 'ISO/IEC 25010']);

    // M2: score 6, max 8, refs [] (normalized empty array, since rubric had [])
    expect(byCode.M2.score).toBe(6);
    expect(byCode.M2.maxScore).toBe(8);
    expect(byCode.M2.standardReferences).toEqual([]);

    // Z3: empty → score null, max 5, notes ''
    expect(byCode.Z3.score).toBeNull();
    expect(byCode.Z3.maxScore).toBe(5);
    expect(byCode.Z3.standardReferences).toEqual(['IEEE 1012-2016']);
    expect(byCode.Z3.notes).toBe('');

    // General fields preserved
    expect(callArg.scoreOriginality).toBe(4);
    expect(callArg.scoreLiterature).toBe(4);
    expect(callArg.scoreMethodology).toBe(5);
    expect(callArg.scoreResults).toBe(4);
    expect(callArg.scoreFormatting).toBe(5);
    expect(callArg.finalDecision).toBe('Accept');
    expect(callArg.generalComments).toBe('Detailed feedback');
    expect(callArg.reviewRequestId).toBe(10);
    expect(callArg.reviewerId).toBe(35);
  });

  it('omits specializedEvaluation when the paper has no subField', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      // no subFieldId
    });
    detailedEvaluationCreateMock.mockResolvedValue({ detailedEvaluationId: 100 });

    const user = userEvent.setup();
    renderDesk();

    await screen.findByText('CRITERIA EVALUATION SCORECARD');

    const general = screen.getByPlaceholderText(/provide detailed feedback/i);
    await user.type(general, 'Detailed feedback');

    await user.click(screen.getByRole('button', { name: /submit final feedback/i }));

    await waitFor(() => {
      expect(detailedEvaluationCreateMock).toHaveBeenCalledTimes(1);
    });

    const callArg = detailedEvaluationCreateMock.mock.calls[0][0];
    // No fabricated entries when subfield is missing
    expect(callArg.specializedEvaluation).toBeUndefined();

    // General fields still present
    expect(callArg.generalComments).toBe('Detailed feedback');
  });

  it('seeds the form from existing evaluation.specializedEvaluation[]', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: unsortedRubric,
    });

    detailedEvaluationGetByReviewRequestIdMock.mockResolvedValueOnce({
      detailedEvaluationId: 999,
      reviewRequestId: 10,
      reviewerId: 35,
      generalComments: 'Prior general notes',
      finalDecision: 'Minor Revision',
      specializedEvaluation: [
        {
          criterionCode: 'A1',
          criterionTitle: 'Methodological rigor',
          maxScore: 10,
          score: 7,
          notes: 'Prior A1 notes',
          standardReferences: ['ACM 2020', 'ISO/IEC 25010'],
        },
      ],
    });
    detailedEvaluationUpdateMock.mockResolvedValue({ detailedEvaluationId: 999 });

    renderDesk();

    const a1Score = await screen.findByTestId('subfield-score-A1');
    expect((a1Score as HTMLInputElement).value).toBe('7');
    expect(screen.getByTestId('subfield-notes-A1')).toHaveTextContent(
      /Prior A1 notes/
    );

    // M2 has no seeded value
    const m2Score = screen.getByTestId('subfield-score-M2') as HTMLInputElement;
    expect(m2Score.value).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Validation: scores must be in [0, maxScore] per criterion
// ─────────────────────────────────────────────────────────────────────────
describe('EvaluationDesk — Additional Subfield Evaluation: validation', () => {
  beforeEach(() => {
    mockReviewRequest = baseReq();
  });

  it('blocks submit when a specialized score is out of range and surfaces an error', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: unsortedRubric,
    });
    detailedEvaluationCreateMock.mockResolvedValue({ detailedEvaluationId: 100 });

    const user = userEvent.setup();
    renderDesk();

    // A1 maxScore = 10 → score 15 is out of range
    const a1Score = await screen.findByTestId('subfield-score-A1');
    // Use fireEvent to land an out-of-range value in the React state.
    fireEvent.change(a1Score, { target: { value: '15' } });

    const general = screen.getByPlaceholderText(/provide detailed feedback/i);
    fireEvent.change(general, { target: { value: 'Detailed feedback' } });

    // Submit via the form's submit event — fireEvent.click on a submit
    // button doesn't always propagate to React's onSubmit handler in
    // jsdom + React 19.
    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    // Inline error message for A1 is shown — assert via aria-invalid on the
    // input + the explanatory banner that drives the validation gate.
    await waitFor(() => {
      expect(a1Score).toHaveAttribute('aria-invalid', 'true');
    });
    expect(
      screen.getByText(/please correct the highlighted specialized-evaluation scores/i)
    ).toBeInTheDocument();
    // Service is NOT called when validation fails
    expect(detailedEvaluationCreateMock).not.toHaveBeenCalled();
    // Review request is also NOT updated
    expect(reviewRequestServiceUpdateMock).not.toHaveBeenCalled();
  });

  it('allows negative scores to be flagged as invalid', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: unsortedRubric,
    });
    detailedEvaluationCreateMock.mockResolvedValue({ detailedEvaluationId: 100 });

    const user = userEvent.setup();
    renderDesk();

    // maxScore 5 for Z3 → -1 out of range
    const z3Score = await screen.findByTestId('subfield-score-Z3');
    fireEvent.change(z3Score, { target: { value: '-1' } });

    const general = screen.getByPlaceholderText(/provide detailed feedback/i);
    fireEvent.change(general, { target: { value: 'Detailed feedback' } });

    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(z3Score).toHaveAttribute('aria-invalid', 'true');
    });
    expect(
      screen.getByText(/please correct the highlighted specialized-evaluation scores/i)
    ).toBeInTheDocument();
    expect(detailedEvaluationCreateMock).not.toHaveBeenCalled();
  });

  it('accepts a score equal to maxScore as the boundary', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: unsortedRubric,
    });
    detailedEvaluationCreateMock.mockResolvedValue({ detailedEvaluationId: 100 });

    const user = userEvent.setup();
    renderDesk();

    // A1 maxScore 10 → exact boundary 10 should be valid.
    const a1 = await screen.findByTestId('subfield-score-A1');
    fireEvent.change(a1, { target: { value: '10' } });

    const general = screen.getByPlaceholderText(/provide detailed feedback/i);
    await user.type(general, 'Detailed feedback');

    // fireEvent.submit directly invokes the form's onSubmit handler.
    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(detailedEvaluationCreateMock).toHaveBeenCalledTimes(1);
    });

    const callArg = detailedEvaluationCreateMock.mock.calls[0][0];
    const byCode = Object.fromEntries(
      (callArg.specializedEvaluation as any[]).map((c) => [c.criterionCode, c])
    );
    expect(byCode.A1.score).toBe(10);
    expect(byCode.A1.maxScore).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Double-submit guard (race)
// ─────────────────────────────────────────────────────────────────────────
describe('EvaluationDesk — Additional Subfield Evaluation: double-submit guard', () => {
  beforeEach(() => {
    mockReviewRequest = baseReq();
  });

  it('sends exactly one create call when the user double-clicks the submit button', async () => {
    paperServiceGetByIdMock.mockResolvedValue({
      id: '10',
      title: 'A Federated Paper',
      status: 'Pending',
      subFieldId: 7,
    });
    subFieldServiceGetByIdMock.mockResolvedValueOnce({
      id: 7,
      subFieldId: 7,
      name: 'Distributed Systems',
      gradingRubric: unsortedRubric,
    });

    // make create() slow so the second click fires while the first is in flight.
    let resolveCreate: (value: any) => void = () => undefined;
    const createPromise = new Promise<any>((resolve) => {
      resolveCreate = resolve;
    });
    detailedEvaluationCreateMock.mockReturnValue(createPromise);

    const user = userEvent.setup();
    renderDesk();

    await screen.findByTestId('subfield-evaluation-section');

    const general = screen.getByPlaceholderText(/provide detailed feedback/i);
    await user.type(general, 'Detailed feedback');

    const form = document.querySelector('form')!;

    // Two rapid submits — the second must be a no-op while the first
    // create call is still in flight.
    fireEvent.submit(form);
    fireEvent.submit(form);

    // Resolve the first (and only) call
    resolveCreate({ detailedEvaluationId: 100 });

    // Wait long enough for any spurious second call to appear
    await new Promise((r) => setTimeout(r, 50));

    expect(detailedEvaluationCreateMock).toHaveBeenCalledTimes(1);
    expect(reviewRequestServiceUpdateMock).toHaveBeenCalledTimes(1);
  });
});
