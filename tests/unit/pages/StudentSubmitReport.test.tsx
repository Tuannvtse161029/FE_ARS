/**
 * Component-level tests for src/pages/GraduateStudent/SubmitReport.tsx.
 *
 * Covers:
 *   - Page header for an authenticated student with a primary group
 *   - Loading + empty states
 *   - RejectionFeedbackBanner path (REJECTED report present)
 *   - Open SubmitReportModal flow
 *   - Global error surfacing
 *   - Auth-required empty-state
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SubmitReport } from '../../../src/pages/GraduateStudent/SubmitReport';
import { buildMockAuth } from '../../../src/utils/mockAuth';

const mockUseStudentGroups = vi.fn();
const mockUsePhasedReports = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock('../../../src/hooks/useStudentGroups', () => ({
  useStudentGroups: () => mockUseStudentGroups(),
}));
vi.mock('../../../src/hooks/usePhasedReports', () => ({
  usePhasedReports: () => mockUsePhasedReports(),
}));

const defaultStudentGroupsState = () => ({
  primaryGroup: {
    id: 7,
    lecturerId: 4,
    topicId: 11,
    name: 'Alpha Lab',
    membershipId: 99,
    deadline: null,
  },
  primaryTopic: { id: 11, title: 'Speech-to-text', status: 'OPEN' as const },
  guidanceProject: null,
  joinedGroups: [],
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
      <SubmitReport />
    </MemoryRouter>,
  );

describe('<SubmitReport> page', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseStudentGroups.mockReset();
    mockUsePhasedReports.mockReset();
    mockUseAuth.mockImplementation(() =>
      buildMockAuth({ role: 'Graduate Student', userId: 9 }),
    );
    mockUseStudentGroups.mockImplementation(() => defaultStudentGroupsState());
    mockUsePhasedReports.mockImplementation(() => defaultPhasedReportsState());
  });

  it('renders the page header and primary group name', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Submit Milestone Research Report/)).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Alpha Lab/).length).toBeGreaterThan(0);
  });

  it('renders the empty state when no prior submission exists', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No prior submission for this group yet/)).toBeInTheDocument(),
    );
  });

  it('opens the SubmitReportModal when "Submit report" is clicked', async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Submit report/i }),
      ).toBeInTheDocument(),
    );
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Submit report/i }),
    );
    // The modal title contains "Submit report — <phase>"
    expect(screen.getByText(/Drag & drop your PDF here/i)).toBeInTheDocument();
  });

  it('renders the RejectionFeedbackBanner when a REJECTED report exists', async () => {
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
      expect(screen.getByText(/Submission rejected by lecturer/)).toBeInTheDocument(),
    );
  });

  it('surfaces a global error when the student-group hook fails', async () => {
    mockUseStudentGroups.mockImplementationOnce(() => ({
      ...defaultStudentGroupsState(),
      error: new Error('boom'),
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/boom/),
    );
  });

  it('shows the "not joined a group" empty state when primaryGroup is null', async () => {
    mockUseStudentGroups.mockImplementationOnce(() => ({
      primaryGroup: null,
      primaryTopic: null,
      guidanceProject: null,
      joinedGroups: [],
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve(),
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/haven't joined a research group/)).toBeInTheDocument(),
    );
  });

  it('renders the "please sign in" empty state when user is missing', async () => {
    mockUseAuth.mockImplementationOnce(() => buildMockAuth({ isAuthenticated: false }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Please sign in to submit a milestone report/)).toBeInTheDocument(),
    );
  });
});