/**
 * Unit tests for the PdfViewer component.
 * Uses vi.hoisted for mock factory variables and vi.fn() for render spies.
 *
 * Tests cover:
 *   - Initial render / toolbar / loading
 *   - Page navigation and zoom
 *   - Callbacks
 *   - Error UI (Defect 4D): empty, invalid, 404, htmlResponse, recoverable
 *   - Safety: no Firebase secret leakage, no `1 / 0` pagination on failure
 */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { PdfViewer } from '../../components/PdfViewer';

// ── Polyfill IntersectionObserver (not available in JSDOM) ───────────
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

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

// ── Mock canvas.getContext so renderToCanvas can actually run ───────────────
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function (
    _contextType: string,
    ..._args: unknown[]
  ) {
    return mockCanvasContext;
  } as typeof HTMLCanvasElement.prototype.getContext;
  // JSDOM doesn't ship canvas implementation; stub toDataURL so the
  // thumbnail renderer doesn't spam console warnings during tests.
  HTMLCanvasElement.prototype.toDataURL = function (..._args: unknown[]) {
    return 'data:image/png;base64,';
  } as typeof HTMLCanvasElement.prototype.toDataURL;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
});

// ── Fake fetch (default: returns a valid PDF body so existing tests pass) ──
const SAMPLE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]).buffer;
let nextFetchBehavior:
  | { kind: 'ok'; status?: number; contentType?: string; body?: ArrayBuffer }
  | { kind: 'reject'; error: Error }
  | { kind: 'custom'; fn: (input: RequestInfo | URL) => Promise<Response> } = {
  kind: 'ok',
  status: 200,
  contentType: 'application/pdf',
  body: SAMPLE_PDF_BYTES,
};

