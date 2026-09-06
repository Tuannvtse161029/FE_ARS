// Lazy wrapper around the heavyweight PdfViewer.
//
// The actual viewer pulls in `pdfjs-dist` (~1.7 MB raw, ~511 kB gzip) plus
// its inline worker blob. Vercel flagged the resulting `vendor-pdf` chunk
// as exceeding the build's chunkSizeWarningLimit. Loading the viewer on
// demand keeps that chunk out of the initial bundle and out of the route
// bundles that do not show a PDF (login, register, profile, wallet, …).
//
// Consumers should import `LazyPdfViewer` (default export) instead of the
// heavy `PdfViewer` directly. The `<Suspense>` boundary here renders a
// neutral placeholder while the chunk downloads so individual call sites
// don't have to manage it themselves.
//
// We lazy-import via this folder's barrel (`./index`) rather than the raw
// `PdfViewer.tsx` file so existing Vitest mocks that target
// `'src/components/PdfViewer'` (the barrel) continue to intercept the
// module resolution and let unit tests stay jsdom-friendly.
import { lazy, Suspense, type ComponentProps } from 'react';

const PdfViewer = lazy(() => import('./index'));

const LoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 240,
      width: '100%',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-sunken)',
      color: 'var(--ink-muted)',
      fontSize: 13,
      fontFamily: 'var(--font-family-ui)',
    }}
    role="status"
    aria-live="polite"
    data-testid="pdf-viewer-loading"
  >
    Loading PDF viewer…
  </div>
);

const LazyPdfViewer = (props: ComponentProps<typeof PdfViewer>) => (
  <Suspense fallback={<LoadingFallback />}>
    <PdfViewer {...props} />
  </Suspense>
);

export default LazyPdfViewer;
export { LazyPdfViewer };
