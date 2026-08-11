// pdf-e2e-test.mjs — Standalone Playwright PDF canvas pixel test
// Run: node pdf-e2e-test.mjs

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';
import { spawn } from 'child_process';

const DEV_SERVER_URL = 'http://localhost:3000';
const PAPERS_PATH = '/papers';
const CHROMIUM_EXECUTABLE =
  'C:\\Users\\admin\\AppData\\Local\\Temp\\cursor-sandbox-cache\\a265ad8c4357be91bc06caefbb9f874a\\playwright\\chromium-1234\\chrome-win64\\chrome.exe';

async function findFreePort() {
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

async function startPythonHttpServer(dir, port) {
  return new Promise((resolve) => {
    const proc = spawn(
      'python',
      ['-m', 'http.server', String(port)],
      { cwd: dir, stdio: 'ignore', shell: true }
    );
    setTimeout(() => resolve({ url: `http://localhost:${port}`, process: proc }), 800);
  });
}

async function generateTestPdf(tmpDir) {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 300]);

  page.drawRectangle({ x: 0, y: 0, width: 400, height: 300, color: rgb(0.95, 0.97, 1.0) });
  page.drawRectangle({ x: 15, y: 15, width: 370, height: 270, borderColor: rgb(0.2, 0.4, 0.8), borderWidth: 2 });
  page.drawCircle({ x: 100, y: 180, size: 50, color: rgb(0.85, 0.15, 0.15) });
  page.drawRectangle({ x: 230, y: 140, width: 120, height: 80, color: rgb(0.15, 0.75, 0.2) });
  page.drawRectangle({ x: 30, y: 40, width: 90, height: 55, color: rgb(0.95, 0.55, 0.1) });

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.drawText('E2E Test Page', { x: 140, y: 258, size: 13, font: helveticaBold, color: rgb(0.05, 0.15, 0.45) });
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('Canvas should show colored shapes, not all-white.', { x: 55, y: 50, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(tmpDir, 'test.pdf');
  fs.writeFileSync(filePath, Buffer.from(pdfBytes));
  return filePath;
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-e2e-'));

console.log('═'.repeat(60));
console.log('  PdfViewer E2E — Canvas Pixel Analysis Test');
console.log('═'.repeat(60));

// 1. Generate PDF
const pdfPath = await generateTestPdf(tmpDir);
console.log('[1] Test PDF written to:', pdfPath);

// 2. Start server
const port = await findFreePort();
const server = await startPythonHttpServer(tmpDir, port);
console.log(`[2] HTTP server on port ${port}:`);

// 3. Launch Chromium
console.log('[3] Launching Chromium...');
const browser = await chromium.launch({
  executablePath: CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  headless: true,
});
console.log('  ✓ Chromium launched');

const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});

// Inject auth into localStorage BEFORE the page loads, synchronously.
// This runs before any JS so Zustand persist picks it up immediately.
await context.addInitScript(`
  const authState = {
    state: {
      user: { id: 1, username: 'tester', email: 't@t.com', fullName: 'Tester', roleId: 3, roleName: 'Researcher' },
      token: 'fake-jwt',
      isAuthenticated: true,
      isLoading: false
    },
    version: 0
  };
  window.localStorage.setItem('ars-auth-storage', JSON.stringify(authState));
`);

const page = await context.newPage();

const consoleMessages = [];
page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', err => consoleMessages.push({ type: 'pageerror', text: err.message }));

const pdfBytes = fs.readFileSync(pdfPath);
await page.route('**/sample.pdf', route => {
  route.fulfill({
    status: 200, contentType: 'application/pdf',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: pdfBytes,
  });
});

// 4. Navigate to Papers
console.log('[4] Navigating to /papers...');
await page.goto(`${DEV_SERVER_URL}${PAPERS_PATH}`, { waitUntil: 'networkidle', timeout: 30000 });
console.log('  ✓ Page loaded');

