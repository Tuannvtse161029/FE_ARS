import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReceiptUpload } from '../../../src/hooks/useReceiptUpload';

const { uploadBytesResumableMock, getDownloadURLMock } = vi.hoisted(() => ({
  uploadBytesResumableMock: vi.fn(),
  getDownloadURLMock: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytesResumable: uploadBytesResumableMock,
  getDownloadURL: getDownloadURLMock,
}));

vi.mock('../../firebase', () => ({
  storage: {},
  isFirebaseConfigured: vi.fn(() => true),
}));

describe('useReceiptUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadBytesResumableMock.mockReset();
    getDownloadURLMock.mockReset();
  });

  it('starts with no draft, no upload state', () => {
    const { result } = renderHook(() => useReceiptUpload());
    expect(result.current.draft).toBeNull();
    expect(result.current.uploadedUrl).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('accepts a PDF file', () => {
    const { result } = renderHook(() => useReceiptUpload());
    const pdf = new File(['x'], 'receipt.pdf', { type: 'application/pdf' });
    act(() => result.current.selectFile(pdf));
    expect(result.current.draft?.kind).toBe('pdf');
    expect(result.current.draft?.file.name).toBe('receipt.pdf');
    expect(result.current.error).toBeNull();
  });

  it('accepts a PNG image', () => {
    const { result } = renderHook(() => useReceiptUpload());
    const png = new File(['x'], 'r.png', { type: 'image/png' });
    act(() => result.current.selectFile(png));
    expect(result.current.draft?.kind).toBe('image');
  });

  it('accepts a JPG image', () => {
    const { result } = renderHook(() => useReceiptUpload());
    const jpg = new File(['x'], 'r.jpg', { type: 'image/jpeg' });
    act(() => result.current.selectFile(jpg));
    expect(result.current.draft?.kind).toBe('image');
  });

  it('rejects unsupported mime types (e.g. text/plain)', () => {
    const { result } = renderHook(() => useReceiptUpload());
    const bad = new File(['x'], 'note.txt', { type: 'text/plain' });
    act(() => result.current.selectFile(bad));
    expect(result.current.draft).toBeNull();
    expect(result.current.error).toMatch(/PDF, PNG, or JPG/);
  });

  it('rejects files larger than 10 MB', () => {
    const { result } = renderHook(() => useReceiptUpload());
    const oversized = new File([new Uint8Array(11 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    act(() => result.current.selectFile(oversized));
    expect(result.current.draft).toBeNull();
    expect(result.current.error).toMatch(/10 MB or less/);
  });

  it('clears the previous draft when selectFile(null) is called', () => {
    const { result } = renderHook(() => useReceiptUpload());
    act(() => result.current.selectFile(new File(['x'], 'a.pdf', { type: 'application/pdf' })));
    expect(result.current.draft).not.toBeNull();
    act(() => result.current.selectFile(null));
    expect(result.current.draft).toBeNull();
  });

  it('uploads via Firebase and returns the download URL', async () => {
    uploadBytesResumableMock.mockReturnValue({
      on: vi.fn(
        (
          _event: string,
          _onProgress: () => void,
          _onError: (err: Error) => void,
          onComplete: () => void,
        ) => {
          onComplete();
        },
      ),
      snapshot: { ref: {} },
    });
    getDownloadURLMock.mockResolvedValue('https://example.com/receipt.pdf');

    const { result } = renderHook(() => useReceiptUpload());
    act(() =>
      result.current.selectFile(new File(['data'], 'receipt.pdf', { type: 'application/pdf' })),
    );

    let returned: string | null = null;
    await act(async () => {
      returned = await result.current.upload();
    });

    expect(returned).toBe('https://example.com/receipt.pdf');
    expect(result.current.uploadedUrl).toBe('https://example.com/receipt.pdf');
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error when there is no selected file', async () => {
    const { result } = renderHook(() => useReceiptUpload());
    await act(async () => {
      try {
        await result.current.upload();
      } catch {
        // expected — the rejection is the contract
      }
    });
    expect(result.current.error).toMatch(/No receipt file selected/);
  });

  it('reset() clears draft, error, and uploaded url', () => {
    const { result } = renderHook(() => useReceiptUpload());
    act(() => result.current.selectFile(new File(['x'], 'a.pdf', { type: 'application/pdf' })));
    act(() => result.current.reset());
    expect(result.current.draft).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.uploadedUrl).toBeNull();
  });
});
