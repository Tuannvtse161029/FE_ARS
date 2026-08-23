// Replace the helper-based imports and setupMainLayoutMocks() call with
// top-level vi.mock factories + a local `renderMainLayout` / `setMockAuth` /
// DOM-query helpers. We apply this transformation to the five test files
// that previously imported from `../../../src/utils/renderMainLayout`.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || '.';
const TESTS = [
  'tests/unit/layouts/MainLayout.guestSidebar.test.tsx',
  'tests/unit/layouts/MainLayout.graduateStudentNav.test.tsx',
  'tests/unit/layouts/MainLayout.premiumRoute.test.tsx',
  'tests/unit/layouts/MainLayout.notificationCenter.test.tsx',
];

const SENTINEL = '// ── Standard MainLayout test mock surface (CORE_KEEP) ──';

const HEAD = `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Standard MainLayout test mock surface (CORE_KEEP: sidebar/header/wallet) ──
const useAuthMockLocal = vi.fn();

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => useAuthMockLocal(),
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: (selector: unknown) =>
    typeof selector === 'function'
      ? selector({ user: null, isAuthenticated: false })
      : { user: null, isAuthenticated: false },
}));

vi.mock('../../../src/hooks/useWallet', () => ({
  useWallet: () => ({
    wallet: null,
    balance: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../../src/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
    markRead: () => Promise.resolve(true),
    markAllRead: () => Promise.resolve([]),
    reset: () => undefined,
  }),
  useMarkNotificationRead: () => ({
    markRead: () => Promise.resolve(true),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../../src/hooks/useReviewerProfiles', () => ({
  useReviewerAvailability: () => ({
    isAvailable: false,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../../src/services/reviewer.service', () => ({
  reviewerService: { updateAvailability: () => Promise.resolve() },
}));

vi.mock('../../../src/components/wallet/WalletTopUpModal', () => ({
  WalletTopUpModal: () => null,
}));

import { buildMockAuth } from '../../../src/utils/mockAuth';
import { MainLayout } from '../../../src/layouts/MainLayout';

beforeEach(() => {
  useAuthMockLocal.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const setMockAuth = (opts: Parameters<typeof buildMockAuth>[0] = {}) => {
  useAuthMockLocal.mockReturnValue(buildMockAuth(opts));
};

const renderMainLayout = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
    </MemoryRouter>,
  );

const findSidebarLinkByHref = (href: string): HTMLAnchorElement | null => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const anchors = aside.querySelectorAll('a');
  for (const a of Array.from(anchors)) {
    if (a.getAttribute('href') === href) return a as HTMLAnchorElement;
  }
  return null;
};

const findSidebarLinkByText = (text: string): HTMLAnchorElement | null => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const lower = text.toLowerCase();
  const anchors = aside.querySelectorAll('a');
  for (const a of Array.from(anchors)) {
    const t = (a.textContent ?? '').toLowerCase();
    if (t.includes(lower)) return a as HTMLAnchorElement;
  }
  return null;
};
`;

let changed = 0;
let skipped = 0;

const importRe = new RegExp(
  String.raw`import\s*\{\s*([^}]*)\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/src\/utils\/renderMainLayout['"];?`,
);

for (const rel of TESTS) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    skipped++;
    continue;
  }
  let content = fs.readFileSync(full, 'utf8');
  if (content.includes(SENTINEL)) {
    skipped++;
    continue;
  }
  // Strip the helper import.
  content = content.replace(importRe, '');

  // Strip the helper setup() call.
  content = content.replace(/^setupMainLayoutMocks\(\);\s*\n/m, '');

  // Strip the leftover `import { ROUTES } ...` when needed (replace with our own).
  content = content.replace(
    /^import\s*\{\s*ROUTES\s*\}\s*from\s*['"][^'"]+['"];?\s*\n/m,
    '',
  );

  // Drop `import { render, screen }` since we import render + screen ourselves.
  content = content.replace(
    /^import\s*\{\s*render\s*\}(,\s*\{\s*screen\s*\})?\s*from\s*['"]@testing-library\/react['"];?\s*\n/m,
    '',
  );

  // Prepend the standard mock block + helpers.
  content = HEAD + content + '\n';

  // Add a final ROUTES import line if the test references ROUTES (the body still does).
  if (/ROUTES\.[A-Z_]/.test(content) && !content.includes('from \'../../../src/routes/paths\'')) {
    content += "import { ROUTES } from '../../../src/routes/paths';\n";
  }

  fs.writeFileSync(full, content, 'utf8');
  changed++;
  // eslint-disable-next-line no-console
  console.log(`transformed: ${rel}`);
}

// eslint-disable-next-line no-console
console.log(`\nDone. Patched ${changed}, skipped ${skipped}.`);
