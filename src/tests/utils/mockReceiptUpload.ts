/**
 * Test helper for mocking the `useReceiptUpload` hook used by
 * `src/pages/Admin/ApprovePayoutModal.tsx`.
 *
 * Behaviour mirrors the existing `mockFirebaseUpload.ts` pattern (used by
 * the registration flow) so test authors can `vi.mock('../../hooks/useReceiptUpload', …)`
 * and then drive `selectFile`/`upload` from each test.
 *
 * Defaults: no draft, no uploaded url, no error. Each test mutates the
 * returned shape to assert specific UI states (progress, error, preview, …).
 */
import { vi } from 'vitest';

export interface MockReceiptUploadOverrides {
  draft?: {
    file: File;
    previewUrl: string;
    kind: 'pdf' | 'image';
    sizeBytes: number;
  } | null;
  isUploading?: boolean;
  progress?: number;
  error?: string | null;
  uploadedUrl?: string | null;
}

export const buildMockReceiptUpload = (
  overrides: MockReceiptUploadOverrides = {},
) => {
  const selectFile = vi.fn();
  const reset = vi.fn();
  const upload = vi.fn(async () => overrides.uploadedUrl ?? 'https://mocked.firebase/receipt.pdf');

  // The hook is invoked once on render and may be invoked again by re-renders.
  // vitest hoists vi.mock factories, so we return a stable factory function.
  return {
    selectFile,
    reset,
    upload,
    apply(over: MockReceiptUploadOverrides = {}) {
      const merged = { ...overrides, ...over };
      return {
        draft: merged.draft ?? null,
        isUploading: merged.isUploading ?? false,
        progress: merged.progress ?? 0,
        error: merged.error ?? null,
        uploadedUrl: merged.uploadedUrl ?? null,
        selectFile,
        reset,
        upload,
      };
    },
  };
};

/**
 * Convenience vi.mock factory. Place a single call at the top of a test file:
 *
 *   vi.mock('../../hooks/useReceiptUpload', () => mockReceiptUploadFactory());
 *
 * Then call `apply({ ... })` inside individual tests to drive hook state.
 */
export const mockReceiptUploadFactory = () => {
  const helper = buildMockReceiptUpload();
  return {
    useReceiptUpload: () => helper.apply(),
    __helper: helper,
  };
};