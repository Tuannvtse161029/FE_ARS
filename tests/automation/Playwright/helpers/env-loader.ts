/**
 * Loads `.env.playwright.local` (gitignored) into `process.env` without
 * ever logging the values. Falls back to `.env.playwright.example`
 * for shape documentation only — its values are intentionally empty.
 *
 * Uses `import.meta.url` (ESM) instead of `__dirname` (CommonJS).
 *
 * Call once at the top of `playwright.config.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function loadEnvFile(filePath: string, source: string): void {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Only set when the variable is not already in process.env so the
    // shell-provided value (e.g. CI secret store) wins.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  // Use a flag instead of printing the path; never echo values.
  if (!process.env.__ARS_E2E_ENV_LOADED__) {
    process.env.__ARS_E2E_ENV_LOADED__ = source;
  }
}

const LOCAL = path.join(ROOT, '.env.playwright.local');
const EXAMPLE = path.join(ROOT, '.env.playwright.example');

if (fs.existsSync(LOCAL)) {
  loadEnvFile(LOCAL, 'local');
} else {
  loadEnvFile(EXAMPLE, 'example');
}

export { LOCAL, EXAMPLE };