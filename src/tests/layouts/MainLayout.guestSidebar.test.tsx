/**
 * Sidebar regression for the Guest (unverified) state.
 *
 * Contract (post-registration flow):
 *   - A freshly-registered user whose role request has not yet been approved
 *     by an Admin (`isActive !== true`) is treated as a Guest.
 *   - Guest sidebar MUST show only `Forums`.
 *   - Guest sidebar MUST NOT expose the role's workspace nav (e.g. Paper,
 *     Reviewers, Research Groups, Wallet, Premium Package, Submit Report,
 *     Seminar, etc.) — even though the verified-guard would bounce the user
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
import {
  setupMainLayoutMocks,
  setMockAuth,
  renderMainLayout,
  findSidebarLinkByHref,
  findSidebarLinkByText,
} from '../utils/renderMainLayout';
import { ROUTES } from '../../routes/paths';

setupMainLayoutMocks();

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

  it('Guest sidebar does NOT expose Premium Package', () => {
    setMockAuth({ role: 'Researcher', isActive: false });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES)).toBeNull();
    expect(findSidebarLinkByText('Premium Package')).toBeNull();
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

    expect(findSidebarLinkByHref(ROUTES.PAPERS)).not.toBeNull();
    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).not.toBeNull();
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
