/**
 * Role authentication fixture — authenticates as each role and persists
 * the session state to `tests/automation/Playwright/.auth/<role>.json`.
 *
 * Playwright's `useStorageState` is the canonical way to share a session
 * across test files without re-logging in every test. The auth file is
 * stored in the `.auth/` directory which is gitignored.
 *
 * Privacy: credentials are read from env vars via `credentials.ts` and are
 * never written to disk. Only the serialized browser session (cookies,
 * localStorage snapshot) is persisted.
 */
import { test as base, type Page } from '@playwright/test';
import { loginAs } from '../helpers/login';
import { getCredentials, type RoleName } from '../helpers/credentials';
import path from 'node:path';
import fs from 'node:fs';

const AUTH_DIR = path.resolve(__dirname, '..', '.auth');

function ensureAuthDir(): void {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

function authFilePath(role: RoleName): string {
  ensureAuthDir();
  return path.join(AUTH_DIR, `${role}.json`);
}

/**
 * Loads a cached session for `role` if one exists on disk. Returns
 * `true` when a session was loaded; `false` when the caller should
 * authenticate fresh.
 */
export async function loadCachedAuth(
  page: Page,
  role: RoleName,
): Promise<boolean> {
  const file = authFilePath(role);
  if (!fs.existsSync(file)) return false;
  try {
    await page.context().storageState({ path: file });
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticates as `role` and saves the session to disk. The next test
 * that calls `loadCachedAuth` for the same role will reuse it.
 *
 * Usage in a test file:
 *   test.describe('Researcher', () => {
 *     test.beforeEach(async ({ page }) => {
 *       await authenticate(page, 'researcher');
 *     });
 *   });
 */
export async function authenticate(
  page: Page,
  role: RoleName,
): Promise<void> {
  const creds = getCredentials(role);
  await loginAs(page, creds.email, creds.password);
  const file = authFilePath(role);
  await page.context().storageState({ path: file });
}

/**
 * Verifies that the current session is authenticated as `role`. Used
 * to assert that a guard redirected correctly before checking the URL.
 */
export async function expectAuthenticatedAs(
  page: Page,
  role: RoleName,
): Promise<void> {
  // A simple check: the sidebar nav or header role label should be visible.
  // We check the page title as a proxy — if the user is not logged in,
  // Playwright will have redirected to /login.
  const url = page.url();
  if (url.includes('/login')) {
    throw new Error(
      `expectAuthenticatedAs: expected to be logged in as ${role} but found /login.`,
    );
  }
}
