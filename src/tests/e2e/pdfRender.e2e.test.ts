/**
 * Playwright E2E test — PdfViewer canvas pixel analysis.
 *
 * Architecture:
 *   1. Generate a known-content PDF with pdf-lib (colored rect + text)
 *   2. Serve it via Python's http.server on a random free port
 *   3. Inject Zustand auth localStorage so we can access /papers (requires auth)
 *   4. Navigate to /papers, click "View" on the first paper row
 *   5. Intercept the /sample.pdf URL the app uses and serve our test PDF instead
 *   6. Wait for canvas to render, then read pixel data
 *
 * Run standalone (requires dev server on port 3000):
 *   npx tsx src/tests/e2e/pdfRender.e2e.test.ts
 *
 * Run as vitest test:
 *   npx vitest run src/tests/e2e/pdfRender.e2e.test.ts
 *
 * Prerequisites:
 *   - Chromium must be installed: npx playwright install chromium
 *   - The Vite dev server must be running on port 3000 (npm run dev)
 */

import { chromium, Browser, Page, Route } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// ── Config ─────────────────────────────────────────────────────────────────────

const DEV_SERVER_URL = 'http://localhost:3000';
const PAPERS_PATH = '/papers';
// Chromium installed by npx playwright install chromium
const CHROMIUM_EXECUTABLE =
  'C:\\Users\\admin\\AppData\\Local\\Temp\\cursor-sandbox-cache\\a265ad8c4357be91bc06caefbb9f874a\\playwright\\chromium-1234\\chrome-win64\\chrome.exe';

// ── HTTP Server helpers ────────────────────────────────────────────────────────

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

async function startPythonHttpServer(
  dir: string,
  port: number,
): Promise<{ url: string; process: ChildProcess }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'python',
      ['-m', 'http.server', String(port)],
      { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], shell: true },
    );

    proc.stderr?.on('data', () => {}); // swallow "Serving HTTP on 0.0.0.0:PORT"
    proc.on('error', reject);

    setTimeout(() => {
      resolve({ url: `http://localhost:${port}`, process: proc });
    }, 800);
  });
}

async function stopServer(proc: ChildProcess) {
  return new Promise<void>((resolve) => {
    proc.kill('SIGTERM');
    proc.on('close', () => resolve());
    setTimeout(resolve, 1000); // fallback
  });
}

// ── PDF generation with pdf-lib ────────────────────────────────────────────────

async function generateTestPdf(tmpDir: string): Promise<string> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 300]);

  // Background (light blue fill)
  page.drawRectangle({
    x: 0, y: 0, width: 400, height: 300,
    color: rgb(0.95, 0.97, 1.0),
  });

  // Blue border box
  page.drawRectangle({
    x: 15, y: 15, width: 370, height: 270,
    borderColor: rgb(0.2, 0.4, 0.8),
    borderWidth: 2,
  });

  // Red filled circle
  page.drawCircle({
    x: 100, y: 180, size: 50,
    color: rgb(0.85, 0.15, 0.15),
    borderColor: rgb(0.6, 0.05, 0.05),
    borderWidth: 1,
  });

  // Green filled rectangle
  page.drawRectangle({
    x: 230, y: 140, width: 120, height: 80,
    color: rgb(0.15, 0.75, 0.2),
  });

  // Orange filled rectangle
  page.drawRectangle({
    x: 30, y: 40, width: 90, height: 55,
    color: rgb(0.95, 0.55, 0.1),
  });

  // Text heading
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.drawText('E2E Test Page', {
    x: 140, y: 258, size: 13,
    font, color: rgb(0.05, 0.15, 0.45),
  });

  // Subtext
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('Canvas should show colored shapes, not all-white.', {
    x: 55, y: 50, size: 9,
    font: helvetica, color: rgb(0.3, 0.3, 0.3),
  });

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(tmpDir, 'test-e2e-pdf.pdf');
  fs.writeFileSync(filePath, Buffer.from(pdfBytes));
  return filePath;
}

// ── Canvas pixel analysis ──────────────────────────────────────────────────────

