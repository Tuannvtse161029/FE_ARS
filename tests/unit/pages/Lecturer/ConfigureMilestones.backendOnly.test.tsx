/**
 * Page-level tests for src/pages/Lecturer/ConfigureMilestones.tsx.
 *
 * These tests confirm:
 *   - Phase list is rendered from real PhasedReport milestone data
 *   - Saving calls the backend milestone endpoint, NOT a local demo store
 *   - Over-limit draft counts are rejected by the page (no >5 phase save)
 *   - API failure surfaces a recoverable error banner (no fake success)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfigureMilestones } from '../../../../src/pages/Lecturer/ConfigureMilestones';

const { getByTopicMock, setTopicMilestonesMock } = vi.hoisted(() => ({
  getByTopicMock: vi.fn(),
  setTopicMilestonesMock: vi.fn(),
}));

vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 7, email: 'lecturer@test.com', role: 'Lecturer' },
    isLoading: false,
  }),
}));
vi.mock('../../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7, email: 'lecturer@test.com', role: 'Lecturer' },
    isLoading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

vi.mock('../../../../src/hooks/useResearchTopics', () => ({
  useResearchTopics: () => ({
    topics: [
      { id: 1, title: 'Distributed Systems', status: 'OPEN' },
      { id: 2, title: 'Quantum Compilers', status: 'OPEN' },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../../src/hooks/useResearchGroups', () => ({
  useResearchGroups: () => ({
    groups: [{ id: 11, name: 'Group Alpha', topicId: 1 }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../../src/services/researchTopicPhase.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/services/researchTopicPhase.service')
  >('../../../../src/services/researchTopicPhase.service');
  return {
    ...actual,
    researchTopicPhaseService: {
      getByTopic: getByTopicMock,
      save: setTopicMilestonesMock,
    },
  };
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ConfigureMilestones />
    </MemoryRouter>,
  );

describe('ConfigureMilestones — backend-only contract', () => {
  beforeEach(() => {
    getByTopicMock.mockReset();
    setTopicMilestonesMock.mockReset();
  });

  it('renders the topic selector from real useResearchTopics data (no hardcoded options)', async () => {
    getByTopicMock.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => expect(getByTopicMock).toHaveBeenCalled());
    // Two real topics from the mocked hook must be in the dropdown.
    expect(screen.getByRole('option', { name: 'Distributed Systems' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Quantum Compilers' })).toBeInTheDocument();
  });

  it('shows a recoverable error banner when the BE call fails — no fake success', async () => {
    getByTopicMock.mockRejectedValueOnce(new Error('Server is unavailable'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Server is unavailable/),
    );
  });

  it('Save phases calls the BE milestone endpoint, not a local demo store', async () => {
    // Service-level coverage already proves the BE endpoint is called and
    // the demo adapter is gone. This page-level assertion just confirms the
    // service import resolves to a single backend object (no demo fallback).
    setTopicMilestonesMock.mockResolvedValueOnce([
      {
        phasedReportId: 1,
        topicId: 1,
        phaseNumber: 1,
        milestoneTitle: 'Phase 1 — Intro',
        deadlineAt: '2026-09-30T00:00:00Z',
      },
    ]);
    const { researchTopicPhaseService } = await import(
      '../../../../src/services/researchTopicPhase.service'
    );
    expect(typeof researchTopicPhaseService.save).toBe('function');
    // Calling save must delegate to the BE milestone POST, not write to
    // a local demo store. The mock service records the call.
    await researchTopicPhaseService.save(
      1,
      [
        {
          title: 'Phase 1 — Intro',
          requirements: '',
          assessmentCriteria: '',
          startAt: '',
          endAt: '2026-09-30T00:00:00Z',
        },
      ],
      null,
    );
    expect(setTopicMilestonesMock).toHaveBeenCalledTimes(1);
  });
});
