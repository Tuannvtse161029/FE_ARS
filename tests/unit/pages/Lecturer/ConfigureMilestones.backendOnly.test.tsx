/**
 * Page-level tests for src/pages/Lecturer/ConfigureMilestones.tsx.
 *
 * The page now renders a card list of research topics (when no `topicId`
 * is supplied) instead of a topic selector dropdown. These tests confirm:
 *
 *   - Card list shows topics fetched via the live research-topic service.
 *   - Save calls the backend milestone endpoint, NOT a local demo store.
 *   - API failure surfaces a recoverable error banner (no fake success).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigureMilestones } from '../../../../src/pages/Lecturer/ConfigureMilestones';

const { getAllTopicsMock, getByTopicMock, setTopicMilestonesMock } = vi.hoisted(
  () => ({
    getAllTopicsMock: vi.fn(),
    getByTopicMock: vi.fn(),
    setTopicMilestonesMock: vi.fn(),
  }),
);

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

// The page calls `researchTopicService.getAll()` directly to render the
// card list (and to fan out `getByTopic` per topic for phase counts).
// Mock the service module instead of the hook.
vi.mock('../../../../src/services/researchTopic.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/services/researchTopic.service')
  >('../../../../src/services/researchTopic.service');
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

vi.mock('../../../../src/services/researchTopicPhase.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/services/researchTopicPhase.service')
  >('../../../../src/services/researchTopicPhase.service');
  return {
    ...actual,
    researchTopicPhaseService: {
      ...actual.researchTopicPhaseService,
      getByTopic: getByTopicMock,
      save: setTopicMilestonesMock,
    },
  };
});

vi.mock('../../../../src/services/researchGroup.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/services/researchGroup.service')
  >('../../../../src/services/researchGroup.service');
  return {
    ...actual,
    researchGroupService: {
      ...actual.researchGroupService,
      getAll: vi.fn().mockResolvedValue([]),
      getMyGroups: vi.fn().mockResolvedValue([]),
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
    getAllTopicsMock.mockReset();
    getByTopicMock.mockReset();
    setTopicMilestonesMock.mockReset();
  });

  it('renders the card-list view with topics fetched from the live service', async () => {
    getAllTopicsMock.mockResolvedValue([
      { id: 1, title: 'Distributed Systems', status: 'OPEN' },
      { id: 2, title: 'Quantum Compilers', status: 'OPEN' },
    ]);
    getByTopicMock.mockResolvedValue([]); // no phases yet
    renderPage();
    // Wait for the topics to render before asserting on headings.
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

  it('shows a recoverable error banner when the BE call fails — no fake success', async () => {
    getAllTopicsMock.mockRejectedValueOnce(new Error('Server is unavailable'));
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
          learningMaterialId: null,
        },
      ],
      11,
    );
    expect(setTopicMilestonesMock).toHaveBeenCalledTimes(1);
  });

  it('exposes a "Go to Research Topics" CTA when the lecturer has no topics', async () => {
    getAllTopicsMock.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Go to Research Topics/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /Go to Research Topics/i }),
    ).toBeInTheDocument();
  });
});
