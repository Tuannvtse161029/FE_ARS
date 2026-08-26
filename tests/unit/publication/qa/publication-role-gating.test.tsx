// Coordinator: docs/local-only/publication-flow-contract-matrix.md §1,
// `docs/UI_PUBLICATION_FLOW_DECISIONS.md` §2 (role gating).
//
// Owned by the API-contract-and-QA subagent. This file does NOT modify
// App.tsx, RoleRouteGuard, paths.ts, the auth context, or any other
// agent's files. It re-implements a minimal Routes tree that mirrors
// the publication-relevant RoleRouteGuard mounts in App.tsx and asserts
// the role-allow-list invariants the coordinator doc pins:
//
//   - HomeResearchCatalog (/home)
//       Researcher, Reviewer, Lecturer, Graduate Student (Admin excluded)
//   - Researcher submissions (+ new + detail)
//       Researcher only
//   - Reviewer assignments (+ detail)
//       Reviewer only
//   - Admin paper submissions (+ detail), reviewer assignments, published
//       Admin only
//
// These tests stub `useAuth` and mount the real RoleRouteGuard against a
// MemoryRouter so the routing logic is the production code under test —
// no JSX duplication of the guard itself.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleRouteGuard } from '@/routes/RoleRouteGuard';
import { ROUTES } from '@/routes/paths';
import { landingRouteForRoleName } from '@/utils/roleNormalizer';

// ── Auth mock ─────────────────────────────────────────────────────────────
const useAuthMock = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

const buildUser = (role: string | null) => ({
  user: role
    ? {
        token: 'mock-token',
        username: 'tester',
        email: 'tester@example.com',
        role,
        userId: 99,
        isActive: true,
        roleId: 0,
      }
    : null,
  isAuthenticated: role !== null,
  isLoading: false,
  error: null,
  login: () => Promise.resolve(),
  logout: () => undefined,
  clearError: () => undefined,
  pendingRoleSelection: null,
  confirmRoleSelection: () => undefined,
  cancelRoleSelection: () => undefined,
});

const setupRole = (role: string | null) => {
  useAuthMock.mockReturnValue(buildUser(role));
};

beforeEach(() => {
  vi.clearAllMocks();
});

// Sentinel pages — kept here so the test file owns no shared component.
// Each sentinel renders a unique data-testid we can assert on.
const SENTINELS = {
  home: 'sentinel-home',
  researcherList: 'sentinel-researcher-list',
  researcherNew: 'sentinel-researcher-new',
  researcherDetail: 'sentinel-researcher-detail',
  reviewerList: 'sentinel-reviewer-list',
  reviewerDetail: 'sentinel-reviewer-detail',
  adminSubmissions: 'sentinel-admin-submissions',
  adminSubmissionDetail: 'sentinel-admin-submission-detail',
  adminReviewerAssignments: 'sentinel-admin-reviewer-assignments',
  adminPublishedPapers: 'sentinel-admin-published-papers',
};

const HomeSentinel = () => <div data-testid={SENTINELS.home} />;
const ResearcherListSentinel = () => <div data-testid={SENTINELS.researcherList} />;
const ResearcherNewSentinel = () => <div data-testid={SENTINELS.researcherNew} />;
const ResearcherDetailSentinel = () => <div data-testid={SENTINELS.researcherDetail} />;
const ReviewerListSentinel = () => <div data-testid={SENTINELS.reviewerList} />;
const ReviewerDetailSentinel = () => <div data-testid={SENTINELS.reviewerDetail} />;
const AdminSubmissionsSentinel = () => <div data-testid={SENTINELS.adminSubmissions} />;
const AdminSubmissionDetailSentinel = () => <div data-testid={SENTINELS.adminSubmissionDetail} />;
const AdminReviewerAssignmentsSentinel = () => <div data-testid={SENTINELS.adminReviewerAssignments} />;
const AdminPublishedPapersSentinel = () => <div data-testid={SENTINELS.adminPublishedPapers} />;

// Mirror of the publication-relevant routes in App.tsx, restricted to
// the routes the publication feature ships. We rebuild the tree here so
// this test file does not depend on the lazy chunks in App.tsx (which
// would force a full Provider tree + bundle load).
const AppMirror = (
  <Routes>
    <Route path={ROUTES.HOME} element={<RoleRouteGuard allow={['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student']} />} >
      <Route index element={<HomeSentinel />} />
    </Route>
    <Route element={<RoleRouteGuard allow={['Researcher']} />} >
      <Route path={ROUTES.RESEARCHER_SUBMISSIONS} element={<ResearcherListSentinel />} />
      <Route path={ROUTES.RESEARCHER_SUBMISSION_NEW} element={<ResearcherNewSentinel />} />
      <Route path={ROUTES.RESEARCHER_SUBMISSION_DETAIL} element={<ResearcherDetailSentinel />} />
    </Route>
    <Route element={<RoleRouteGuard allow={['Reviewer']} />} >
      <Route path={ROUTES.REVIEWER_ASSIGNMENTS} element={<ReviewerListSentinel />} />
      <Route path={ROUTES.REVIEWER_ASSIGNMENT_DETAIL} element={<ReviewerDetailSentinel />} />
    </Route>
    <Route element={<RoleRouteGuard allow={['Admin']} />} >
      <Route path={ROUTES.ADMIN_PAPER_SUBMISSIONS} element={<AdminSubmissionsSentinel />} />
      <Route path={ROUTES.ADMIN_PAPER_SUBMISSION_DETAIL} element={<AdminSubmissionDetailSentinel />} />
      <Route path={ROUTES.ADMIN_REVIEWER_ASSIGNMENTS} element={<AdminReviewerAssignmentsSentinel />} />
      <Route path={ROUTES.ADMIN_PUBLISHED_PAPERS} element={<AdminPublishedPapersSentinel />} />
    </Route>
    <Route path="/login" element={<div data-testid="login-page" />} />
    {/* Landing route used by the role normalizer (e.g. /home for Researcher). */}
    <Route path="/home" element={<div data-testid="researcher-landing" />} />
  </Routes>
);

