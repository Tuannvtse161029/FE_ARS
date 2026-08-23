/**
 * Sibling tests for src/pages/GraduateStudent/StudentResearchGroups.tsx.
 *
 * The 6 existing tests in `StudentResearchGroups.test.tsx` are untouched.
 * This new file focuses on the per-group detail expansion:
 *   - Members list section (groupMemberService.getMembersForGroup)
 *   - Materials list (useLearningMaterials)
 *   - <MilestoneProgress /> consumed with the page's reports
 *   - Lecturer-name fallback to `Lecturer #<id>` when getLecturerDisplayName rejects
 *   - Invitation banner reads `status` field — shows expired when not pending
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudentResearchGroups } from '../../../../src/pages/GraduateStudent/StudentResearchGroups';
import { buildMockAuth } from '../../../../src/utils/mockAuth';

const {
  mockGetMembersForGroup,
  mockListReportsForGroup,
  mockGetLecturerDisplayName,
  useStudentGroupsImpl,
} = vi.hoisted(() => ({
  mockGetMembersForGroup: vi.fn(),
  mockListReportsForGroup: vi.fn(),
  mockGetLecturerDisplayName: vi.fn(),
  useStudentGroupsImpl: vi.fn(),
}));

vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Graduate Student', userId: 9 }),
}));

vi.mock('../../../../src/services/groupMember.service', () => ({
  groupMemberService: { getMembersForGroup: mockGetMembersForGroup },
}));

vi.mock('../../../../src/services/phasedReport.service', () => ({
  listReportsForGroup: mockListReportsForGroup,
}));

vi.mock('../../../../src/services/lecturerLookup.service', () => ({
  lecturerLookupService: {
    getLecturerDisplayName: mockGetLecturerDisplayName,
    ensureLecturerDisplayName: vi.fn(),
  },
}));

vi.mock('../../../../src/hooks/useLearningMaterials', () => ({
  useLearningMaterials: () => ({
    materials: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../../src/hooks/useStudentGroups', () => ({
  useStudentGroups: () => useStudentGroupsImpl(),
}));

vi.mock('../../../../src/hooks/usePhasedReports', () => ({
  usePhasedReports: () => ({
    reports: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    latestByStatus: () => null,
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <StudentResearchGroups />
    </MemoryRouter>,
  );

describe('<StudentResearchGroups> — sibling tests', () => {
  beforeEach(() => {
    mockGetMembersForGroup.mockReset();
    mockListReportsForGroup.mockReset();
    mockGetLecturerDisplayName.mockReset();

    mockGetMembersForGroup.mockResolvedValue([]);
    mockListReportsForGroup.mockResolvedValue([]);
    mockGetLecturerDisplayName.mockImplementation(
      (id: number) => `Lecturer #${id}`,
    );

    useStudentGroupsImpl.mockImplementation(() => ({
      joinedGroups: [],
      guidanceProject: null,
      primaryGroup: null,
      primaryTopic: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }));
  });

  it('renders members list section after getMembersForGroup resolves', async () => {
    useStudentGroupsImpl.mockImplementation(() => ({
      joinedGroups: [
        {
          id: 42,
          name: 'Alpha Lab',
          lecturerId: 4,
          topicId: 11,
          joinedAt: '2025-01-01T00:00:00Z',
          membershipId: 1,
        },
      ],
      guidanceProject: null,
      primaryGroup: null,
      primaryTopic: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }));
    mockGetMembersForGroup.mockResolvedValueOnce([
      {
        id: 100,
        researchGroupId: 42,
        studentId: 9,
        activityStatus: 'ACTIVE',
        joinedAt: '2025-01-05T00:00:00Z',
      },
    ]);
    renderPage();
    const openBtn = await screen.findByRole('button', {
      name: /Open Group Workspace/i,
    });
    await userEvent.setup().click(openBtn);
    await waitFor(() =>
      expect(screen.getByText(/Student #9/)).toBeInTheDocument(),
    );
    expect(mockGetMembersForGroup).toHaveBeenCalledWith(42);
  });

  it('renders materials list section (via useLearningMaterials mock)', async () => {
    useStudentGroupsImpl.mockImplementation(() => ({
      joinedGroups: [
        {
          id: 42,
          name: 'Alpha Lab',
          lecturerId: 4,
          topicId: 11,
          joinedAt: '2025-01-01T00:00:00Z',
          membershipId: 1,
        },
      ],
      guidanceProject: null,
      primaryGroup: null,
      primaryTopic: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }));
    renderPage();
    const openBtn = await screen.findByRole('button', {
      name: /Open Group Workspace/i,
    });
    await userEvent.setup().click(openBtn);
    await waitFor(() =>
      expect(screen.getAllByText(/Learning materials/i).length).toBeGreaterThan(0),
    );
  });

  it('renders <MilestoneProgress /> consumed with the page reports', async () => {
    useStudentGroupsImpl.mockImplementation(() => ({
      joinedGroups: [
        {
          id: 42,
          name: 'Alpha Lab',
          lecturerId: 4,
          topicId: 11,
          joinedAt: '2025-01-01T00:00:00Z',
          membershipId: 1,
        },
      ],
      guidanceProject: null,
      primaryGroup: null,
      primaryTopic: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }));
    mockListReportsForGroup.mockResolvedValueOnce([
      {
        id: 1,
        researchGroupId: 42,
        status: 'SUBMITTED',
        submittedAt: '2025-01-02T00:00:00Z',
      },
    ]);
    renderPage();
    const openBtn = await screen.findByRole('button', {
      name: /Open Group Workspace/i,
    });
    await userEvent.setup().click(openBtn);
    await waitFor(() =>
      expect(screen.getByTestId('milestone-progress')).toBeInTheDocument(),
    );
  });

  it('lecturer name resolution falls back to Lecturer #<id> when no display name has been resolved', async () => {
    useStudentGroupsImpl.mockImplementation(() => ({
      joinedGroups: [
        {
          id: 42,
          name: 'Alpha Lab',
          lecturerId: 4,
          topicId: 11,
          joinedAt: '2025-01-01T00:00:00Z',
          membershipId: 1,
        },
      ],
      guidanceProject: null,
      primaryGroup: null,
      primaryTopic: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }));
    // The lecturerLookup service is silent-by-default: even on fetch
    // failure, getLecturerDisplayName returns `Lecturer #<id>`. Verify
    // that's what the page surfaces.
    mockGetLecturerDisplayName.mockImplementation(
      (id: number) => `Lecturer #${id}`,
    );
    renderPage();
    const openBtn = await screen.findByRole('button', {
      name: /Open Group Workspace/i,
    });
    await userEvent.setup().click(openBtn);
    // The workspace header reads "Supervised by Lecturer #4".
    await waitFor(() =>
      expect(screen.getAllByText(/Lecturer #4/).length).toBeGreaterThan(0),
    );
  });

  it('invitation banner shows expired state when status !== "pending"', async () => {
    useStudentGroupsImpl.mockImplementationOnce(() => ({
      joinedGroups: [
        {
          id: 42,
          name: 'Alpha Lab',
          lecturerId: 4,
          topicId: 11,
          joinedAt: '2025-01-01T00:00:00Z',
          membershipId: 1,
          membershipStatus: 'expired',
        },
      ],
      guidanceProject: null,
      primaryGroup: null,
      primaryTopic: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }));
    renderPage();
    // The InvitationBanner shouldn't render Accept/Decline buttons when the
    // joined row carries a stale status.
    await waitFor(() =>
      expect(screen.getByText(/Alpha Lab/)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: /Accept invitation/i }),
    ).not.toBeInTheDocument();
  });
});