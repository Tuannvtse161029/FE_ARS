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

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

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
