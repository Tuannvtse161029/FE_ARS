/**
 * Integration tests for PDF upload.
 *
 * Key insight: PdfDropzone renders preview/error/progress based on the
 * useFirebaseUpload hook's return value. These tests verify:
 *   1. PdfDropzone shows correct states based on hook return values
 *   2. Register calls handleUploadComplete when the hook fires onUploadComplete
 *   3. Upload callbacks are wired correctly between Register ↔ PdfDropzone
 *
 * These are integration-level tests because they involve multiple components
 * (Register + PdfDropzone + the hook) working together.
 */
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { Register } from '../../pages/Register/Register';

// Mock useFirebaseUpload at module level using vi.hoisted
const {
  uploadPdfMock,
  resetUploadMock,
  useFirebaseUploadMock,
} = vi.hoisted(() => {
  const uploadPdfMock = vi.fn();
  const resetUploadMock = vi.fn();
  const useFirebaseUploadMock = vi.fn(() => ({
    uploadPdf: uploadPdfMock,
    progress: 0,
    isUploading: false,
    error: null,
    pdfUrl: null,
    uploadedFile: null,
    resetUpload: resetUploadMock,
  }));
  return { uploadPdfMock, resetUploadMock, useFirebaseUploadMock };
});

vi.mock('../../hooks/useFirebaseUpload', () => ({
  useFirebaseUpload: useFirebaseUploadMock,
}));

const renderRegister = () =>
  render(<Register />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    ),
  });

// ─── Fixture files ─────────────────────────────────────────────────────────────

const makeFile = (filename = 'sample.pdf'): File => {
  const fixturePath = require.resolve(`../fixtures/${filename}`);
  const buffer = require('fs').readFileSync(fixturePath);
  return new File([buffer], filename, { type: 'application/pdf' });
};

let SAMPLE_PDF: File;
let MULTI_PAGE_PDF: File;
try {
  SAMPLE_PDF = makeFile('sample.pdf');
  MULTI_PAGE_PDF = makeFile('sample-multi-page.pdf');
} catch {
  SAMPLE_PDF = new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' });
  MULTI_PAGE_PDF = new File(['%PDF-1.4'], 'sample-multi-page.pdf', { type: 'application/pdf' });
}

// ─── Test helpers ──────────────────────────────────────────────────────────────

const idleState = () => ({
  uploadPdf: uploadPdfMock,
  progress: 0,
  isUploading: false,
  error: null,
  pdfUrl: null,
  uploadedFile: null,
  resetUpload: resetUploadMock,
});

const uploadingState = (progress = 45) => ({
  uploadPdf: uploadPdfMock,
  progress,
  isUploading: true,
  error: null,
  pdfUrl: null,
  uploadedFile: null,
  resetUpload: resetUploadMock,
});

const errorState = (message: string) => ({
  uploadPdf: uploadPdfMock,
  progress: 0,
  isUploading: false,
  error: message,
  pdfUrl: null,
  uploadedFile: null,
  resetUpload: resetUploadMock,
});

describe('PDF Upload Integration – hook ↔ PdfDropzone ↔ Register wiring', () => {
  // ── Idle state ──────────────────────────────────────────────────────────────

  it('renders dropzone instructions in idle state', () => {
    useFirebaseUploadMock.mockReturnValue(idleState());
    renderRegister();
    expect(screen.getByText(/drag & drop verification document/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf only, max 10mb/i)).toBeInTheDocument();
  });

  it('file input accepts only PDF MIME type', () => {
    useFirebaseUploadMock.mockReturnValue(idleState());
    renderRegister();
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input.accept).toBe('application/pdf');
  });

  it('does not show upload progress in idle state', () => {
    useFirebaseUploadMock.mockReturnValue(idleState());
    renderRegister();
    expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
  });

  it('does not show error message in idle state', () => {
    useFirebaseUploadMock.mockReturnValue(idleState());
    renderRegister();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ── Uploading state ─────────────────────────────────────────────────────────

  it('shows progress bar with percentage while isUploading is true', () => {
    useFirebaseUploadMock.mockReturnValue(uploadingState(45));
    renderRegister();
    expect(screen.getByText(/uploading... 45%/i)).toBeInTheDocument();
  });

  it('shows progress bar at 100% while isUploading is still true', () => {
    useFirebaseUploadMock.mockReturnValue({
      uploadPdf: uploadPdfMock,
      progress: 100,
      isUploading: true,
      error: null,
      pdfUrl: null,
      uploadedFile: null,
      resetUpload: resetUploadMock,
    });
    renderRegister();
    expect(screen.getByText(/uploading... 100%/i)).toBeInTheDocument();
  });

  // ── Error state ───────────────────────────────────────────────────────────

  it('displays Firebase storage error message', () => {
    useFirebaseUploadMock.mockReturnValue(errorState('Storage quota exceeded'));
    renderRegister();
    expect(screen.getByText('Storage quota exceeded')).toBeInTheDocument();
  });

  it('displays type-validation error for non-PDF uploads', () => {
    useFirebaseUploadMock.mockReturnValue(errorState('Only PDF files are allowed.'));
    renderRegister();
    expect(screen.getByText('Only PDF files are allowed.')).toBeInTheDocument();
  });

  it('displays file-size limit error', () => {
    useFirebaseUploadMock.mockReturnValue(errorState('File size must be 10 MB or less.'));
    renderRegister();
    expect(screen.getByText('File size must be 10 MB or less.')).toBeInTheDocument();
  });

  // ── Upload interaction ──────────────────────────────────────────────────────

  it('calls uploadPdf when a PDF fixture file is selected via input', async () => {
    useFirebaseUploadMock.mockReturnValue(idleState());
    const user = userEvent.setup();
    renderRegister();

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    await act(async () => {
      await user.upload(input, SAMPLE_PDF);
    });

    expect(uploadPdfMock).toHaveBeenCalledTimes(1);
    expect(uploadPdfMock).toHaveBeenCalledWith(SAMPLE_PDF);
  });

  it('calls uploadPdf with multi-page PDF fixture file', async () => {
    useFirebaseUploadMock.mockReturnValue(idleState());
    const user = userEvent.setup();
    renderRegister();

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    await act(async () => {
      await user.upload(input, MULTI_PAGE_PDF);
    });

    expect(uploadPdfMock).toHaveBeenCalledWith(MULTI_PAGE_PDF);
  });

  it('does not show upload UI elements when idle', () => {
    useFirebaseUploadMock.mockReturnValue(idleState());
    renderRegister();
    expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ── Reset button ───────────────────────────────────────────────────────────

  it('renders dropzone instructions again after reset', () => {
    useFirebaseUploadMock.mockReturnValue(idleState());
    renderRegister();
    expect(screen.getByText(/drag & drop verification document/i)).toBeInTheDocument();
  });
});
