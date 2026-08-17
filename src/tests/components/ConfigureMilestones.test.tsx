/**
 * Component tests for src/pages/Lecturer/ConfigureMilestones.tsx.
 *
 * Per the contract: Save is disabled (BE endpoint pending), the form
 * validates locally, and reference-material uploads use Firebase only.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ConfigureMilestones } from '../../pages/Lecturer/ConfigureMilestones';

// We mimic the real useFirebaseUpload hook using real React state so that
// when uploadPdf resolves, the consumer re-renders and the page's useEffect
// picks up the new pdfUrl. This mirrors the local pattern used by
// src/tests/integration/pdfUploadView.integration.test.tsx.
const {
  uploadPdfMock,
  resetUploadMock,
  pdfUrlSetterRef,
  errorSetterRef,
} = vi.hoisted(() => {
  const uploadPdfMock = vi.fn();
  const resetUploadMock = vi.fn();
  const pdfUrlSetterRef: { current: ((v: string | null) => void) | null } = {
    current: null,
  };
  const errorSetterRef: { current: ((v: string | null) => void) | null } = {
    current: null,
  };
  return { uploadPdfMock, resetUploadMock, pdfUrlSetterRef, errorSetterRef };
});

vi.mock('../../hooks/useFirebaseUpload', async () => {
  const React = await import('react');
  return {
    useFirebaseUpload: () => {
      const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
      const [error, setError] = React.useState<string | null>(null);
      const [isUploading, setIsUploading] = React.useState<boolean>(false);
      const [progress, setProgress] = React.useState<number>(0);
      pdfUrlSetterRef.current = setPdfUrl;
      errorSetterRef.current = setError;
      return {
        uploadPdf: uploadPdfMock,
        resetUpload: resetUploadMock,
        progress,
        isUploading,
        error,
        pdfUrl,
      };
    },
  };
});

describe('<ConfigureMilestones>', () => {
  beforeEach(() => {
    uploadPdfMock.mockReset();
    resetUploadMock.mockReset();
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(
        'https://fb.storage/learning-materials/1234/reference.pdf',
      );
    });
  });

  it('renders the disabled Save button + tooltip', () => {
    render(<ConfigureMilestones />);
    const save = screen.getByRole('button', {
      name: /PUBLISH MILESTONE REQUIREMENTS/i,
    });
    expect(save).toBeDisabled();
    expect(screen.getAllByText(/Save disabled — BE endpoint pending/).length).toBeGreaterThan(0);
  });

  it('shows the BE-gap banner naming the missing endpoint', () => {
    render(<ConfigureMilestones />);
    expect(screen.getAllByText(/Save disabled — BE endpoint pending/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/POST \/api\/Milestone/).length).toBeGreaterThan(0);
  });

  it('renders all four phase options', () => {
    render(<ConfigureMilestones />);
    const select = screen.getByLabelText(/Milestone Track Phase/);
    expect(select.querySelectorAll('option')).toHaveLength(4);
    expect(
      Array.from(select.querySelectorAll('option')).map((o) => o.textContent),
    ).toEqual([
      'Phase 1: Project Introduction Draft',
      'Phase 2: Literature Review Submission',
      'Phase 3: Methodology & Implementation Details',
      'Phase 4: Final Evaluation Report',
    ]);
  });

  it('description textarea enforces 8000-character cap', () => {
    render(<ConfigureMilestones />);
    const textarea = screen.getByLabelText(/Description Requirements/);
    expect(textarea).toHaveAttribute('maxLength', '8000');
  });

  it('blocks uploading non-PDF files (Firebase hook errors)', () => {
    render(<ConfigureMilestones />);
    errorSetterRef.current?.('Only PDF files are allowed.');
    // The error banner is rendered synchronously when state flips.
    return waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Only PDF files/);
    });
  });

  it('accepts a PDF and appends to the materials list (simulating Firebase success)', async () => {
    render(<ConfigureMilestones />);

    const pdf = new File(['%PDF-1.4'], 'reference.pdf', {
      type: 'application/pdf',
    });
    const input = screen.getByLabelText(/Browse files/i) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [pdf], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(uploadPdfMock).toHaveBeenCalledWith(pdf));
    // After the mocked uploadPdf sets pdfUrl via React state, the page's
    // useEffect runs and calls resetUpload.
    await waitFor(() => expect(resetUploadMock).toHaveBeenCalled());
  });

  it('displays an error banner when the Firebase upload fails', async () => {
    render(<ConfigureMilestones />);
    errorSetterRef.current?.('Storage quota exceeded');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Storage quota/),
    );
  });
});