interface PixelReport {
  width: number;
  height: number;
  totalPixels: number;
  whitePixels: number;
  nonWhitePixels: number;
  sampleNonWhite: Array<{ r: number; g: number; b: number; a: number }>;
  isBlank: boolean;
  maxR: number;
  maxG: number;
  maxB: number;
}

async function analyzeCanvas(page: Page, selector: string): Promise<PixelReport> {
  return page.evaluate(
    (sel) => {
      const canvas = document.querySelector(sel) as HTMLCanvasElement | null;
      if (!canvas) throw new Error(`Canvas not found: ${sel}`);

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get 2d context');

      const w = canvas.width;
      const h = canvas.height;

      if (w === 0 || h === 0) {
        throw new Error(`Canvas has zero dimensions: ${w}x${h}`);
      }

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      let whitePixels = 0;
      let nonWhitePixels = 0;
      const sampleNonWhite: Array<{ r: number; g: number; b: number; a: number }> = [];
      let maxR = 0, maxG = 0, maxB = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const a = data[i + 3]!;

        if (r > 240 && g > 240 && b > 240 && a > 200) {
          whitePixels++;
        } else {
          nonWhitePixels++;
          if (sampleNonWhite.length < 30) {
            sampleNonWhite.push({ r, g, b, a });
          }
          if (r > maxR) maxR = r;
          if (g > maxG) maxG = g;
          if (b > maxB) maxB = b;
        }
      }

      return {
        width: w, height: h,
        totalPixels: Math.floor(data.length / 4),
        whitePixels, nonWhitePixels, sampleNonWhite,
        isBlank: nonWhitePixels === 0,
        maxR, maxG, maxB,
      };
    },
    selector,
  );
}

// ── Fake Zustand auth localStorage ───────────────────────────────────────────

function buildFakeAuthStorage(): string {
  return JSON.stringify({
    state: {
      user: {
        id: 1,
        username: 'test-researcher',
        email: 'test@example.com',
        fullName: 'Test Researcher',
        roleId: 3,
        roleName: 'Researcher',
      },
      token: 'fake-jwt-token-for-e2e-testing',
      isAuthenticated: true,
      isLoading: false,
    },
    version: 0,
  });
}

// ── Test state (module-level so all tests share it) ───────────────────────────

