/**
 * Unit tests for the PdfViewer component.
 * Uses vi.hoisted for mock factory variables and vi.fn() for render spies.
 */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { PdfViewer } from '../../components/PdfViewer';

// ── Mock factory (hoisted by vi.mock) ──────────────────────────────────────────
const {
  getDocumentMock,
  mockPage,
  mockDoc,
} = vi.hoisted(() => {
  const mockPage = {
    getViewport: vi.fn(() => ({ width: 595, height: 842 })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
  };
  const mockDoc = {
    numPages: 5,
    getPage: vi.fn(() => Promise.resolve(mockPage)),
    destroy: vi.fn(),
  };
  const getDocumentMock = vi.fn(() => ({
    promise: Promise.resolve(mockDoc),
    on: vi.fn(),
    destroy: vi.fn(),
  }));
  return { getDocumentMock, mockPage, mockDoc };
});

vi.mock('pdfjs-dist', () => ({
  getDocument: getDocumentMock,
  GlobalWorkerOptions: { workerSrc: '' },
  version: '3.11.174',
}));

// ── Render helper ──────────────────────────────────────────────────────────────
const renderViewer = (url = 'https://example.com/doc.pdf') =>
  render(<PdfViewer url={url} />);

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('PdfViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults
    mockDoc.numPages = 5;
    mockPage.getViewport.mockReturnValue({ width: 595, height: 842 });
    mockPage.render.mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() });
    mockDoc.getPage.mockReturnValue(Promise.resolve(mockPage));
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(mockDoc),
      on: vi.fn(),
      destroy: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render ────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('renders viewer wrapper with testid', () => {
      renderViewer();
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
    });

    it('renders all toolbar controls', () => {
      renderViewer();
      expect(screen.getByTestId('pdf-prev-btn')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-next-btn')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-zoom-in-btn')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-zoom-out-btn')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-zoom-percent')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-page-input')).toBeInTheDocument();
    });

    it('renders canvas element', () => {
      renderViewer();
      expect(screen.getByTestId('pdf-canvas')).toBeInTheDocument();
    });

    it('shows loading spinner while fetching PDF', () => {
      renderViewer();
      expect(screen.getByTestId('pdf-loading')).toBeInTheDocument();
    });

    it('does not render error initially', () => {
      renderViewer();
      expect(screen.queryByTestId('pdf-error')).not.toBeInTheDocument();
    });
  });

  // ── Loading ────────────────────────────────────────────────────────────────

  describe('loading', () => {
    it('calls getDocument with the given URL', async () => {
      renderViewer('https://storage.example.com/paper.pdf');
      expect(getDocumentMock).toHaveBeenCalledWith('https://storage.example.com/paper.pdf');
    });

    it('hides loading spinner after PDF loads', async () => {
      renderViewer();
      await act(async () => {
        // promise resolves on next tick
      });
      expect(screen.queryByTestId('pdf-loading')).not.toBeInTheDocument();
    });

    it('calls getPage for page 1 after load', async () => {
      renderViewer();
      await act(async () => { /* resolved on next tick */ });
      expect(mockDoc.getPage).toHaveBeenCalledWith(1);
    });

    it('renders page with default scale (1.5)', async () => {
      renderViewer();
      await act(async () => { /* resolved on next tick */ });
      expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.5 });
    });

    it('renders with correct canvas dimensions', async () => {
      mockPage.getViewport.mockReturnValue({ width: 892, height: 1263 });
      renderViewer();
      await act(async () => { /* resolved on next tick */ });
      const canvas = screen.getByTestId('pdf-canvas') as HTMLCanvasElement;
      expect(canvas.width).toBe(892);
      expect(canvas.height).toBe(1263);
    });

    it('shows error when getDocument rejects', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.reject(new Error('403 Forbidden')),
        on: vi.fn(),
        destroy: vi.fn(),
      });
      renderViewer('https://example.com/restricted.pdf');
      await act(async () => { /* resolved on next tick */ });
      expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
      expect(screen.getByText(/403 forbidden/i)).toBeInTheDocument();
    });
  });

  // ── Page navigation ───────────────────────────────────────────────────────

  describe('page navigation', () => {
    beforeEach(async () => {
      renderViewer();
      await act(async () => { /* resolved on next tick */ });
    });

    it('defaults to page 1', () => {
      expect(screen.getByTestId('pdf-page-input')).toHaveValue(1);
    });

    it('disables prev button on first page', () => {
      expect(screen.getByTestId('pdf-prev-btn')).toBeDisabled();
    });

    it('enables next button when not on last page', () => {
      expect(screen.getByTestId('pdf-next-btn')).not.toBeDisabled();
    });

    it('renders next page when next button is clicked', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-next-btn'));
      expect(mockDoc.getPage).toHaveBeenCalledWith(2);
    });

    it('renders previous page when prev button is clicked', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-next-btn'));
      await user.click(screen.getByTestId('pdf-prev-btn'));
      expect(mockDoc.getPage).toHaveBeenLastCalledWith(1);
    });

    it('disables next button on last page', async () => {
      const user = userEvent.setup();
      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByTestId('pdf-next-btn'));
      }
      expect(screen.getByTestId('pdf-next-btn')).toBeDisabled();
    });

    it('does not go past last page', async () => {
      const user = userEvent.setup();
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByTestId('pdf-next-btn'));
      }
      expect(mockDoc.getPage).toHaveBeenLastCalledWith(5);
    });

    it('does not go below page 1', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-prev-btn'));
      expect(screen.getByTestId('pdf-page-input')).toHaveValue(1);
    });
  });

  // ── Zoom ────────────────────────────────────────────────────────────────

  describe('zoom', () => {
    beforeEach(async () => {
      renderViewer();
      await act(async () => { /* resolved on next tick */ });
    });

    it('shows initial zoom as 150%', () => {
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    });

    it('increases scale on zoom in', async () => {
      mockPage.getViewport.mockReturnValue({ width: 744, height: 1052 });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-in-btn'));
      expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.75 });
    });

    it('decreases scale on zoom out', async () => {
      mockPage.getViewport.mockReturnValue({ width: 476, height: 674 });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-out-btn'));
      expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.25 });
    });

    it('resets zoom to 1.5 when percent button is clicked', async () => {
      mockPage.getViewport.mockReturnValue({ width: 595, height: 842 });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-out-btn'));
      await user.click(screen.getByTestId('pdf-zoom-percent'));
      expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.5 });
    });

    it('disables zoom out at minimum scale (0.5)', async () => {
      mockPage.getViewport.mockReturnValue({ width: 297.5, height: 421 });
      const user = userEvent.setup();
      for (let i = 0; i < 6; i++) {
        await user.click(screen.getByTestId('pdf-zoom-out-btn'));
      }
      expect(screen.getByTestId('pdf-zoom-out-btn')).toBeDisabled();
    });

    it('disables zoom in at maximum scale (3.0)', async () => {
      mockPage.getViewport.mockReturnValue({ width: 1190, height: 1684 });
      const user = userEvent.setup();
      for (let i = 0; i < 7; i++) {
        await user.click(screen.getByTestId('pdf-zoom-in-btn'));
      }
      expect(screen.getByTestId('pdf-zoom-in-btn')).toBeDisabled();
    });
  });

  // ── Callbacks ────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('calls onTotalPages after PDF loads', async () => {
      const onTotal = vi.fn();
      render(<PdfViewer url="https://example.com/doc.pdf" onTotalPages={onTotal} />);
      await act(async () => { /* resolved on next tick */ });
      expect(onTotal).toHaveBeenCalledWith(5);
    });

    it('calls onPageChange when page changes', async () => {
      const onPage = vi.fn();
      render(<PdfViewer url="https://example.com/doc.pdf" onPageChange={onPage} />);
      await act(async () => { /* resolved on next tick */ });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-next-btn'));
      expect(onPage).toHaveBeenCalledWith(2);
    });
  });
});
