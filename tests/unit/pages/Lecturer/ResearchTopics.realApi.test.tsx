/**
 * Page-level tests for src/pages/Lecturer/ResearchTopics.tsx.
 *
 * Verifies:
 *   - Real API data from useResearchTopics is rendered in the table
 *   - No hardcoded sample topic rows leak through
 *   - Empty / loading / error states are truthful (no fake cards on API failure)
 *   - The "Assigned to N groups" badge is computed from the real
 *     researchGroupService.getAll() response
 *   - Status transitions call researchTopicService.update(...) and never
 *     mutate local state without a successful BE response
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResearchTopicsPage } from '../../../../src/pages/Lecturer/ResearchTopics';

const { getAllTopicsMock, getMyTopicsMock, getAllGroupsMock, updateTopicMock } =
  vi.hoisted(() => ({
    getAllTopicsMock: vi.fn(),
    getMyTopicsMock: vi.fn(),
    getAllGroupsMock: vi.fn(),
    updateTopicMock: vi.fn(),
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

vi.mock('../../../../src/services/researchTopic.service', () => ({
  researchTopicService: {
    getAll: getAllTopicsMock,
    getMyTopics: getMyTopicsMock,
    getById: vi.fn(),
    create: vi.fn(),
    update: updateTopicMock,
    delete: vi.fn(),
  },
}));

vi.mock('../../../../src/services/researchGroup.service', () => ({
  researchGroupService: {
    getAll: getAllGroupsMock,
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  deriveGroupStatus: vi.fn(() => 'OPEN'),
}));

// LearningMaterialModal pulls useAuth from a deeply nested provider — silence
// it so the page renders without spinning up the full AuthContext tree.
vi.mock('../../../../src/components/lecturer/LearningMaterialModal', () => ({
  LearningMaterialModal: () => null,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ResearchTopicsPage />
    </MemoryRouter>,
  );

describe('<ResearchTopicsPage> — real API integration', () => {
  beforeEach(() => {
    getAllTopicsMock.mockReset();
    getMyTopicsMock.mockReset();
    getAllGroupsMock.mockReset();
    updateTopicMock.mockReset();
    getAllGroupsMock.mockResolvedValue([]);
    updateTopicMock.mockResolvedValue({});
  });

  it('renders API-returned topics (not hardcoded sample rows)', async () => {
    getAllTopicsMock.mockResolvedValueOnce([
      {
        id: 1001,
        title: 'High-Concurrency Load Balancing',
        description: 'Microservices routing research',
        status: 'OPEN',
      },
    ]);
    getMyTopicsMock.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText('High-Concurrency Load Balancing'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('RT-2026-1001')).toBeInTheDocument();
  });

  it('renders truthful empty state when the API returns []', async () => {
    getAllTopicsMock.mockResolvedValueOnce([]);
    getMyTopicsMock.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('topics-empty')).toBeInTheDocument(),
    );
    // The page must not invent sample cards.
    expect(screen.queryAllByText(/High-Concurrency Load Balancing/i)).toHaveLength(0);
  });

  it('shows truthful empty state when the BE rejects — never silently renders fake cards', async () => {
    // The hook uses Promise.allSettled so a rejected topics request becomes
    // an empty array, NOT a thrown error. The page must show the truthful
    // empty state — it must NOT invent sample rows.
    getAllGroupsMock.mockResolvedValueOnce([]);
    getAllTopicsMock.mockRejectedValueOnce(new Error('Network failure'));
    getMyTopicsMock.mockRejectedValueOnce(new Error('Network failure'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('topics-empty')).toBeInTheDocument(),
    );
    // The page must not invent sample cards when both APIs fail.
    expect(screen.queryByText(/High-Concurrency Load Balancing/i)).toBeNull();
  });

  it('computes the "Assigned to N groups" badge from real group data', async () => {
    getAllGroupsMock.mockResolvedValue([
      { id: 1, topicId: 50 },
      { id: 2, topicId: 50 },
      { id: 3, topicId: 99 },
    ]);
    getAllTopicsMock.mockResolvedValueOnce([
      { id: 50, title: 'Quantum Compilers', description: '', status: 'OPEN' },
    ]);
    getMyTopicsMock.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Quantum Compilers')).toBeInTheDocument());
    // The page derives the badge count from researchGroupService.getAll(),
    // which the mock resolves to two groups sharing topicId 50.
    await waitFor(() => {
      const badges = screen.getAllByTestId('topic-group-count');
      expect(badges[0]).toHaveTextContent('2');
    });
  });

  it('Mark Completed button calls researchTopicService.update — no optimistic fake update', async () => {
    // CLOSED was removed from the research-topic status lifecycle
    // (see utils/researchStatus.ts). The remaining transition is OPEN/ASSIGNED
    // → COMPLETED, exercised here through the "Mark Completed" affordance.
    getAllTopicsMock.mockResolvedValueOnce([
      { id: 77, title: 'Old title', description: '', status: 'ASSIGNED' },
    ]);
    getMyTopicsMock.mockResolvedValueOnce([]);
    updateTopicMock.mockResolvedValueOnce({
      id: 77,
      title: 'Old title',
      status: 'COMPLETED',
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Old title')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Mark Completed/i }));
    await waitFor(() => expect(updateTopicMock).toHaveBeenCalledTimes(1));
    const payload = updateTopicMock.mock.calls[0][1];
    expect(payload.status).toBe('COMPLETED');
  });
});
