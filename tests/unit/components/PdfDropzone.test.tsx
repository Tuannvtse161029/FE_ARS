import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import React from 'react';
import { I18nProvider } from '../../../src/i18n/I18nContext';
import { PdfDropzone } from '../../../src/pages/Register/components/PdfDropzone';

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

vi.mock('../../../src/hooks/useFirebaseUpload', () => ({
  useFirebaseUpload: useFirebaseUploadMock,
}));

const renderDropzone = (ui: React.ReactElement): ReturnType<typeof render> =>
  render(<I18nProvider>{ui}</I18nProvider>);

/**
 * Wait for the en dictionary chunk to finish loading inside the I18nProvider
 * so the components re-render with translated strings instead of raw keys.
 */
const waitForDictionary = async () => {
  await waitFor(() => {
    // The dropzone renders "Drag and drop your verification document here, or"
    // once the dictionary resolves. If the key is still rendered as a raw
    // string, the dictionary has not loaded yet.
    expect(
      document.querySelector('[aria-label="register.dropzone.uploadLabel"]'),
    ).not.toBeInTheDocument();
  }, { timeout: 3000 });
};

describe('PdfDropzone – smoke', () => {
  test('renders dropzone instructions', async () => {
    renderDropzone(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl={null}
        uploadedFile={null}
      />
    );
    await waitForDictionary();
    expect(screen.getByText(/drag and drop your verification document here/i)).toBeInTheDocument();
    expect(screen.getByText(/max 10mb/i)).toBeInTheDocument();
  });

  test('renders hidden file input with accept=application/pdf', async () => {
    renderDropzone(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl={null}
        uploadedFile={null}
      />
    );
    await waitForDictionary();
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.accept).toBe('application/pdf');
  });
});

describe('PdfDropzone – upload states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders progress bar when uploading', async () => {
    useFirebaseUploadMock.mockReturnValue({
      uploadPdf: vi.fn(),
      progress: 45,
      isUploading: true,
      error: null,
      pdfUrl: null,
      resetUpload: vi.fn(),
    });

    renderDropzone(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl={null}
        uploadedFile={null}
      />
    );
    await waitForDictionary();
    expect(screen.getByText(/uploading... 45%/i)).toBeInTheDocument();
  });

  test('renders error message on upload failure', async () => {
    useFirebaseUploadMock.mockReturnValue({
      uploadPdf: vi.fn(),
      progress: 0,
      isUploading: false,
      error: 'Only PDF files are allowed.',
      pdfUrl: null,
      resetUpload: vi.fn(),
    });

    renderDropzone(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl={null}
        uploadedFile={null}
      />
    );
    await waitForDictionary();
    expect(screen.getByText('Only PDF files are allowed.')).toBeInTheDocument();
  });
});

describe('PdfDropzone – preview card', () => {
  test('shows preview card when pdfUrl and uploadedFile are provided', async () => {
    const file = new File(['content'], 'verification.pdf', { type: 'application/pdf' });
    renderDropzone(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl="https://example.com/verification.pdf"
        uploadedFile={file}
      />
    );
    await waitForDictionary();
    expect(screen.getByText('verification.pdf')).toBeInTheDocument();
    expect(screen.getByText(/uploaded/i)).toBeInTheDocument();
  });

  test('shows remove button on preview card', async () => {
    const file = new File(['content'], 'verification.pdf', { type: 'application/pdf' });
    renderDropzone(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={vi.fn()}
        pdfUrl="https://example.com/verification.pdf"
        uploadedFile={file}
      />
    );
    await waitForDictionary();
    expect(screen.getByRole('button', { name: /remove uploaded pdf/i })).toBeInTheDocument();
  });

  test('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const file = new File(['content'], 'verification.pdf', { type: 'application/pdf' });
    renderDropzone(
      <PdfDropzone
        onUploadComplete={vi.fn()}
        onRemove={onRemove}
        pdfUrl="https://example.com/verification.pdf"
        uploadedFile={file}
      />
    );
    await waitForDictionary();
    await user.click(screen.getByRole('button', { name: /remove uploaded pdf/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});
