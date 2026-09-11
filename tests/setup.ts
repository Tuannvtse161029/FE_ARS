import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// ── Feature flag stubs ────────────────────────────────────────────────────────
// These env vars are read at module-load via `import.meta.env.X`. Setting them
// before any source module is imported keeps the SUTs in their expected test
// posture (e.g. ORCID check disabled).
vi.stubEnv('VITE_ORCID_CHECK_ENABLED', 'false');

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
