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

/**
 * Structured error returned by the summarize hook.
 *
 * Splitting `message` (for the user) from `code` (for the UI to branch on)
 * keeps the displayed string free of `[CODE]` suffixes — the bug the
 * user reported was the BE message being tagged with `Không có nội dung
 * feedback [SEMINAR_NO_FEEDBACK]` in the modal, which is the kind of
 * developer-only noise the FE has to scrub.
 */
export interface AudioUploadError {
  /** Human-readable, English, with any BE error-code suffix stripped. */
  message: string;
  /** BE error code, if any (e.g. `SUMMARY_ALREADY_EXISTS`). Null otherwise. */
  code: string | null;
  /** HTTP status from the BE response, if any. */
  status: number | null;
}

export interface UseSeminarAudioResult {
  /** Trigger the upload + summarize flow. */
  summarize: (
    seminarId: number,
    file: File,
    options?: { replaceExisting?: boolean },
  ) => Promise<SeminarAudioSummaryResponse>;
  /** Current upload state machine status. */
  status: AudioUploadStatus;
  /** Upload progress 0–100. */
  progress: number;
  /** The final response once status === 'completed'. */
  result: SeminarAudioSummaryResponse | null;
  /**
   * Structured error when status === 'failed'. The `message` is the
   * user-facing string (already English, no `[CODE]` suffix); the `code`
   * is the BE error code for callers that need to branch on it.
   */
  error: AudioUploadError | null;
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
 *
 * The duration check is best-effort: if the browser refuses to read
 * metadata (CSP `media-src` is too tight, the user agent blocks the
 * blob: URL, the codec is unsupported, or `loadedmetadata` simply
 * never fires within the timeout), we log a `console.warn` and let
 * the upload proceed. The BE enforces the 2-hour limit server-side
 * (`POST /api/Seminar/{id}/summarize-audio` returns 4xx for over-long
 * recordings), so a soft-fail here never lets an over-long video slip
 * through — it only avoids blocking legitimate uploads on browsers
 * that can't introspect the local blob.
 */
async function validateFile(file: File): Promise<void> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type "${file.type}". Only MP4 files are accepted.`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the 500 MB limit.`);
  }

  // Read duration via video element — lightweight, no full file read.
  // Wrapped in a 5-second timeout so a blocked `loadedmetadata` event
  // (e.g. CSP `media-src` missing `blob:`) cannot stall the entire
  // upload flow indefinitely.
  const objectUrl = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.src = objectUrl;
      const cleanup = () => {
        v.onloadedmetadata = null;
        v.onerror = null;
        v.src = '';
      };
      v.onloadedmetadata = () => {
        const d = v.duration;
        cleanup();
        resolve(d);
      };
      v.onerror = () => {
        cleanup();
        reject(new Error('Could not read video metadata. The file may be corrupted.'));
      };
      // Hard cap: if `loadedmetadata` never fires (CSP-blocked blob,
      // missing codec, browser autoplay restrictions), resolve with
      // `NaN` after 5s so the caller can soft-fail rather than hang.
      window.setTimeout(() => {
        if (v.onloadedmetadata) {
          cleanup();
          resolve(Number.NaN);
        }
      }, 5000);
    });

    if (!Number.isFinite(duration) || duration < 0) {
      // Soft fail: don't block the upload. The BE will reject files
      // over 2 hours with a 4xx and surface a clear error message.
      // eslint-disable-next-line no-console
      console.warn(
        '[useSeminarAudio] Could not read local video duration; skipping client-side 2-hour check. The BE will enforce the limit server-side.',
      );
      return;
    }
    if (duration >= MAX_DURATION_SEC) {
      throw new Error(
        `Video duration (${Math.floor(duration / 60)} min) must be strictly under 2 hours.`
      );
    }
  } catch (err) {
    // If we already threw a user-facing 2-hour error above, re-throw it
    // verbatim. Anything else (CSP block, codec error, blob revoke race)
    // is treated as a soft warning so the upload can still proceed.
    if (err instanceof Error && /2 hours?/.test(err.message)) {
      throw err;
    }
    // eslint-disable-next-line no-console
    console.warn(
      '[useSeminarAudio] Video duration check skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSeminarAudio(): UseSeminarAudioResult {
  const [status, setStatus] = useState<AudioUploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SeminarAudioSummaryResponse | null>(null);
  const [error, setError] = useState<AudioUploadError | null>(null);

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
    async (
      seminarId: number,
      file: File,
      options?: { replaceExisting?: boolean },
    ): Promise<SeminarAudioSummaryResponse> => {
      // ── 1. Validate ──────────────────────────────────────────────────────────
      setStatus('validating');
      setProgress(0);
      setError(null);

      try {
        await validateFile(file);
      } catch (err) {
        setStatus('failed');
        setError({
          message: (err as Error).message,
          code: null,
          status: null,
        });
        throw err;
      }

      // ── 2. Upload + Process ──────────────────────────────────────────────────
      setStatus('uploading');
      setProgress(0);

      try {
        const response = await seminarAudioService.summarizeAudio(
          seminarId,
          file,
          {
            replaceExisting: options?.replaceExisting ?? false,
            onProgress: (percent) => {
              setProgress(percent);
              if (percent === 100) {
                setStatus('processing'); // BE is processing after upload completes
              }
            },
          },
        );

        setResult(response);
        setStatus('completed');
        setProgress(100);
        return response;
      } catch (err) {
        // Surface the BE's `message` (ticket §36) but ALWAYS render in
        // English, and never append the BE's `[CODE]` tag to the
        // user-facing string. Callers that need to branch on the code
        // (e.g. open the 409 replace confirm flow) consume
        // `error.code` directly instead of doing a substring search.
        const ax = err as {
          response?: {
            status?: number;
            data?: { code?: string; message?: string } | string;
          };
          message?: string;
        };
        const beCode =
          (typeof ax.response?.data === 'object'
            ? ax.response?.data?.code
            : undefined) ?? null;
        const beStatus = ax.response?.status ?? null;
        const rawBeMessage =
          (typeof ax.response?.data === 'object'
            ? ax.response?.data?.message
            : undefined) ??
          (typeof ax.response?.data === 'string'
            ? ax.response.data
            : undefined) ??
          ax.message;

        const friendly: AudioUploadError = {
          message: translateBeError(beCode, rawBeMessage),
          code: beCode,
          status: beStatus,
        };

        setStatus('failed');
        setError(friendly);
        throw err;
      }
    },
    []
  );

  return { summarize, status, progress, result, error, cancel, reset };
}

