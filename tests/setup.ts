import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// ── Set up window callback store for integration tests ─────────────────────────
// PdfDropzone writes onComplete / onRemove here; simulateUploadComplete reads them.
// This must be initialized BEFORE any vi.mock factories run (beforeAll runs before hoisting).
beforeAll(() => {
  if (typeof window !== 'undefined') {
    (window as Window & { __pdfCallbacks__?: unknown }).__pdfCallbacks__ = undefined;
  }
});

afterEach(() => {
  cleanup();
});
