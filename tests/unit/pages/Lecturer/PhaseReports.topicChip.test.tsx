/**
 * Unit tests for the topic scope chip in src/pages/Lecturer/PhaseReports.tsx
 *
 * Issue #4: The chip must show "Filtered to topic: <name>" instead of
 * "Filtered to topic #N". This file tests the four chip states:
 *   1. Loading — topic is being resolved
 *   2. Resolved — topic name found
 *   3. Missing  — topicId present but topic not in list (fallback)
 *   4. Cleared  — no topicId in URL (chip is hidden)
 *
 * These are unit tests (not integration tests): we mock all data-layer
 * hooks so the test is fast and pinned to the page's chip logic without
 * mounting the full router + auth + API chain.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PhaseReports } from '../../../../src/pages/Lecturer/PhaseReports';

// All data referenced inside vi.hoisted factories must be created INSIDE those
// factories, because vi.hoisted() runs at module evaluation start — before
// any module-scope `const` is initialized, and before imported bindings are
// available (all top-level imports are also hoisted by Vitest to the top of
// the module before module-scope const declarations run).
//
// This single hoisted call creates all shared mock data and functions at once,
// so no cross-factory references are needed.
const [mockPhasedReportService, mockUseResearchGroups, mockUseResearchTopics] =
  vi.hoisted(() => {
    const phasedReportService = {
      getAll: vi.fn().mockResolvedValue([]),
    };

    const useResearchGroups = vi.fn().mockReturnValue({
      groups: [{ id: 1, name: 'Group Alpha', topicId: 10, lecturerId: 7 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const useResearchTopics = vi.fn().mockReturnValue({
      topics: [
        { id: 10, title: 'Deep Learning for NLP' },
        { id: 20, title: 'Reinforcement Learning' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    return [phasedReportService, { useResearchGroups }, { useResearchTopics }];
  });

// Stub for buildMockAuth — defined after vi.hoisted so it doesn't block it
const buildMockAuth = (overrides: Record<string, unknown>) => ({
  user: { userId: 7, role: 'Lecturer', ...overrides },
  role: 'Lecturer',
});

vi.mock('../../../../src/services/phasedReport.service', () => ({
  phasedReportService: mockPhasedReportService,
}));

vi.mock('../../../../src/hooks/useResearchGroups', () => ({
  useResearchGroups: mockUseResearchGroups.useResearchGroups,
}));

vi.mock('../../../../src/hooks/useResearchTopics', () => ({
  useResearchTopics: mockUseResearchTopics.useResearchTopics,
}));

vi.mock('../../../../src/context/AuthContext', () => ({
  useAuth: () => buildMockAuth({}),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

vi.mock('../../../../src/i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

vi.mock('../../../../src/components/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

vi.mock('../../../../src/components/Button/Button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock('../../../../src/components/lecturer/StatusBadge', () => ({
  StatusBadge: ({ label }: { label: string }) => <span data-testid="status-badge">{label}</span>,
}));

vi.mock('../../../../src/components/lecturer/PhaseReportStatusTabs', () => ({
  PhaseReportStatusTabs: vi.fn(() => null),
}));

vi.mock('../../../../src/components/lecturer/PhaseReportDetailModal', () => ({
  PhaseReportDetailModal: vi.fn(() => null),
}));

vi.mock('../../../../src/components/lecturer/ExtendDeadlineModal', () => ({
  ExtendDeadlineModal: vi.fn(() => null),
}));

vi.mock('../../../../src/components/EmptyState', () => ({
  EmptyState: vi.fn(() => null),
}));

vi.mock('../../../../src/components/SkeletonRow', () => ({
  SkeletonRow: vi.fn(() => null),
}));

vi.mock('../../../../src/components/table/TableToolbar', () => ({
  TableToolbar: vi.fn(() => null),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const renderPage = (initialUrl: string): void => {
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <PhaseReports />
    </MemoryRouter>,
  );
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('PhaseReports scope chip — issue #4', () => {
  beforeEach(() => {
    mockPhasedReportService.getAll.mockResolvedValue([]);
    vi.clearAllMocks();
  });

  describe('state 1: loading — while useResearchTopics is fetching', () => {
    it('shows "Loading topic…" when topics are still loading', () => {
      // Override the mock to return loading state
      mockUseResearchTopics.useResearchTopics.mockReturnValueOnce({
        topics: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      renderPage('/lecturer/phase-reports?topicId=10');

      expect(screen.getByText(/Loading topic/i)).toBeInTheDocument();
      expect(screen.getByText(/Filtered to topic:/i)).toBeInTheDocument();
    });
  });

  describe('state 2: resolved — topic name found in the list', () => {
    it('renders "Filtered to topic: Deep Learning for NLP" when topicId=10', () => {
      renderPage('/lecturer/phase-reports?topicId=10');

      expect(
        screen.getByText('Filtered to topic:'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Deep Learning for NLP', { selector: 'strong' }),
      ).toBeInTheDocument();
      // Must NOT show a raw numeric id
      expect(screen.queryByText(/topic #10/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/topic #\d/i)).not.toBeInTheDocument();
    });

    it('renders the correct name for topicId=20', () => {
      renderPage('/lecturer/phase-reports?topicId=20');

      expect(
        screen.getByText('Filtered to topic:'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Reinforcement Learning', { selector: 'strong' }),
      ).toBeInTheDocument();
    });
  });

  describe('state 3: missing — topicId in URL but not in the topic list', () => {
    it('renders "Filtered to topic: Selected research topic" when topic is not in list', () => {
      // topicId=99 is not in mockTopics
      renderPage('/lecturer/phase-reports?topicId=99');

      expect(
        screen.getByText('Filtered to topic:'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Selected research topic', { selector: 'strong' }),
      ).toBeInTheDocument();
      // Must NOT show raw "#99"
      expect(screen.queryByText(/#99/i)).not.toBeInTheDocument();
    });

    it('renders fallback when topic list is empty (network error)', () => {
      mockUseResearchTopics.useResearchTopics.mockReturnValueOnce({
        topics: [],
        isLoading: false,
        error: new Error('Network error'),
        refetch: vi.fn(),
      });

      renderPage('/lecturer/phase-reports?topicId=10');

      expect(
        screen.getByText('Filtered to topic:'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Selected research topic', { selector: 'strong' }),
      ).toBeInTheDocument();
    });
  });

  describe('state 4: cleared — no topicId in URL', () => {
    it('hides the chip when there is no topicId query param', () => {
      renderPage('/lecturer/phase-reports');

      expect(screen.queryByText(/Filtered to topic:/i)).not.toBeInTheDocument();
    });

    it('hides the chip when topicId is empty', () => {
      renderPage('/lecturer/phase-reports?topicId=');

      expect(screen.queryByText(/Filtered to topic:/i)).not.toBeInTheDocument();
    });

    it('hides the chip when topicId is an invalid non-numeric value', () => {
      renderPage('/lecturer/phase-reports?topicId=abc');

      expect(screen.queryByText(/Filtered to topic:/i)).not.toBeInTheDocument();
    });
  });

  describe('Clear filter link', () => {
    it('renders a "Clear filter" link that points to /lecturer/phase-reports', () => {
      renderPage('/lecturer/phase-reports?topicId=10');

      const clearLink = screen.getByRole('link', { name: /clear filter/i });
      expect(clearLink).toHaveAttribute('href', '/lecturer/phase-reports');
    });
  });

  describe('filtering still works after chip change', () => {
    it('passes topicId to the ownedReports filter when present in URL', async () => {
      mockPhasedReportService.getAll.mockResolvedValue([
        {
          id: 1,
          phasedReportId: 1,
          researchGroupId: 1,
          topicId: 10,
          topicTitle: 'Deep Learning for NLP',
          groupName: 'Group Alpha',
          status: 'Pending',
          deadlineAt: '2027-01-01T00:00:00Z',
        },
        {
          id: 2,
          phasedReportId: 2,
          researchGroupId: 1,
          topicId: 99, // Different topic — should be filtered out
          topicTitle: 'Unrelated Topic',
          groupName: 'Group Alpha',
          status: 'Pending',
          deadlineAt: '2027-01-01T00:00:00Z',
        },
      ]);

      renderPage('/lecturer/phase-reports?topicId=10');

      // Only the row with topicId=10 should appear in the table
      expect(screen.queryByText('Deep Learning for NLP')).toBeInTheDocument();
      // The unrelated topic row should not appear
      expect(screen.queryByText('Unrelated Topic')).not.toBeInTheDocument();
    });
  });
});
