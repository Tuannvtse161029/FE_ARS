/**
 * Component-level tests for src/pages/GraduateStudent/SubmitReport.tsx
 * (per-group milestone table redesign).
 *
 * The September 2026 redesign moved the Submit Report page from
 * "single primary group + topic phase list" to "table of every joined
 * group + every milestone + per-row action". These tests assert the
 * core contract of that new surface.
 *
 * Contract:
 *   - One row per (joined group, milestone) pair.
 *   - The leader row exposes a "Submit report" action; non-leader rows
 *     get a muted note instead.
 *   - The student (leader) can open the submit modal and the modal
 *     receives the correct `researchGroupId` and `groupMemberId`.
 *   - "Student#N" placeholder is no longer rendered — the page now
 *     resolves the lecturer name through the lecturer lookup and falls
 *     back to a generic "your group leader" string when no name is
 *     available.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SubmitReport } from '../../../../src/pages/GraduateStudent/SubmitReport';
import { buildMockAuth } from '../../../../src/utils/mockAuth';

const mockUseAuth = vi.fn();
const mockUseStudentGroups = vi.fn();
const mockUsePhasedReports = vi.fn();
const mockListReportsForGroup = vi.fn();

vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock('../../../../src/hooks/useStudentGroups', () => ({
  useStudentGroups: () => mockUseStudentGroups(),
}));
vi.mock('../../../../src/hooks/usePhasedReports', () => ({
  usePhasedReports: () => mockUsePhasedReports(),
}));
vi.mock('../../../../src/services/phasedReport.service', () => ({
  listReportsForGroup: (...args: unknown[]) =>
    mockListReportsForGroup(...args),
  phasedReportService: {
    getByTopic: vi.fn().mockResolvedValue([]),
    getMembersByTopic: vi.fn().mockResolvedValue([]),
    submitLeaderReport: vi.fn(),
  },
  normalizePhasedReportStatus: (s: string | null | undefined) => s,
}));
vi.mock('../../../../src/components/gradstudent/SubmitReportModal', () => ({
  default: ({
    isOpen,
    onSubmitted,
    groupMemberId,
    researchGroupId,
  }: {
    isOpen: boolean;
    onSubmitted: (report: unknown) => void;
    groupMemberId?: number;
    researchGroupId: number;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="submit-report-modal">
        <span data-testid="modal-group-member-id">
          {String(groupMemberId ?? '')}
        </span>
        <span data-testid="modal-research-group-id">
          {String(researchGroupId)}
        </span>
        <button
          type="button"
          onClick={() =>
            onSubmitted({
              id: 1,
              researchGroupId,
              status: 'SUBMITTED',
              submittedAt: new Date().toISOString(),
              reportFileUrl: 'https://fb/x.pdf',
              groupMemberId,
            })
          }
        >
          Trigger submit success
        </button>
      </div>
    );
  },
}));

const baseGroupsState = () => ({
  primaryGroup: {
    id: 7,
    name: 'Alpha Lab',
    lecturerId: 4,
    topicId: 11,
    membershipId: 99,
    deadline: null,
    isLeader: true,
  },
  primaryTopic: { id: 11, title: 'Speech-to-text', status: 'OPEN' as const },
  joinedGroups: [
    {
      id: 7,
      name: 'Alpha Lab',
      lecturerId: 4,
      topicId: 11,
      joinedAt: '2025-01-01T00:00:00Z',
      membershipId: 99,
      isLeader: true,
    },
  ],
  guidanceProject: null,
  isLoading: false,
  error: null,
  refetch: () => Promise.resolve(),
});

const baseReportsState = () => ({
  reports: [],
  isLoading: false,
  error: null,
  refetch: () => Promise.resolve(),
  latestByStatus: () => null,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SubmitReport />
    </MemoryRouter>,
  );

describe('<SubmitReport> per-group milestone table', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseStudentGroups.mockReset();
    mockUsePhasedReports.mockReset();
    mockListReportsForGroup.mockReset();

    mockUseAuth.mockImplementation(() =>
      buildMockAuth({ role: 'Graduate Student', userId: 9 }),
    );
    mockUseStudentGroups.mockImplementation(() => baseGroupsState());
    mockUsePhasedReports.mockImplementation(() => baseReportsState());
    mockListReportsForGroup.mockResolvedValue([]);
  });

  it('renders the page title and the new milestone-table title', async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/Submit Research Report by Phase/),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Research groups & milestones/),
    ).toBeInTheDocument();
  });

  it('shows one table row per joined group × milestone', async () => {
    mockListReportsForGroup.mockImplementation(async (gid: number) => {
      if (gid === 7) {
        return [
          {
            id: 1,
            researchGroupId: 7,
            groupMemberId: 99,
            status: 'SUBMITTED' as const,
            phaseNumber: 1,
            milestoneTitle: 'Literature review',
            deadlineAt: '2026-10-01T00:00:00Z',
            reportFileUrl: 'https://fb/one.pdf',
            submittedAt: '2025-09-01T00:00:00Z',
          },
          {
            id: 2,
            researchGroupId: 7,
            groupMemberId: 99,
            status: 'WAITING' as const,
            phaseNumber: 2,
            milestoneTitle: 'Methodology',
            deadlineAt: '2026-11-01T00:00:00Z',
          },
        ];
      }
      return [];
    });

    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/Literature review/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/Methodology/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Alpha Lab/i).length).toBeGreaterThan(0);
  });

  it('shows a "Submit report" button on leader rows that have no file', async () => {
    mockListReportsForGroup.mockResolvedValue([
      {
        id: 3,
        researchGroupId: 7,
        groupMemberId: 99,
        status: 'WAITING' as const,
        phaseNumber: 1,
        milestoneTitle: 'Methodology',
        deadlineAt: '2026-11-01T00:00:00Z',
      },
    ]);

    renderPage();
    const submitButton = await screen.findByRole('button', {
      name: /Submit report/i,
    });
    await userEvent.setup().click(submitButton);
    await waitFor(() =>
      expect(screen.getByTestId('submit-report-modal')).toBeInTheDocument(),
    );
    // Modal received the correct group + group-member ids.
    expect(screen.getByTestId('modal-research-group-id')).toHaveTextContent(
      '7',
    );
    expect(screen.getByTestId('modal-group-member-id')).toHaveTextContent('99');
  });

  it('does NOT render the legacy "Student #25" placeholder for the leader', async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/Submit Research Report by Phase/),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Student\s*#\d+/i)).toBeNull();
  });

  it('hides the Submit button on non-leader rows', async () => {
    mockUseStudentGroups.mockImplementation(() => ({
      ...baseGroupsState(),
      primaryGroup: {
        ...baseGroupsState().primaryGroup,
        isLeader: false,
      },
      joinedGroups: [
        {
          ...baseGroupsState().joinedGroups[0],
          isLeader: false,
        },
      ],
    }));
    mockListReportsForGroup.mockResolvedValue([
      {
        id: 4,
        researchGroupId: 7,
        groupMemberId: 99,
        status: 'WAITING' as const,
        phaseNumber: 1,
        milestoneTitle: 'Methodology',
        deadlineAt: '2026-11-01T00:00:00Z',
      },
    ]);

    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Methodology/i)).toBeInTheDocument(),
    );
    // The "Submit report" button on a non-leader row is replaced by a
    // muted explainer.
    expect(
      screen.queryByRole('button', { name: /Submit report/i }),
    ).toBeNull();
    expect(
      screen.getByText(/Only the group leader can submit/i),
    ).toBeInTheDocument();
  });

  it('refreshes the per-group table after a successful submit', async () => {
    let refetchCalls = 0;
    mockListReportsForGroup.mockImplementation(async (gid: number) => {
      refetchCalls += 1;
      return gid === 7
        ? [
            {
              id: 5,
              researchGroupId: 7,
              groupMemberId: 99,
              status:
                refetchCalls > 1
                  ? ('SUBMITTED' as const)
                  : ('WAITING' as const),
              phaseNumber: 1,
              milestoneTitle: 'Methodology',
              deadlineAt: '2026-11-01T00:00:00Z',
              reportFileUrl:
                refetchCalls > 1 ? 'https://fb/sub.pdf' : undefined,
              submittedAt:
                refetchCalls > 1 ? '2025-10-10T00:00:00Z' : undefined,
            },
          ]
        : [];
    });

    renderPage();
    const submitButton = await screen.findByRole('button', {
      name: /Submit report/i,
    });
    await userEvent.setup().click(submitButton);
    await waitFor(() =>
      expect(screen.getByTestId('submit-report-modal')).toBeInTheDocument(),
    );
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Trigger submit success/i }),
    );
    await waitFor(() => expect(refetchCalls).toBeGreaterThanOrEqual(2));
  });
});
