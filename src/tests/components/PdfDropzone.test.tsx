import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import React from 'react';
import { PdfDropzone } from '../../pages/Register/components/PdfDropzone';

const { useFirebaseUploadMock } = vi.hoisted(() => {
  const mock = vi.fn(() => ({
    uploadPdf: vi.fn(),
    progress: 0,
    isUploading: false,
    error: null,
    pdfUrl: null,
    resetUpload: vi.fn(),
  }));
  return { useFirebaseUploadMock: mock };
});

vi.mock('../../hooks/useFirebaseUpload', () => ({
  useFirebaseUpload: useFirebaseUploadMock,
}));

describe('PdfDropzone – smoke', () => {
  test('renders dropzone instructions', () => {
    render(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl={null}
        uploadedFile={null}
      />
    );
    expect(screen.getByText(/drag & drop verification document/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf only, max 10mb/i)).toBeInTheDocument();
  });

  test('renders hidden file input with accept=application/pdf', () => {
    render(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl={null}
        uploadedFile={null}
      />
    );
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.accept).toBe('application/pdf');
  });
});

describe('PdfDropzone – upload states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders progress bar when uploading', () => {
    useFirebaseUploadMock.mockReturnValue({
      uploadPdf: vi.fn(),
      progress: 45,
      isUploading: true,
      error: null,
      pdfUrl: null,
      resetUpload: vi.fn(),
    });

    render(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl={null}
        uploadedFile={null}
      />
    );
    expect(screen.getByText(/uploading... 45%/i)).toBeInTheDocument();
  });

  test('renders error message on upload failure', () => {
    useFirebaseUploadMock.mockReturnValue({
      uploadPdf: vi.fn(),
      progress: 0,
      isUploading: false,
      error: 'Only PDF files are allowed.',
      pdfUrl: null,
      resetUpload: vi.fn(),
    });

    render(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl={null}
        uploadedFile={null}
      />
    );
    expect(screen.getByText('Only PDF files are allowed.')).toBeInTheDocument();
  });
});

describe('PdfDropzone – preview card', () => {
  test('shows preview card when pdfUrl and uploadedFile are provided', () => {
    const file = new File(['content'], 'verification.pdf', { type: 'application/pdf' });
    render(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl="https://example.com/verification.pdf"
        uploadedFile={file}
      />
    );
    expect(screen.getByText('verification.pdf')).toBeInTheDocument();
    expect(screen.getByText(/uploaded/i)).toBeInTheDocument();
  });

  test('shows remove button on preview card', () => {
    const file = new File(['content'], 'verification.pdf', { type: 'application/pdf' });
    render(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl="https://example.com/verification.pdf"
        uploadedFile={file}
      />
    );
    expect(screen.getByRole('button', { name: /remove uploaded pdf/i })).toBeInTheDocument();
  });

  test('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const file = new File(['content'], 'verification.pdf', { type: 'application/pdf' });
    render(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={onRemove}
        pdfUrl="https://example.com/verification.pdf"
        uploadedFile={file}
      />
    );
    await user.click(screen.getByRole('button', { name: /remove uploaded pdf/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});
