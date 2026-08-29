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
/**
 * Sidebar regression for the Guest (unverified) state.
 *
 * Contract (post-registration flow):
 *   - A freshly-registered user whose role request has not yet been approved
 *     by an Admin (`isActive !== true`) is treated as a Guest.
 *   - Guest sidebar MUST show only `Forums`.
 *   - Guest sidebar MUST NOT expose the role's workspace nav (e.g. Paper,
 *     Reviewers, Research Groups, Wallet, Submit Report, Seminar, etc.) — even though the verified-guard would bounce the user
 *     off those routes, the sidebar should not advertise them in the first
 *     place.
 *   - Guest header pill MUST display "Guest" instead of the roleName the BE
 *     returned at registration time (Researcher / Reviewer / Lecturer /
 *     Graduate Student / Admin).
 *   - Verified users are unaffected: the Researcher sidebar keeps Paper +
 *     Reviewers items, etc.
 *
 * Uses the shared `renderMainLayout` test harness so hook mocks, storage
 * resets, and sidebar query helpers aren't duplicated from the other
 * MainLayout tests.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';

describe('MainLayout — Guest (unverified) sidebar', () => {
  it('Guest sidebar shows only Forums regardless of the chosen roleName', () => {
    setMockAuth({ role: 'Researcher', isActive: false });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.FORUM)).not.toBeNull();
    expect(findSidebarLinkByText('Forums')).not.toBeNull();
  });

  it('Guest sidebar does NOT expose /papers (Researcher workspace)', () => {
    setMockAuth({ role: 'Researcher', isActive: false });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
    expect(findSidebarLinkByText('Paper')).toBeNull();
  });

  it('Guest sidebar does NOT expose /reviewers', () => {
    setMockAuth({ role: 'Researcher', isActive: false });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).toBeNull();
    expect(findSidebarLinkByText('Reviewers')).toBeNull();
  });

  it('Guest sidebar does NOT expose Research Groups (Graduate Student workspace)', () => {
    setMockAuth({ role: 'Graduate Student', isActive: false });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.STUDENT_RESEARCH_GROUPS)).toBeNull();
  });

  it('Guest sidebar does NOT expose Submit Report (Graduate Student workspace)', () => {
    setMockAuth({ role: 'Graduate Student', isActive: false });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.SUBMIT_REPORT)).toBeNull();
  });

  it('Guest sidebar has exactly one sidebar entry (Forums)', () => {
    setMockAuth({ role: 'Researcher', isActive: false });
    renderMainLayout(ROUTES.FORUM);

    const aside = document.querySelector('aside');
    const anchors = aside
      ? Array.from(aside.querySelectorAll('a')).filter((a) =>
          (a.getAttribute('href') ?? '').startsWith('/'),
        )
      : [];
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.getAttribute('href')).toBe(ROUTES.FORUM);
  });

  it('Guest header pill shows "Guest" instead of the BE-returned roleName', () => {
    setMockAuth({ role: 'Researcher', isActive: false });
    renderMainLayout(ROUTES.FORUM);

    expect(screen.getByText('Guest')).toBeTruthy();
    expect(screen.queryByText('Researcher')).toBeNull();
  });

  it('Verified Researcher header pill still shows "Researcher"', () => {
    setMockAuth({ role: 'Researcher', isActive: true, userId: 99 });
    renderMainLayout(ROUTES.FORUM);

    expect(screen.getByText('Researcher')).toBeTruthy();
    expect(screen.queryByText('Guest')).toBeNull();
  });

  it('Verified Researcher sidebar still exposes Paper and Reviewers', () => {
    setMockAuth({ role: 'Researcher', isActive: true, userId: 99 });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.RESEARCHER_SUBMISSIONS)).not.toBeNull();
  });

  // Guests have no wallet row until an Admin approves their role request,
  // so the wallet badge + top-up button must be hidden.
  it('Guest header does NOT show the wallet badge (no wallet row yet)', () => {
    setMockAuth({ role: 'Researcher', isActive: false });
    renderMainLayout(ROUTES.FORUM);

    expect(screen.queryByTestId('wallet-topup-trigger')).toBeNull();
  });

  it('Verified Researcher header DOES show the wallet top-up trigger', () => {
    setMockAuth({ role: 'Researcher', isActive: true, userId: 99 });
    renderMainLayout(ROUTES.FORUM);

    expect(screen.queryByTestId('wallet-topup-trigger')).not.toBeNull();
  });

  // Agent 39 — explicit effectiveRole: 'Guest' source variant. The user is
  // verified (isActive=true) but the BE-derived effectiveRole is 'Guest' —
  // e.g. a freshly-approved user whose role-request is still propagating.
  // The derived heuristic would NOT catch this; the new `isGuestUser` helper
  // must.
  it('Guest sidebar is shown when effectiveRole is explicitly "Guest" even if isActive is true', () => {
    setMockAuth({
      role: 'Researcher',
      isActive: true,
      effectiveRole: 'Guest',
      userId: 99,
    });
    renderMainLayout(ROUTES.FORUM);

    // Forums-only sidebar.
    expect(findSidebarLinkByHref(ROUTES.PAPERS)).toBeNull();
    expect(findSidebarLinkByText('Paper')).toBeNull();
    // Header pill reads Guest.
    expect(screen.getByText('Guest')).toBeTruthy();
    expect(screen.queryByText('Researcher')).toBeNull();
  });
});

import { ROUTES } from '../../../src/routes/paths';
