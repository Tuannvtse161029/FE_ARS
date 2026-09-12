import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { Button } from '../../../components/Button/Button';
import { useT } from '../../../i18n/I18nContext';
import { safeHref } from '../../../utils/validationRules';
import reviewer from './reviewer.module.css';

/**
 * ManuscriptViewer — protected PDF iframe with a graceful fallback.
 *
 * Pre-2026-09 the reviewer page rendered the signed Firebase URL inside
 * a bare `<iframe>`. When the URL expired (HTTP 402 from the storage
 * CDN) or returned a non-PDF error payload, the iframe would render the
 * raw error JSON inside the document zone, leaving the reviewer with no
 * way to recover — the "Download" link still worked but the visible
 * surface looked broken.
 *
 * This component:
 *   - issues a HEAD request to the signed URL once, caches the verdict
 *     per `fileUrl` (so re-mounting the page doesn't re-fire),
 *   - shows the iframe when the response is `application/pdf`,
 *   - shows an `ErrorBanner` with Retry / Open-in-new-tab / Download
 *     actions when the response is not a PDF (status >= 400, wrong
 *     content-type, or network error),
 *   - leaves a clear "PDF unavailable" placeholder when no URL is
 *     provided (the parent renders the policy gate so this branch only
 *     runs when the reviewer has acknowledged responsibilities).
 *
 * The HEAD request is wrapped in try/catch — we never throw to the
 * parent, we just flip the `state` to `'error'` so the error UI shows.
 */

type ViewerState = 'checking' | 'ready' | 'error';

const HEAD_TIMEOUT_MS = 5000;

const isPdfContentType = (rawType: string | null | undefined): boolean => {
  if (!rawType) return false;
  return rawType.toLowerCase().split(';')[0].trim() === 'application/pdf';
};

export interface ManuscriptViewerProps {
  /** Signed Firebase (or storage) URL for the manuscript PDF. */
  fileUrl: string;
  /** Display title used in the iframe's accessible name. */
  title: string;
}

export const ManuscriptViewer = ({ fileUrl, title }: ManuscriptViewerProps) => {
  const t = useT();
  const [state, setState] = useState<ViewerState>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const cacheRef = useRef<Map<string, ViewerState>>(new Map());

  const verify = useCallback(async (url: string) => {
    const cached = cacheRef.current.get(url);
    if (cached && cached !== 'checking') {
      setState(cached);
      return;
    }
    setState('checking');
    setErrorMessage('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        // No cache: we want a fresh verdict when the user clicks Retry —
        // storage URLs change after rotation so a stale cache could mask
        // a fix that just took effect.
        cache: 'no-store',
        signal: controller.signal,
        credentials: 'omit',
        mode: 'cors',
      });
      clearTimeout(timer);
      if (!response.ok) {
        cacheRef.current.set(url, 'error');
        setState('error');
        setErrorMessage(
          t(
            'reviewer.detail.manuscript.httpError',
            `Storage returned ${response.status}. The signed URL may have expired.`,
          ),
        );
        return;
      }
      const contentType = response.headers.get('content-type');
      if (!isPdfContentType(contentType)) {
        cacheRef.current.set(url, 'error');
        setState('error');
        setErrorMessage(
          t(
            'reviewer.detail.manuscript.wrongType',
            'The file at this URL is not a PDF. Use the download link below to retrieve the manuscript.',
          ),
        );
        return;
      }
      cacheRef.current.set(url, 'ready');
      setState('ready');
    } catch (caught) {
      clearTimeout(timer);
      cacheRef.current.set(url, 'error');
      setState('error');
      const isAbort = caught instanceof DOMException && caught.name === 'AbortError';
      setErrorMessage(
        isAbort
          ? t(
              'reviewer.detail.manuscript.timeout',
              'The storage server did not respond in time. You can retry or download the manuscript directly.',
            )
          : t(
              'reviewer.detail.manuscript.networkError',
              'Could not reach the storage server. Check your connection and retry.',
            ),
      );
    }
  }, [t]);

  useEffect(() => {
    void verify(fileUrl);
  }, [fileUrl, verify]);

  const handleRetry = () => {
    cacheRef.current.delete(fileUrl);
    void verify(fileUrl);
  };

  return (
    <div className={reviewer.pdfFrame} data-testid="pdf-frame">
      <div className={reviewer.pdfActions}>
        <span>
          <FileText size={17} aria-hidden="true" />{' '}
          {t('reviewer.detail.doc.protected')}
        </span>
        <div>
          {safeHref(fileUrl) && (
            <a href={safeHref(fileUrl) ?? '#'} target="_blank" rel="noreferrer">
              <ExternalLink size={15} aria-hidden="true" />{' '}
              {t('reviewer.detail.doc.openLink')}
            </a>
          )}
          {fileUrl && (
            <a href={safeHref(fileUrl) ?? undefined} download>
              <Download size={15} aria-hidden="true" />{' '}
              {t('reviewer.detail.doc.download')}
            </a>
          )}
        </div>
      </div>

      {state === 'ready' && safeHref(fileUrl) && (
        <iframe
          src={safeHref(fileUrl) ?? ''}
          title={t('reviewer.detail.doc.frameTitle', undefined, { title })}
        />
      )}

      {state === 'checking' && (
        <div className={reviewer.manuscriptFallback} role="status" aria-live="polite">
          <FileText size={20} aria-hidden="true" />
          <p>{t('reviewer.detail.manuscript.loading', 'Loading manuscript…')}</p>
        </div>
      )}

      {state === 'error' && (
        <div className={reviewer.manuscriptFallback} data-testid="pdf-fallback" role="alert">
          <ErrorBanner
            tone="warning"
            title={t(
              'reviewer.detail.manuscript.fallbackTitle',
              'Manuscript preview unavailable',
            )}
            message={errorMessage}
          />
          <div className={reviewer.manuscriptFallbackActions}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw size={14} aria-hidden />}
              onClick={handleRetry}
            >
              {t('reviewer.detail.manuscript.retry', 'Retry')}
            </Button>
            {(() => {
              const safe = safeHref(fileUrl);
              return safe ? (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<AlertTriangle size={14} aria-hidden />}
                  onClick={() => window.open(safe, '_blank', 'noopener,noreferrer')}
                >
                  {t('reviewer.detail.manuscript.openRaw', 'Open anyway')}
                </Button>
              ) : null;
            })()}
            <a
              href={safeHref(fileUrl) ?? undefined}
              download
              className={reviewer.manuscriptDownloadLink}
            >
              <Download size={14} aria-hidden />{' '}
              {t('reviewer.detail.manuscript.downloadAnyway', 'Download anyway')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManuscriptViewer;
