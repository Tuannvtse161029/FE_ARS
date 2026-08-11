/**
 * Unit tests for the PdfViewer component.
 * Uses vi.hoisted for mock factory variables and vi.fn() for render spies.
 */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { PdfViewer } from '../../components/PdfViewer';

// ── Polyfill IntersectionObserver (not available in JSDOM) ───────────
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

// Define as a regular class to allow `new` to work correctly
class MockIntersectionObserver {
  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = vi.fn(() => []);
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// ── Polyfill Element.prototype.scrollIntoView (not available in JSDOM) ─
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = vi.fn();
}

// ── Mock factory (hoisted by vi.mock) ──────────────────────────────────────────
const {
  getDocumentMock,
  mockPage,
  mockDoc,
  mockCanvasContext,
} = vi.hoisted(() => {
  const mockCanvasContext = {
    setTransform: vi.fn(),
    scale: vi.fn(),
  };
  const mockPage = {
    getViewport: vi.fn(() => ({ width: 595, height: 842, scale: 1 })),
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
  return { getDocumentMock, mockPage, mockDoc, mockCanvasContext };
});

vi.mock('pdfjs-dist', () => ({
  getDocument: getDocumentMock,
  GlobalWorkerOptions: { workerSrc: '' },
  version: '3.11.174',
}));

// Mock canvas.getContext so renderPage can actually run
const originalGetContext = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function (
    _contextType: string,
    ..._args: unknown[]
  ) {
    return mockCanvasContext;
  } as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

// ── Render helper ──────────────────────────────────────────────────────────────
const renderViewer = (url = 'https://example.com/doc.pdf') =>
  render(<PdfViewer url={url} />);

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('PdfViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();
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
    mockObserve.mockReset();
    mockUnobserve.mockReset();
    mockDisconnect.mockReset();
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
      await act(async () => { /* flush initial load */ });
      expect(getDocumentMock).toHaveBeenCalledWith('https://storage.example.com/paper.pdf');
    });

    it('hides loading spinner after PDF loads', async () => {
      renderViewer();
      await act(async () => { /* flush initial load */ });
      expect(screen.queryByTestId('pdf-loading')).not.toBeInTheDocument();
    });

    it('calls getPage for page 1 after load', async () => {
      renderViewer();
      await act(async () => { /* flush initial load */ });
      expect(mockDoc.getPage).toHaveBeenCalledWith(1);
    });

    it('renders page with default scale (1.5)', async () => {
      renderViewer();
      await act(async () => { /* flush initial load */ });
      // Verify the zoom percent shows the default scale
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    });

    it('renders with correct canvas dimensions', async () => {
      // Set mock BEFORE render so the useEffect sees it when it starts loading
      mockPage.getViewport.mockReturnValue({ width: 892, height: 1263, scale: 1 });
      renderViewer();
      await act(async () => { /* flush initial load + async renderPage */ });
      const canvas = screen.getByTestId('pdf-canvas') as HTMLCanvasElement;
      expect(canvas.style.width).toBe('892px');
      expect(canvas.style.height).toBe('1263px');
    });

    it('shows error when getDocument rejects', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.reject(new Error('403 Forbidden')),
        on: vi.fn(),
        destroy: vi.fn(),
      });
      renderViewer('https://example.com/restricted.pdf');
      await act(async () => { /* flush initial load */ });
      expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
      expect(screen.getByText(/403 forbidden/i)).toBeInTheDocument();
    });
  });

  // ── Page navigation ───────────────────────────────────────────────────────

  describe('page navigation', () => {
    beforeEach(async () => {
      renderViewer();
      await act(async () => { /* flush initial load */ });
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
      await act(async () => { /* flush page change */ });
      expect(mockDoc.getPage).toHaveBeenCalledWith(2);
    });

    it('renders previous page when prev button is clicked', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-next-btn'));
      await act(async () => { /* flush page change */ });
      await user.click(screen.getByTestId('pdf-prev-btn'));
      await act(async () => { /* flush page change */ });
      expect(mockDoc.getPage).toHaveBeenLastCalledWith(1);
    });

    it('disables next button on last page', async () => {
      const user = userEvent.setup();
      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByTestId('pdf-next-btn'));
        await act(async () => { /* flush */ });
      }
      expect(screen.getByTestId('pdf-next-btn')).toBeDisabled();
    });

    it('does not go past last page', async () => {
      const user = userEvent.setup();
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByTestId('pdf-next-btn'));
        await act(async () => { /* flush */ });
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
      await act(async () => { /* flush initial load */ });
    });

    it('shows initial zoom as 150%', () => {
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    });

    it('increases scale on zoom in', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-in-btn'));
      // Zoom goes from 150% to 175%
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('175%');
    });

    it('decreases scale on zoom out', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-out-btn'));
      // Zoom goes from 150% to 125%
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('125%');
    });

    it('resets zoom to 1.5 when percent button is clicked', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-out-btn'));
      await user.click(screen.getByTestId('pdf-zoom-percent'));
      // Resets back to 150%
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    });

    it('disables zoom out at minimum scale (0.5)', async () => {
      mockPage.getViewport.mockReturnValue({ width: 297.5, height: 421, scale: 1 });
      const user = userEvent.setup();
      for (let i = 0; i < 6; i++) {
        await user.click(screen.getByTestId('pdf-zoom-out-btn'));
        await act(async () => { /* flush */ });
      }
      expect(screen.getByTestId('pdf-zoom-out-btn')).toBeDisabled();
    });

    it('disables zoom in at maximum scale (3.0)', async () => {
      mockPage.getViewport.mockReturnValue({ width: 1190, height: 1684, scale: 1 });
      const user = userEvent.setup();
      for (let i = 0; i < 7; i++) {
        await user.click(screen.getByTestId('pdf-zoom-in-btn'));
        await act(async () => { /* flush */ });
      }
      expect(screen.getByTestId('pdf-zoom-in-btn')).toBeDisabled();
    });
  });

  // ── Callbacks ────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('calls onTotalPages after PDF loads', async () => {
      const onTotal = vi.fn();
      render(<PdfViewer url="https://example.com/doc.pdf" onTotalPages={onTotal} />);
      await act(async () => { /* flush initial load */ });
      expect(onTotal).toHaveBeenCalledWith(5);
    });

    it('calls onPageChange when page changes', async () => {
      const onPage = vi.fn();
      render(<PdfViewer url="https://example.com/doc.pdf" onPageChange={onPage} />);
      await act(async () => { /* flush initial load */ });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-next-btn'));
      await act(async () => { /* flush page change */ });
      expect(onPage).toHaveBeenCalledWith(2);
    });
  });
});
