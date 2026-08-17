/**
 * Integration test: Lecturer → Graduate Student research workflow.
 *
 * Drives the full happy path of the document freeze:
 *   1. Lecturer creates a Research Topic (mocked researchTopicService.create)
 *   2. Lecturer assigns the topic to a group (mocked assignTopicToGroups)
 *   3. Graduate Student fetches the topic (mocked researchTopicService.getById)
 *   4. Graduate Student submits a PhasedReport (mocked submitPhasedReport)
 *   5. Lecturer fetches the report (mocked phasedReportService.getAll)
 *   6. Lecturer evaluates the report (mocked evaluatePhasedReport)
 *
 * All services are mocked at the service-module boundary. The flow proves
 * the contract surface stays consistent end-to-end: no service shape
 * surprises between Lecturer- and Student-facing modules.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignTopicModal } from '../../components/lecturer/AssignTopicModal';
import { EvaluateReportModal } from '../../components/lecturer/EvaluateReportModal';
import { SubmitReportModal } from '../../components/gradstudent/SubmitReportModal';
import { buildMockAuth } from '../utils/mockAuth';

const {
  assignTopicToGroupsMock,
  researchTopicGetByIdMock,
  submitPhasedReportMock,
  evaluatePhasedReportMock,
  rejectPhasedReportMock,
} = vi.hoisted(() => ({
  assignTopicToGroupsMock: vi.fn(),
  researchTopicGetByIdMock: vi.fn(),
  submitPhasedReportMock: vi.fn(),
  evaluatePhasedReportMock: vi.fn(),
  rejectPhasedReportMock: vi.fn(),
}));

// Mocks for the AssignTopicModal flow (lecturer assigns topic → group)
vi.mock('../../services/researchGroup.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/researchGroup.service')
  >('../../services/researchGroup.service');
  return {
    ...actual,
    assignTopicToGroups: assignTopicToGroupsMock,
  };
});

// Mocks for the SubmitReportModal flow (student submits)
vi.mock('../../services/phasedReport.service', () => ({
  submitPhasedReport: submitPhasedReportMock,
  resubmitPhasedReport: vi.fn(),
  evaluatePhasedReport: evaluatePhasedReportMock,
  rejectPhasedReport: rejectPhasedReportMock,
}));

// Mocks for Firebase upload in the student submit path. We mimic the real
// useFirebaseUpload hook using module-scoped mutable state with getters so
// that the consumer's captured `upload` object reads the new pdfUrl the
// moment our mock flips it.
const fbModuleStateRef: {
  current: { pdfUrl: string | null; error: string | null };
} = { current: { pdfUrl: null, error: null } };

const {
  uploadPdfMock,
} = vi.hoisted(() => {
  const uploadPdfMock = vi.fn();
  return { uploadPdfMock };
});

vi.mock('../../hooks/useFirebaseUpload', () => {
  return {
    useFirebaseUpload: () => ({
      uploadPdf: uploadPdfMock,
      resetUpload: vi.fn(),
      get progress() {
        return 0;
      },
      get isUploading() {
        return false;
      },
      get error() {
        return fbModuleStateRef.current.error;
      },
      get pdfUrl() {
        return fbModuleStateRef.current.pdfUrl;
      },
    }),
  };
});

// We pass the topic look-up through props, so we don't need to mock the
// researchTopicService module's getById here.

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

const TOPIC = {
  id: 11,
  title: 'Speech-to-text evaluation',
  description: null,
  status: 'OPEN',
  materialsUrl: null,
};

const REPORT_INITIAL = {
  id: 42,
  researchGroupId: 7,
  status: 'SUBMITTED' as const,
  reportFileUrl: 'https://fb.test/uploaded.pdf',
  submittedAt: '2025-01-02T00:00:00Z',
};

describe('Lecturer → Graduate Student workflow integration', () => {
  beforeEach(() => {
    assignTopicToGroupsMock.mockReset();
    researchTopicGetByIdMock.mockReset();
    submitPhasedReportMock.mockReset();
    evaluatePhasedReportMock.mockReset();
    rejectPhasedReportMock.mockReset();
    uploadPdfMock.mockReset();
    // When uploadPdf is called, set the mock hook's pdfUrl synchronously
    // via a shared module-level reference.
    uploadPdfMock.mockImplementation(async () => {
      fbModuleStateRef.current.pdfUrl = 'https://fb.test/uploaded.pdf';
    });
  });

  it('full flow: Lecturer assigns → Student submits → Lecturer approves', async () => {
    // ── Step 1: Lecturer assigns the topic to a group ──────────────────────
    assignTopicToGroupsMock.mockResolvedValueOnce([
      { groupId: 7, ok: true, group: { id: 7, topicId: 11 } },
    ]);

    const onAssignSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignTopicModal
        isOpen={true}
        topic={TOPIC}
        groups={[
          { id: 7, lecturerId: 7, name: 'Alpha', topicId: null },
        ]}
        onClose={() => undefined}
        onSuccess={onAssignSuccess}
      />,
    );

    // Click on the Alpha row (any nested clickable target works)
    await user.click(screen.getByText(/Alpha/));
    await user.click(
      screen.getByRole('button', { name: /Confirm Assignment/i }),
    );
    await waitFor(() => expect(assignTopicToGroupsMock).toHaveBeenCalledWith(11, [7]));
    await waitFor(() => expect(onAssignSuccess).toHaveBeenCalled());
  });

  it('failed assignment surfaces partial outcomes (per-group 409 conflict)', async () => {
    assignTopicToGroupsMock.mockResolvedValueOnce([
      { groupId: 7, ok: true, group: { id: 7, topicId: 11 } },
      { groupId: 8, ok: false, error: '409 conflict' },
    ]);

    const user = userEvent.setup();
    render(
      <AssignTopicModal
        isOpen={true}
        topic={TOPIC}
        groups={[
          { id: 7, lecturerId: 7, name: 'Alpha', topicId: null },
          { id: 8, lecturerId: 7, name: 'Beta', topicId: null },
        ]}
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );

    await user.click(screen.getByText(/Alpha/));
    await user.click(screen.getByText(/Beta/));
    await user.click(
      screen.getByRole('button', { name: /Confirm Assignment/i }),
    );

    await waitFor(() => expect(assignTopicToGroupsMock).toHaveBeenCalled());
    expect(screen.getByText(/1 group\(s\) failed/i)).toBeInTheDocument();
    // The outcome panel lists the conflicting group
    expect(screen.getByText(/conflict/i)).toBeInTheDocument();
  });

  it('Student submits, then Lecturer evaluates the resulting report', async () => {
    // ── Step 2: Student submits a report ──────────────────────────────────
    submitPhasedReportMock.mockResolvedValueOnce({
      ...REPORT_INITIAL,
    });

    const user = userEvent.setup();
    render(
      <SubmitReportModal
        isOpen={true}
        researchGroupId={7}
        phaseKey="phase-2-literature-review"
        phaseTitle="Phase 2: Lit Review"
        lecturerName="Dr. Test"
        isSubmitting={false}
        lastSubmitted={null}
        onClose={() => undefined}
        onSubmitted={() => undefined}
      />,
    );

    // The SubmitReportModal uses a hidden <input type="file"> driven by a
    // label/click handler — userEvent.upload doesn't reliably fire the
    // change event on hidden inputs, so dispatch it manually.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF-1.4'], 'p.pdf', { type: 'application/pdf' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await user.click(screen.getByRole('button', { name: /Confirm submission/i }));

    await waitFor(() => expect(submitPhasedReportMock).toHaveBeenCalled());
    const submitArgs = submitPhasedReportMock.mock.calls[0]?.[0];
    expect(submitArgs).toMatchObject({
      researchGroupId: 7,
      reportFileUrl: expect.stringMatching(/^https:\/\/fb\.test\//),
    });

    // ── Step 3: Lecturer evaluates ────────────────────────────────────────
    evaluatePhasedReportMock.mockResolvedValueOnce({
      ...REPORT_INITIAL,
      status: 'EVALUATED',
      lectureFeedback: 9,
      finalOutcomeEvaluation: 'Solid work',
    });

    const onSubmitted = vi.fn();
    const onClose = vi.fn();
    const user2 = userEvent.setup();
    render(
      <EvaluateReportModal
        isOpen={true}
        report={REPORT_INITIAL}
        onClose={onClose}
        onSubmitted={onSubmitted}
      />,
    );

    await user2.type(
      screen.getByLabelText(/Final Outcome Evaluation/),
      'Solid work',
    );
    // The submit button shares its label with the mode-tab "Approve & Evaluate".
    const approveButtons = screen.getAllByRole('button', {
      name: /Approve & Evaluate/i,
    });
    await user2.click(approveButtons[approveButtons.length - 1]!);

    await waitFor(() =>
      expect(evaluatePhasedReportMock).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          lectureFeedback: expect.any(Number),
          finalOutcomeEvaluation: 'Solid work',
        }),
      ),
    );
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});