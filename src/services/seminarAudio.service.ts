// Service for seminar audio summarization.
//
// Uploads an MP4 video file to `POST /api/Seminar/{id}/summarize-audio`
// as `multipart/form-data`. The BE processes the audio synchronously and
// returns the AI-generated summary directly — no polling needed.
//
// Constraints (FE validates before upload; BE is authoritative):
//   - File type: video/mp4 only
//   - Max size: 500 MB
//   - Max duration: strictly < 2 hours (7,200 seconds)
//
// The summarize-audio endpoint accepts files up to 500 MB and the BE
// synchronously extracts audio + calls the AI provider before returning.
// That pipeline can comfortably exceed the 60s axios default —
// especially with longer recordings — so we override the per-request
// timeout to 3 minutes (180_000 ms). Other endpoints keep the default
// 60s timeout from the shared axios instance.

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

const SUMMARIZE_AUDIO_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

/** Response shape from `POST /api/Seminar/{id}/summarize-audio`. */
export interface SeminarAudioSummaryResponse {
  seminarId: number;
  aiSummary: string | null;
  updatedAt: string | null;
}

/** Upload progress callback type. */
export type UploadProgressCallback = (percent: number) => void;

export const seminarAudioService = {
  /**
   * Upload an MP4 file and request AI summarization.
   *
   * @param seminarId  The target seminar ID.
   * @param file       The MP4 file (pre-validated by the caller).
   * @param onProgress Optional progress callback (0–100).
   */
  summarizeAudio: async (
    seminarId: number,
    file: File,
    onProgress?: UploadProgressCallback
  ): Promise<SeminarAudioSummaryResponse> => {
    const formData = new FormData();
    // The field name matches the Swagger parameter name: `AudioFile`
    formData.append('AudioFile', file);

    const response = await api.post<SeminarAudioSummaryResponse>(
      API_ENDPOINTS.SEMINAR.SUMMARIZE_AUDIO(seminarId),
      formData,
      {
        // axios infers Content-Type: multipart/form-data with boundary
        headers: { 'Content-Type': 'multipart/form-data' },
        // Allow up to 3 minutes for upload + BE-side AI summarization.
        // The shared axios instance default is 60s, which is too short
        // for large recordings or busy AI provider response times.
        timeout: SUMMARIZE_AUDIO_TIMEOUT_MS,
        onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      }
    );

    return response.data;
  },
};

export default seminarAudioService;