const renderAt = (initialPath: string) =>
  render(<MemoryRouter initialEntries={[initialPath]}>{AppMirror}</MemoryRouter>);

describe('publication role gating — catalog (/home)', () => {
  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ])('allows %s to reach the research catalog', (role) => {
    setupRole(role);
    renderAt(ROUTES.HOME);
    expect(screen.getByTestId(SENTINELS.home)).toBeInTheDocument();
  });

  it('redirects Admin away from the catalog to the admin landing route', () => {
    setupRole('Admin');
    renderAt(ROUTES.HOME);
    // Admin is NOT in the catalog allow list. The guard falls back to
    // landingRouteForRoleName('Admin'), which per the role normalizer
    // resolves to /admin. We assert the absence of the catalog sentinel
    // rather than the specific landing path because the normalizer is
    // owned by the Lead and may evolve.
    expect(screen.queryByTestId(SENTINELS.home)).not.toBeInTheDocument();
  });
});

describe('publication role gating — researcher surfaces', () => {
  it.each([
    ROUTES.RESEARCHER_SUBMISSIONS,
    ROUTES.RESEARCHER_SUBMISSION_NEW,
    ROUTES.RESEARCHER_SUBMISSION_DETAIL,
  ])('allows Researcher to reach %s', (path) => {
    setupRole('Researcher');
    renderAt(path);
    const sentinels = [
      SENTINELS.researcherList,
      SENTINELS.researcherNew,
      SENTINELS.researcherDetail,
    ];
    const visible = sentinels.filter((id) => screen.queryByTestId(id));
    expect(visible.length).toBeGreaterThan(0);
  });

  it.each(['Admin', 'Reviewer', 'Lecturer', 'Graduate Student'])(
    'redirects %s away from /researcher/submissions',
    (role) => {
      setupRole(role);
      renderAt(ROUTES.RESEARCHER_SUBMISSIONS);
      expect(screen.queryByTestId(SENTINELS.researcherList)).not.toBeInTheDocument();
    },
  );
});

describe('publication role gating — reviewer surfaces', () => {
  it.each([
    ROUTES.REVIEWER_ASSIGNMENTS,
    ROUTES.REVIEWER_ASSIGNMENT_DETAIL,
  ])('allows Reviewer to reach %s', (path) => {
    setupRole('Reviewer');
    renderAt(path);
    const visible = [
      SENTINELS.reviewerList,
      SENTINELS.reviewerDetail,
    ].filter((id) => screen.queryByTestId(id));
    expect(visible.length).toBeGreaterThan(0);
  });

  it.each(['Admin', 'Researcher', 'Lecturer', 'Graduate Student'])(
    'redirects %s away from /reviewer/assignments',
    (role) => {
      setupRole(role);
      renderAt(ROUTES.REVIEWER_ASSIGNMENTS);
      expect(screen.queryByTestId(SENTINELS.reviewerList)).not.toBeInTheDocument();
    },
  );
});

describe('publication role gating — admin surfaces', () => {
  it.each([
    [ROUTES.ADMIN_PAPER_SUBMISSIONS, SENTINELS.adminSubmissions],
    [ROUTES.ADMIN_PAPER_SUBMISSION_DETAIL, SENTINELS.adminSubmissionDetail],
    [ROUTES.ADMIN_REVIEWER_ASSIGNMENTS, SENTINELS.adminReviewerAssignments],
    [ROUTES.ADMIN_PUBLISHED_PAPERS, SENTINELS.adminPublishedPapers],
  ] as const)('allows Admin to reach %s', (path, sentinel) => {
    setupRole('Admin');
    renderAt(path);
    expect(screen.getByTestId(sentinel)).toBeInTheDocument();
  });

  it.each(['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student'])(
    'redirects %s away from /admin/paper-submissions',
    (role) => {
      setupRole(role);
      renderAt(ROUTES.ADMIN_PAPER_SUBMISSIONS);
      expect(screen.queryByTestId(SENTINELS.adminSubmissions)).not.toBeInTheDocument();
    },
  );
});

describe('publication role gating — landing route resolution', () => {
  // The contract matrix §2 and UI decisions §2 pin that the role
  // normalizer returns a landing route for every business role. We
  // assert the LandingRouteForRoleName returns non-empty strings for
  // every role the publication UI cares about so a future normalizer
  // edit cannot silently return an empty path and cause an infinite
  // redirect.
  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
    'Admin',
  ])('landingRouteForRoleName(%s) returns a non-empty path', (role) => {
    const route = landingRouteForRoleName(role);
    expect(route).toBeTruthy();
    expect(route.startsWith('/')).toBe(true);
  });
});