let browser: Browser | null = null;
let pdfServerProc: ChildProcess | null = null;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-e2e-'));
let pdfServerUrl = '';
let consoleMessages: Array<{ type: string; text: string }> = [];
let pageRef: Page | null = null;

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PdfViewer E2E — Canvas Pixel Analysis', () => {

  beforeAll(async () => {
    // Set timeout for this suite (60s)
    expect.getState().testTimeout = 60000;

    // 1. Generate test PDF
    const pdfPath = await generateTestPdf(tmpDir);
    expect(fs.existsSync(pdfPath)).toBe(true);

    // 2. Start Python HTTP server
    const serverPort = await findFreePort();
    const server = await startPythonHttpServer(tmpDir, serverPort);
    pdfServerUrl = `${server.url}/test-e2e-pdf.pdf`;
    pdfServerProc = server.process;

    // 3. Verify dev server is reachable (with timeout)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(`${DEV_SERVER_URL}/papers`, { signal: controller.signal });
      clearTimeout(timeout);
    } catch {
      // Dev server may not be running — test will fail gracefully later
      console.warn(`[WARN] Dev server not reachable at ${DEV_SERVER_URL}.`);
    }

    // 4. Launch Chromium
    browser = await chromium.launch({
      executablePath: CHROMIUM_EXECUTABLE,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-webgl',
      ],
      headless: true,
      timeout: 30000,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      storageState: {
        cookies: [],
        origins: [{
          origin: DEV_SERVER_URL,
          localStorage: [{ name: 'ars-auth-storage', value: buildFakeAuthStorage() }],
        }],
      },
    });
    const page = await context.newPage();
    pageRef = page;

    // Track console
    consoleMessages = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => consoleMessages.push({ type: 'pageerror', text: err.message }));

    // Read PDF bytes for interception
    const pdfBytes = fs.readFileSync(path.join(tmpDir, 'test-e2e-pdf.pdf'));

    // Intercept /sample.pdf and serve our test PDF
    await page.route('**/sample.pdf', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: pdfBytes,
      });
    });

    // Also intercept any Firebase storage URLs (Papers page hardcodes /sample.pdf)
    await page.route(`${new URL(pdfServerUrl).origin}/**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: pdfBytes,
      });
    });
  }, 60000);

  afterAll(async () => {
    await browser?.close();
    if (pdfServerProc) await stopServer(pdfServerProc);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* EBUSY: dir still open */ }
  });

  it('navigates to /papers and renders the PDF canvas', async () => {
    // Increase test timeout — this test does multiple network + page operations
    //noinspection PointlessBooleanExpressionJS
    expect.getState().testTimeout = 60000;
    if (!pageRef) throw new Error('Browser page not initialized');

    const page = pageRef;

    // Navigate to Papers page
    await page.goto(`${DEV_SERVER_URL}${PAPERS_PATH}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for the table to appear
    await page.waitForSelector('table', { timeout: 10000 });

    // Click the "View" button
    const allButtons = await page.$$('button');
    let clicked = false;
    for (const btn of allButtons) {
      const text = await btn.textContent();
      if (text?.trim().toLowerCase() === 'view') {
        await btn.click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBe(true);

    // Wait for canvas to appear in the modal
    const canvasSelector = '[data-testid="pdf-canvas"]';
    await page.waitForSelector(canvasSelector, { timeout: 20000 });

    // Wait for loading to finish (loading spinner must disappear)
    try {
      await page.waitForSelector('[data-testid="pdf-loading"]', { state: 'hidden', timeout: 15000 });
    } catch {
      // Loading may not appear if PDF loads very fast
    }

    // Wait for rendering badge to disappear
    try {
      await page.waitForSelector('[data-testid="pdf-rendering"]', { state: 'hidden', timeout: 10000 });
    } catch {
      // Rendering badge may not exist
    }

    // Check for error state
    const errorEl = await page.$('[data-testid="pdf-error"]');
    if (errorEl) {
      const errText = await errorEl.textContent();
      console.warn('[PDF ERROR]', errText);
    }

    // ── Canvas pixel analysis ──────────────────────────────────────────────
    const report = await analyzeCanvas(page, canvasSelector);

    console.log('─'.repeat(60));
    console.log(`Canvas dimensions : ${report.width} x ${report.height} px`);
    console.log(`Total pixels     : ${report.totalPixels.toLocaleString()}`);
    console.log(`White pixels     : ${report.whitePixels.toLocaleString()} (${((report.whitePixels / report.totalPixels) * 100).toFixed(2)}%)`);
    console.log(`Non-white pixels : ${report.nonWhitePixels.toLocaleString()} (${((report.nonWhitePixels / report.totalPixels) * 100).toFixed(2)}%)`);
    console.log(`Max RGB values   : R=${report.maxR}, G=${report.maxG}, B=${report.maxB}`);
    console.log(`Is blank?        : ${report.isBlank}`);
    if (report.sampleNonWhite.length > 0) {
      console.log('Sample non-white pixels:', report.sampleNonWhite.slice(0, 5));
    }
    console.log('─'.repeat(60));

    // Assertions
    expect(report.width).toBeGreaterThan(0);
    expect(report.height).toBeGreaterThan(0);

    // The canvas must have non-white pixels — this is the core test
    expect(report.isBlank).toBe(false);
    expect(report.nonWhitePixels).toBeGreaterThan(0);
  });

  it('captures browser console errors for diagnostics', async () => {
    if (!pageRef) return;
    const errors = consoleMessages.filter(
      (m) => m.type === 'error' || m.type === 'pageerror',
    );
    if (errors.length > 0) {
      console.log('Browser errors:', errors.map((m) => m.text.slice(0, 200)));
    }
    // Don't fail on errors — the main test above is the gate
  });
});
