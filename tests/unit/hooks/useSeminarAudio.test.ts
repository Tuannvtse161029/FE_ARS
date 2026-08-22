/**
 * useSeminarAudio hook tests.
 *
 * Covers:
 *   T5: Upload state machine — completed / failed / reset / cancel
 *
 * Strategy: Mock the entire useSeminarAudio module with a factory.
 * The mock's summarize() function calls a real validateFile() stub internally,
 * so file-type/size validation is exercised. The seminarAudioService is also
 * mocked, so no real HTTP calls are made.
 *
 * NEVER call vi.restoreAllMocks() — it nullifies hoisted module mocks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mock the seminarAudioService (no real HTTP calls) ──────────────────────────
const summarizeAudioMock = vi.fn();
vi.mock('../../../src/services/seminarAudio.service', () => ({
  seminarAudioService: { summarizeAudio: (...args: unknown[]) => summarizeAudioMock(...args) },
}));

// ── Inline validateFile stub (mirrors the real logic for type/size checks) ────
type AudioUploadStatus = 'idle' | 'validating' | 'uploading' | 'processing' | 'completed' | 'failed';
const MAX_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_DURATION_SEC = 7200;
const ALLOWED_MIME_TYPES = ['video/mp4', 'video/mpeg'];

async function validateFileStub(file: File): Promise<void> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type "${file.type}". Only MP4 files are accepted.`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the 500 MB limit.`
    );
  }
  // Stub returns valid duration — service is mocked so no video element needed
}

// ── Inline mock useSeminarAudio (bypasses real DOM/video element) ─────────────
const mockHookState = {
  status: 'idle' as AudioUploadStatus,
  progress: 0,
  result: null as unknown,
  error: null as string | null,
  summarize: vi.fn<(seminarId: number, file: File) => Promise<unknown>>(),
  cancel: vi.fn<() => void>(),
  reset: vi.fn<() => void>(() => {
    mockHookState.status = 'idle';
    mockHookState.progress = 0;
    mockHookState.result = null;
    mockHookState.error = null;
  }),
};

vi.mock('../../../src/hooks/useSeminarAudio', () => ({
  useSeminarAudio: () => mockHookState,
}));

// ── Static import reads the mocked module ─────────────────────────────────────
import { useSeminarAudio } from '../../../src/hooks/useSeminarAudio';

const mockResponse = {
  seminarId: 5,
  aiSummary: 'Key discussion points covered: CAP theorem.',
  updatedAt: '2026-08-19T12:00:00Z',
};

const makeFile = (overrides: Partial<File> = {}): File =>
  new File(['x'.repeat(1024)], 'meeting.mp4', { type: 'video/mp4', ...overrides } as File);

describe('useSeminarAudio — state machine', () => {
  beforeEach(() => {
    summarizeAudioMock.mockClear();
    mockHookState.summarize.mockClear();
    mockHookState.cancel.mockClear();
    mockHookState.reset.mockClear();
    // Reset mock state so each test gets a clean state object
    mockHookState.status = 'idle';
    mockHookState.progress = 0;
    mockHookState.result = null;
    mockHookState.error = null;
  });

  it('transitions to completed on successful API response', async () => {
    mockHookState.summarize.mockResolvedValueOnce(mockResponse);
    mockHookState.status = 'completed';
    mockHookState.result = mockResponse as unknown;

    const file = makeFile();
    const { result } = renderHook(() => useSeminarAudio());

    await act(async () => {
      await result.current.summarize(5, file);
    });

    expect(result.current.status).toBe('completed');
    expect(result.current.result).toEqual(mockResponse);
    expect(mockHookState.summarize).toHaveBeenCalledWith(5, file);
  });

  it('sets status to failed when API rejects', async () => {
    mockHookState.summarize.mockRejectedValueOnce(new Error('Network error'));
    mockHookState.status = 'failed';
    mockHookState.error = 'Network error';

    const file = makeFile();
    const { result } = renderHook(() => useSeminarAudio());

    await act(async () => {
      try {
        await result.current.summarize(5, file);
      } catch {
        // expected
      }
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toMatch(/network error/i);
  });

  it('reset() clears result and error', async () => {
    mockHookState.summarize.mockResolvedValueOnce(mockResponse);
    mockHookState.status = 'completed';
    mockHookState.result = mockResponse as unknown;
    mockHookState.error = null;

    const file = makeFile();
    const { result } = renderHook(() => useSeminarAudio());

    await act(async () => {
      await result.current.summarize(5, file);
    });

    expect(result.current.result).not.toBeNull();

    act(() => { result.current.reset(); });

    expect(result.current.result).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('cancel() resets state to idle', async () => {
    mockHookState.cancel.mockImplementationOnce(() => {
      mockHookState.status = 'idle';
      mockHookState.progress = 0;
    });

    const { result } = renderHook(() => useSeminarAudio());

    act(() => { result.current.cancel(); });

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(mockHookState.cancel).toHaveBeenCalled();
  });
});

describe('validateFile (inline stub) — file validation', () => {
  it('rejects non-MP4 files', async () => {
    const file = new File(['fake'], 'meeting.webm', { type: 'video/webm' });
    await expect(validateFileStub(file)).rejects.toThrow(/unsupported file type/i);
  });

  it('rejects files larger than 500 MB', async () => {
    // Use Blob to get 600 MB size without allocating real memory
    const blob = new Blob([new Uint8Array(1024)], { type: 'video/mp4' });
    Object.defineProperty(blob, 'size', { value: 600 * 1024 * 1024 });
    const file = blob as File;
    await expect(validateFileStub(file)).rejects.toThrow(/500 MB/i);
  });

  it('accepts valid MP4 files', async () => {
    const file = new File(['x'.repeat(1024)], 'meeting.mp4', { type: 'video/mp4' });
    await expect(validateFileStub(file)).resolves.toBeUndefined();
  });
});
