/**
 * Sidebar regression for the Graduate Student role.
 *
 * Contract (Agent-12, AGENT_12_GS_NAV_READY):
 *   - Graduate Student sidebar MUST NOT expose `Paper` or `Browse Reviewers`
 *     — those routes are Researcher-only (see App.tsx RoleRouteGuard).
 *   - Graduate Student sidebar MUST retain `Dashboard`, `Research Groups`,
 *     `Submit Report`, and `Premium Package`.
 *   - Researcher sidebar still exposes Paper + Reviewers items.
 *   - Lecturer, Reviewer, Admin sidebars are unchanged by Agent-12.
 *
 * Renders MainLayout behind a MemoryRouter after mocking the hooks it
 * touches (wallet / notifications / reviewer-availability). The hook-mock
 * pattern is borrowed from MainLayout.premiumRoute.test.tsx so the two
 * files share conventions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainLayout } from '../../layouts/MainLayout';
import { ROUTES } from '../../routes/paths';

// ── Hook mocks (avoid hitting wallet / notifications / reviewer BE) ────────
vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    wallet: null,
    balance: null,
    isLoading: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

vi.mock('../../hooks/useReviewerProfiles', () => ({
  useReviewerAvailability: () => ({
    isAvailable: false,
    refetch: () => Promise.resolve(),
  }),
}));

vi.mock('../../services/reviewer.service', () => ({
  reviewerService: {
    updateAvailability: () => Promise.resolve(),
  },
}));

// ── Auth mock — swap role per test ──────────────────────────────────────────
const useAuthMock = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

// Stub the wallet top-up modal so we don't pull its real implementation.
vi.mock('../../components/wallet/WalletTopUpModal', () => ({
  WalletTopUpModal: () => null,
}));

// Authenticated active user helper.
const setupRole = (role: string) => {
  useAuthMock.mockReturnValue({
    user: {
      token: 'mock-token',
      username: 'tester',
      email: 'tester@example.com',
      role,
      userId: 99,
      isActive: true,
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: () => Promise.resolve(),
    logout: () => undefined,
    clearError: () => undefined,
    pendingRoleSelection: null,
    confirmRoleSelection: () => undefined,
    cancelRoleSelection: () => undefined,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  // Clear any persisted ars_user so the admin dual-signal check in
  // MainLayout can't accidentally flip the role to Admin.
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const renderMainLayout = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
    </MemoryRouter>,
  );

const findSidebarLinkByHref = (href: string): HTMLAnchorElement | null =>
  document.querySelector(`aside a[href="${href}"]`);

const findSidebarLinkByText = (label: string): HTMLAnchorElement | null => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const anchors = Array.from(aside.querySelectorAll('a'));
  return (
    anchors.find((a) => (a.textContent ?? '').trim().includes(label)) ??
    null
  );
};

describe('MainLayout — Graduate Student sidebar (AGENT_12_GS_NAV_READY)', () => {
  it('Graduate Student sidebar does NOT expose /papers', () => {
    setupRole('Graduate Student');
    renderMainLayout(ROUTES.FORUM);

    const link = findSidebarLinkByHref(ROUTES.PAPERS);
    expect(link).toBeNull();
  });

  it('Graduate Student sidebar does NOT expose /reviewers', () => {
    setupRole('Graduate Student');
    renderMainLayout(ROUTES.FORUM);

    const link = findSidebarLinkByHref(ROUTES.REVIEWERS);
    expect(link).toBeNull();
  });

  it('Graduate Student sidebar does NOT show "Paper" or "Browse Reviewers" labels anywhere', () => {
    setupRole('Graduate Student');
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByText('Paper')).toBeNull();
    expect(findSidebarLinkByText('Browse Reviewers')).toBeNull();
  });

  it('Graduate Student sidebar retains Dashboard, Research Groups, Submit Report, and Premium Package', () => {
    setupRole('Graduate Student');
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.GRADUATE_STUDENT_DASHBOARD)).not.toBeNull();
    expect(findSidebarLinkByHref(ROUTES.STUDENT_RESEARCH_GROUPS)).not.toBeNull();
    expect(findSidebarLinkByHref(ROUTES.SUBMIT_REPORT)).not.toBeNull();
    expect(findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES)).not.toBeNull();
  });

  it('Graduate Student sidebar still shows Forums', () => {
    setupRole('Graduate Student');
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.FORUM)).not.toBeNull();
  });

  it('Researcher sidebar still exposes /papers and /reviewers links', () => {
    setupRole('Researcher');
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.PAPERS)).not.toBeNull();
    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).not.toBeNull();
    // Researcher uses the singular "Reviewers" label per current MainLayout.
    expect(findSidebarLinkByText('Reviewers')).not.toBeNull();
    expect(findSidebarLinkByText('Paper')).not.toBeNull();
  });

  it('Lecturer sidebar is unchanged — does not expose /papers or /reviewers', () => {
    setupRole('Lecturer');
    renderMainLayout(ROUTES.FORUM);

    // Lecturer never owned Paper/Reviewers; the nav did not add them, and
    // Agent-12 must not silently expand Lecturer scope.
    expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).toBeNull();
  });

  it('Reviewer sidebar is unchanged — does not expose /papers or /reviewers', () => {
    setupRole('Reviewer');
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).toBeNull();
  });

  it('Admin sidebar is unchanged — does not expose /papers or /reviewers', () => {
    setupRole('Admin');
    renderMainLayout(ROUTES.ADMIN);

    expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).toBeNull();
    // And the legacy admin packages link still resolves.
    expect(findSidebarLinkByHref(ROUTES.ADMIN_PACKAGES)).not.toBeNull();
  });
});
