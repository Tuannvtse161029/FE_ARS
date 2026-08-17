/**
 * Centralized PDF source resolver.
 *
 * The PdfViewer receives `url: string | File | Blob | null` from many call
 * sites: backend-saved Firebase download URLs, `gs://` URIs, bare object
 * paths, relative app URLs, upload Blobs, etc. Some of those — like the mock
 * fixtures in src/services/admin.mocks.ts — used to point at Firebase
 * objects that do not exist (404), so the viewer saw "Failed to load PDF"
 * without a useful reason. This module classifies the input, fetches it
 * correctly, and surfaces typed errors so the caller can render a precise
 * UI state (see PdfViewer's error overlay).
 *
 * Strictly frontend-only. No secrets are read or logged.
 */

import { ref, getDownloadURL, type FirebaseStorage } from 'firebase/storage';

export type PdfSourceCategory =
  | 'blob'
  | 'firebaseDownloadUrl'
  | 'gsUri'
  | 'firebaseObjectPath'
  | 'httpUrl'
  | 'relativeUrl'
  | 'invalid'
  | 'empty';

export type PdfSourceReason =
  | 'invalid'
  | 'notFound'
  | 'forbidden'
  | 'server'
  | 'network'
  | 'htmlResponse'
  | 'cors'
  | 'firebaseNotConfigured';

export interface PdfSource {
  category: PdfSourceCategory;
  /** ArrayBuffer for network/firebase inputs, or original Blob/File. */
  resolved: ArrayBuffer | Blob | File;
  /** Original input URL (absolute when we resolved one). Used for "Open in new tab". */
  originalUrl: string | null;
}

export class PdfSourceError extends Error {
  readonly category: PdfSourceCategory;
  readonly httpStatus: number | undefined;
  readonly reason: PdfSourceReason;

  constructor(p: {
    category: PdfSourceCategory;
    reason: PdfSourceReason;
    message: string;
    httpStatus?: number;
  }) {
    super(p.message);
    this.name = 'PdfSourceError';
    this.category = p.category;
    this.reason = p.reason;
    this.httpStatus = p.httpStatus;
  }
}

export interface ResolveOptions {
  signal?: AbortSignal;
  /** Optional Firebase storage handle. Injected for tests; defaults to the app's `storage`. */
  storage?: FirebaseStorage | null;
}

const FIREBASE_HOST = 'firebasestorage.googleapis.com';

/**
 * Classify the input without performing any network work.
 */
export function classifyPdfSource(input: string | File | Blob | null): PdfSourceCategory {
  if (input == null) return 'empty';
  if (typeof input !== 'string') return 'blob';

  const trimmed = input.trim();
  if (trimmed.length === 0) return 'empty';

  if (/^gs:\/\//i.test(trimmed)) return 'gsUri';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.hostname === FIREBASE_HOST || u.hostname.endsWith('.' + FIREBASE_HOST)) {
        // Firebase HTTPS URL. Resolved download URLs include alt=media (token query).
        if (u.searchParams.has('alt')) return 'firebaseDownloadUrl';
        // Otherwise it could still be a Firebase-hosted HTTPS endpoint for the
        // object — treat it as a Firebase-style URL we can resolve via the SDK.
        return 'firebaseDownloadUrl';
      }
      return 'httpUrl';
    } catch {
      return 'invalid';
    }
  }

  // No scheme — relative or bare path.
  if (trimmed.startsWith('/')) return 'relativeUrl';
  if (/^[a-zA-Z0-9_./-]+$/.test(trimmed) && trimmed.includes('/')) {
    // Looks like a Firebase object path (folder/file.pdf or bucket/path).
    // Only treat as Firebase object path if it has no scheme/slashes start
    // and contains a slash — otherwise we risk misclassifying bare filenames.
    return 'firebaseObjectPath';
  }

  return 'invalid';
}

function safeReasonFromStatus(status: number): PdfSourceReason {
  if (status === 404) return 'notFound';
  if (status === 403) return 'forbidden';
  if (status >= 500 && status < 600) return 'server';
  return 'server';
}

function safeReasonFromText(text: string): PdfSourceReason {
  const lower = text.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return 'network';
  }
  if (lower.includes('cors')) return 'cors';
  return 'network';
}

/**
 * Resolve a PDF source to bytes the PDF.js loader can consume.
 *
 * Returns an `ArrayBuffer` (for network/firebase URLs) or the original
 * `Blob`/`File` (for in-memory sources). Throws `PdfSourceError` with a
 * safe message for any failure mode the UI must distinguish.
 */
