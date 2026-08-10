/**
 * Test utilities for mocking pdfjs-dist in integration tests.
 *
 * Uses module-level reactive state atoms (mutated in-place) so that
 * state changes in tests are IMMEDIATELY visible to pdfjs-dist mocks.
 */
import { vi } from 'vitest';

// ── Module-level reactive state ──────────────────────────────────────────────
// We MUTATE this object's properties in-place — never reassign `state`.
const state = {
  numPages: 5,
  viewport: { width: 595, height: 842 },
  getPageCalls: [] as number[],
  getDocumentUrl: null as string | null,
};

const mockPage = {
  getViewport: vi.fn(() => ({ ...state.viewport })),
  render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
};

const mockDoc = {
  get numPages() { return state.numPages; },
  getPage: vi.fn((pageNum: number) => {
    state.getPageCalls.push(pageNum);
    return Promise.resolve(mockPage);
  }),
  destroy: vi.fn(),
};

const getDocumentMock = vi.fn((url: string) => {
  state.getDocumentUrl = url;
  return {
    promise: Promise.resolve(mockDoc),
    on: vi.fn(),
    destroy: vi.fn(),
  };
});

/** Update the shared state atom in-place */
export const mockPdfState = (overrides: {
  numPages?: number;
  viewport?: { width: number; height: number };
} = {}) => {
  // Mutate in-place
  if ('numPages' in overrides) state.numPages = overrides.numPages ?? 5;
  if ('viewport' in overrides && overrides.viewport) {
    state.viewport = { ...overrides.viewport };
    mockPage.getViewport.mockReturnValue({ ...overrides.viewport });
  }
};

/** Reset all mocks and restore default state (mutate in-place) */
export const resetPdfMock = () => {
  getDocumentMock.mockReset();
  mockDoc.getPage.mockReset();
  mockDoc.destroy.mockReset();
  mockPage.getViewport.mockReset();
  mockPage.render.mockReset();

  // Mutate in-place
  state.numPages = 5;
  state.viewport = { width: 595, height: 842 };
  state.getPageCalls = [];
  state.getDocumentUrl = null;

  // Re-wire mock implementations
  mockPage.getViewport.mockReturnValue({ width: 595, height: 842 });
  mockDoc.getPage.mockImplementation((pageNum: number) => {
    state.getPageCalls.push(pageNum);
    return Promise.resolve(mockPage);
  });
  getDocumentMock.mockImplementation((url: string) => {
    state.getDocumentUrl = url;
    return { promise: Promise.resolve(mockDoc), on: vi.fn(), destroy: vi.fn() };
  });
};

export { getDocumentMock, mockPage, mockDoc, state };