const originalFetch = globalThis.fetch;
beforeEach(() => {
  nextFetchBehavior = {
    kind: 'ok',
    status: 200,
    contentType: 'application/pdf',
    body: SAMPLE_PDF_BYTES,
  };
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (nextFetchBehavior.kind === 'reject') throw nextFetchBehavior.error;
    if (nextFetchBehavior.kind === 'custom') return nextFetchBehavior.fn(input);
    const { status = 200, contentType = 'application/pdf', body = SAMPLE_PDF_BYTES } = nextFetchBehavior;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (key: string) =>
          key.toLowerCase() === 'content-type' ? contentType : null,
      },
      arrayBuffer: async () => body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── Render helper ──────────────────────────────────────────────────────────────
const renderViewer = (url: string | File | Blob | null = 'https://example.com/doc.pdf') =>
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

    it('does not render error or empty initially', () => {
      renderViewer();
      expect(screen.queryByTestId('pdf-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pdf-empty')).not.toBeInTheDocument();
    });
  });

  // ── Loading ────────────────────────────────────────────────────────────────

  describe('loading', () => {
    it('calls getDocument with array-buffer source (resolver pipeline)', async () => {
      renderViewer('https://storage.example.com/paper.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getDocumentMock).toHaveBeenCalledTimes(1);
      // getDocument must be invoked with an object (data: ArrayBuffer) per the resolver contract.
      const arg = getDocumentMock.mock.calls[0][0];
      expect(arg).toBeTypeOf('object');
      expect(arg).toHaveProperty('data');
      expect(arg.data).toBeInstanceOf(ArrayBuffer);
    });

    it('hides loading spinner after PDF loads', async () => {
      renderViewer();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.queryByTestId('pdf-loading')).not.toBeInTheDocument();
    });

    it('calls getPage for page 1 after load', async () => {
      renderViewer();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockDoc.getPage).toHaveBeenCalledWith(1);
    });

    it('renders page with default scale (1.5)', async () => {
      renderViewer();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    });

    it('renders with correct canvas dimensions', async () => {
      mockPage.getViewport.mockReturnValue({ width: 892, height: 1263, scale: 1 });
      renderViewer();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      const canvas = screen.getByTestId('pdf-canvas') as HTMLCanvasElement;
      expect(canvas.style.width).toBe('892px');
      expect(canvas.style.height).toBe('1263px');
    });

    it('shows error when getDocument rejects (downstream render failure)', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.reject(new Error('403 Forbidden')),
        on: vi.fn(),
        destroy: vi.fn(),
      });
      renderViewer('https://example.com/restricted.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
    });
  });

  // ── File / Blob inputs (Defect 4B requirement) ─────────────────────────────

  describe('blob inputs', () => {
    it('renders File input directly without hitting fetch', async () => {
      const file = new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' });
      renderViewer(file);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(getDocumentMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('pdf-error')).not.toBeInTheDocument();
    });

    it('renders Blob input directly without hitting fetch', async () => {
      const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      renderViewer(blob);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(getDocumentMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Error UI states (Defect 4D) ────────────────────────────────────────────

  describe('error states', () => {
    it('shows the empty card when url is null', async () => {
      renderViewer(null);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('pdf-error')).not.toBeInTheDocument();
    });

    it('shows the empty card when url is an empty string', async () => {
      renderViewer('');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-empty')).toBeInTheDocument();
    });

    it('shows typed error with "File not found" message for 404 responses', async () => {
      nextFetchBehavior = { kind: 'ok', status: 404, contentType: null, body: null };
      renderViewer('https://example.com/missing.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-error')).toHaveAttribute('data-reason', 'notFound');
      expect(screen.getByTestId('pdf-error-message')).toHaveTextContent(/file not found/i);
    });

    it('does NOT show Retry button for 404 (non-recoverable)', async () => {
      nextFetchBehavior = { kind: 'ok', status: 404, contentType: null, body: null };
      renderViewer('https://example.com/missing.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.queryByTestId('pdf-error-retry')).not.toBeInTheDocument();
    });

    it('shows htmlResponse error when content-type is HTML', async () => {
      nextFetchBehavior = {
        kind: 'ok',
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: new TextEncoder().encode('<html>oops</html>').buffer,
      };
      renderViewer('https://example.com/page');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-error')).toHaveAttribute('data-reason', 'htmlResponse');
    });

    it('does NOT pass HTML bytes to PDF.js (getDocument never called)', async () => {
      nextFetchBehavior = {
        kind: 'ok',
        status: 200,
        contentType: 'text/html',
        body: new TextEncoder().encode('<!DOCTYPE html>').buffer,
      };
      renderViewer('https://example.com/page');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getDocumentMock).not.toHaveBeenCalled();
    });

    it('shows server error for 5xx and offers Retry (recoverable)', async () => {
      nextFetchBehavior = { kind: 'ok', status: 502, contentType: null, body: null };
      renderViewer('https://example.com/down.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-error')).toHaveAttribute('data-reason', 'server');
      expect(screen.getByTestId('pdf-error-retry')).toBeInTheDocument();
    });

    it('shows network error and offers Retry (recoverable)', async () => {
      nextFetchBehavior = { kind: 'reject', error: new TypeError('Failed to fetch') };
      renderViewer('https://example.com/x.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-error')).toHaveAttribute('data-reason', 'network');
      expect(screen.getByTestId('pdf-error-retry')).toBeInTheDocument();
    });

    it('shows invalid error for malformed URL and does NOT offer Retry', async () => {
      renderViewer(':::not a url');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-error')).toHaveAttribute('data-reason', 'invalid');
      expect(screen.queryByTestId('pdf-error-retry')).not.toBeInTheDocument();
    });

    it('never shows "1 / 0" page pagination on failure', async () => {
      nextFetchBehavior = { kind: 'ok', status: 404, contentType: null, body: null };
      renderViewer('https://example.com/missing.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      // Toolbar is hidden when error is present — no "1 / 0" indicator visible.
      expect(screen.queryByTestId('pdf-page-indicator')).not.toBeInTheDocument();
    });

    it('sidebar shows "0 pages" placeholder on failure (no empty iteration)', async () => {
      nextFetchBehavior = { kind: 'ok', status: 404, contentType: null, body: null };
      renderViewer('https://example.com/missing.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/0 pages/i)).toBeInTheDocument();
    });

    it('does NOT expose the source URL in the visible error message', async () => {
      nextFetchBehavior = { kind: 'ok', status: 404, contentType: null, body: null };
      const secretUrl = 'https://firebasestorage.googleapis.com/v0/b/SECRET_BUCKET/o/file.pdf?alt=media&token=SECRET_TOKEN';
      renderViewer(secretUrl);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      const node = screen.getByTestId('pdf-error');
      expect(node.textContent).not.toContain('SECRET_BUCKET');
      expect(node.textContent).not.toContain('SECRET_TOKEN');
      expect(node.textContent).not.toContain('firebasestorage.googleapis.com');
    });

    // Agent 13 fix: the error card must NEVER expose a Download button.
    // A forced "save as" dialog on an unreadable document is bad UX.
    it('does NOT render a Download button on the error card for notFound', async () => {
      nextFetchBehavior = { kind: 'ok', status: 404, contentType: null, body: null };
      renderViewer('https://example.com/missing.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.queryByTestId('pdf-error-download')).not.toBeInTheDocument();
      const errorNode = screen.getByTestId('pdf-error');
      expect(errorNode.querySelector('a[download]')).toBeNull();
    });

    it('does NOT render a Download button on the error card for htmlResponse', async () => {
      nextFetchBehavior = {
        kind: 'ok',
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: new TextEncoder().encode('<html>oops</html>').buffer,
      };
      renderViewer('https://example.com/page');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.queryByTestId('pdf-error-download')).not.toBeInTheDocument();
      const errorNode = screen.getByTestId('pdf-error');
      expect(errorNode.querySelector('a[download]')).toBeNull();
    });

    it('does NOT render a Download button on the error card for invalid input', async () => {
      renderViewer(':::not a url');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.queryByTestId('pdf-error-download')).not.toBeInTheDocument();
    });

    it('does NOT render a Download button on the error card for server 5xx', async () => {
      nextFetchBehavior = { kind: 'ok', status: 502, contentType: null, body: null };
      renderViewer('https://example.com/down.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.queryByTestId('pdf-error-download')).not.toBeInTheDocument();
    });
  });

  // ── Toolbar "Open in new tab" action (Agent 13 fix) ────────────────────

  describe('toolbar open-in-new-tab action', () => {
    it('does NOT render the toolbar open button while loading or on error', async () => {
      nextFetchBehavior = { kind: 'ok', status: 404, contentType: null, body: null };
      renderViewer('https://example.com/missing.pdf');
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.queryByTestId('pdf-open-newtab-btn')).not.toBeInTheDocument();
    });

    it('renders the toolbar open button once a PDF is successfully loaded', async () => {
      renderViewer();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('pdf-open-newtab-btn')).toBeInTheDocument();
    });

    it('uses window.open with the resolved blob URL, never an anchor with the download attribute', async () => {
      const openSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null);
      renderViewer();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      const btn = screen.getByTestId('pdf-open-newtab-btn');
      // The toolbar action must be a <button>, never an <a download>.
      expect(btn.tagName).toBe('BUTTON');
      await userEvent.click(btn);
      expect(openSpy).toHaveBeenCalledTimes(1);
      const [arg, target, features] = openSpy.mock.calls[0] as [string, string, string];
      expect(target).toBe('_blank');
      expect(features).toContain('noopener');
      expect(features).toContain('noreferrer');
      // Arg must be an object URL, not a real network URL with Content-Disposition: attachment.
      expect(arg.startsWith('blob:')).toBe(true);
      openSpy.mockRestore();
    });
  });

  // ── Page navigation ───────────────────────────────────────────────────────

  describe('page navigation', () => {
    beforeEach(async () => {
      renderViewer();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
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
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockDoc.getPage).toHaveBeenCalledWith(2);
    });

    it('renders previous page when prev button is clicked', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-next-btn'));
      await act(async () => {
        await Promise.resolve();
      });
      await user.click(screen.getByTestId('pdf-prev-btn'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockDoc.getPage).toHaveBeenLastCalledWith(1);
    });

    it('disables next button on last page', async () => {
      const user = userEvent.setup();
      for (let i = 0; i < 4; i++) {
        await user.click(screen.getByTestId('pdf-next-btn'));
        await act(async () => {
          await Promise.resolve();
        });
      }
      expect(screen.getByTestId('pdf-next-btn')).toBeDisabled();
    });

    it('does not go past last page', async () => {
      const user = userEvent.setup();
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByTestId('pdf-next-btn'));
        await act(async () => {
          await Promise.resolve();
        });
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
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    });

    it('shows initial zoom as 150%', () => {
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    });

    it('increases scale on zoom in', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-in-btn'));
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('175%');
    });

    it('decreases scale on zoom out', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-out-btn'));
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('125%');
    });

    it('resets zoom to 1.5 when percent button is clicked', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-zoom-out-btn'));
      await user.click(screen.getByTestId('pdf-zoom-percent'));
      expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    });

    it('disables zoom out at minimum scale (0.5)', async () => {
      mockPage.getViewport.mockReturnValue({ width: 297.5, height: 421, scale: 1 });
      const user = userEvent.setup();
      for (let i = 0; i < 6; i++) {
        await user.click(screen.getByTestId('pdf-zoom-out-btn'));
        await act(async () => {
          await Promise.resolve();
        });
      }
      expect(screen.getByTestId('pdf-zoom-out-btn')).toBeDisabled();
    });

    it('disables zoom in at maximum scale (3.0)', async () => {
      mockPage.getViewport.mockReturnValue({ width: 1190, height: 1684, scale: 1 });
      const user = userEvent.setup();
      for (let i = 0; i < 7; i++) {
        await user.click(screen.getByTestId('pdf-zoom-in-btn'));
        await act(async () => {
          await Promise.resolve();
        });
      }
      expect(screen.getByTestId('pdf-zoom-in-btn')).toBeDisabled();
    });
  });

  // ── Callbacks ────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('calls onTotalPages after PDF loads', async () => {
      const onTotal = vi.fn();
      render(<PdfViewer url="https://example.com/doc.pdf" onTotalPages={onTotal} />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(onTotal).toHaveBeenCalledWith(5);
    });

    it('calls onPageChange when page changes', async () => {
      const onPage = vi.fn();
      render(<PdfViewer url="https://example.com/doc.pdf" onPageChange={onPage} />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      const user = userEvent.setup();
      await user.click(screen.getByTestId('pdf-next-btn'));
      await act(async () => {
        await Promise.resolve();
      });
    expect(onPage).toHaveBeenCalledWith(2);
  });
});

