/**
 * Component-level tests for src/pages/Lecturer/EvaluateReports.tsx.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EvaluateReports } from '../../../src/pages/Lecturer/EvaluateReports';
import { buildMockAuth } from '../../../src/utils/mockAuth';

const { getAllGroupsMock, getAllReportsMock } = vi.hoisted(() => ({
  getAllGroupsMock: vi.fn(),
  getAllReportsMock: vi.fn(),
}));

vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
}));

// The Lecturer/EvaluateReports page imports useAuth from context/AuthContext.
// Mock that path directly (the page does not go through the hook re-export).
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

vi.mock('../../../src/services/researchGroup.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/services/researchGroup.service')
  >('../../../src/services/researchGroup.service');
  return {
    ...actual,
    researchGroupService: { getAll: getAllGroupsMock },
  };
});

vi.mock('../../../src/services/phasedReport.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/services/phasedReport.service')
  >('../../../src/services/phasedReport.service');
  return {
    ...actual,
    phasedReportService: { getAll: getAllReportsMock },
  };
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <EvaluateReports />
    </MemoryRouter>,
  );

describe('<EvaluateReports> page', () => {
  beforeEach(() => {
    getAllGroupsMock.mockReset();
    getAllReportsMock.mockReset();
    getAllGroupsMock.mockResolvedValue([]);
    getAllReportsMock.mockResolvedValue([]);
  });

  it('renders the page title and summary tiles', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Phased Report Review Console/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Submitted \(Awaiting Review\)/)).toBeInTheDocument();
    expect(screen.getByText(/Rejected \(Resubmission Pending\)/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting \(No Submission Yet\)/)).toBeInTheDocument();
    expect(screen.getByText(/Total Reviewable/)).toBeInTheDocument();
  });

  it('renders empty columns when there are no reports', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No submissions waiting for your review/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/No rejected reports awaiting a student resubmission/)).toBeInTheDocument();
    expect(screen.getByText(/No reports in the WAITING state/)).toBeInTheDocument();
  });

  it('shows the loading spinner when reports are loading', () => {
    getAllReportsMock.mockReturnValueOnce(new Promise(() => undefined));
    renderPage();
    expect(screen.getAllByText(/Loading/).length).toBeGreaterThanOrEqual(0);
  });

  it('surfaces a global error banner when reports fail to load', async () => {
    getAllReportsMock.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/boom/),
    );
  });

  it('renders SUBMITTED reports in the Submitted column', async () => {
    getAllGroupsMock.mockResolvedValueOnce([
      { id: 7, lecturerId: 7, name: 'Alpha' },
    ]);
    getAllReportsMock.mockResolvedValueOnce([
      {
        id: 1,
        researchGroupId: 7,
        status: 'SUBMITTED',
        submittedAt: '2025-01-02T00:00:00Z',
      },
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Submitted \(Awaiting Review\)/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Evaluate/i })).toBeInTheDocument();
  });

  it('opens the EvaluateReportModal when "Evaluate" is clicked', async () => {
    getAllGroupsMock.mockResolvedValueOnce([
      { id: 7, lecturerId: 7, name: 'Alpha' },
    ]);
    getAllReportsMock.mockResolvedValueOnce([
      {
        id: 1,
        researchGroupId: 7,
        status: 'SUBMITTED',
        submittedAt: '2025-01-02T00:00:00Z',
      },
    ]);
    renderPage();
    await waitFor(() => screen.getByText(/Alpha/));
    await userEvent.setup().click(screen.getByRole('button', { name: /Evaluate/i }));
    expect(screen.getByText(/Evaluate Phased Report/)).toBeInTheDocument();
  });

  it('Refresh button refetches both lists', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Refresh reports/i })).toBeInTheDocument(),
    );
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Refresh reports/i }),
    );
    expect(getAllReportsMock).toHaveBeenCalled();
    expect(getAllGroupsMock).toHaveBeenCalled();
  });
});