// 5. Click View button
console.log('[5] Clicking View button...');
const buttons = await page.$$('button');
let clicked = false;
for (const btn of buttons) {
  const txt = (await btn.textContent())?.trim().toLowerCase();
  if (txt === 'view') {
    await btn.click();
    clicked = true;
    break;
  }
}
console.log(clicked ? '  ✓ View button clicked' : '  ✗ No View button found');

// 6. Wait for canvas
console.log('[6] Waiting for canvas...');
const canvasSelector = '[data-testid="pdf-canvas"]';
try {
  await page.waitForSelector(canvasSelector, { timeout: 20000 });
  console.log('  ✓ Canvas found');
} catch (e) {
  console.error('  ✗ Canvas never appeared');
  await page.screenshot({ path: path.join(tmpDir, 'no-canvas.png') });
  await browser.close();
  process.exit(2);
}

// Wait for loading to finish
try {
  await page.waitForSelector('[data-testid="pdf-loading"]', { state: 'hidden', timeout: 15000 });
  console.log('  ✓ Loading hidden');
} catch {
  console.log('  (no loading element or still loading)');
}

// Check for error
const errorEl = await page.$('[data-testid="pdf-error"]');
if (errorEl) {
  const errText = await errorEl.textContent();
  console.log('  ✗ PDF ERROR shown:', errText);
}

// 7. Analyze canvas
console.log('[7] Analyzing canvas pixels...');
const report = await page.evaluate((sel) => {
  const canvas = document.querySelector(sel);
  if (!canvas) throw new Error('No canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  const w = canvas.width, h = canvas.height;
  if (w === 0 || h === 0) return { error: 'Zero dim', width: w, height: h };

  const id = ctx.getImageData(0, 0, w, h);
  const data = id.data;
  let white = 0, nonWhite = 0;
  const samples = [];
  let maxR = 0, maxG = 0, maxB = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
    if (r > 240 && g > 240 && b > 240 && a > 200) {
      white++;
    } else {
      nonWhite++;
      if (samples.length < 20) samples.push({ r, g, b, a });
      if (r > maxR) maxR = r;
      if (g > maxG) maxG = g;
      if (b > maxB) maxB = b;
    }
  }

  return {
    width: w, height: h,
    total: data.length / 4,
    white, nonWhite, isBlank: nonWhite === 0,
    maxR, maxG, maxB,
    samples,
  };
}, canvasSelector);

console.log('─'.repeat(60));
console.log('  CANVAS REPORT');
console.log('─'.repeat(60));
if (report.error) {
  console.log('  Error:', report.error);
  console.log('  Dimensions:', report.width, 'x', report.height);
} else {
  console.log(`  Dimensions: ${report.width} x ${report.height}`);
  console.log(`  Total pixels: ${report.total.toLocaleString()}`);
  console.log(`  White: ${report.white.toLocaleString()} (${(report.white / report.total * 100).toFixed(2)}%)`);
  console.log(`  Non-white: ${report.nonWhite.toLocaleString()} (${(report.nonWhite / report.total * 100).toFixed(2)}%)`);
  console.log(`  Max RGB: R=${report.maxR}, G=${report.maxG}, B=${report.maxB}`);
  console.log(`  Is blank: ${report.isBlank}`);
  console.log('  Samples:', report.samples.slice(0, 5));
}
console.log('─'.repeat(60));

// Save screenshot
const screenshot = path.join(tmpDir, 'final.png');
await page.screenshot({ path: screenshot });
console.log('  Screenshot:', screenshot);

// Show errors
const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror');
if (errors.length > 0) {
  console.log('\n  BROWSER ERRORS:');
  errors.slice(0, 10).forEach(m => console.log(`    [${m.type}] ${m.text.slice(0, 300)}`));
}

const finalResult = report.error ? 'FAIL — ' + report.error :
  report.isBlank ? 'FAIL — Canvas is blank' :
  'PASS';

console.log('\n' + '='.repeat(60));
console.log('  RESULT:', finalResult);
console.log('='.repeat(60));

await browser.close();
server.process.kill();
fs.rmSync(tmpDir, { recursive: true, force: true });
