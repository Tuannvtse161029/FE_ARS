/**
 * Component-level tests for src/pages/Lecturer/ResearchGroup.tsx.
 *
 * Per Issue #6 from the brief: the decorative group code (e.g. "RG-2026-016")
 * must not be rendered on group cards. This file verifies:
 *   - The page renders with a stubbed group and shows the group name
 *   - The rendered card does NOT contain any "RG-" string
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { ResearchGroup } from '../../../../src/pages/Lecturer/ResearchGroup';
import type { ResearchGroup as ResearchGroupType } from '../../../../src/services/researchGroup.service';
import type { ResearchTopic } from '../../../../src/types/research';
import type { GroupMember } from '../../../../src/services/groupMember.service';
import { dictionary } from '../../../../src/i18n/dictionaries/en';

const translate = (
  key: string,
  fallback?: string,
  _params?: Record<string, string | number>,
) => dictionary[key] ?? fallback ?? key;

const {
  useResearchGroupsMock,
  useResearchTopicsMock,
  getAllMembersMock,
  getRequestsByGroupMock,
  deleteGroupMock,
  setActiveGroupMock,
  usePaginationMock,
} = vi.hoisted(() => {
  return {
    useResearchGroupsMock: vi.fn(),
    useResearchTopicsMock: vi.fn(),
    getAllMembersMock: vi.fn(),
    getRequestsByGroupMock: vi.fn(),
    deleteGroupMock: vi.fn(),
    setActiveGroupMock: vi.fn(),
    usePaginationMock: vi.fn(),
  };
});

vi.mock('../../../../src/i18n/I18nContext', () => ({
  useI18n: () => ({
    t: translate,
  }),
  useT: () => translate,
  useLocale: () => 'en',
}));

vi.mock('../../../../src/hooks/useResearchGroups', () => ({
  useResearchGroups: useResearchGroupsMock,
}));

vi.mock('../../../../src/hooks/useResearchTopics', () => ({
  useResearchTopics: useResearchTopicsMock,
}));

vi.mock('../../../../src/hooks/usePagination', () => ({
  usePagination: usePaginationMock,
}));

vi.mock('../../../../src/services/groupMember.service', () => ({
  groupMemberService: {
    getAll: getAllMembersMock,
    getMembersForGroup: vi.fn(),
  },
  indexGroupMembersByGroupId: (members: GroupMember[]) => {
    const index: Record<number, GroupMember[]> = {};
    for (const m of members) {
      if (typeof m.groupId === 'number') {
        if (!index[m.groupId]) index[m.groupId] = [];
        index[m.groupId].push(m);
      }
    }
    return index;
  },
}));

vi.mock('../../../../src/services/groupJoinRequest.service', () => ({
  groupJoinRequestService: {
    getRequestsByGroup: getRequestsByGroupMock,
    acceptRequest: vi.fn(),
    rejectRequest: vi.fn(),
  },
}));

vi.mock('../../../../src/services/researchGroup.service', () => ({
  researchGroupService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: deleteGroupMock,
    setActive: setActiveGroupMock,
  },
  deriveGroupStatus: vi.fn(() => 'active'),
}));

vi.mock('../../../../src/services/notification.service', () => ({
  notificationService: {
    create: vi.fn(),
  },
}));

vi.mock('../../../../src/services/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const stubUser = {
  userId: 7,
  email: 'lecturer@test.com',
  displayName: 'Dr. Test',
  role: 'Lecturer' as const,
};

vi.mock('../../../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: stubUser }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

const stubGroup: ResearchGroupType = {
  id: 16,
  researchGroupId: 16,
  name: 'Machine Learning Research Team',
  description: 'Exploring new frontiers in supervised learning.',
  topicId: 3,
  lecturerId: 7,
  isActive: true,
  assignedAt: '2026-01-15T08:00:00Z',
  deadline: '2026-12-31T00:00:00Z',
};

const stubTopic: ResearchTopic = {
  id: 3,
  title: 'Applied Machine Learning',
  description: 'Research on ML applications.',
  lecturerId: 7,
  status: 'Active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const stubMember: GroupMember = {
  id: 1,
  groupId: 16,
  studentId: 101,
  studentName: 'Alice Nguyen',
  isLeader: true,
  joinedAt: '2026-02-01T00:00:00Z',
};

const makePaginationResult = (items: unknown[]) => ({
  page: 1,
  totalPages: 1,
  totalItems: items.length,
  startIndex: 0,
  endIndex: items.length,
  pageItems: items,
  setPage: vi.fn(),
  next: vi.fn(),
  prev: vi.fn(),
  resetPage: vi.fn(),
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ResearchGroup />
    </MemoryRouter>,
  );

describe('ResearchGroup — Issue #6: decorative group code must not appear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useResearchGroupsMock.mockReturnValue({
      groups: [stubGroup],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useResearchTopicsMock.mockReturnValue({
      topics: [stubTopic],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    getAllMembersMock.mockResolvedValue([stubMember]);
    getRequestsByGroupMock.mockResolvedValue([]);
    deleteGroupMock.mockResolvedValue(undefined);
    setActiveGroupMock.mockResolvedValue(undefined);
    usePaginationMock.mockImplementation((items) => makePaginationResult(items));
  });

  it('renders the group name', async () => {
    renderPage();
    const nameEl = await screen.findByText('Machine Learning Research Team');
    expect(nameEl).toBeTruthy();
  });

  it('renders the group description', async () => {
    renderPage();
    expect(
      await screen.findByText('Exploring new frontiers in supervised learning.'),
    ).toBeTruthy();
  });

  it('does NOT render any decorative RG- code on the group card', async () => {
    const { container } = renderPage();
    await screen.findByText('Machine Learning Research Team');
    // The container must not contain any text matching "RG-" (case-sensitive),
    // which would be the decorative group code like "RG-2026-016".
    expect(container.textContent).not.toMatch(/RG-/);
  });

  it('does NOT render "RG-" anywhere on the page', async () => {
    const { container } = renderPage();
    await screen.findByText('Machine Learning Research Team');
    expect(container.innerHTML).not.toContain('RG-');
  });
});
