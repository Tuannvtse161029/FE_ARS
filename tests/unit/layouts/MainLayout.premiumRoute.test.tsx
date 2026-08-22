/**
 * Sidebar nav regression: every non-Admin role exposes a real
 * `/premium-packages` link (singular label), Admin does NOT expose that
 * link, and Admin still owns the legacy `/admin/packages` route.
 *
 * Uses the shared `renderMainLayout` test harness so hook mocks and helpers
 * aren't duplicated from the other MainLayout tests.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  setupMainLayoutMocks,
  setMockAuth,
  renderMainLayout,
  findSidebarLinkByHref,
} from '../../../src/utils/renderMainLayout';
import { MainLayout } from '../../../src/layouts/MainLayout';
import { ROUTES } from '../../routes/paths';

setupMainLayoutMocks();

const renderMainLayoutWithSentinel = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
      <Routes>
        <Route
          path={ROUTES.PREMIUM_PACKAGES}
          element={<div data-testid="premium-page-reached" />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('MainLayout — Premium Package sidebar item', () => {
  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ])('%s sidebar contains a real-path /premium-packages link', (role) => {
    setMockAuth({ role });
    renderMainLayout('/premium-packages');

    const link = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(link).not.toBeNull();
    expect(link).toBeInstanceOf(HTMLAnchorElement);
    expect(link?.getAttribute('href')).toBe('/premium-packages');
    // The legacy plural "Premium Packages" placeholder must not survive.
    expect(link?.textContent ?? '').toMatch(/Premium Package/);
    expect(link?.textContent ?? '').not.toMatch(/Premium Packages/);
  });

  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ])(
    '%s sidebar does NOT expose a #premium-packages hash placeholder',
    (role) => {
      setMockAuth({ role });
      renderMainLayout('/forum');

      const hashLink = document.querySelector(
        'aside a[href="#premium-packages"]',
      );
      expect(hashLink).toBeNull();

      // The hash placeholder must also not leak as a disabled nav row.
      const sidebar = document.querySelector('aside');
      expect(sidebar?.textContent ?? '').not.toMatch(/#premium-packages/);
      // The real-path link is in the sidebar though.
      const realLink = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
      expect(realLink).not.toBeNull();
    },
  );

  it('Admin sidebar still has /admin/packages and NOT /premium-packages', () => {
    setMockAuth({ role: 'Admin', roleId: 2 });
    renderMainLayout(ROUTES.ADMIN_PACKAGES);

    // Admin legacy packages link still present.
    const adminLink = findSidebarLinkByHref(ROUTES.ADMIN_PACKAGES);
    expect(adminLink).not.toBeNull();
    expect(adminLink?.textContent ?? '').toMatch(/Packages/i);

    // The new user-facing route must NOT appear in Admin's sidebar.
    const userLink = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(userLink).toBeNull();
  });

  it('clicking the sidebar link navigates to /premium-packages and applies the active class', async () => {
    const user = userEvent.setup();
    setMockAuth({ role: 'Researcher' });
    renderMainLayoutWithSentinel('/forum');

    const link = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(link).not.toBeNull();
    if (!link) return;

    await user.click(link);

    // The MemoryRouter advanced: the sentinel route is now mounted.
    expect(screen.getByTestId('premium-page-reached')).toBeInTheDocument();
    // The active class should be applied to the same link.
    const activeLink = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(activeLink?.className ?? '').toMatch(/navItemActive/);
  });

  it('renders an accessible label "Premium Package" on the sidebar link', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    const link = findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES);
    expect(link).not.toBeNull();
    // The link's accessible name comes from its visible text.
    const labelEl = within(link as HTMLElement).getByText(/Premium Package/i);
    expect(labelEl).toBeInTheDocument();
  });
});
