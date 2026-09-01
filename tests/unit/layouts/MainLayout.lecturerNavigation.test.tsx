/**
 * Sidebar + page-mount regression for the Lecturer Navigation Agent.
 *
 * Contract (AGENT_LECTURER_NAVIGATION_READY):
 *   - Lecturer sidebar shows top-level items in this exact order:
 *       Forums → Seminar → Guidance Projects → Learning Materials
 *       → Research Topics → Research Groups → Milestones
 *   - Lecturer sidebar exposes /lecturer/research-topics as its own
 *     top-level nav item (not nested under /research-group).
 *   - Lecturer sidebar exposes /lecturer/learning-materials as its own
 *     top-level nav item (not a disabled stub).
 *   - The Lecturer "Research Group" entry has been renamed to "Research Groups"
 *     for consistency with the Graduate Student sidebar label, and points
 *     at /research-group (still the canonical groups list).
 *   - The Lecturer "Configure Milestones" entry has been renamed to
 *     "Milestones" (dropping the "Configure" prefix to match the new
 *     order wording).
 *   - The Research Groups page no longer renders the per-topic Create /
 *     Edit / Reopen / Close / Mark Completed / Manage Materials UI — those
 *     affordances live on the new Research Topics page only.
 *   - Group cards on /research-group keep a visible assigned-topic
 *     summary that deep-links to /lecturer/research-topics.
 *
 * Shared-edit note: MainLayout.tsx is touched to re-order the Lecturer
 * nav block. All other role sidebars are unchanged. See
 * docs/BACKEND_REQUESTS.md "Coordination — Agent Lecturer Navigation"
 * for the coordination note.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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

vi.mock('../../../src/components/notification/NotificationCenter', () => ({
  NotificationCenter: () => null,
}));

vi.mock('../../../src/components/WelcomeBackBanner/WelcomeBackBanner', () => ({
  WelcomeBackBanner: () => null,
}));

import { buildMockAuth } from '../../../src/utils/mockAuth';
import { MainLayout } from '../../../src/layouts/MainLayout';
import { ROUTES } from '../../../src/routes/paths';
import { ResearchTopicsPage } from '../../../src/pages/Lecturer/ResearchTopics';
import { LecturerLearningMaterialsPage } from '../../../src/pages/Lecturer/LearningMaterials';
import { ResearchGroup } from '../../../src/pages/Lecturer/ResearchGroup';

beforeEach(() => {
  useAuthMockLocal.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const setMockAuth = (opts: Parameters<typeof buildMockAuth>[0] = {}) => {
  useAuthMockLocal.mockReturnValue(buildMockAuth(opts));
};

const renderAppAt = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<div data-testid="outlet-stub" />} />
          <Route path={ROUTES.FORUM} element={<div data-testid="forum-stub" />} />
          <Route path={ROUTES.RESEARCH_GROUP} element={<ResearchGroup />} />
          <Route
            path={ROUTES.LECTURER_RESEARCH_TOPICS}
            element={<ResearchTopicsPage />}
          />
          <Route
            path={ROUTES.LECTURER_LEARNING_MATERIALS}
            element={<LecturerLearningMaterialsPage />}
          />
        </Route>
      </Routes>
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

const sidebarLinkOrder = (): string[] => {
  const aside = document.querySelector('aside');
  if (!aside) return [];
  return Array.from(aside.querySelectorAll('a'))
    .map((a) => (a.textContent ?? '').trim())
    .filter((s) => s.length > 0);
};

describe('MainLayout — Lecturer navigation (AGENT_LECTURER_NAVIGATION_READY)', () => {
  describe('sidebar order', () => {
    it('renders Lecturer sidebar items in the required top-to-bottom order', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.FORUM);

      const labels = sidebarLinkOrder();
      // Discover Research (ROUTES.HOME) is the first workspace entry for
      // every verified role — it may render as "Discover Research" (current)
      // or a shortened "Home" variant; accept either.
      expect(labels[0]).toMatch(/^(discover research|home)$/i);
      // Find indices of each required item.
      const idx = (s: string) =>
        labels.findIndex((l) => l.toLowerCase().includes(s));
      expect(idx('seminar')).toBeGreaterThan(-1);
      expect(idx('guidance projects')).toBeGreaterThan(idx('seminar'));
      expect(idx('learning materials')).toBeGreaterThan(idx('guidance projects'));
      expect(idx('research topics')).toBeGreaterThan(idx('learning materials'));
      expect(idx('research groups')).toBeGreaterThan(idx('research topics'));
      expect(idx('milestones')).toBeGreaterThan(idx('research groups'));
    });
  });

  describe('top-level topic separation', () => {
    it('exposes /lecturer/research-topics as a top-level Lecturer nav item', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.FORUM);

      const link = findSidebarLinkByHref(ROUTES.LECTURER_RESEARCH_TOPICS);
      expect(link).not.toBeNull();
      expect(link?.textContent ?? '').toMatch(/research topics/i);
    });

    it('exposes /lecturer/learning-materials as a top-level Lecturer nav item', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.FORUM);

      const link = findSidebarLinkByHref(ROUTES.LECTURER_LEARNING_MATERIALS);
      expect(link).not.toBeNull();
      expect(link?.textContent ?? '').toMatch(/learning materials/i);
    });

    it('does not expose the legacy "#shared-material" disabled stub', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.FORUM);

      // The stub used a `#shared-material` href; the new design has a real
      // /lecturer/learning-materials href instead.
      const aside = document.querySelector('aside');
      const anchors = aside?.querySelectorAll('a') ?? [];
      for (const a of Array.from(anchors)) {
        expect(a.getAttribute('href')).not.toBe('#shared-material');
        expect(a.getAttribute('href')).not.toBe('#wallet');
      }
    });

    it('Research Topics route renders its own page (no fallback)', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.LECTURER_RESEARCH_TOPICS);

      expect(screen.getByTestId('lecturer-research-topics')).toBeInTheDocument();
    });

    it('Learning Materials route renders its own page (no fallback)', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.LECTURER_LEARNING_MATERIALS);

      expect(
        screen.getByTestId('lecturer-learning-materials'),
      ).toBeInTheDocument();
    });
  });

  describe('Research Groups page — topic delegation', () => {
    it('does not render the in-page topic Create button or topics table', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.RESEARCH_GROUP);

      // The page has the create-group button …
      expect(
        screen.getByRole('button', { name: /Create Research Group/i }),
      ).toBeInTheDocument();
      // … but no create-topic button or topics table heading.
      expect(
        screen.queryByRole('button', { name: /Create Research Topic/i }),
      ).toBeNull();
      expect(screen.queryByText(/Research Topics Library/i)).toBeNull();
      expect(screen.queryByText(/Reopen/i)).toBeNull();
      expect(screen.queryByText(/Manage Materials/i)).toBeNull();
    });
  });

  describe('detail refresh active tab (deep link to topic page from group card)', () => {
    it('renders a group card with an assigned-topic deep-link to /lecturer/research-topics', async () => {
      setMockAuth({ role: 'Lecturer' });

      // Mock the services used by the Research Groups page.
      const { researchGroupService } = await import(
        '../../../src/services/researchGroup.service'
      );
      const { groupMemberService } = await import(
        '../../../src/services/groupMember.service'
      );
      const getAllGroupsSpy = vi
        .spyOn(researchGroupService, 'getAll')
        .mockResolvedValue([
          {
            id: 1,
            lecturerId: 1,
            topicId: 11,
            name: 'Alpha',
            description: null,
            deadline: null,
            assignedAt: new Date().toISOString(),
          },
        ]);
      const getAllTopicsSpy = vi
        .spyOn(
          await import('../../../src/services/guidanceProject.service'),
          'getAllResearchTopics',
        )
        .mockResolvedValue([
          {
            id: 11,
            title: 'Whisper STT',
            status: 'OPEN',
            description: 'desc',
            materialsUrl: null,
            assignedGroupId: 1,
          },
        ]);
      vi.spyOn(groupMemberService, 'getAll').mockResolvedValue([]);

      renderAppAt(ROUTES.RESEARCH_GROUP);

      const link = await screen.findByTestId('assigned-topic-link');
      expect(link.getAttribute('href')).toBe(ROUTES.LECTURER_RESEARCH_TOPICS);

      getAllGroupsSpy.mockRestore();
      getAllTopicsSpy.mockRestore();
    });
  });

  describe('active-tab detection on the sidebar', () => {
    it('marks /research-group as active when the user is on /research-group', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.RESEARCH_GROUP);

      const aside = document.querySelector('aside');
      if (!aside) throw new Error('sidebar missing');
      const links = within(aside).getAllByRole('link');
      const groupsLink = links.find(
        (l) => l.getAttribute('href') === ROUTES.RESEARCH_GROUP,
      );
      expect(groupsLink?.className ?? '').toMatch(/navItemActive/);
    });

    it('marks /lecturer/research-topics as active when the user is on that route', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.LECTURER_RESEARCH_TOPICS);

      const aside = document.querySelector('aside');
      if (!aside) throw new Error('sidebar missing');
      const links = within(aside).getAllByRole('link');
      const topicsLink = links.find(
        (l) => l.getAttribute('href') === ROUTES.LECTURER_RESEARCH_TOPICS,
      );
      expect(topicsLink?.className ?? '').toMatch(/navItemActive/);
    });

    it('marks /research-group as NOT active when the user is on /lecturer/research-topics', () => {
      setMockAuth({ role: 'Lecturer' });
      renderAppAt(ROUTES.LECTURER_RESEARCH_TOPICS);

      const aside = document.querySelector('aside');
      if (!aside) throw new Error('sidebar missing');
      const links = within(aside).getAllByRole('link');
      const groupsLink = links.find(
        (l) => l.getAttribute('href') === ROUTES.RESEARCH_GROUP,
      );
      expect(groupsLink?.className ?? '').not.toMatch(/navItemActive/);
    });
  });
});

void findSidebarLinkByText;