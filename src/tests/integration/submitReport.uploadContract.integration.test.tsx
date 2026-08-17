/**
 * Integration test: SubmitReport upload contract.
 *
 * End-to-end pipeline (no live network):
 *   1. Student drops a PDF into <SubmitReportModal>
 *   2. The modal delegates to useSubmitPhasedReport
 *   3. useSubmitPhasedReport calls the mocked useFirebaseUpload
 *   4. On Firebase success, useSubmitPhasedReport calls
 *      submitPhasedReport (mocked at the service module boundary)
 *   5. The modal renders a success card
 *
 * This contract verifies the "Firebase-first then BE POST" flow that
 * the FE has standardized on for all PDF submissions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmitReportModal } from '../../components/gradstudent/SubmitReportModal';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';

// We mimic the real useFirebaseUpload hook using module-scoped mutable
// state with getters so the consumer's captured `upload` object reads
// the new pdfUrl/error the moment our mock flips them.
const fbState = {
  pdfUrl: null as string | null,
  error: null as string | null,
  isUploading: false,
  progress: 0,
};

const {
  uploadPdfMock,
  resetUploadMock,
  submitPhasedReportMock,
} = vi.hoisted(() => {
  const uploadPdfMock = vi.fn();
  const resetUploadMock = vi.fn();
  const submitPhasedReportMock = vi.fn();
  return { uploadPdfMock, resetUploadMock, submitPhasedReportMock };
});

vi.mock('../../hooks/useFirebaseUpload', () => ({
  useFirebaseUpload: () => ({
    uploadPdf: uploadPdfMock,
    resetUpload: resetUploadMock,
    get progress() {
      return fbState.progress;
    },
    get isUploading() {
      return fbState.isUploading;
    },
    get error() {
      return fbState.error;
    },
    get pdfUrl() {
      return fbState.pdfUrl;
    },
  }),
}));

vi.mock('../../services/phasedReport.service', () => ({
  submitPhasedReport: submitPhasedReportMock,
  resubmitPhasedReport: vi.fn(),
  evaluatePhasedReport: vi.fn(),
  rejectPhasedReport: vi.fn(),
}));

// The modal's success card only renders when the parent passes a
// non-null `lastSubmitted` prop. We mirror the real SubmitReport page
// by exposing a setter so tests can push the BE POST's result into
// the wrapper after the submission resolves.
const setLastSubmittedRef: {
  current: ((v: SubmittedPhasedReport | null) => void) | null;
} = { current: null };

const Wrapper = ({
  modalProps,
}: {
  modalProps: React.ComponentProps<typeof SubmitReportModal>;
}) => {
  const [lastSubmitted, setLastSubmitted] =
    React.useState<SubmittedPhasedReport | null>(null);
  setLastSubmittedRef.current = setLastSubmitted;
  return <SubmitReportModal {...modalProps} lastSubmitted={lastSubmitted} />;
};

const baseProps: React.ComponentProps<typeof SubmitReportModal> = {
  isOpen: true,
  researchGroupId: 7,
  phaseKey: 'phase-2-literature-review',
  phaseTitle: 'Phase 2: Lit Review',
  lecturerName: 'Dr. Test',
  isSubmitting: false,
  onClose: () => undefined,
  onSubmitted: () => undefined,
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof SubmitReportModal>> = {},
) => render(<Wrapper modalProps={{ ...baseProps, ...overrides }} />);

const fireUpload = async (file: File) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('SubmitReportModal: Firebase -> BE submit contract', () => {
  beforeEach(() => {
    uploadPdfMock.mockReset();
    resetUploadMock.mockReset();
    submitPhasedReportMock.mockReset();
    fbState.pdfUrl = null;
    fbState.error = null;
    fbState.isUploading = false;
    fbState.progress = 0;
    uploadPdfMock.mockImplementation(async () => undefined);
  });

  it('happy path: drop PDF -> Firebase upload -> BE POST -> success card', async () => {
    submitPhasedReportMock.mockResolvedValueOnce({
      id: 100,
      researchGroupId: 7,
      reportFileUrl: 'https://fb/x.pdf',
      status: 'SUBMITTED',
    });
    uploadPdfMock.mockImplementation(async () => {
      fbState.pdfUrl = 'https://fb/x.pdf';
    });

    const user = userEvent.setup();
    renderModal();
    await fireUpload(new File(['%PDF-1.4'], 'p.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /Confirm submission/i }));

    // BE POST goes through with the Firebase URL
    await waitFor(() => expect(submitPhasedReportMock).toHaveBeenCalled());
    const callArg = submitPhasedReportMock.mock.calls[0]?.[0];
    expect(callArg).toMatchObject({
      researchGroupId: 7,
      reportFileUrl: 'https://fb/x.pdf',
    });

    // Mirror production: page pushes the submitted row into the modal's
    // lastSubmitted prop so the success card effect fires.
    const submitted = await submitPhasedReportMock.mock.results[0]!.value;
    setLastSubmittedRef.current?.(submitted);
    expect(
      await screen.findByText(/Submission recorded/),
    ).toBeInTheDocument();
  });

  it('Firebase upload succeeds but BE fails — recoverable retry uses cached URL', async () => {
    uploadPdfMock.mockImplementation(async () => {
      fbState.pdfUrl = 'https://fb/x.pdf';
    });
    submitPhasedReportMock
      .mockRejectedValueOnce(new Error('Server timeout'))
      .mockResolvedValueOnce({
        id: 200,
        researchGroupId: 7,
        reportFileUrl: 'https://fb/x.pdf',
        status: 'SUBMITTED',
      });

    const user = userEvent.setup();
    renderModal();
    await fireUpload(new File(['%PDF-1.4'], 'p.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /Confirm submission/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Upload saved, but server submission failed/),
      ).toBeInTheDocument(),
    );

    // Click Retry — no second upload
    await user.click(screen.getByRole('button', { name: /Retry submission/i }));
    await waitFor(() => expect(submitPhasedReportMock).toHaveBeenCalledTimes(2));
    expect(uploadPdfMock).toHaveBeenCalledTimes(1);
  });

  it('Firebase upload failure surfaces an error and never hits the BE', async () => {
    // Configure the mock so uploadPdf resolves to an error state and
    // pdfUrl stays null. The hook will surface the error and skip the BE POST.
    uploadPdfMock.mockImplementation(async () => {
      fbState.error = 'Storage quota exceeded';
      fbState.pdfUrl = null;
    });

    const user = userEvent.setup();
    renderModal();
    await fireUpload(new File(['%PDF-1.4'], 'p.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /Confirm submission/i }));

    // Wait for any async BE POST to settle
    await waitFor(() =>
      expect(
        screen.getByText(/Storage quota exceeded/),
      ).toBeInTheDocument(),
    );
    expect(submitPhasedReportMock).not.toHaveBeenCalled();
  });
});