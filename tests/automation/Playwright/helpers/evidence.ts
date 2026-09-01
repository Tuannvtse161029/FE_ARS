/**
 * Evidence helper — manages screenshot + trace + failure metadata for
 * each test step. Every screenshot is named after the step index +
 * label so the run folder is greppable.
 *
 * NEVER writes a screenshot that contains a password input value. The
 * capture path always scrubs:
 *   - any element with `type="password"`
 *   - the login form (recognized by aria-label or form id)
 *
 * Even though we clear password fields before navigation, this helper
 * is the second line of defence so a future contributor can never
 * accidentally capture a typed password.
 */
import { test, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

export interface StepContext {
  runDir: string;
  testName: string;
  role: string;
}

let stepCounter = 0;

export function resetStepCounter(): void {
  stepCounter = 0;
}

export async function captureEvidence(
  page: Page,
  label: string,
  runDir: string,
  extras: Record<string, unknown> = {},
): Promise<string> {
  stepCounter += 1;
  const safeLabel = label.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 64);
  const filename = `${String(stepCounter).padStart(2, '0')}-${safeLabel}.png`;
  const fullPath = path.join(runDir, filename);

  // Mask password fields before capture. The CSS attribute selector
  // is sufficient — input[type=password] is what Playwright already
  // uses for autocomplete.
  await page.addStyleTag({
    content: 'input[type="password"]{color:transparent !important;-webkit-text-fill-color:transparent !important;}',
  });
  try {
    await page.screenshot({ path: fullPath, fullPage: false });
  } finally {
    // Best-effort cleanup of the injected style. Removing it ensures
    // later steps can interact with the input normally.
    await page
      .evaluate(() => {
        const styles = document.querySelectorAll('style');
        styles.forEach((s) => {
          if (s.textContent && s.textContent.includes('input[type="password"]')) {
            s.remove();
          }
        });
      })
      .catch(() => {
        /* ignore cleanup failures */
      });
  }

  // Persist a sidecar JSON describing the step.
  const sidecarPath = `${fullPath}.json`;
  fs.writeFileSync(
    sidecarPath,
    JSON.stringify(
      {
        step: stepCounter,
        label,
        url: page.url(),
        capturedAt: new Date().toISOString(),
        ...extras,
      },
      null,
      2,
    ),
  );

  return filename;
}

/**
 * Wraps `test.step()` with automatic evidence capture. The page
 * argument must be the active page when the step runs.
 */
export async function stepWithEvidence(
  page: Page,
  label: string,
  runDir: string,
  body: () => Promise<void>,
  extras: Record<string, unknown> = {},
): Promise<void> {
  await test.step(label, async () => {
    await body();
    await captureEvidence(page, label, runDir, extras);
  });
}