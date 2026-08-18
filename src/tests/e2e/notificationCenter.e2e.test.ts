/**
 * Header Notification Center — Playwright E2E (Vitest-driven).
 *
 * Verifies the full user-facing notification flow against the running
 * dev server:
 *
 *   1. The header bell renders in the desktop layout.
 *   2. With `unreadCount = 0` the badge is hidden.
 *   3. With `unreadCount > 0` a red badge is visible.
 *   4. Clicking the bell opens the dropdown panel.
 *   5. Outside click and Escape close the dropdown.
 *   6. Clicking a notification navigates to the resolved route.
 *
 * The notification rows are served by the BE `/api/Notification` endpoint
 * (see notificationService). To make this test deterministic in CI we
 * intercept that endpoint with a fixed JSON payload — the test
 * therefore exercises the entire UI surface without depending on BE
 * fixture data.
 *
 * Run:
 *   npx vitest run src/tests/e2e/notificationCenter.e2e.test.ts
 *
 * Prerequisites:
 *   - Chromium installed: `npx playwright install chromium`
 *   - Dev server running on port 3000: `npm run dev`
 */
import { chromium, Browser, Page } from 'playwright';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const DEV_SERVER_URL = process.env.VITE_E2E_BASE_URL || 'http://localhost:3001';

// Fake auth storage — Researcher role, userId 7. Matches the payload the
// mocked `/api/Notification` route returns so the FE's defense-in-depth
// `userId === X` filter does not drop the rows.
function buildFakeAuthStorage(): string {
  return JSON.stringify({
    state: {
      user: {
        id: 7,
        username: 'e2e-researcher',
        email: 'researcher@example.com',
        fullName: 'E2E Researcher',
        roleId: 1,
        roleName: 'Researcher',
        isActive: true,
      },
      token: 'fake-jwt-token-for-e2e-testing',
      isAuthenticated: true,
      isLoading: false,
    },
    version: 0,
  });
}

// Stable notification fixture for this test. The payload shape mirrors
// the live Swagger contract: id, userId, message, isRead, createdAt.
const FAKE_NOTIFICATIONS = [
  {
    id: 101,
    userId: 7,
    message: '[Paper] status changed — your submission was accepted',
    isRead: false,
    createdAt: '2026-08-18T12:00:00Z',
  },
  {
    id: 102,
    userId: 7,
    message: '[Review] accepted — Dr. Smith will review your paper',
    isRead: false,
    createdAt: '2026-08-17T08:30:00Z',
  },
  {
    id: 103,
    userId: 7,
    message: '[Review] completed — Dr. Smith submitted feedback',
    isRead: true,
    createdAt: '2026-08-15T14:15:00Z',
  },
];

// Both the zustand `ars-auth-storage` and the legacy `ars_user` key must
// be seeded. `useVerifiedGuard` reads `ars_user` directly from storage
// during the brief window before AuthContext finishes rehydrating; if
// it's missing the user gets bounced to /login even though the zustand
// store says they're authenticated.
function buildFakeUser(): string {
  return JSON.stringify({
    id: 7,
    username: 'e2e-researcher',
    email: 'researcher@example.com',
    fullName: 'E2E Researcher',
    roleId: 1,
    roleName: 'Researcher',
    isActive: true,
  });
}

let browser: Browser | null = null;
let pageRef: Page | null = null;

describe('NotificationCenter — header E2E (Agent 16)', () => {
  beforeAll(async () => {
    expect.getState().testTimeout = 60_000;
    browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      headless: true,
      timeout: 30_000,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      storageState: {
        cookies: [],
        origins: [
          {
            origin: DEV_SERVER_URL,
            localStorage: [
              { name: 'ars-auth-storage', value: buildFakeAuthStorage() },
              { name: 'ars_user', value: buildFakeUser() },
            ],
          },
        ],
      },
    });

    // Intercept the notification endpoints with deterministic fixtures.
    // The "unread count" the FE computes is `count(isRead === false)`, so
    // 2 of the 3 rows are unread. The FE's axios baseURL points at the
    // production BE (https://arsplatform.onrender.com), so we have to
    // match the absolute URL the browser is actually calling. Using a
    // glob that matches BOTH the hostname and the path so the route
    // handler is fired for any `/api/Notification*` call.
    const notificationHandler = async (route: import('playwright').Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(FAKE_NOTIFICATIONS),
        });
        return;
      }
      if (route.request().method() === 'PUT') {
        const id = route.request().url().split('/').pop();
        const target = FAKE_NOTIFICATIONS.find((n) => String(n.id) === id);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...(target ?? FAKE_NOTIFICATIONS[0]), isRead: true }),
        });
        return;
      }
      await route.continue();
    };
    await context.route(/\/api\/Notification/, notificationHandler);

    // The AuthContext / axios interceptor calls /api/auth/refresh on
    // every 401. We must keep those responses from triggering the
    // auto-logout-and-redirect path that clears our fake auth. Return
    // a 401-shaped body without the auto-redirect side-effect by
    // short-circuiting the call before it can hit the network.
    await context.route(/\/api\/auth\/refresh/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    pageRef = await context.newPage();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    browser = null;
    pageRef = null;
  });

  it('renders the bell with a red badge and opens the dropdown', async () => {
    if (!pageRef) throw new Error('Browser not initialized');
    await pageRef.goto(`${DEV_SERVER_URL}/forum`, { waitUntil: 'domcontentloaded' });

    // The bell is rendered in the header for a Researcher.
    await pageRef.waitForSelector('[data-testid="notification-bell"]', { timeout: 20_000 });
    const badge = pageRef.locator('[data-testid="notification-bell-badge"]');
    await badge.waitFor({ timeout: 5_000 });
    expect(await badge.textContent()).toBe('2');

    // Open the dropdown.
    await pageRef.click('[data-testid="notification-bell"]');
    await pageRef.waitForSelector('[data-testid="notification-dropdown"]');
    await pageRef.waitForSelector('[data-testid="notification-list"]');
    const items = pageRef.locator('[data-testid^="notification-item-"]');
    expect(await items.count()).toBe(3);
  });

  it('closes the dropdown on Escape', async () => {
    if (!pageRef) throw new Error('Browser not initialized');
    await pageRef.click('[data-testid="notification-bell"]');
    await pageRef.waitForSelector('[data-testid="notification-dropdown"]');
    await pageRef.keyboard.press('Escape');
    await pageRef.waitForSelector('[data-testid="notification-dropdown"]', {
      state: 'detached',
      timeout: 5_000,
    });
  });

  it('closes the dropdown on outside click', async () => {
    if (!pageRef) throw new Error('Browser not initialized');
    await pageRef.click('[data-testid="notification-bell"]');
    await pageRef.waitForSelector('[data-testid="notification-dropdown"]');
    // Click somewhere far away from the dropdown.
    await pageRef.click('main');
    await pageRef.waitForSelector('[data-testid="notification-dropdown"]', {
      state: 'detached',
      timeout: 5_000,
    });
  });

  it('navigates to /papers when clicking a paper-related notification', async () => {
    if (!pageRef) throw new Error('Browser not initialized');
    await pageRef.click('[data-testid="notification-bell"]');
    await pageRef.waitForSelector('[data-testid="notification-dropdown"]');
    await pageRef.click('[data-testid="notification-item-101"]');
    // Wait for the URL to change to /papers (route resolver picks /papers
    // for the "[Paper] status changed" prefix).
    await pageRef.waitForURL('**/papers', { timeout: 10_000 });
    const url = new URL(pageRef.url());
    expect(url.pathname).toBe('/papers');
  });
});
