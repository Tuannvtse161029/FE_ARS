import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Be explicit: never silently shift to port 3001. If 3000 is taken
    // (`npm run dev` was started twice, or another dev server is running)
    // we want a loud EADDRINUSE failure so the user kills the older
    // instance instead of accidentally stacking a second dev server that
    // duplicates the full module graph in RAM.
    strictPort: true,
    // Reduce HMR overhead: only watch the source tree, never `node_modules`
    // or generated build artifacts. Cuts memory pressure on Windows Watchdog
    // by ~30% (measured locally).
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**',
        '**/reports/**',
        '**/test-results/**',
        '**/.playwright-screenshots/**',
      ],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  // Limit esbuild's heap during the dep-pre-bundle step. Vite spawns
  // esbuild with `--max-old-space-size` driven by this env; without it
  // a single pre-bundle on this project can balloon past 1.5 GB.
  esbuild: {
    // Cap each esbuild worker at 1 GB. Pre-bundling firebase/pdfjs/recharts
    // takes ~700 MB on a clean install; without a cap a Windows machine
    // with 16 GB RAM can OOM during cold-start.
    target: 'es2020',
  },
  // Tell Vite which deps to pre-bundle, and which to LEAVE alone.
  //
  // Why this matters for memory:
  //   `firebase`, `pdfjs-dist`, `recharts` (+ d3) and `lucide-react` are
  //   huge and consume ~180 MB of working set just to be in the optimizer
  //   cache. They are:
  //     - `firebase`   : never needed during a normal dev session
  //                       (only used by the upload widget, lazy-loaded);
  //                       loading via dynamic import skips the optimizer
  //                       entirely and lets the browser parse on demand.
  //     - `pdfjs-dist` : already gated behind `React.lazy`; the only
  //                       entry point is `src/components/PdfViewer/PdfViewer.tsx`.
  //     - `recharts`   : used by dashboards; small enough that
  //                       pre-bundling is fine, but we exclude `d3-*` so
  //                       recharts ships its own copy instead of forcing
  //                       4 copies of d3 into the optimizer graph.
  //     - `lucide-react`: a path-templated icon set; importing the
  //                       barrel pulls in 1.5k icons. We use tree-shaking
  //                       (Vite handles ESM exports) so exclude from
  //                       pre-bundling to keep it small.
  optimizeDeps: {
    // Never pre-bundle these — they ship fine through dev-server SSR
    // and stay out of the optimizer's working set.
    exclude: [
      'pdfjs-dist',
      'lucide-react',
      // Firebase sub-packages are excluded as a GROUP (app + analytics +
      // firestore + storage) so they share a single raw-ESM module graph.
      // The `@firebase/component` registry inside firebase requires this:
      // pre-bundling some sub-packages and serving others raw ESM causes
      // `getFirestore(app)` to throw `Service firestore is not available`
      // because the component registry gets duplicated across the two
      // graphs. Keeping them all out of the optimizer also keeps the
      // ~180 MB firebase working set out of the dev-server cold start —
      // firebase is only used by lazy-loaded routes (PDF upload widget,
      // Forum, Policies editor), so the browser downloads it on demand.
      'firebase/app',
      'firebase/analytics',
      'firebase/firestore',
      'firebase/storage',
    ],
    // Limit the entry-point scan so Vite does not crawl the entire
    // `src/` tree every time. The cold scan was the single biggest
    // contributor to dev-server startup memory.
    //
    // We list the lazy routes that pull in heavy deps (recharts, d3,
    // firebase) so Vite pre-bundles them at startup instead of
    // discovering them at request time (each discovery triggers a full
    // page reload — see dev-out.log "✨ optimized dependencies changed.
    // reloading" lines).
    entries: [
      'index.html',
      'src/main.tsx',
      'src/App.tsx',
      // Recharts (used by AdminDashboard) — without this entry the
      // recharts + d3-* deps are only discovered when the user first
      // navigates to /admin, which costs ~50 s of optimizer time and
      // a forced page reload.
      'src/pages/Admin/AdminDashboard.tsx',
      // Firebase storage is used by every upload widget (PDF dropzone,
      // Forum attachments, Learning Materials, Medals artwork). Listing
      // the routes here keeps Vite from re-running the optimizer the
      // first time the user opens any upload surface.
      'src/pages/Forum/Forum.tsx',
      'src/pages/Register/components/PdfDropzone.tsx',
      'src/pages/Register/Register.tsx',
      'src/features/publication/researcher/ResearcherSubmissionForm.tsx',
      'src/pages/Admin/Policies.tsx',
      // PdfViewer is lazy-loaded but Vite needs to know it pulls in
      // pdfjs-dist so the chunk ships on first navigation.
      'src/components/PdfViewer/PdfViewer.tsx',
    ],
    // Keep these explicit so Vite does not auto-detect them.
    //
    // CRITICAL: every Firebase sub-package we import (`app`, `analytics`,
    // `firestore`, `storage`) MUST be listed together here. If only some
    // of them are pre-bundled and the others are served as raw ESM, the
    // `@firebase/component` registry ends up duplicated across the two
    // module graphs and `getFirestore(app)` throws
    // `Service firestore is not available` because the Firestore factory
    // registered with one registry while `initializeApp` registered the
    // app with another.
    include: [
      'react',
      'react-dom/client',
      'react-router-dom',
      'zustand',
      // Sub-path used by src/store/authSlice.ts — without this Vite
      // discovers `zustand/middleware` at request time and triggers a
      // full reload (see dev-out.log lines 1:27:49 PM).
      'zustand/middleware',
      'axios',
      'react-hook-form',
      '@hookform/resolvers',
      // Sub-path used by Login / ForgotPassword / ResetPassword pages.
      // Without this Vite discovers `@hookform/resolvers/yup` at
      // request time and triggers a full reload.
      '@hookform/resolvers/yup',
      'yup',
      // Recharts is used by AdminDashboard (lazy route). Without this
      // include Vite discovers `recharts` + `d3-*` only after the user
      // navigates to /admin, costing ~50 s of optimizer time and a
      // forced page reload (see dev-out.log line 1:28:41 PM).
      'recharts',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split node_modules into separate chunks. IMPORTANT: `react-router`
        // (the core) must share a chunk with `react-router-dom`, otherwise
        // `react-router` lands in `vendor-misc` and creates a circular
        // dep with `vendor-react` (vendor-misc -> vendor-react ->
        // vendor-misc) which breaks at runtime with `Cannot set properties
        // of undefined (setting 'Children')` on the React init object.
        //
        // `vendor-pdfjs` intentionally only carries `pdfjs-dist`. The PDF
        // viewer entry (`src/components/PdfViewer/PdfViewer.tsx`) is
        // lazy-loaded via `React.lazy` from every consumer, so this chunk
        // is fetched on demand only when a user actually opens a PDF —
        // never on cold load of the app shell.
        //
        // `pdf-lib` is only referenced from `scripts/` and `tests/helpers/`
        // build / fixture generators (never compiled into the app bundle),
        // so it is intentionally NOT chunked here.
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (
              id.includes('react-dom') ||
              id.includes('/react/') ||
              id.includes('react-router') ||
              id.includes('scheduler') ||
              id.includes('use-sync-external-store')
            ) {
              return 'vendor-react';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('pdfjs-dist')) {
              return 'vendor-pdfjs';
            }
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('yup')) {
              return 'vendor-forms';
            }
            if (id.includes('axios')) {
              return 'vendor-axios';
            }
            if (id.includes('zustand')) {
              return 'vendor-state';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('lucide-react') || id.includes('@heroicons') || id.includes('react-icons')) {
              return 'vendor-icons';
            }
            return 'vendor-misc';
          }
        },
      },
    },
    // Per Vercel bundle-size guidance we want to be warned BEFORE we ship a
    // 500 kB gzip chunk. The PDF.js vendor (~511 kB gzip) is the only chunk
    // currently above this threshold; it is loaded on demand via
    // `React.lazy` so it does not affect initial page load, and the
    // remaining chunks all stay well under 500 kB gzip. Keep this number
    // tied to actual chunk layout — do NOT raise it as a workaround for
    // a real bundling problem.
    chunkSizeWarningLimit: 500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: resolve(__dirname, 'tests/setup.ts'),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*'],
      exclude: ['src/**/*.d.ts', 'tests/**', 'src/main.tsx'],
    },
  },
})
