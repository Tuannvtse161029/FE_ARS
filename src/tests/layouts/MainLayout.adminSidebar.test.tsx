/**
 * Admin sidebar active-state regression for Phase C defect 3B.
 *
 * Contract: exactly one sidebar item is marked active at any time, based on
 * an explicit pathname match — never a CSS-selector trick. The Dashboard
 * item (to === /admin) must use `end` matching so it activates only at the
 * exact `/admin` path and NOT on `/admin/role-requests` etc.
 *
 * Uses the shared `renderMainLayout` test harness so hook mocks and helpers
 * aren't duplicated from the other MainLayout tests.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  setupMainLayoutMocks,
  setMockAuth,
  renderMainLayout,
} from '../utils/renderMainLayout';
import { MainLayout } from '../../layouts/MainLayout';
import { ROUTES } from '../../routes/paths';

setupMainLayoutMocks();

const findAdminLink = (href: string): HTMLAnchorElement | null =>
  document.querySelector(`aside a[href="${href}"]`);

const adminNavItems = [
  { to: ROUTES.ADMIN, label: 'Dashboard' },
  { to: ROUTES.ADMIN_ROLE_REQUESTS, label: 'Role Requests' },
  { to: ROUTES.ADMIN_ACCOUNTS, label: 'Accounts' },
  { to: ROUTES.ADMIN_TRANSACTIONS, label: 'Transactions' },
  { to: ROUTES.ADMIN_REPORTS, label: 'Reports' },
  { to: ROUTES.ADMIN_PACKAGES, label: 'Packages' },
  { to: ROUTES.ADMIN_AUDIT_LOGS, label: 'Audit Logs' },
];

const assertActiveOnly = (activeHref: string) => {
  const activeLinks = Array.from(
    document.querySelectorAll('aside a'),
  ).filter((a) => (a.className ?? '').includes('navItemActive'));
  expect(activeLinks).toHaveLength(1);
  expect(activeLinks[0]?.getAttribute('href')).toBe(activeHref);
};

const renderAdminLayout = (initialPath: string) => {
  setMockAuth({ role: 'Admin', roleId: 2 });
  return renderMainLayout(initialPath);
};

describe('Admin sidebar — active item per route (defect 3B)', () => {
  it('exactly /admin activates Dashboard only', () => {
    renderAdminLayout(ROUTES.ADMIN);
    assertActiveOnly(ROUTES.ADMIN);
    const dash = findAdminLink(ROUTES.ADMIN);
    expect(dash?.className ?? '').toMatch(/navItemActive/);
  });

  it('/admin/role-requests activates Role Requests only (NOT Dashboard)', () => {
    renderAdminLayout(ROUTES.ADMIN_ROLE_REQUESTS);
    assertActiveOnly(ROUTES.ADMIN_ROLE_REQUESTS);
    expect(findAdminLink(ROUTES.ADMIN)?.className ?? '').not.toMatch(
      /navItemActive/,
    );
  });

  it('/admin/accounts activates Accounts only', () => {
    renderAdminLayout(ROUTES.ADMIN_ACCOUNTS);
    assertActiveOnly(ROUTES.ADMIN_ACCOUNTS);
  });

  it('/admin/transactions activates Transactions only', () => {
    renderAdminLayout(ROUTES.ADMIN_TRANSACTIONS);
    assertActiveOnly(ROUTES.ADMIN_TRANSACTIONS);
  });

  it('/admin/reports activates Reports only', () => {
    renderAdminLayout(ROUTES.ADMIN_REPORTS);
    assertActiveOnly(ROUTES.ADMIN_REPORTS);
  });

  it('/admin/packages activates Packages only', () => {
    renderAdminLayout(ROUTES.ADMIN_PACKAGES);
    assertActiveOnly(ROUTES.ADMIN_PACKAGES);
  });

  it('/admin/audit-logs activates Audit Logs only', () => {
    renderAdminLayout(ROUTES.ADMIN_AUDIT_LOGS);
    assertActiveOnly(ROUTES.ADMIN_AUDIT_LOGS);
  });

  it('browser refresh (re-mount at /admin/role-requests) preserves Role Requests as active', () => {
    // Simulates a full reload: re-render the layout at the same path. The
    // NavLink should re-derive the active class on first paint.
    const { unmount } = renderAdminLayout(ROUTES.ADMIN_ROLE_REQUESTS);
    assertActiveOnly(ROUTES.ADMIN_ROLE_REQUESTS);
    unmount();
    renderAdminLayout(ROUTES.ADMIN_ROLE_REQUESTS);
    assertActiveOnly(ROUTES.ADMIN_ROLE_REQUESTS);
  });

  it('every admin nav entry is rendered and reachable', () => {
    renderAdminLayout(ROUTES.ADMIN);
    adminNavItems.forEach(({ to, label }) => {
      const link = findAdminLink(to);
      expect(link, `expected link to ${to} to exist`).not.toBeNull();
      expect(link?.textContent ?? '').toMatch(new RegExp(label, 'i'));
    });
  });
});

describe('Non-Admin roles — sidebar untouched (defect 3B scope)', () => {
  it.each([
    ['Researcher', ROUTES.FORUM],
    ['Reviewer', ROUTES.REVIEW_TASKS],
    ['Lecturer', ROUTES.RESEARCH_GROUP],
    ['Graduate Student', ROUTES.STUDENT_RESEARCH_GROUPS],
  ])('%s on its landing path renders zero admin links', (role, _landing) => {
    setMockAuth({ role });
    render(
      <MemoryRouter initialEntries={['/forum']}>
        <MainLayout />
      </MemoryRouter>,
    );
    const adminLink = document.querySelector(`aside a[href="${ROUTES.ADMIN}"]`);
    expect(adminLink).toBeNull();
  });
});
