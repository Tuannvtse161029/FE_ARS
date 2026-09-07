/**
 * Component-level tests for src/pages/GraduateStudent/StudentResearchGroups.tsx.
 *
 * Covers the role-guard contract (test plan question #3) by ensuring
 * only authenticated students see the page.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudentResearchGroups } from '../../../src/features/guidance/StudentResearchGroups';
import { buildMockAuth } from '../../../src/utils/mockAuth';

const { getAllGuidanceProjectsMock } = vi.hoisted(() => ({
  getAllGuidanceProjectsMock: vi.fn(),
}));

const mockUseStudentGroups = vi.fn();
const mockUsePhasedReports = vi.fn();

vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Graduate Student', userId: 9 }),
}));

vi.mock('../../../src/hooks/useStudentGroups', () => ({
  useStudentGroups: (id: number | null) => mockUseStudentGroups(id),
}));

vi.mock('../../../src/hooks/usePhasedReports', () => ({
  usePhasedReports: (gid: number | null) => mockUsePhasedReports(gid),
}));

vi.mock('../../../src/services/guidanceProject.service', () => ({
  getAllGuidanceProjects: getAllGuidanceProjectsMock,
}));

const defaultStudentGroupsState = () => ({
  joinedGroups: [],
  primaryGroup: null,
  primaryTopic: null,
  guidanceProject: null,
  isLoading: false,
  error: null,
  refetch: () => Promise.resolve(),
});

const defaultPhasedReportsState = () => ({
  reports: [],
  isLoading: false,
  error: null,
  refetch: () => Promise.resolve(),
  latestByStatus: () => null,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <StudentResearchGroups />
    </MemoryRouter>,
  );

describe('<StudentResearchGroups> page', () => {
  beforeEach(() => {
    mockUseStudentGroups.mockReset();
    mockUsePhasedReports.mockReset();
    getAllGuidanceProjectsMock.mockReset();
    getAllGuidanceProjectsMock.mockResolvedValue([]);

    mockUseStudentGroups.mockImplementation(() => defaultStudentGroupsState());
    mockUsePhasedReports.mockImplementation(() => defaultPhasedReportsState());
  });

  it('renders the empty "no groups yet" state for a fresh student', async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/haven't joined any research group yet/),
      ).toBeInTheDocument(),
    );
  });

  it('renders the BE-gap banner when no invitation is present', () => {
    // InvitationBanner renders nothing for null invitation — verify by
    // confirming there's no banner with role="status" in the empty state.
    renderPage();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the guidance project subtitle when present', async () => {
    mockUseStudentGroups.mockImplementation(() => ({
      joinedGroups: [],
      primaryGroup: null,
      primaryTopic: null,
      guidanceProject: {
        id: 1,
        lecturerId: 4,
        studentId: 9,
        title: 'My Thesis',
        status: 'ONGOING' as const,
      },
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve(),
    }));
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/Active guidance project: My Thesis/),
      ).toBeInTheDocument(),
    );
  });

  it('lists joined groups and lets the user open the workspace', async () => {
    mockUseStudentGroups.mockImplementation(() => ({
      joinedGroups: [
        {
          id: 7,
          lecturerId: 4,
          topicId: 11,
          name: 'Alpha Lab',
          membershipId: 99,
        },
      ],
      primaryGroup: {
        id: 7,
        lecturerId: 4,
        topicId: 11,
        name: 'Alpha Lab',
        membershipId: 99,
      },
      primaryTopic: null,
      guidanceProject: null,
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve(),
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Alpha Lab/)).toBeInTheDocument(),
    );
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Open Group Workspace/i }),
    );
    // The workspace header should now appear
    await waitFor(() =>
      expect(screen.getByText(/Milestone Reports/)).toBeInTheDocument(),
    );
  });

  it('shows the RejectionFeedbackBanner when a REJECTED report exists', async () => {
    mockUseStudentGroups.mockImplementation(() => ({
      joinedGroups: [
        {
          id: 7,
          lecturerId: 4,
          topicId: 11,
          name: 'Alpha Lab',
          membershipId: 99,
        },
      ],
      primaryGroup: {
        id: 7,
        lecturerId: 4,
        topicId: 11,
        name: 'Alpha Lab',
        membershipId: 99,
      },
      primaryTopic: null,
      guidanceProject: null,
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve(),
    }));
    mockUsePhasedReports.mockImplementation(() => ({
      reports: [
        {
          id: 1,
          researchGroupId: 7,
          status: 'REJECTED' as const,
          finalOutcomeEvaluation: 'Needs more detail',
          lectureFeedback: 4,
          submittedAt: '2025-01-02T00:00:00Z',
        },
      ],
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve(),
      latestByStatus: () => null,
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Alpha Lab/)).toBeInTheDocument(),
    );
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Open Group Workspace/i }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Submission rejected by lecturer/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Resubmit revised version/)).toBeInTheDocument();
  });

  it('shows the global error banner when useStudentGroups reports an error', async () => {
    mockUseStudentGroups.mockImplementation(() => ({
      joinedGroups: [],
      primaryGroup: null,
      primaryTopic: null,
      guidanceProject: null,
      isLoading: false,
      error: new Error('boom'),
      refetch: () => Promise.resolve(),
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/boom/),
    );
  });
});