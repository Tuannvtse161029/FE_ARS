/**
 * Researcher → Reviewer E2E flow helpers.
 *
 * Shared by `researcherReviewerMainFlow.spec.ts`. Centralizes:
 *  - Unique paper title generation
 *  - Existing safe PDF fixture selection (from src/tests/fixtures/)
 *  - Login + role selection modal handling
 *  - Logout (clear localStorage + sessionStorage)
 *  - Wallet-balance capture (does not assert — read-only)
 *  - PdfViewer canvas-render wait
 *
 * NEVER prints password / token values. Env credentials are passed in via the
 * spec; this file does not call `process.env.X` at evaluation time so the helper
 * stays portable across CI configs.
 */

import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of `__dirname` for the helpers/ subdirectory.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The Researcher/Reviewer accounts are NOT seeded in production. The FE uses
 * `input[name="username"]` for the email field (see Login.tsx) and the BE
 * wires the email via `auth.service.ts` `login({ email, password })`. So we
 * fill `input[name="username"]` with the email.
 */
export const USERNAME_INPUT = 'input[name="username"], input[name="email"]';
export const PASSWORD_INPUT = 'input[name="password"], input[type="password"]';
export const SIGN_IN_BUTTON = 'button[type="submit"]:has-text("Sign in")';

export interface PdfFixture {
  /** Absolute path to a copy of the PDF on disk (Playwright `setInputFiles`). */
  tmpPath: string;
  /** Human-readable filename, including `.pdf` extension. */
  fileName: string;
}

export function makeUniquePaperTitle(): string {
  return `ARS-E2E Main Review Flow ${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}`;
}

/**
 * Reads the FIRST `*.pdf` from `src/tests/fixtures/` (already used by other
 * E2E files — researcherUpload.e2e.test.ts uses `getRandomPdfFile()` from
 * `src/assets/pdf_sample/` but those files are academic arXiv copies and too
 * heavy; the fixture dir holds 3 small PDFs totaling ~8 KB which is plenty
 * for an intercepted Playwright session).
 *
 * Copies the fixture into a deterministic tmp path so Playwright can attach
 * it to a hidden file input. Returns both `tmpPath` (absolute, ephemeral)
 * and `fileName` (the original name, suitable for `setInputFiles`).
 */
export function pickSafePdfFixture(): PdfFixture {
  // helpers/ → e2e/ → tests/ → fixtures/
  const fixtureDir = path.resolve(
    __dirname,
    '..',
    '..',
    'fixtures',
  );
  if (!fs.existsSync(fixtureDir)) {
    throw new Error(
      `[researcherReviewerFlow] fixtures directory missing: ${fixtureDir}`,
    );
  }
  const pdfs = fs
    .readdirSync(fixtureDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (pdfs.length === 0) {
    throw new Error(
      `[researcherReviewerFlow] no PDF fixtures found in ${fixtureDir}`,
    );
  }
  // Deterministic: take the smallest fixture so the upload is fast.
  const sorted = pdfs
    .map((f) => ({ f, size: fs.statSync(path.join(fixtureDir, f)).size }))
    .sort((a, b) => a.size - b.size);
  const chosen = sorted[0]!.f;
  const src = path.join(fixtureDir, chosen);
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ars-revrev-'),
  );
  const tmpPath = path.join(tmpDir, chosen);
  fs.copyFileSync(src, tmpPath);
  return { tmpPath, fileName: chosen };
}

/**
 * Submits the login form and, if a multi-role selection modal appears, picks
 * the requested role. Reads `localStorage.ars_user` afterwards to confirm the
 * active role was persisted.
 */
export async function signInAs(
  page: Page,
  email: string,
  password: string,
  expectedRole: string,
): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 45_000 });
  // Wait for the Login form to render. The custom <Input> component renders a
  // native <input> with `name="username"`; the Fast Login buttons also exist
  // even before any data is loaded. Either of these arriving means the React
  // tree is mounted.
  await page.waitForSelector(
    'input[name="username"], input[name="email"], button:has-text("Sign in")',
    { timeout: 45_000 },
  );
  await page.fill(USERNAME_INPUT, email);
  await page.fill(PASSWORD_INPUT, password);
  await Promise.all([
    page
      .waitForURL((u) => !/\/login\b/.test(u.pathname), { timeout: 25_000 })
      .catch(() => undefined),
    page.click(SIGN_IN_BUTTON),
  ]);

  // Multi-role modal: click the radio matching `expectedRole` then "Continue"
  const modalTitle = page.locator(
    '[role="dialog"][aria-labelledby="role-selection-title"]',
  );
  const modalOpen = await modalTitle.isVisible().catch(() => false);
  if (modalOpen) {
    const radio = modalTitle
      .locator(`input[type="radio"][value="${expectedRole}"]`)
      .first();
    if (await radio.isVisible().catch(() => false)) {
      await radio.check().catch(() => undefined);
    }
    const continueBtn = modalTitle.locator(
      `button:has-text("Continue as")`,
    );
    await continueBtn.click({ timeout: 5_000 }).catch(() => undefined);
    // Wait for the modal to disappear before continuing.
    await modalTitle.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
  }

  // Verify the user record in localStorage reflects the role. If the user was
  // already single-role Researcher/Reviewer, `ars_user` is set; if the modal
  // was needed, it was set on continue. If neither happened, throw — the test
  // body needs a confirmed auth state.
  await page.waitForFunction(
    (role: string) => {
      try {
        const raw = localStorage.getItem('ars_user');
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { roleName?: string };
        return parsed.roleName === role;
      } catch {
        return false;
      }
    },
    expectedRole,
    { timeout: 10_000 },
  );
}

/**
 * Clears both localStorage and sessionStorage of any `ars_*` keys, then visits
 * `/login`. We do NOT call `authService.logout()` from JS because Playwright
 * already has direct DOM access — clearing the persisted buckets is enough to
 * drop auth state and bounce the route guard.
 */
export async function signOut(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      const lsKeys = Object.keys(localStorage).filter((k) =>
        k.startsWith('ars_'),
      );
      lsKeys.forEach((k) => localStorage.removeItem(k));
      const ssKeys = Object.keys(sessionStorage).filter((k) =>
        k.startsWith('ars_'),
      );
      ssKeys.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
}

/**
 * Captures whatever wallet balance the UI is showing. This is a passive read —
 * the test never asserts on it because the 25,000 VND system fee is OUT OF
 * SCOPE per the user-confirmed financial-safety override. We still surface the
 * value to the test log for forensics.
 */
export async function recordWalletBeforeSubmit(
  page: Page,
): Promise<{ raw: string | null }> {
  const bodyText = await page.textContent('body').catch(() => '');
  const match = bodyText?.match(/([\d.,]+)\s*VND/);
  return { raw: match ? match[0] : null };
}

/**
 * Waits for the PdfViewer `<canvas>` to render with non-zero dimensions. The
 * `data-testid="pdf-canvas"` selector is set by `PdfViewer.tsx`. The check
 * avoids a race where Playwright sees the canvas in the DOM before the first
 * `page.render()` call finishes.
 */
export async function waitForCanvasRenders(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="pdf-canvas"]', { timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const c = document.querySelector(
        '[data-testid="pdf-canvas"]',
      ) as HTMLCanvasElement | null;
      return Boolean(c && c.width > 0 && c.height > 0);
    },
    undefined,
    { timeout: 20_000 },
  );
}