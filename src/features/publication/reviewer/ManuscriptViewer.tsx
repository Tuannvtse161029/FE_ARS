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
 * The fix:
 *   - Instead of a CORS-busting HEAD fetch (which fails against Firebase
 *     Storage because the bucket is not CORS-configured for localhost), we
 *     render the PDF inside a hidden "probe" iframe with a 6-second load
 *     timeout.
 *   - `onload`  → URL is alive; switch to the visible iframe.
 *   - `onerror` → URL is dead (expired / blocked); show fallback.
 *   - Timeout   → same fallback with a timeout message.
 *
 * No fetch() CORS needed: browser iframe resource loading is not gated
 * by the fetch CORS check, so Firebase Storage signed URLs work fine
 * without any CORS bucket policy changes.
 */

type ViewerState = 'checking' | 'ready' | 'error';

const PROBE_TIMEOUT_MS = 6000;

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
  const cacheRef = useRef<Map<string, 'ready' | 'error'>>(new Map());
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeRef = useRef<HTMLIFrameElement | null>(null);

  const probeCleanup = () => {
    if (probeTimerRef.current !== null) {
      clearTimeout(probeTimerRef.current);
      probeTimerRef.current = null;
    }
    if (probeRef.current) {
      // Remove the probe iframe from the DOM to stop it loading
      probeRef.current.remove();
      probeRef.current = null;
    }
  };

  const verify = useCallback(
    async (url: string) => {
      const cached = cacheRef.current.get(url);
      if (cached) {
        setState(cached);
        return;
      }
      setState('checking');
      setErrorMessage('');

      // Remove any stale probe from the previous attempt
      probeCleanup();

      // Create a hidden iframe to probe whether the signed URL is alive.
      // We do NOT use fetch() here because Firebase Storage signed URLs
      // do not carry CORS headers for localhost — the fetch would be
      // rejected by the browser before we even get a response.
      // Iframe resource loading, however, is not gated by fetch CORS.
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.visibility = 'hidden';
      iframe.width = '0';
      iframe.height = '0';
      iframe.referrerPolicy = 'no-referrer';
      iframe.setAttribute('aria-hidden', 'true');

      // Append to body so it actually begins loading
      document.body.appendChild(iframe);
      probeRef.current = iframe;

      // 6-second load timeout: if the iframe hasn't fired onload by then,
      // the URL is likely expired or unreachable.
      probeTimerRef.current = setTimeout(() => {
        // Check if the iframe is still in the DOM (not already cleaned up)
        if (probeRef.current === iframe) {
          probeCleanup();
          cacheRef.current.set(url, 'error');
          setState('error');
          setErrorMessage(
            t(
              'reviewer.detail.manuscript.timeout',
              'The storage server did not respond in time. You can retry or download the manuscript directly.',
            ),
          );
        }
      }, PROBE_TIMEOUT_MS);

      iframe.onload = () => {
        if (probeRef.current !== iframe) return; // stale after unmount
        probeCleanup();
        cacheRef.current.set(url, 'ready');
        setState('ready');
      };

      iframe.onerror = () => {
        if (probeRef.current !== iframe) return;
        probeCleanup();
        cacheRef.current.set(url, 'error');
        setState('error');
        setErrorMessage(
          t(
            'reviewer.detail.manuscript.networkError',
            'Could not reach the storage server. Check your connection and retry.',
          ),
        );
      };

      // Assign src last — iframe only starts loading after being in the DOM
      iframe.src = url;
    },
    [t],
  );

  useEffect(() => {
    void verify(fileUrl);
    return probeCleanup; // cleanup on unmount or re-verify
  }, [fileUrl, verify]);

  const handleRetry = () => {
    cacheRef.current.delete(fileUrl);
    void verify(fileUrl);
  };

  // Safety nets on the visible iframe (only rendered after the probe
  // confirmed the URL is alive). handleIframeLoad is a no-op because
  // the probe already verified the URL is alive before this iframe mounts.
  const handleIframeLoad = () => {};
  const handleIframeError = () => {
    cacheRef.current.set(fileUrl, 'error');
    setState('error');
    setErrorMessage(
      t(
        'reviewer.detail.manuscript.corsBlocked',
        'The embedded preview was blocked. Download or open the manuscript in a new tab to view it.',
      ),
    );
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
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts"
          referrerPolicy="no-referrer"
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
