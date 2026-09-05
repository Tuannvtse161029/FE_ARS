/**
 * Component-level tests for src/pages/Lecturer/GroupDetail.tsx.
 *
 * Phase C, contract §3.1 / L2. Covers:
 *   - Loading skeleton
 *   - Error banner when group fetch fails
 *   - Members list rendered from groupMemberService.getMembersForGroup
 *   - <MilestoneProgress /> consumes the fetched reports
 *   - BE-gap banner for /api/Milestone
 *   - "Edit group" modal PUTs /api/ResearchGroup/{id}
 *   - Refresh button refetches
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LecturerGroupDetail } from '../../../../src/features/guidance/GroupDetail';
import { buildMockAuth } from '../../../../src/utils/mockAuth';

const {
  getAllGroupsMock,
  getAllTopicsMock,
  getMembersForGroupMock,
  listReportsForGroupMock,
  getAllLearningMaterialsMock,
  updateGroupMock,
} = vi.hoisted(() => ({
  getAllGroupsMock: vi.fn(),
  getAllTopicsMock: vi.fn(),
  getMembersForGroupMock: vi.fn(),
  listReportsForGroupMock: vi.fn(),
  getAllLearningMaterialsMock: vi.fn(),
  updateGroupMock: vi.fn(),
}));

vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
}));

vi.mock('../../../../src/context/AuthContext', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

vi.mock('../../../../src/services/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../../src/services/researchGroup.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/services/researchGroup.service')
  >('../../../../src/services/researchGroup.service');
  return {
    ...actual,
    researchGroupService: {
      getAll: getAllGroupsMock,
      getById: vi.fn(),
      create: vi.fn(),
      update: updateGroupMock,
      delete: vi.fn(),
    },
  };
});

vi.mock('../../../../src/services/groupMember.service', () => ({
  groupMemberService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getMembersForGroup: getMembersForGroupMock,
  },
}));

vi.mock('../../../../src/services/phasedReport.service', () => ({
  listReportsForGroup: listReportsForGroupMock,
}));

vi.mock('../../../../src/services/learningMaterial.service', () => ({
  learningMaterialService: { getAll: getAllLearningMaterialsMock },
}));

vi.mock('../../../../src/services/guidanceProject.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/services/guidanceProject.service')
  >('../../../../src/services/guidanceProject.service');
  return {
    ...actual,
    getAllResearchTopics: getAllTopicsMock,
  };
});

const renderAt = (groupId: string | undefined) =>
  render(
    <MemoryRouter initialEntries={[`/research-groups/${groupId ?? ''}`]}>
      <Routes>
        <Route path="/research-groups/:groupId" element={<LecturerGroupDetail />} />
        <Route path="/research-groups" element={<LecturerGroupDetail />} />
      </Routes>
    </MemoryRouter>,
  );

const SEED_GROUP = {
  id: 42,
  lecturerId: 7,
  topicId: 11,
  name: 'Alpha Lab',
  description: 'desc',
  deadline: '2025-12-31T00:00:00Z',
  assignedAt: '2025-01-01T00:00:00Z',
};

describe('<LecturerGroupDetail> page', () => {
  beforeEach(() => {
    getAllGroupsMock.mockReset();
    getAllTopicsMock.mockReset();
    getMembersForGroupMock.mockReset();
    listReportsForGroupMock.mockReset();
    getAllLearningMaterialsMock.mockReset();
    updateGroupMock.mockReset();
    // Provide defaults for the always-on effect calls.
    getAllGroupsMock.mockResolvedValue([]);
    getMembersForGroupMock.mockResolvedValue([]);
    getAllTopicsMock.mockResolvedValue([]);
    listReportsForGroupMock.mockResolvedValue([]);
    getAllLearningMaterialsMock.mockResolvedValue([]);
    updateGroupMock.mockResolvedValue({ ...SEED_GROUP, name: 'Renamed' });
  });

  it('renders loading skeleton when group fetch is pending', async () => {
    getAllGroupsMock.mockReturnValueOnce(new Promise(() => undefined));
    getMembersForGroupMock.mockReturnValueOnce(new Promise(() => undefined));
    renderAt('42');
    expect(screen.getByText(/Loading group/)).toBeInTheDocument();
  });

  it('renders error banner when group fetch rejects', async () => {
    getAllGroupsMock.mockRejectedValueOnce(new Error('boom'));
    renderAt('42');
    await waitFor(() =>
      expect(
        screen.getAllByText((_, node) =>
          node?.textContent?.includes('No research group with id') ?? false,
        ).length,
      ).toBeGreaterThan(0),
    );
  });

  it('renders members list after getMembersForGroup resolves', async () => {
    getAllGroupsMock.mockResolvedValueOnce([SEED_GROUP]);
    getMembersForGroupMock.mockResolvedValueOnce([
      {
        id: 100,
        researchGroupId: 42,
        studentId: 9,
        activityStatus: 'ACTIVE',
        joinedAt: '2025-01-05T00:00:00Z',
      },
      {
        id: 101,
        researchGroupId: 42,
        studentId: 10,
        activityStatus: 'ACTIVE',
        joinedAt: '2025-01-06T00:00:00Z',
      },
    ]);
    renderAt('42');
    await waitFor(() => expect(screen.getByText(/Alpha Lab/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Student #9/)).toBeInTheDocument());
    expect(screen.getByText(/Student #10/)).toBeInTheDocument();
    expect(getMembersForGroupMock).toHaveBeenCalledWith(42);
  });

  it('renders <MilestoneProgress /> with the fetched reports', async () => {
    getAllGroupsMock.mockResolvedValueOnce([SEED_GROUP]);
    getMembersForGroupMock.mockResolvedValueOnce([]);
    listReportsForGroupMock.mockResolvedValueOnce([
      {
        id: 1,
        researchGroupId: 42,
        status: 'SUBMITTED',
        submittedAt: '2025-01-02T00:00:00Z',
      },
      {
        id: 2,
        researchGroupId: 42,
        status: 'REJECTED',
        submittedAt: '2025-01-03T00:00:00Z',
      },
    ]);
    renderAt('42');
    await waitFor(() =>
      expect(screen.getByTestId('milestone-progress')).toBeInTheDocument(),
    );
    // MilestoneProgress renders per-status counts via data-testid
    expect(screen.getByTestId('count-submitted').textContent).toBe('1');
    expect(screen.getByTestId('count-rejected').textContent).toBe('1');
  });

  it('surfaces the BE-gap banner for /api/Milestone', async () => {
    getAllGroupsMock.mockResolvedValueOnce([SEED_GROUP]);
    getMembersForGroupMock.mockResolvedValueOnce([]);
    renderAt('42');
    await waitFor(() => expect(screen.getByText(/Alpha Lab/)).toBeInTheDocument());
    expect(screen.getByText(/BE does not yet expose/)).toBeInTheDocument();
    expect(screen.getByText(/GET \/api\/Milestone/)).toBeInTheDocument();
  });

  it('"Edit group" modal saves via PUT /api/ResearchGroup/{id}', async () => {
    getAllGroupsMock.mockResolvedValueOnce([SEED_GROUP]);
    getMembersForGroupMock.mockResolvedValueOnce([]);
    renderAt('42');
    await waitFor(() => expect(screen.getByText(/Alpha Lab/)).toBeInTheDocument());
    await userEvent.setup().click(
      screen.getByRole('button', { name: /^Edit group$/i }),
    );
    const nameInput = screen.getByLabelText(/Group name/i) as HTMLInputElement;
    await userEvent.setup().clear(nameInput);
    await userEvent.setup().type(nameInput, 'Renamed');
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Save group/i }),
    );
    await waitFor(() => expect(updateGroupMock).toHaveBeenCalledWith(42,
      expect.objectContaining({ name: 'Renamed' }),
    ));
  });

  it('refresh button refetches the group', async () => {
    getAllGroupsMock.mockResolvedValueOnce([SEED_GROUP]);
    getMembersForGroupMock.mockResolvedValueOnce([]);
    renderAt('42');
    await waitFor(() => expect(screen.getByText(/Alpha Lab/)).toBeInTheDocument());
    expect(getAllGroupsMock).toHaveBeenCalledTimes(1);
    getAllGroupsMock.mockResolvedValueOnce([SEED_GROUP]);
    await userEvent.setup().click(
      screen.getByRole('button', { name: /^Refresh$/i }),
    );
    await waitFor(() => expect(getAllGroupsMock).toHaveBeenCalledTimes(2));
  });
});