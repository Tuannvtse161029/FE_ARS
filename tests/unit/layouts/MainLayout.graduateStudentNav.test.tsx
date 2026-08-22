/**
 * Sidebar regression for the Graduate Student role.
 *
 * Contract (Agent-12, AGENT_12_GS_NAV_READY, updated for Forum-as-landing):
 *   - Graduate Student sidebar MUST NOT expose `Paper` or `Browse Reviewers`
 *     — those routes are Researcher-only (see App.tsx RoleRouteGuard).
 *   - Graduate Student sidebar MUST retain `Research Groups`,
 *     `Submit Report`, and `Premium Package`.
 *   - Graduate Student sidebar MUST NOT expose a top-level `Dashboard`
 *     item — the role-based landing page is the Forum now (per
 *     landingRouteForRoleName), so the Graduate Student's dedicated
 *     `/student/dashboard` workspace is reached via Research Groups
 *     rather than a sidebar shortcut.
 *   - Researcher sidebar still exposes Paper + Reviewers items.
 *   - Lecturer, Reviewer, Admin sidebars are unchanged by Agent-12.
 *
 * Uses the shared `renderMainLayout` test harness so hook mocks and helpers
 * aren't duplicated from the other MainLayout tests.
 */
import { describe, it, expect } from 'vitest';
import {
  setupMainLayoutMocks,
  setMockAuth,
  renderMainLayout,
  findSidebarLinkByHref,
  findSidebarLinkByText,
} from '../../../src/utils/renderMainLayout';
import { ROUTES } from '../../routes/paths';

setupMainLayoutMocks();

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

  it('Graduate Student sidebar retains Research Groups, Submit Report, and Premium Package', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.STUDENT_RESEARCH_GROUPS)).not.toBeNull();
    expect(findSidebarLinkByHref(ROUTES.SUBMIT_REPORT)).not.toBeNull();
    expect(findSidebarLinkByHref(ROUTES.PREMIUM_PACKAGES)).not.toBeNull();
  });

  it('Graduate Student sidebar does NOT expose a top-level Dashboard shortcut', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    // Forum is now the post-login landing page for every non-Admin role
    // (per landingRouteForRoleName in roleNormalizer), so the Graduate
    // Student sidebar must not carry a Dashboard item pointing at the
    // role-specific workspace.
    expect(findSidebarLinkByHref(ROUTES.GRADUATE_STUDENT_DASHBOARD)).toBeNull();
    expect(findSidebarLinkByText('Dashboard')).toBeNull();
  });

  it('Graduate Student sidebar still shows Forums', () => {
    setMockAuth({ role: 'Graduate Student' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.FORUM)).not.toBeNull();
  });

  it('Researcher sidebar still exposes /papers and /reviewers links', () => {
    setMockAuth({ role: 'Researcher' });
    renderMainLayout(ROUTES.FORUM);

    expect(findSidebarLinkByHref(ROUTES.PAPERS)).not.toBeNull();
    expect(findSidebarLinkByHref(ROUTES.REVIEWERS)).not.toBeNull();
    // Researcher uses the singular "Reviewers" label per current MainLayout.
    expect(findSidebarLinkByText('Reviewers')).not.toBeNull();
    expect(findSidebarLinkByText('Paper')).not.toBeNull();
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