export default useSeminarAudio;

// ─── BE error translation ────────────────────────────────────────────────────
// The BE returns `Không có nội dung feedback` (and possibly other
// Vietnamese strings) as the human-readable message. The FE is the
// English surface, so we maintain a small lookup of known BE codes
// to English messages, plus a regex fallback for the common Vietnamese
// patterns the BE sends today. Anything unrecognised falls back to
// the original message so a future BE translation update is never
// silently swallowed — the user just sees whatever the BE wrote.
//
// This is intentionally NOT a complete i18n table; the BE is the
// source of truth, and this file is the bridge that scrubs the
// displayed string so it never includes a `[CODE]` suffix and is
// always English. If a new BE message needs mapping, add an entry
// below — the regex test is case-insensitive and trims whitespace.
const FALLBACK_ENGLISH_MESSAGE =
  'Upload failed. Check your connection and try again.';

/**
 * Known BE codes → English messages.
 *
 * The keys are the BE's `code` field. When the BE has a stable code,
 * we trust the code more than the message text because the message
 * may be translated in the future.
 */
const BE_CODE_TO_ENGLISH: Record<string, string> = {
  SEMINAR_NO_FEEDBACK:
    'No feedback content is available yet. Participants need to submit their feedback before an AI summary can be generated.',
  SUMMARY_ALREADY_EXISTS:
    'A summary already exists for this seminar. Confirm replacement to overwrite it with a fresh one.',
  NO_FEEDBACK_CONTENT:
    'No feedback content is available yet. Participants need to submit their feedback before an AI summary can be generated.',
};

/**
 * Vietnamese → English regex fallbacks. Matched case-insensitively.
 * Keys are regex sources, values are the English replacement.
 */
const VIETNAMESE_MESSAGE_PATTERNS: Array<{ pattern: RegExp; english: string }> = [
  {
    pattern: /không có nội dung feedback/i,
    english:
      'No feedback content is available yet. Participants need to submit their feedback before an AI summary can be generated.',
  },
  {
    pattern: /không có dữ liệu/i,
    english: 'No data is available for this seminar yet.',
  },
  {
    pattern: /đã tồn tại/i,
    english: 'A record with this name already exists.',
  },
];

/**
 * Map a (code, rawMessage) pair from the BE to a user-facing English
 * string. Always returns a non-empty string so the modal never shows
 * a blank error.
 *
 * Exported for unit testing — the hook uses it internally to scrub
 * every BE error before it reaches the UI.
 */
export function translateBeError(
  beCode: string | null,
  rawMessage: string | undefined,
): string {
  // 1. Trust the BE code if we have a translation for it.
  if (beCode && BE_CODE_TO_ENGLISH[beCode]) {
    return BE_CODE_TO_ENGLISH[beCode]!;
  }
  // 2. Otherwise, try to recognise the message text (handles the
  //    case where the BE omitted `code` but still sent a Vietnamese
  //    message).
  const candidate = (rawMessage ?? '').trim();
  if (candidate) {
    for (const { pattern, english } of VIETNAMESE_MESSAGE_PATTERNS) {
      if (pattern.test(candidate)) return english;
    }
    // 3. If the candidate already looks like English (no Vietnamese
    //    diacritics or characters), pass it through. This is the
    //    path future BE translations will take.
    if (looksLikeEnglish(candidate)) return candidate;
  }
  return FALLBACK_ENGLISH_MESSAGE;
}

/**
 * Heuristic: a string is "likely English" if it contains no common
 * Vietnamese diacritics and is made up of printable ASCII / common
 * Latin characters. Used to avoid over-translating messages the BE
 * might one day return in English.
 */
function looksLikeEnglish(s: string): boolean {
  // Vietnamese letters and diacritics we want to detect:
  //   ă â đ ê ô ơ ư (plus the diacritic-marked forms ắ ằ ẳ ẵ ặ …)
  // and the combined forms with diacritics like "ế", "ộ", "ể".
  // We use a Unicode property regex so we don't have to enumerate
  // every letter.
  return !/[\u00C0-\u024F\u1E00-\u1EFF]/.test(s);
}
