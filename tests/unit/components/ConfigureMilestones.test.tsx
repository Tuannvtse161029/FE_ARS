/**
 * Component tests for src/pages/Lecturer/ConfigureMilestones.tsx.
 *
 * Verifies the new card-list view (no `?topicId`) renders topics fetched
 * from the live service and surfaces group chips with phase counts. The
 * detailed MaterialSourcePicker behaviour is tested in its own suite.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigureMilestones } from '../../../src/pages/Lecturer/ConfigureMilestones';

const { getAllTopicsMock, getByTopicMock, getAllGroupsMock } = vi.hoisted(() => ({
  getAllTopicsMock: vi.fn(),
  getByTopicMock: vi.fn(),
  getAllGroupsMock: vi.fn(),
}));

vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { userId: 7, email: 'lecturer@test.com', role: 'Lecturer' },
    isLoading: false,
  }),
}));
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 7, email: 'lecturer@test.com', role: 'Lecturer' },
    isLoading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

vi.mock('../../../src/services/researchTopic.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/services/researchTopic.service')
  >('../../../src/services/researchTopic.service');
  return {
    ...actual,
    researchTopicService: {
      ...actual.researchTopicService,
      getAll: getAllTopicsMock,
      getMyTopics: getAllTopicsMock,
      getById: getByTopicMock,
    },
  };
});

vi.mock('../../../src/services/researchGroup.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/services/researchGroup.service')
  >('../../../src/services/researchGroup.service');
  return {
    ...actual,
    researchGroupService: {
      ...actual.researchGroupService,
      getAll: getAllGroupsMock,
      getMyGroups: getAllGroupsMock,
    },
  };
});

vi.mock('../../../src/services/researchTopicPhase.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/services/researchTopicPhase.service')
  >('../../../src/services/researchTopicPhase.service');
  return {
    ...actual,
    researchTopicPhaseService: {
      ...actual.researchTopicPhaseService,
      getByTopic: getByTopicMock,
    },
  };
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ConfigureMilestones />
    </MemoryRouter>,
  );

describe('<ConfigureMilestones> — card-list view', () => {
  beforeEach(() => {
    getAllTopicsMock.mockReset();
    getByTopicMock.mockReset();
    getAllGroupsMock.mockReset();
  });

  it('renders a topic card for every research topic returned by the service', async () => {
    getAllTopicsMock.mockResolvedValue([
      { id: 1, title: 'Distributed Systems', status: 'OPEN' },
      { id: 2, title: 'Quantum Compilers', status: 'OPEN' },
    ]);
    getAllGroupsMock.mockResolvedValue([]);
    getByTopicMock.mockResolvedValue([]);
    renderPage();

    // Wait for at least one topic heading before asserting on the rest.
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 2, name: /Distributed Systems/ }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { level: 2, name: /Distributed Systems/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Quantum Compilers/ }),
    ).toBeInTheDocument();
  });

  it('shows a "0 phases" chip for every group assigned to a topic', async () => {
    getAllTopicsMock.mockResolvedValue([
      { id: 1, title: 'Distributed Systems', status: 'OPEN' },
    ]);
    getAllGroupsMock.mockResolvedValue([
      { id: 11, name: 'Group Alpha', topicId: 1 },
      { id: 12, name: 'Group Beta', topicId: 1 },
    ]);
    getByTopicMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('group-chip-1-11')).toBeInTheDocument(),
    );
    const chips = screen.getAllByTestId(/^group-chip-1-/);
    expect(chips).toHaveLength(2);
    expect(screen.getByTestId('group-chip-1-11')).toHaveTextContent(/0 phases/);
    expect(screen.getByTestId('group-chip-1-12')).toHaveTextContent(/0 phases/);
  });

  it('shows the correct phase count per group from the BE', async () => {
    getAllTopicsMock.mockResolvedValue([
      { id: 1, title: 'Distributed Systems', status: 'OPEN' },
    ]);
    getAllGroupsMock.mockResolvedValue([
      { id: 11, name: 'Group Alpha', topicId: 1 },
      { id: 12, name: 'Group Beta', topicId: 1 },
    ]);
    // Two phases for group 11, none for group 12.
    getByTopicMock.mockResolvedValue([
      {
        id: 'api-1-1',
        topicId: 1,
        phaseNumber: 1,
        title: 'Phase 1',
        requirements: '',
        assessmentCriteria: '',
        startAt: '',
        endAt: '',
        deadlineAt: '',
        order: 1,
        locked: false,
        source: 'api',
        report: {
          phasedReportId: 1,
          researchGroupId: 11,
          phaseNumber: 1,
          topicId: 1,
        },
      },
      {
        id: 'api-1-2',
        topicId: 1,
        phaseNumber: 2,
        title: 'Phase 2',
        requirements: '',
        assessmentCriteria: '',
        startAt: '',
        endAt: '',
        deadlineAt: '',
        order: 2,
        locked: false,
        source: 'api',
        report: {
          phasedReportId: 2,
          researchGroupId: 11,
          phaseNumber: 2,
          topicId: 1,
        },
      },
    ]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('group-chip-1-11')).toHaveTextContent(
        /2 phases/,
      ),
    );
    expect(screen.getByTestId('group-chip-1-11')).toHaveTextContent(/2 phases/);
    expect(screen.getByTestId('group-chip-1-12')).toHaveTextContent(/0 phases/);
  });

  it('renders a recoverable error banner when the BE call fails', async () => {
    getAllTopicsMock.mockRejectedValueOnce(new Error('Server is unavailable'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Server is unavailable/),
    );
  });
});
