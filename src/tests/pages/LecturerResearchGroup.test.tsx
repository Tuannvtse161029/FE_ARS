/**
 * Component-level tests for src/pages/Lecturer/ResearchGroup.tsx.
 *
 * Covers:
 *   - Renders the four ResearchTopic status badge colours
 *     (OPEN / ASSIGNED / COMPLETED / CLOSED) via deriveGroupStatus.
 *   - Loading state, empty state, and error state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResearchGroup } from '../../pages/Lecturer/ResearchGroup';
import { buildMockAuth } from '../utils/mockAuth';
import styles from '../../components/lecturer/StatusBadge.module.css';

const { getAllGroupsMock, getAllTopicsMock, getAllMembersMock } = vi.hoisted(
  () => ({
    getAllGroupsMock: vi.fn(),
    getAllTopicsMock: vi.fn(),
    getAllMembersMock: vi.fn(),
  }),
);

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
}));

// The Lecturer/ResearchGroup page imports useAuth from context/AuthContext.
// Mock that path directly (the page does not go through the hook re-export).
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

vi.mock('../../services/researchGroup.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/researchGroup.service')
  >('../../services/researchGroup.service');
  return {
    ...actual,
    researchGroupService: {
      getAll: getAllGroupsMock,
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock('../../services/guidanceProject.service', () => ({
  getAllGuidanceProjects: vi.fn().mockResolvedValue([]),
  getGuidanceProjectById: vi.fn(),
  getAllResearchTopics: getAllTopicsMock,
  getResearchTopicById: vi.fn(),
  getActiveGuidanceProjectForStudent: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/groupMember.service', () => ({
  groupMemberService: {
    getAll: getAllMembersMock,
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  indexGroupMembersByGroupId: (members: { researchGroupId: number | null }[]) => {
    const acc: Record<number, typeof members> = {};
    for (const m of members) {
      const gid = m.researchGroupId;
      if (gid === null || gid === undefined) continue;
      const bucket = acc[gid] ?? [];
      bucket.push(m);
      acc[gid] = bucket;
    }
    return acc;
  },
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ResearchGroup />
    </MemoryRouter>,
  );

describe('<ResearchGroup> page', () => {
  beforeEach(() => {
    getAllGroupsMock.mockReset();
    getAllTopicsMock.mockReset();
    getAllMembersMock.mockReset();
    getAllMembersMock.mockResolvedValue([]);
    getAllTopicsMock.mockResolvedValue([]);
  });

  describe('status badge colors', () => {
    it('renders OPEN badge for a group with no topic', async () => {
      getAllGroupsMock.mockResolvedValueOnce([
        { id: 1, lecturerId: 7, name: 'Open Group', topicId: null },
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText(/Open Group/)).toBeInTheDocument());
      const badge = screen.getByLabelText(/Status: OPEN/);
      expect(badge.className).toContain(styles.open);
    });

    it('renders ASSIGNED badge when group has a topic whose status is OPEN', async () => {
      getAllTopicsMock.mockResolvedValueOnce([
        { id: 11, title: 'T', status: 'OPEN' },
      ]);
      getAllGroupsMock.mockResolvedValueOnce([
        { id: 1, lecturerId: 7, name: 'Assigned', topicId: 11 },
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText(/Assigned/)).toBeInTheDocument());
      const badge = screen.getByLabelText(/Status: ASSIGNED/);
      expect(badge.className).toContain(styles.assigned);
    });

    it('renders COMPLETED badge when topic.status === COMPLETED', async () => {
      getAllTopicsMock.mockResolvedValueOnce([
        { id: 11, title: 'Topic T', status: 'COMPLETED' },
      ]);
      getAllGroupsMock.mockResolvedValueOnce([
        { id: 1, lecturerId: 7, name: 'Group Alpha', topicId: 11 },
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText('Topic T')).toBeInTheDocument());
      // Both the group card AND the topic row render COMPLETED — use getAllByLabelText
      expect(
        screen.getAllByLabelText(/Status: COMPLETED/).length,
      ).toBeGreaterThan(0);
    });

    it('renders ASSIGNED badge when topic.status === CLOSED (treated as in-progress)', async () => {
      getAllTopicsMock.mockResolvedValueOnce([
        { id: 11, title: 'T', status: 'CLOSED' },
      ]);
      getAllGroupsMock.mockResolvedValueOnce([
        { id: 1, lecturerId: 7, name: 'Closed', topicId: 11 },
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText(/Closed/)).toBeInTheDocument());
      // The CLOSED topic renders as ASSIGNED on the group card (per deriveGroupStatus)
      expect(
        screen.getAllByLabelText(/Status: ASSIGNED/).length,
      ).toBeGreaterThan(0);
      // The topic row in the topics table renders its CLOSED badge directly
      expect(screen.getByLabelText(/Status: CLOSED/)).toBeInTheDocument();
    });
  });

  describe('loading / empty / error', () => {
    it('shows the loading state when groups are loading', () => {
      getAllGroupsMock.mockReturnValueOnce(new Promise(() => undefined));
      renderPage();
      expect(screen.getByText(/Loading research groups/)).toBeInTheDocument();
    });

    it('shows the empty state when groups is []', async () => {
      getAllGroupsMock.mockResolvedValueOnce([]);
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/No research groups yet/)).toBeInTheDocument(),
      );
    });

    it('shows the global error banner when group load fails', async () => {
      getAllGroupsMock.mockRejectedValueOnce(new Error('boom'));
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/boom/),
      );
    });

    it('shows the topics empty state', async () => {
      getAllGroupsMock.mockResolvedValueOnce([]);
      getAllTopicsMock.mockResolvedValueOnce([]);
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/No topics yet/)).toBeInTheDocument(),
      );
    });
  });

  describe('create-group modal', () => {
    it('opens the create-group modal when the button is clicked', async () => {
      getAllGroupsMock.mockResolvedValueOnce([]);
      renderPage();
      await userEvent.setup().click(
        screen.getByRole('button', { name: /Create Research Group/i }),
      );
      expect(screen.getByText(/Create New Research Group/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Research Group Name/)).toBeInTheDocument();
    });

    it('blocks submit when group name is empty', async () => {
      getAllGroupsMock.mockResolvedValueOnce([]);
      renderPage();
      await userEvent.setup().click(
        screen.getByRole('button', { name: /Create Research Group/i }),
      );
      const name = screen.getByLabelText(/Research Group Name/) as HTMLInputElement;
      expect(name).toBeRequired();
    });
  });
});