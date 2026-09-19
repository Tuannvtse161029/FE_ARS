/**
 * Worker 3 — Sidebar role-context label tests.
 *
 * Verifies that the sidebar role-context pill renders the correct label for
 * all non-Admin roles and that Admin intentionally has no pill.
 *
 * Contract:
 *   - Lecturer / Researcher / Reviewer / Graduate Student → "Workspace · <Role>"
 *   - Admin → no role-context pill rendered
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { MainLayout } from '../../../src/layouts/MainLayout';
import { ROUTES } from '../../../src/routes/paths';
import { buildMockAuth } from '../../../src/utils/mockAuth';
import type { MockUseAuthOptions } from '../../../src/utils/mockAuth';

// ── Mock surface ───────────────────────────────────────────────────────────────

const useAuthMock = vi.fn();

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
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

// ── Auth helper ───────────────────────────────────────────────────────────────

const setMockAuth = (opts: MockUseAuthOptions = {}) => {
  useAuthMock.mockReturnValue(buildMockAuth(opts));
};

// ── Render harness ────────────────────────────────────────────────────────────

const renderLayout = (path = ROUTES.HOME) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MainLayout />
    </MemoryRouter>,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MainLayout — sidebar role-context pill', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it.each`
    role               | displayRole
    ${'Lecturer'}     | ${'Lecturer'}
    ${'Researcher'}   | ${'Researcher'}
    ${'Reviewer'}     | ${'Reviewer'}
    ${'Graduate Student'} | ${'Graduate Student'}
  `('renders "Workspace · $displayRole" for $role role', ({ role, displayRole }) => {
    setMockAuth({ role, isActive: true, userId: 1 });
    renderLayout();

    const roleContext = document.querySelector('[class*="roleContext"]');
    expect(roleContext).not.toBeNull();
    expect(roleContext).toHaveTextContent(`Workspace\u00b7${displayRole}`);
  });

  it('does NOT render a role-context pill for Admin role', () => {
    setMockAuth({ role: 'Admin', isActive: true, userId: 1 });
    renderLayout();

    const roleContext = document.querySelector('[class*="roleContext"]');
    expect(roleContext).toBeNull();
  });
});
