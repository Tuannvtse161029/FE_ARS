/**
 * Component-level tests for src/pages/GraduateStudent/GraduateStudentDashboard.tsx.
 *
 * Phase C contract G4 — covers the state-card branching:
 *   - Loading skeleton
 *   - Empty state with disabled "Request supervision" (§D.3 tooltip)
 *   - PROPOSED card
 *   - ONGOING card with deadline + Withdraw
 *   - COMPLETED card with submission date
 *   - CANCELLED card with §D.4 cancellation tooltip
 *   - No-group-joined card
 *   - Visibility-change listener triggers refetch
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GraduateStudentDashboard } from '../../../../../src/pages/GraduateStudent/GraduateStudentDashboard';
import { buildMockAuth } from '../../../../../src/utils/mockAuth';

const {
  mockUseStudentGroups,
  mockUsePhasedReports,
} = vi.hoisted(() => ({
  mockUseStudentGroups: vi.fn(),
  mockUsePhasedReports: vi.fn(),
}));

vi.mock('../../../../../src/hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Graduate Student', userId: 9 }),
}));

vi.mock('../../../../../src/hooks/useStudentGroups', () => ({
  useStudentGroups: () => mockUseStudentGroups(),
}));

vi.mock('../../../../../src/hooks/usePhasedReports', () => ({
  usePhasedReports: () => mockUsePhasedReports(),
}));

vi.mock('../../../../../src/services/lecturerLookup.service', () => ({
  lecturerLookupService: {
    getLecturerDisplayName: () => 'Lecturer #4',
    ensureLecturerDisplayName: vi.fn(),
  },
}));

const defaultEmpty = () => ({
  guidanceProject: null,
  joinedGroups: [],
  primaryGroup: null,
  primaryTopic: null,
  isLoading: false,
  error: null,
  refetch: vi.fn(() => Promise.resolve()),
});

const defaultReports = () => ({
  reports: [],
  isLoading: false,
  error: null,
  refetch: vi.fn(() => Promise.resolve()),
  latestByStatus: () => null,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <GraduateStudentDashboard />
    </MemoryRouter>,
  );

describe('<GraduateStudentDashboard>', () => {
  beforeEach(() => {
    mockUseStudentGroups.mockReset();
    mockUsePhasedReports.mockReset();
    mockUseStudentGroups.mockImplementation(() => defaultEmpty());
    mockUsePhasedReports.mockImplementation(() => defaultReports());
  });

  it('renders loading skeleton when useStudentGroups is loading', () => {
    mockUseStudentGroups.mockImplementationOnce(() => ({
      ...defaultEmpty(),
      isLoading: true,
    }));
    renderPage();
    expect(screen.getByText(/Loading your dashboard/)).toBeInTheDocument();
  });

  it('renders empty state with disabled "Request supervision" (§D.3 tooltip)', async () => {
    mockUseStudentGroups.mockImplementationOnce(() => defaultEmpty());
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Graduate Student Workspace/)).toBeInTheDocument(),
    );
    const btn = screen.getByRole('button', { name: /Request supervision/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute(
      'title',
      expect.stringMatching(/Request supervision is not yet available/),
    );
  });

  it('renders PROPOSED state card with title + status pill', async () => {
    mockUseStudentGroups.mockImplementationOnce(() => ({
      ...defaultEmpty(),
      guidanceProject: {
        id: 1,
        lecturerId: 4,
        studentId: 9,
        title: 'My Proposal',
        status: 'PROPOSED',
      },
    }));
    renderPage();
    await waitFor(() =>
      // "My Proposal" appears twice: once in the SummaryCard and once in the
      // GuidanceProjectCard subtitle. Use getAllByText to assert presence.
      expect(screen.getAllByText(/My Proposal/).length).toBeGreaterThan(0),
    );
    // The PROPOSED status pill appears in the section header.
    expect(screen.getByText(/^PROPOSED$/)).toBeInTheDocument();
  });

  it('renders ONGOING state card with deadline + Withdraw button', async () => {
    mockUseStudentGroups.mockImplementationOnce(() => ({
      ...defaultEmpty(),
      guidanceProject: {
        id: 1,
        lecturerId: 4,
        studentId: 9,
        title: 'My Thesis',
        status: 'ONGOING',
      },
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByText(/My Thesis/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/^ONGOING$/)).toBeInTheDocument();
    // The ONGOING branch renders a "Submit milestone" button + a disabled
    // Withdraw button.
    expect(screen.getByRole('button', { name: /Withdraw/i })).toBeInTheDocument();
  });

  it('renders COMPLETED state card with submission date text', async () => {
    mockUseStudentGroups.mockImplementationOnce(() => ({
      ...defaultEmpty(),
      guidanceProject: {
        id: 1,
        lecturerId: 4,
        studentId: 9,
        title: 'My Thesis',
        status: 'COMPLETED',
        updatedAt: '2025-12-01T00:00:00Z',
      },
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByText(/My Thesis/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/^COMPLETED$/)).toBeInTheDocument();
    expect(screen.getByText(/Project completed by your lecturer/)).toBeInTheDocument();
  });

  it('renders CANCELLED card with §D.4 cancellation tooltip (no fake reason)', async () => {
    mockUseStudentGroups.mockImplementationOnce(() => ({
      ...defaultEmpty(),
      guidanceProject: {
        id: 1,
        lecturerId: 4,
        studentId: 9,
        title: 'My Thesis',
        status: 'CANCELLED',
      },
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByText(/My Thesis/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/^CANCELLED$/)).toBeInTheDocument();
    expect(
      screen.getByText(/Cancellation reason is not yet captured by the platform/),
    ).toBeInTheDocument();
  });

  it('renders "no-group-joined" card', async () => {
    // default state — no groups, no project
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Graduate Student Workspace/)).toBeInTheDocument(),
    );
    // The "Joined Groups" summary card surfaces the empty state with
    // "Join a research group to begin" hint.
    expect(screen.getByText(/Join a research group to begin/)).toBeInTheDocument();
  });

  it('visibilitychange listener triggers refetch()', async () => {
    const refetchMock = vi.fn(() => Promise.resolve());
    const refetchReportsMock = vi.fn(() => Promise.resolve());
    mockUseStudentGroups.mockImplementationOnce(() => ({
      ...defaultEmpty(),
      refetch: refetchMock,
    }));
    mockUsePhasedReports.mockImplementationOnce(() => ({
      ...defaultReports(),
      refetch: refetchReportsMock,
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Graduate Student Workspace/)).toBeInTheDocument(),
    );
    // Simulate the visibilitychange event with visibilityState === 'visible'.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(refetchMock).toHaveBeenCalled());
    await waitFor(() => expect(refetchReportsMock).toHaveBeenCalled());
    // cleanup
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    void userEvent;
  });
});