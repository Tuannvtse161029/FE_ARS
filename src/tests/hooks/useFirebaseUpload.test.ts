import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFirebaseUpload } from '../../hooks/useFirebaseUpload';

const { uploadBytesResumableMock, getDownloadURLMock } = vi.hoisted(() => {
  const uploadBytesResumableMock = vi.fn();
  const getDownloadURLMock = vi.fn();
  return { uploadBytesResumableMock, getDownloadURLMock };
});

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytesResumable: uploadBytesResumableMock,
  getDownloadURL: getDownloadURLMock,
}));

vi.mock('../../firebase', () => ({
  storage: {},
}));

describe('useFirebaseUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadBytesResumableMock.mockReset();
    getDownloadURLMock.mockReset();
  });

  describe('initial state', () => {
    it('returns zeros and nulls initially', () => {
      const { result } = renderHook(() => useFirebaseUpload());
      expect(result.current.progress).toBe(0);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.pdfUrl).toBe(null);
    });
  });

  describe('file type validation', () => {
    it('sets error for non-PDF file', async () => {
      const { result } = renderHook(() => useFirebaseUpload());
      const file = new File(['content'], 'image.png', { type: 'image/png' });

      await act(async () => {
        await result.current.uploadPdf(file);
      });

      expect(result.current.error).toBe('Only PDF files are allowed.');
      expect(result.current.pdfUrl).toBe(null);
    });

    it('clears previous error when new valid file is selected', async () => {
      uploadBytesResumableMock.mockReturnValue({
        on: vi.fn((_event: string, _onProgress: () => void, _onError: () => void, onComplete: () => void) => {
          onComplete();
        }),
        snapshot: { ref: {} },
      });
      getDownloadURLMock.mockResolvedValue('https://example.com/doc.pdf');

      const { result } = renderHook(() => useFirebaseUpload());

      const pngFile = new File(['content'], 'image.png', { type: 'image/png' });
      await act(async () => {
        await result.current.uploadPdf(pngFile);
      });
      expect(result.current.error).toBe('Only PDF files are allowed.');

      const pdfFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
      await act(async () => {
        await result.current.uploadPdf(pdfFile);
      });
      expect(result.current.error).toBe(null);
    });
  });

  describe('file size validation', () => {
    it('sets error for file larger than 10 MB', async () => {
      const { result } = renderHook(() => useFirebaseUpload());
      const bigBlob = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: 'application/pdf' });
      const bigFile = new File([bigBlob], 'large.pdf', { type: 'application/pdf' });

      await act(async () => {
        await result.current.uploadPdf(bigFile);
      });

      expect(result.current.error).toBe('File size must be 10 MB or less.');
      expect(result.current.pdfUrl).toBe(null);
    });

    it('accepts valid PDF and returns download URL', async () => {
      uploadBytesResumableMock.mockReturnValue({
        on: vi.fn((_event: string, _onProgress: () => void, _onError: () => void, onComplete: () => void) => {
          onComplete();
        }),
        snapshot: { ref: {} },
      });
      getDownloadURLMock.mockResolvedValue('https://example.com/doc.pdf');

      const { result } = renderHook(() => useFirebaseUpload());
      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });

      await act(async () => {
        await result.current.uploadPdf(file);
      });

      expect(result.current.error).toBe(null);
      expect(result.current.pdfUrl).toBe('https://example.com/doc.pdf');
    });

    it('sets error when Firebase upload fails', async () => {
      uploadBytesResumableMock.mockReturnValue({
        on: vi.fn(
          (_event: string, _onProgress: () => void, onError: (e: Error) => void) => {
            onError(new Error('Storage quota exceeded'));
          }
        ),
        snapshot: { ref: {} },
      });

      const { result } = renderHook(() => useFirebaseUpload());
      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });

      await act(async () => {
        await result.current.uploadPdf(file);
      });

      expect(result.current.error).toBe('Storage quota exceeded');
      expect(result.current.pdfUrl).toBe(null);
    });
  });

  describe('resetUpload', () => {
    it('resets all state values', async () => {
      const { result } = renderHook(() => useFirebaseUpload());

      await act(async () => {
        result.current.resetUpload();
      });

      expect(result.current.progress).toBe(0);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.pdfUrl).toBe(null);
    });
  });
});