// ── Protected-review mode ─────────────────────────────────────────────────────

describe('PdfViewer protected-review mode', () => {
  // Ensure each test starts with a clean DOM to avoid duplicate overlays.
  afterEach(() => {
    vi.restoreAllMocks();
    mockObserve.mockReset();
    mockUnobserve.mockReset();
    mockDisconnect.mockReset();
    mockDoc.numPages = 5;
  });

  // ── Structural ──────────────────────────────────────────────────────────

  it('adds the protected class to the root wrapper', async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const wrapper = screen.getByTestId('pdf-viewer');
    expect(wrapper.className).toContain('protectedWrapper');
  });

  it('renders the protected overlay notice with the exact required text', async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const overlay = screen.getByTestId('pdf-protected-overlay');
    expect(overlay).toHaveTextContent(
      'Confidential review copy — copying and redistribution are prohibited.'
    );
  });

  it('renders the watermark when reviewCopyId is provided', async () => {
    render(
      <PdfViewer
        url="https://example.com/doc.pdf"
        mode="protected-review"
        reviewCopyId="Review Copy #42"
      />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const overlay = screen.getByTestId('pdf-protected-overlay');
    expect(overlay).toHaveTextContent('Review Copy #42');
  });

  it('does NOT render the watermark when reviewCopyId is absent', async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const overlay = screen.getByTestId('pdf-protected-overlay');
    // Only the notice text should be present; no extra copy-id span.
    expect(overlay.textContent).not.toContain('Review Copy');
  });

  it('renders the overlay as non-interactive (aria-hidden)', async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const overlay = screen.getByTestId('pdf-protected-overlay');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });

  // ── Toolbar: no open-in-new-tab ─────────────────────────────────────────

  it('does NOT render the Open in new tab toolbar button in protected mode', async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByTestId('pdf-open-newtab-btn')).not.toBeInTheDocument();
  });

  it('still renders all navigation and zoom controls in protected mode', async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('pdf-prev-btn')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-next-btn')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-zoom-in-btn')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-zoom-out-btn')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-zoom-percent')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-page-input')).toBeInTheDocument();
  });

  // ── Page navigation still works ─────────────────────────────────────────

  it('navigates to the next page in protected mode', async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('pdf-next-btn'));
    await act(async () => { await Promise.resolve(); });
    expect(mockDoc.getPage).toHaveBeenLastCalledWith(2);
  });

  it('navigates to the previous page in protected mode', async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('pdf-next-btn'));
    await act(async () => { await Promise.resolve(); });
    await user.click(screen.getByTestId('pdf-prev-btn'));
    await act(async () => { await Promise.resolve(); });
    expect(mockDoc.getPage).toHaveBeenLastCalledWith(1);
  });

  it('zooms in and out in protected mode', async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const user = userEvent.setup();
    expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    await user.click(screen.getByTestId('pdf-zoom-in-btn'));
    expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('175%');
    await user.click(screen.getByTestId('pdf-zoom-out-btn'));
    expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
  });

  // ── Event registration ──────────────────────────────────────────────────

  it('registers copy, cut, paste, contextmenu, dragstart, drag, and keydown listeners in protected mode', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    render(<PdfViewer url="https://example.com/doc.pdf" mode="protected-review" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const registeredTypes = addSpy.mock.calls.map((c) => c[0] as string);
    expect(registeredTypes).toContain('copy');
    expect(registeredTypes).toContain('cut');
    expect(registeredTypes).toContain('paste');
    expect(registeredTypes).toContain('contextmenu');
    expect(registeredTypes).toContain('dragstart');
    expect(registeredTypes).toContain('drag');
    expect(registeredTypes).toContain('keydown');
  });
});

