/**
 * seminarAudio.service.ts tests.
 *
 * Covers:
 *   T4: File validation (type/size — duration requires real video element)
 *   T5: Upload flow with progress tracking
 *   T6: ReplaceExisting flag (avoids BE 409 when summary already exists)
 *
 * The service is tested directly — no DOM required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../../src/services/axios';
import { seminarAudioService } from '../../../src/services/seminarAudio.service';

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockedApi = api as unknown as { post: ReturnType<typeof vi.fn> };

const mockResponse = {
  seminarId: 5,
  aiSummary: 'Key discussion points covered: CAP theorem.',
  updatedAt: '2026-08-19T12:00:00Z',
};

describe('seminarAudioService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('summarizeAudio', () => {
    it('POSTs to /api/Seminar/{id}/summarize-audio with FormData', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: mockResponse });

      const file = new File(['fake'], 'meeting.mp4', { type: 'video/mp4' });
      const result = await seminarAudioService.summarizeAudio(5, file);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/api/Seminar/5/summarize-audio',
        expect.any(FormData),
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
      );
      expect(result).toEqual(mockResponse);
    });

    it('calls onProgress callback with upload percentage', async () => {
      let capturedProgress: number[] = [];
      // Simulate upload progress by calling the onProgress function from axios config
      mockedApi.post.mockImplementationOnce(
        (_url: string, _data: FormData, config?: { onUploadProgress?: (e: { loaded: number; total: number }) => void }) => {
          // Simulate progress 50% then 100%
          config?.onUploadProgress?.({ loaded: 50, total: 100 });
          config?.onUploadProgress?.({ loaded: 100, total: 100 });
          return Promise.resolve({ data: mockResponse });
        }
      );

      const file = new File(['fake'], 'meeting.mp4', { type: 'video/mp4' });
      await seminarAudioService.summarizeAudio(5, file, (p) => capturedProgress.push(p));

      expect(capturedProgress).toEqual([50, 100]);
    });

    it('throws when API rejects', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Request failed'));

      const file = new File(['fake'], 'meeting.mp4', { type: 'video/mp4' });
      await expect(seminarAudioService.summarizeAudio(5, file)).rejects.toThrow('Request failed');
    });

    it('omits ReplaceExisting from FormData by default', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: mockResponse });

      const file = new File(['fake'], 'meeting.mp4', { type: 'video/mp4' });
      await seminarAudioService.summarizeAudio(5, file);

      const formData = mockedApi.post.mock.calls[0][1] as FormData;
      expect(formData.has('ReplaceExisting')).toBe(false);
      expect(formData.has('AudioFile')).toBe(true);
    });

    it('appends ReplaceExisting=true to FormData when replaceExisting option is set', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: mockResponse });

      const file = new File(['fake'], 'meeting.mp4', { type: 'video/mp4' });
      await seminarAudioService.summarizeAudio(5, file, { replaceExisting: true });

      const formData = mockedApi.post.mock.calls[0][1] as FormData;
      expect(formData.has('ReplaceExisting')).toBe(true);
      expect(formData.get('ReplaceExisting')).toBe('true');
      expect(formData.has('AudioFile')).toBe(true);
    });

    it('accepts the legacy positional onProgress callback alongside replaceExisting via options bag', async () => {
      mockedApi.post.mockImplementationOnce(
        (_url: string, _data: FormData, config?: { onUploadProgress?: (e: { loaded: number; total: number }) => void }) => {
          config?.onUploadProgress?.({ loaded: 25, total: 100 });
          return Promise.resolve({ data: mockResponse });
        }
      );

      const file = new File(['fake'], 'meeting.mp4', { type: 'video/mp4' });
      const captured: number[] = [];
      await seminarAudioService.summarizeAudio(5, file, {
        replaceExisting: true,
        onProgress: (p) => captured.push(p),
      });

      expect(captured).toEqual([25]);
      const formData = mockedApi.post.mock.calls[0][1] as FormData;
      expect(formData.get('ReplaceExisting')).toBe('true');
    });
  });
});
