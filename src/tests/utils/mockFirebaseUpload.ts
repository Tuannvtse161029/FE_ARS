/**
 * Test utilities for mocking useFirebaseUpload in integration tests.
 *
 * APPROACH:
 *   - A module-level mutable "callbacksRef" object lives in this module.
 *   - vi.mock HOISTS the mock factory but NOT module-level code that follows it,
 *     so the mock factory can READ callbacksRef (set to a default) at factory time.
 *   - beforeEach in the test MUTATES callbacksRef to point to live test callbacks.
 *   - mockHookReturn() READS callbacksRef each time it is called, returning whatever
 *     callbacksRef.current points to.
 *   - simulateUploadComplete() directly calls callbacksRef.current.onComplete().
 *
 * This avoids needing window, require(), or any hoisting workarounds.
 */
import { vi } from 'vitest';

// ── Module-level mutable ref (survives vi.mock hoisting) ───────────────────────

type PdfCallbacks = {
  onComplete: ((file: File, url: string) => void) | null;
  onRemove: (() => void) | null;
};

/** Mutable pointer to the live callbacks — mutated by test beforeEach */
export const callbacksRef = { current: null as PdfCallbacks | null };

// ── Mock instances ─────────────────────────────────────────────────────────────

export const uploadPdfMock = vi.fn();
export const resetUploadMock = vi.fn();

/**
 * Returns the mock hook return. Reads callbacksRef.current each call so that
 * tests can swap the callbacks via beforeEach before renderRegister() is called.
 */
export const mockHookReturn = () => {
  const cb = callbacksRef.current ?? { onComplete: null, onRemove: null };
  return {
    uploadPdf: uploadPdfMock,
    resetUpload: resetUploadMock,
    progress: 0,
    isUploading: false,
    error: null as string | null,
    pdfUrl: null as string | null,
    uploadedFile: null as File | null,
    onComplete: cb.onComplete,
    onRemove: cb.onRemove,
  };
};

export const resetFirebaseUploadMock = () => {
  uploadPdfMock.mockReset();
  resetUploadMock.mockReset();
};

/**
 * Simulate Firebase returning a download URL.
 * Calls the onComplete callback registered via beforeEach.
 */
export const simulateUploadComplete = (
  file: File = new File(['%PDF-1.4'], 'research-paper.pdf', { type: 'application/pdf' }),
  url = 'https://firebasestorage.googleapis.com/v0/b/ars-platform/o/papers/research.pdf'
) => {
  if (!callbacksRef.current?.onComplete) {
    throw new Error(
      '[simulateUploadComplete] onComplete not registered. ' +
        'Ensure callbacksRef.current.onComplete is set before calling this (via beforeEach).'
    );
  }
  callbacksRef.current.onComplete(file, url);
};

/** Simulate user clicking the remove button */
export const simulateUploadRemove = () => {
  callbacksRef.current?.onRemove?.();
};