// ── Standard mode (backwards-compatibility) ──────────────────────────────────

describe('PdfViewer standard mode (default)', () => {
  beforeEach(async () => {
    render(<PdfViewer url="https://example.com/doc.pdf" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockDoc.numPages = 5;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockDoc.numPages = 5;
  });

  it('renders the Open in new tab toolbar button in standard mode', () => {
    expect(screen.getByTestId('pdf-open-newtab-btn')).toBeInTheDocument();
  });

  it('does NOT add the protected class to the root wrapper in standard mode', () => {
    const wrapper = screen.getByTestId('pdf-viewer');
    expect(wrapper.className).not.toContain('protectedWrapper');
  });

  it('does NOT render the protected overlay in standard mode', () => {
    expect(screen.queryByTestId('pdf-protected-overlay')).not.toBeInTheDocument();
  });

  it('does NOT register copy/cut/paste/contextmenu dragstart handlers in standard mode', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    // The render in beforeEach already set up the component; spy separately here.
    render(<PdfViewer url="https://example.com/doc.pdf" mode="standard" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const registeredTypes = addSpy.mock.calls.map((c) => c[0] as string);
    // Navigation keydown is always registered; copy/cut/paste/contextmenu/dragstart are not.
    expect(registeredTypes).not.toContain('copy');
    expect(registeredTypes).not.toContain('cut');
    expect(registeredTypes).not.toContain('paste');
    expect(registeredTypes).not.toContain('contextmenu');
    expect(registeredTypes).not.toContain('dragstart');
    expect(registeredTypes).not.toContain('drag');
  });

  it('page navigation works identically in standard mode', async () => {
    const user = userEvent.setup();
    await user.click(screen.getByTestId('pdf-next-btn'));
    await act(async () => { await Promise.resolve(); });
    expect(mockDoc.getPage).toHaveBeenLastCalledWith(2);
  });

  it('zoom works identically in standard mode', async () => {
    const user = userEvent.setup();
    expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('150%');
    await user.click(screen.getByTestId('pdf-zoom-in-btn'));
    expect(screen.getByTestId('pdf-zoom-percent')).toHaveTextContent('175%');
  });
});
});
