import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
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
