import { describe, it, expect, vi, beforeEach } from 'vitest';
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
/**
 * Sidebar regression for the Graduate Student role.
 *
 * Contract (updated for the ARS Research Journey navigation):
 *   - Graduate Student sidebar MUST NOT expose `Paper` or `Browse Reviewers`
 *     — those routes are Researcher-only (see App.tsx RoleRouteGuard).
 *   - Graduate Student sidebar exposes its existing `Research Journey` route,
 *     `Research Groups`, and `Submit Report`.
 *   - Researcher sidebar still exposes its submissions route.
 *   - Lecturer, Reviewer, and Admin sidebars remain role-specific.
 *
 * Uses the shared `renderMainLayout` test harness so hook mocks and helpers
 * aren't duplicated from the other MainLayout tests.
 */
import { describe, it, expect } from 'vitest';

describe('MainLayout — Graduate Student sidebar (AGENT_12_GS_NAV_READY)', () => {
  it('Graduate Student sidebar does NOT expose /papers', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
  });

  it('Graduate Student sidebar does NOT expose /reviewers', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).toBeNull();
  });

  it('Graduate Student sidebar does NOT show "Paper" or "Browse Reviewers" labels anywhere', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByText('Paper')).toBeNull();
    expect(findSidebarLinkByText('Browse Reviewers')).toBeNull();
  });

  it('Graduate Student sidebar retains Research Groups and Submit Report', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.STUDENT_RESEARCH_GROUPS)).not.toBeNull();
    expect(findSidebarLinkByHref(ROUTES.SUBMIT_REPORT)).not.toBeNull();
  });

  it('Graduate Student sidebar exposes the existing Research Journey workspace', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.GRADUATE_STUDENT_DASHBOARD)).not.toBeNull();
    expect(findSidebarLinkByText('Research Journey')).not.toBeNull();
  });

  it('Graduate Student sidebar still shows Forums', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.FORUM)).not.toBeNull();
  });

  it('Researcher sidebar still exposes its submissions link', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.RESEARCHER_SUBMISSIONS)).not.toBeNull();
    expect(findSidebarLinkByText('My Research Papers')).not.toBeNull();
  });

  it('Lecturer sidebar is unchanged — does not expose /papers or /reviewers', () => {
    setMockAuth({ role: 'Lecturer' });
    renderMainLayout(ROUTES.FORUM);

    // Lecturer never owned Paper/Reviewers; the nav did not add them, and
    // Agent-12 must not silently expand Lecturer scope.
    expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).toBeNull();
  });

  it('Reviewer sidebar is unchanged — does not expose /papers or /reviewers', () => {
    setMockAuth({ role: 'Reviewer' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).toBeNull();
  });

  it('Admin sidebar is unchanged — does not expose /papers or /reviewers', () => {
    setMockAuth({ role: 'Admin', roleId: 2 });
    renderMainLayout(ROUTES.ADMIN);

    expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).toBeNull();
    // And the legacy admin packages link still resolves.
    expect(findSidebarLinkByHref(ROUTES.ADMIN_PACKAGES)).not.toBeNull();
  });
});

import { ROUTES } from '../../../src/routes/paths';
