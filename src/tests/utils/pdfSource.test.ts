/**
 * Tests for the centralized PDF source resolver.
 *
 * Covers every required branch of defect 4B and the safety guarantees of
 * 4D (no token leakage into rendered errors, no `1 / 0` regressions, no
 * HTML passed to PDF.js).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock firebase/storage so the resolver sees a predictable SDK ────────────
const refMock = vi.fn((storage, path) => ({ _storage: storage, path }));
const getDownloadURLMock = vi.fn(async (ref) => {
  if (ref && ref.path === '__BOOM__') throw new Error('boom from sdk');
  // Build a fake download URL — host matches so the resolver knows it's a Firebase URL.
  return `https://firebasestorage.googleapis.com/v0/b/test/o/${encodeURIComponent(ref.path)}?alt=media&token=fake-token-value`;
});

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => refMock(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURLMock(...args),
}));

import {
  classifyPdfSource,
  resolvePdfSource,
  PdfSourceError,
  isRecoverablePdfError,
} from '../../utils/pdfSource';

const SAMPLE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]).buffer;

interface FakeResponseInit {
  status?: number;
  ok?: boolean;
  contentType?: string | null;
  body?: ArrayBuffer | null;
  throwFetch?: Error;
}

function installFetchSpy(init: FakeResponseInit): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    if (init.throwFetch) throw init.throwFetch;
    return {
      ok: init.ok ?? (init.status ? init.status >= 200 && init.status < 300 : true),
      status: init.status ?? 200,
      headers: {
        get: (key: string) =>
          key.toLowerCase() === 'content-type' ? (init.contentType ?? null) : null,
      },
      arrayBuffer: async () => init.body ?? new ArrayBuffer(0),
    } as unknown as Response;
  });
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

describe('classifyPdfSource', () => {
  it('returns empty for null/undefined/blank', () => {
    expect(classifyPdfSource(null)).toBe('empty');
    expect(classifyPdfSource(undefined as unknown as null)).toBe('empty');
    expect(classifyPdfSource('')).toBe('empty');
    expect(classifyPdfSource('   ')).toBe('empty');
  });

  it('returns blob for File/Blob inputs', () => {
    expect(classifyPdfSource(new File(['x'], 'x.pdf'))).toBe('blob');
    expect(classifyPdfSource(new Blob(['x']))).toBe('blob');
  });

  it('returns gsUri for gs:// URLs', () => {
    expect(classifyPdfSource('gs://my-bucket/path/to/file.pdf')).toBe('gsUri');
  });

  it('returns firebaseDownloadUrl for firebasestorage.googleapis.com URLs', () => {
    expect(
      classifyPdfSource(
        'https://firebasestorage.googleapis.com/v0/b/bucket/o/file.pdf?alt=media'
      )
    ).toBe('firebaseDownloadUrl');
  });

  it('returns httpUrl for ordinary https URLs', () => {
    expect(classifyPdfSource('https://example.com/file.pdf')).toBe('httpUrl');
  });

  it('returns relativeUrl for slash-prefixed strings', () => {
    expect(classifyPdfSource('/test-fixtures/mock.pdf')).toBe('relativeUrl');
  });

  it('returns firebaseObjectPath for bare paths with slashes', () => {
    expect(classifyPdfSource('folder/sub/file.pdf')).toBe('firebaseObjectPath');
  });

  it('returns invalid for unsupported shapes', () => {
    expect(classifyPdfSource('!!!nope')).toBe('invalid');
  });
});

describe('resolvePdfSource — input handling', () => {
  beforeEach(() => {
    refMock.mockClear();
    getDownloadURLMock.mockClear();
    installFetchSpy({ status: 200, body: SAMPLE_PDF_BYTES, contentType: 'application/pdf' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns Blob-backed source for File input', async () => {
    const file = new File(['hello'], 'a.pdf', { type: 'application/pdf' });
    const result = await resolvePdfSource(file);
    expect(result.category).toBe('blob');
    expect(result.resolved).toBe(file);
    expect(result.originalUrl).toBeNull();
  });

  it('returns Blob-backed source for Blob input', async () => {
    const blob = new Blob(['hello'], { type: 'application/pdf' });
    const result = await resolvePdfSource(blob);
    expect(result.category).toBe('blob');
    expect(result.resolved).toBe(blob);
  });

  it('throws invalid for empty input', async () => {
    await expect(resolvePdfSource(null)).rejects.toBeInstanceOf(PdfSourceError);
    await expect(resolvePdfSource('')).rejects.toBeInstanceOf(PdfSourceError);
  });

  it('throws invalid for malformed input', async () => {
    await expect(resolvePdfSource(':::not a url')).rejects.toBeInstanceOf(PdfSourceError);
  });
});

describe('resolvePdfSource — Firebase URL paths', () => {
  const fakeStorage = { _kind: 'fake-storage' };

  beforeEach(() => {
    refMock.mockClear();
    getDownloadURLMock.mockClear();
    installFetchSpy({ status: 200, body: SAMPLE_PDF_BYTES, contentType: 'application/pdf' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches Firebase HTTPS download URL directly and preserves query (alt=media, token)', async () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/bucket/o/file%2Fpath.pdf?alt=media&token=abc123';
    const spy = installFetchSpy({
      status: 200,
      body: SAMPLE_PDF_BYTES,
      contentType: 'application/pdf',
    });
    const result = await resolvePdfSource(url);

    expect(result.category).toBe('firebaseDownloadUrl');
    expect(result.originalUrl).toBe(url);
    expect(spy).toHaveBeenCalledTimes(1);
    // The exact URL with its query must reach fetch untouched.
    expect(String(spy.mock.calls[0][0])).toContain('alt=media');
    expect(String(spy.mock.calls[0][0])).toContain('token=abc123');
    expect(result.resolved).toBeInstanceOf(ArrayBuffer);
  });

  it('resolves gs:// via Firebase SDK and then fetches', async () => {
    getDownloadURLMock.mockResolvedValueOnce(
      'https://firebasestorage.googleapis.com/v0/b/x/o/from-gs.pdf?alt=media&token=zzz'
    );
    const url = 'gs://my-bucket/from-gs.pdf';
    const result = await resolvePdfSource(url, { storage: fakeStorage as never });

    expect(result.category).toBe('gsUri');
    expect(refMock).toHaveBeenCalledWith(fakeStorage, 'from-gs.pdf');
    expect(getDownloadURLMock).toHaveBeenCalledTimes(1);
    expect(result.resolved).toBeInstanceOf(ArrayBuffer);
  });

  it('resolves a bare Firebase object path via the SDK', async () => {
    getDownloadURLMock.mockResolvedValueOnce(
      'https://firebasestorage.googleapis.com/v0/b/x/o/folder%2Ffile.pdf?alt=media&token=ppp'
    );
    const result = await resolvePdfSource('folder/sub/file.pdf', {
      storage: fakeStorage as never,
    });
    expect(result.category).toBe('firebaseObjectPath');
    expect(refMock).toHaveBeenCalledWith(fakeStorage, 'folder/sub/file.pdf');
    expect(result.resolved).toBeInstanceOf(ArrayBuffer);
  });

  it('throws firebaseNotConfigured when storage is unavailable and an SDK path is used', async () => {
    await expect(
      resolvePdfSource('gs://bucket/file.pdf', { storage: null })
    ).rejects.toMatchObject({ reason: 'firebaseNotConfigured' });
    await expect(
      resolvePdfSource('folder/sub/file.pdf', { storage: null })
    ).rejects.toMatchObject({ reason: 'firebaseNotConfigured' });
  });
});

describe('resolvePdfSource — HTTP(S) and relative URL paths', () => {
  beforeEach(() => {
    refMock.mockClear();
    getDownloadURLMock.mockClear();
    installFetchSpy({ status: 200, body: SAMPLE_PDF_BYTES, contentType: 'application/pdf' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches ordinary https URLs directly', async () => {
    const result = await resolvePdfSource('https://example.com/file.pdf');
    expect(result.category).toBe('httpUrl');
    expect(result.originalUrl).toBe('https://example.com/file.pdf');
    expect(result.resolved).toBeInstanceOf(ArrayBuffer);
  });

  it('resolves relative URLs against the app origin', async () => {
    const result = await resolvePdfSource('/test-fixtures/mock-proof-an.pdf');
    expect(result.category).toBe('relativeUrl');
    // The exact origin is jsdom-dependent; just assert it became an absolute http(s) URL.
    expect(result.originalUrl).toMatch(/^https?:\/\/[^/]+\/test-fixtures\/mock-proof-an\.pdf$/);
    expect(result.resolved).toBeInstanceOf(ArrayBuffer);
  });
});

describe('resolvePdfSource — pre-PDF.js gates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns notFound for 404', async () => {
    installFetchSpy({ status: 404, body: null, contentType: null });
    await expect(resolvePdfSource('https://example.com/missing.pdf')).rejects.toMatchObject({
      reason: 'notFound',
      httpStatus: 404,
    });
  });

  it('returns forbidden for 403', async () => {
    installFetchSpy({ status: 403, body: null, contentType: null });
    await expect(resolvePdfSource('https://example.com/restricted.pdf')).rejects.toMatchObject({
      reason: 'forbidden',
      httpStatus: 403,
    });
  });

  it('returns server for 5xx', async () => {
    installFetchSpy({ status: 502, body: null, contentType: null });
    await expect(resolvePdfSource('https://example.com/down.pdf')).rejects.toMatchObject({
      reason: 'server',
      httpStatus: 502,
    });
  });

  it('returns htmlResponse when content-type is HTML', async () => {
    installFetchSpy({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: new TextEncoder().encode('<html>oops</html>').buffer,
    });
    await expect(resolvePdfSource('https://example.com/not-pdf')).rejects.toMatchObject({
      reason: 'htmlResponse',
    });
  });

  it('returns htmlResponse when content-type is JSON', async () => {
    installFetchSpy({
      status: 200,
      contentType: 'application/json',
      body: new TextEncoder().encode('{"error":"nope"}').buffer,
    });
    await expect(resolvePdfSource('https://example.com/json.pdf')).rejects.toMatchObject({
      reason: 'htmlResponse',
    });
  });

  it('returns htmlResponse when bytes are not PDF magic', async () => {
    installFetchSpy({
      status: 200,
      contentType: 'application/pdf',
      body: new TextEncoder().encode('<!DOCTYPE html>').buffer,
    });
    await expect(resolvePdfSource('https://example.com/disguised.html')).rejects.toMatchObject({
      reason: 'htmlResponse',
    });
  });

  it('accepts application/octet-stream as a valid content-type', async () => {
    installFetchSpy({
      status: 200,
      contentType: 'application/octet-stream',
      body: SAMPLE_PDF_BYTES,
    });
    const result = await resolvePdfSource('https://example.com/blob.bin');
    expect(result.resolved).toBeInstanceOf(ArrayBuffer);
  });

  it('maps a network failure to reason network', async () => {
    installFetchSpy({ throwFetch: new TypeError('Failed to fetch') });
    await expect(resolvePdfSource('https://example.com/x.pdf')).rejects.toMatchObject({
      reason: 'network',
    });
  });
});

describe('isRecoverablePdfError', () => {
  it('treats network, server, forbidden, and firebaseNotConfigured as recoverable', () => {
    expect(
      isRecoverablePdfError(new PdfSourceError({ category: 'httpUrl', reason: 'network', message: '' }))
    ).toBe(true);
    expect(
      isRecoverablePdfError(
        new PdfSourceError({ category: 'httpUrl', reason: 'server', message: '' })
      )
    ).toBe(true);
    expect(
      isRecoverablePdfError(
        new PdfSourceError({ category: 'httpUrl', reason: 'forbidden', message: '' })
      )
    ).toBe(true);
    expect(
      isRecoverablePdfError(
        new PdfSourceError({ category: 'gsUri', reason: 'firebaseNotConfigured', message: '' })
      )
    ).toBe(true);
  });

  it('treats notFound and htmlResponse as non-recoverable', () => {
    expect(
      isRecoverablePdfError(
        new PdfSourceError({ category: 'httpUrl', reason: 'notFound', message: '', httpStatus: 404 })
      )
    ).toBe(false);
    expect(
      isRecoverablePdfError(
        new PdfSourceError({ category: 'httpUrl', reason: 'htmlResponse', message: '' })
      )
    ).toBe(false);
  });
});

describe('Safety — no secret leakage', () => {
  it('does not echo the input URL into the resolver error messages', async () => {
    installFetchSpy({ status: 403, body: null, contentType: null });
    const secretUrl =
      'https://firebasestorage.googleapis.com/v0/b/BUCKET/o/path?alt=media&token=SECRET_TOKEN';
    const error = await resolvePdfSource(secretUrl).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PdfSourceError);
    if (error instanceof Error) {
      expect(error.message).not.toContain('SECRET_TOKEN');
      expect(error.message).not.toContain('BUCKET');
      // Safe reason text only.
      expect(error.message).toMatch(/access denied|forbidden|403/i);
    }
  });

  it('does not echo the input URL into htmlResponse errors', async () => {
    installFetchSpy({
      status: 200,
      contentType: 'application/json',
      body: new TextEncoder().encode('{"oops":true}').buffer,
    });
    const error = await resolvePdfSource('https://example.com/secret-url.pdf').catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(PdfSourceError);
    if (error instanceof Error) {
      expect(error.message).not.toContain('secret-url');
    }
  });
});
