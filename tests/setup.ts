import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// ── Feature flag stubs ────────────────────────────────────────────────────────
// These env vars are read at module-load via `import.meta.env.X`. Setting them
// before any source module is imported keeps the SUTs in their expected test
// posture (e.g. ORCID check disabled).
vi.stubEnv('VITE_ORCID_CHECK_ENABLED', 'false');
// Force the publication-catalog demo mode OFF during tests, regardless
// of what the developer has in `.env.local`. Tests of the catalog
// adapter expect the BE to be called; the demo-mode branch is tested
// separately by direct module wiring. This keeps the env leak from
// `.env.local` from breaking every catalog test that mocks `/api/paper`.
vi.stubEnv('VITE_USE_PUBLICATION_DEMO', 'false');

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
