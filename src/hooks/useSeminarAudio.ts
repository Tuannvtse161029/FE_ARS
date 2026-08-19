// Hook for seminar audio upload and AI summarization.
//
// Manages the full upload lifecycle:
//   validating → uploading → processing → completed | failed
//
// No polling is needed — the `POST /api/Seminar/{id}/summarize-audio` endpoint
// processes the file synchronously and returns the final result.

import { useCallback, useRef, useState } from 'react';
import {
  seminarAudioService,
  type SeminarAudioSummaryResponse,
} from '../services/seminarAudio.service';

export type AudioUploadStatus =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed';

export interface UseSeminarAudioResult {
  /** Trigger the upload + summarize flow. */
  summarize: (seminarId: number, file: File) => Promise<SeminarAudioSummaryResponse>;
  /** Current upload state machine status. */
  status: AudioUploadStatus;
  /** Upload progress 0–100. */
  progress: number;
  /** The final response once status === 'completed'. */
  result: SeminarAudioSummaryResponse | null;
  /** Error message when status === 'failed'. */
  error: string | null;
  /** Abort the in-flight request (if possible). */
  cancel: () => void;
  /** Reset to idle state. Call after displaying results to allow a new upload. */
  reset: () => void;
}

// ─── Validation constants ────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_DURATION_SEC = 7200; // 2 hours — reject ≥ 7200

const ALLOWED_MIME_TYPES = ['video/mp4', 'video/mpeg'];

/**
 * Validate file metadata (type, size, duration) before upload.
 * Duration is read via a temporary video element — no full file read needed.
 */
async function validateFile(file: File): Promise<void> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type "${file.type}". Only MP4 files are accepted.`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the 500 MB limit.`);
  }

  // Read duration via video element — lightweight, no full file read.
  const objectUrl = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = objectUrl;
      video.onloadedmetadata = () => {
        resolve(video.duration);
        video.src = '';
      };
      video.onerror = () => {
        reject(new Error('Could not read video metadata. The file may be corrupted.'));
      };
    });

    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error('Could not determine video duration.');
    }
    if (duration >= MAX_DURATION_SEC) {
      throw new Error(
        `Video duration (${Math.floor(duration / 60)} min) must be strictly under 2 hours.`
      );
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSeminarAudio(): UseSeminarAudioResult {
  const [status, setStatus] = useState<AudioUploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SeminarAudioSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store the cancel function from the in-flight request
  const cancelRef = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus('idle');
    setProgress(0);
  }, []);

  const reset = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  const summarize = useCallback(
    async (seminarId: number, file: File): Promise<SeminarAudioSummaryResponse> => {
      // ── 1. Validate ──────────────────────────────────────────────────────────
      setStatus('validating');
      setProgress(0);
      setError(null);

      try {
        await validateFile(file);
      } catch (err) {
        setStatus('failed');
        setError((err as Error).message);
        throw err;
      }

      // ── 2. Upload + Process ──────────────────────────────────────────────────
      setStatus('uploading');
      setProgress(0);

      try {
        const response = await seminarAudioService.summarizeAudio(
          seminarId,
          file,
          (percent) => {
            setProgress(percent);
            if (percent === 100) {
              setStatus('processing'); // BE is processing after upload completes
            }
          }
        );

        setResult(response);
        setStatus('completed');
        setProgress(100);
        return response;
      } catch (err) {
        const message =
          (err as { message?: string })?.message ??
          'Upload failed. Check your connection and try again.';
        setStatus('failed');
        setError(message);
        throw err;
      }
    },
    []
  );

  return { summarize, status, progress, result, error, cancel, reset };
}

export default useSeminarAudio;
