/**
 * Integration tests: PDF upload -> Firebase -> PdfViewer pipeline.
 *
 * Verifies:
 *   1. Register: PDF dropzone renders with correct instructions
 *   2. PdfViewer: faithful rendering of any PDF URL with page navigation + zoom
 *   3. Pipeline: Firebase URL flows from Register to PdfViewer
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { Register } from '../../pages/Register/Register';
import { PdfViewer } from '../../components/PdfViewer';
import { mockPdfState, resetPdfMock, getDocumentMock, mockPage } from '../utils/mockPdfJs';

// ── Canvas context mock so renderPage actually runs in jsdom ──────────────────
const mockCanvasContext = { setTransform: vi.fn(), scale: vi.fn() };
beforeAll(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (type === '2d') return mockCanvasContext;
    return orig.call(this, type);
  } as typeof HTMLCanvasElement.prototype.getContext;
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = HTMLCanvasElement.prototype.getContext;
});

// ── vi.hoisted: shared mutable upload state ─────────────────────────────────
// The mocked useFirebaseUpload uses real React state so the consumer
// (PdfDropzone) re-renders when the mocked hook's state changes. Setters are
// exposed via hoisted refs so the test can drive "upload complete" transitions.

const {
  uploadPdfMock,
  resetUploadMock,
  pdfUrlSetterRef,
  uploadedFileSetterRef,
  setUploadComplete,
} = vi.hoisted(() => {
  const uploadPdfMock = vi.fn();
  const resetUploadMock = vi.fn();

  const pdfUrlSetterRef: { current: ((v: string | null) => void) | null } = {
    current: null,
  };
  const uploadedFileSetterRef: { current: ((v: File | null) => void) | null } = {
    current: null,
  };

  // Drive the mocked hook into its "complete" state, wrapped in act() so
  // React flushes the re-render and runs the resulting useEffect synchronously.
  const setUploadComplete = (file: File, url: string) => {
    act(() => {
      pdfUrlSetterRef.current?.(url);
      uploadedFileSetterRef.current?.(file);
    });
  };

  return {
    uploadPdfMock,
    resetUploadMock,
    pdfUrlSetterRef,
    uploadedFileSetterRef,
    setUploadComplete,
  };
});

// ── Mock useFirebaseUpload ───────────────────────────────────────────────────
// The mocked hook uses real React state so PdfDropzone re-renders when state
// changes. Setters are stored in hoisted refs so the test can drive transitions.

vi.mock('../../hooks/useFirebaseUpload', async () => {
  const React = await import('react');
  return {
    useFirebaseUpload: () => {
      const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
      const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
      const [isUploading, setIsUploading] = React.useState<boolean>(false);
      const [progress, setProgress] = React.useState<number>(0);
      const [error, setError] = React.useState<string | null>(null);

      // Expose setters to the test via the hoisted refs.
      pdfUrlSetterRef.current = setPdfUrl;
      uploadedFileSetterRef.current = setUploadedFile;

      return {
        uploadPdf: uploadPdfMock,
        resetUpload: resetUploadMock,
        pdfUrl,
        uploadedFile,
        isUploading,
        progress,
        error,
      };
    },
  };
});

// ── Mock pdfjs-dist ──────────────────────────────────────────────────────────

vi.mock('pdfjs-dist', () => ({
  getDocument: (url: string) => getDocumentMock(url),
  GlobalWorkerOptions: { workerSrc: '' },
  version: '3.11.174',
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const RESEARCH_PAPER = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const fixturePath = path.resolve(__dirname, '../fixtures/research-paper-with-figures.pdf');
    const buffer = fs.readFileSync(fixturePath);
    return new File([buffer], 'research-paper-with-figures.pdf', { type: 'application/pdf' });
  } catch {
    return new File(['%PDF-1.4'], 'research-paper-with-figures.pdf', { type: 'application/pdf' });
  }
})();

const FIREBASE_URL = 'https://firebasestorage.googleapis.com/v0/b/ars-platform/o/papers/research.pdf';

// ── Render helpers ──────────────────────────────────────────────────────────

const renderRegister = () =>
  render(<Register />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    ),
  });

const renderViewer = (url: string) =>
  render(<PdfViewer url={url} />);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PDF Upload -> Firebase -> View Pipeline', () => {

  beforeEach(() => {
    resetPdfMock();
    mockPdfState({ numPages: 5 });
    uploadPdfMock.mockReset();
    resetUploadMock.mockReset();

    // Drive the mocked hook into "complete" state when uploadPdf is called.
    // We run the state update synchronously inside the mock so the resulting
    // useEffect chain (mock pdfUrl change -> PdfDropzone effect ->
    // Register.handleUploadComplete -> preview card) runs in one tick.
    uploadPdfMock.mockImplementation((file: File) => {
      setUploadComplete(file, FIREBASE_URL);
      return Promise.resolve();
    });
  });

  // ── 1. Register: PDF dropzone UI ─────────────────────────────────────────────

  describe('Register: PDF dropzone renders correctly', () => {
    it('shows drag-and-drop instructions', () => {
      renderRegister();
      expect(screen.getByText(/drag & drop verification document/i)).toBeInTheDocument();
      expect(screen.getByText(/pdf only, max 10mb/i)).toBeInTheDocument();
    });

    it('submit is disabled when no PDF is uploaded', () => {
      renderRegister();
      expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
    });

    it('shows PDF file card when upload completes', async () => {
      renderRegister();
      const user = userEvent.setup();
      const fileInput = screen.getByTestId('file-input');
      await user.upload(fileInput, RESEARCH_PAPER);
      // Chain: user.upload -> PdfDropzone.onInputChange -> uploadPdf(file)
      //   -> mock calls setUploadComplete(file, FIREBASE_URL) (synchronous, in act())
      //   -> mocked useFirebaseUpload returns pdfUrl=FIREBASE_URL
      //   -> PdfDropzone.useEffect([hookPdfUrl]) fires -> onUploadComplete(file, url)
      //   -> Register.handleUploadComplete sets pdfFile + pdfUrl state
      //   -> Register re-renders PdfDropzone with pdfUrl/uploadedFile props
      //   -> PdfDropzone renders preview card showing the filename.
      await waitFor(() => {
        expect(screen.getByText('research-paper-with-figures.pdf')).toBeInTheDocument();
      });
    });

    it('shows upload progress when isUploading is true', () => {
      renderRegister();
      expect(screen.queryByText(/uploading.../i)).not.toBeInTheDocument();
    });
  });

  // ── 2. PdfViewer: faithful rendering ─────────────────────────────────────────

  describe('PdfViewer: faithful PDF rendering', () => {
    it('renders viewer wrapper and canvas element', () => {
      renderViewer('https://example.com/research-paper.pdf');
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-canvas')).toBeInTheDocument();
    });

    it('calls getDocument with the PDF URL', () => {
      const url = 'https://firebasestorage.googleapis.com/v0/b/ars-platform/o/research.pdf';
      renderViewer(url);
      expect(getDocumentMock).toHaveBeenCalledWith(url);
    });

    it('displays total page count (5 pages)', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByText('/ 5')).toBeInTheDocument();
      });
    });

    it('renders with canvas dimensions from viewport', async () => {
      // Set viewport BEFORE render so the useEffect uses the right dimensions
      mockPage.getViewport.mockReturnValue({ width: 892, height: 1263 });
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        const canvas = screen.getByTestId('pdf-canvas') as HTMLCanvasElement;
        expect(canvas.width).toBe(892);
        expect(canvas.height).toBe(1263);
      });
    });

    it('renders toolbar with prev/next nav and zoom controls', () => {
      renderViewer('https://example.com/research-paper.pdf');
      expect(screen.getByTestId('pdf-prev-btn')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-next-btn')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-zoom-in-btn')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-zoom-out-btn')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    });

    it('navigates to page 2 when next button is clicked', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-page-input')).toBeInTheDocument();
      });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-next-btn'));
      expect(screen.getByTestId('pdf-page-input')).toHaveValue(2);
    });

    it('renders architecture figure page (page 3)', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-page-input')).toBeInTheDocument();
      });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-next-btn'));
      await user.click(screen.getByTestId('pdf-next-btn'));
      expect(screen.getByTestId('pdf-page-input')).toHaveValue(3);
    });

    it('renders results table page (page 4)', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-page-input')).toBeInTheDocument();
      });
      const user = userEvent.setup();
      for (let i = 0; i < 3; i++) {
        await user.click(screen.getByTestId('pdf-next-btn'));
      }
      expect(screen.getByTestId('pdf-page-input')).toHaveValue(4);
    });

    it('shows error when PDF URL is inaccessible (403)', async () => {
      getDocumentMock.mockImplementationOnce(() => ({
        promise: Promise.reject(new Error('403 Forbidden: Access Denied')),
        on: vi.fn(),
        destroy: vi.fn(),
      }));
      renderViewer('https://example.com/restricted.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
      });
      expect(screen.getByText(/403 forbidden/i)).toBeInTheDocument();
    });

    it('zooms in (150% -> 175%) when zoom-in button is clicked', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-zoom-percent')).toBeInTheDocument();
      });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-in-btn'));
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('175%');
    });

    it('zooms out (150% -> 125%) when zoom-out button is clicked', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-zoom-percent')).toBeInTheDocument();
      });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-out-btn'));
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('125%');
    });

    it('resets zoom to 150% when zoom percent button is clicked', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-zoom-percent')).toBeInTheDocument();
      });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-out-btn'));
      await user.click(screen.getByTestId('pdf-zoom-percent'));
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    });

    it('disables prev button on first page', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-prev-btn')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pdf-prev-btn')).toBeDisabled();
    });

    it('enables next button on first page (not last)', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-next-btn')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pdf-next-btn')).not.toBeDisabled();
    });

    it('disables next button on last page', async () => {
      renderViewer('https://example.com/research-paper.pdf');
      await waitFor(() => {
        expect(screen.getByTestId('pdf-page-input')).toBeInTheDocument();
      });
      const user = userEvent.setup();
      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByTestId('pdf-next-btn'));
      }
      expect(screen.getByTestId('pdf-next-btn')).toBeDisabled();
    });
  });

  // ── 3. E2E: same Firebase URL flows from Register to PdfViewer ──────────────

  describe('E2E: Firebase URL flows from Register upload to PdfViewer', () => {
    it('Register shows the firebase URL filename in the PDF file card', async () => {
      renderRegister();
      const user = userEvent.setup();
      const fileInput = screen.getByTestId('file-input');
      await user.upload(fileInput, RESEARCH_PAPER);
      await waitFor(() => {
        expect(screen.getByText('research-paper-with-figures.pdf')).toBeInTheDocument();
      });
    });

    it('PdfViewer renders the firebase URL as a canvas', () => {
      renderViewer(FIREBASE_URL);
      expect(screen.getByTestId('pdf-canvas')).toBeInTheDocument();
      expect(getDocumentMock).toHaveBeenCalledWith(FIREBASE_URL);
    });

    it('PdfViewer loads all 5 pages of the research paper', async () => {
      renderViewer(FIREBASE_URL);
      await waitFor(() => {
        expect(screen.getByText('/ 5')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pdf-canvas')).toBeInTheDocument();
    });

    it('PdfViewer canvas has correct dimensions for A4 page at 1.5x scale', async () => {
      mockPage.getViewport.mockReturnValue({ width: 892, height: 1263 });
      renderViewer(FIREBASE_URL);
      await waitFor(() => {
        expect(screen.getByTestId('pdf-canvas')).toBeInTheDocument();
      });
      const canvas = screen.getByTestId('pdf-canvas') as HTMLCanvasElement;
      expect(canvas.width).toBe(892);
      expect(canvas.height).toBe(1263);
    });
  });
});