export async function resolvePdfSource(
  input: string | File | Blob | null,
  opts: ResolveOptions = {},
): Promise<PdfSource> {
  const category = classifyPdfSource(input);

  if (category === 'empty') {
    throw new PdfSourceError({
      category,
      reason: 'invalid',
      message: 'No PDF source provided.',
    });
  }

  if (category === 'invalid') {
    throw new PdfSourceError({
      category,
      reason: 'invalid',
      message: 'Unsupported or malformed PDF URL.',
    });
  }

  if (category === 'blob') {
    const blob = input as File | Blob;
    return { category, resolved: blob, originalUrl: null };
  }

  const url = (input as string).trim();

  // gs:// → resolve via Firebase SDK.
  if (category === 'gsUri') {
    const storage = opts.storage ?? null;
    if (!storage) {
      throw new PdfSourceError({
        category,
        reason: 'firebaseNotConfigured',
        message: 'Firebase storage is not configured.',
      });
    }
    const path = url.replace(/^gs:\/\/[^/]+\//i, '');
    const downloadUrl = await getDownloadURL(ref(storage, path));
    return await fetchToArrayBuffer(downloadUrl, category, originalUrl(url), opts.signal);
  }

  // firebaseObjectPath (no scheme, looks like folder/file or bucket/path)
  if (category === 'firebaseObjectPath') {
    const storage = opts.storage ?? null;
    if (!storage) {
      throw new PdfSourceError({
        category,
        reason: 'firebaseNotConfigured',
        message: 'Firebase storage is not configured.',
      });
    }
    const downloadUrl = await getDownloadURL(ref(storage, url));
    return await fetchToArrayBuffer(downloadUrl, category, originalUrl(url), opts.signal);
  }

  // firebaseDownloadUrl (HTTPS Firebase URL, possibly with alt=media and token query)
  if (category === 'firebaseDownloadUrl') {
    // Preserve the entire query string (alt=media, token).
    return await fetchToArrayBuffer(url, category, url, opts.signal);
  }

  // relativeUrl (starts with "/") → resolve against app origin.
  if (category === 'relativeUrl') {
    const absolute = new URL(url, safeOrigin()).toString();
    return await fetchToArrayBuffer(absolute, category, absolute, opts.signal);
  }

  // httpUrl
  return await fetchToArrayBuffer(url, category, url, opts.signal);
}

function safeOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
}

function originalUrl(input: string): string {
  return input;
}

async function fetchToArrayBuffer(
  url: string,
  category: PdfSourceCategory,
  originalUrlValue: string,
  signal?: AbortSignal,
): Promise<PdfSource> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    const text = err instanceof Error ? err.message : '';
    throw new PdfSourceError({
      category,
      reason: safeReasonFromText(text),
      message: 'Unable to reach the document server.',
    });
  }

  if (!response.ok) {
    throw new PdfSourceError({
      category,
      reason: safeReasonFromStatus(response.status),
      message: safeHttpMessage(response.status),
      httpStatus: response.status,
    });
  }

  // Pre-PDF.js gates: content-type sniff + magic-byte sniff.
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !isAcceptableContentType(contentType)) {
    throw new PdfSourceError({
      category,
      reason: 'htmlResponse',
      message: 'Server returned a non-PDF response.',
    });
  }

  const buffer = await response.arrayBuffer();
  if (!hasPdfMagic(buffer)) {
    throw new PdfSourceError({
      category,
      reason: 'htmlResponse',
      message: 'Server returned a non-PDF response.',
    });
  }

  return { category, resolved: buffer, originalUrl: originalUrlValue };
}

function isAcceptableContentType(ct: string): boolean {
  const lowered = ct.toLowerCase();
  return (
    lowered.startsWith('application/pdf') ||
    lowered.startsWith('application/octet-stream') ||
    lowered.startsWith('binary/octet-stream')
  );
}

function hasPdfMagic(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 5) return false;
  const view = new Uint8Array(buf, 0, 5);
  return view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46 && view[4] === 0x2d;
}

function safeHttpMessage(status: number): string {
  if (status === 404) return 'File not found (404).';
  if (status === 403) return 'Access denied (403).';
  if (status >= 500 && status < 600) return 'Server error. Please try again later.';
  return `Request failed with status ${status}.`;
}

/**
 * True when the error is potentially recoverable by retrying (network blip,
 * 5xx, 403 token-expiry, Firebase configured). False for invalid inputs,
 * 404 not-found, and HTML responses.
 */
export function isRecoverablePdfError(err: unknown): boolean {
  if (err instanceof PdfSourceError) {
    return (
      err.reason === 'network' ||
      err.reason === 'server' ||
      err.reason === 'forbidden' ||
      err.reason === 'firebaseNotConfigured'
    );
  }
  return false;
}
