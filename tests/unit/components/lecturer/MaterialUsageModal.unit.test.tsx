/**
 * Component tests for src/components/lecturer/MaterialUsageModal.tsx.
 *
 * Assertions:
 *
 *   TC-3 (loading): when `loading=true`, the modal must render a skeleton
 *                    list (not the real content and not the "nothing links"
 *                    empty state).
 *
 *   TC-4 (error):   when `error=true`, the modal must NOT show the
 *                    "Nothing links to this material yet" empty state.
 *                    Instead it must show an error state with an optional
 *                    Retry button.
 *
 *   TC-2 (valid):   topics and phases from props are rendered correctly
 *                    in the respective sections.
 *
 *   Modal rendering: when both topics and phases are provided, the correct
 *                    counts appear in the section headers and intro text.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResearchTopic } from '../../../../src/types/research';
import type { PhasedReport } from '../../../../src/services/phasedReport.service';
import type { LearningMaterial } from '../../../../src/services/learningMaterial.service';
import { MaterialUsageModal } from '../../../../src/components/lecturer/MaterialUsageModal';

const SEED_MATERIAL: LearningMaterial = {
  id: 5,
  title: 'Test Material',
  fileUrl: 'https://example.com/material.pdf',
  lecturerId: 1,
};

const TOPIC_1: ResearchTopic = {
  id: 1,
  title: 'Distributed Systems',
  status: 'OPEN',
};

const TOPIC_2: ResearchTopic = {
  id: 2,
  title: 'Quantum Compilers',
  status: 'CLOSED',
};

const PHASE_1: PhasedReport = {
  topicId: 1,
  researchGroupId: 10,
  phaseNumber: 1,
  milestoneTitle: 'Phase 1 — Intro',
  deadlineAt: '2026-12-31T23:59:00Z',
  phasedMaterialsUrl: 'https://example.com/material.pdf',
};

const PHASE_2: PhasedReport = {
  topicId: 2,
  researchGroupId: 20,
  phaseNumber: 2,
  milestoneTitle: 'Phase 2 — Review',
  deadlineAt: '2027-01-15T00:00:00Z',
  phasedMaterialsUrl: 'https://example.com/material.pdf',
};

const renderModal = (overrides: {
  isOpen?: boolean;
  material?: LearningMaterial | null;
  usedByTopics?: ResearchTopic[];
  usedByPhases?: PhasedReport[];
  loading?: boolean;
  error?: boolean;
  onNavigate?: ReturnType<typeof vi.fn>;
  onRetry?: () => void;
} = {}) => {
  const onNavigate = overrides.onNavigate ?? vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <MaterialUsageModal
      isOpen={overrides.isOpen ?? true}
      material={overrides.material ?? SEED_MATERIAL}
      usedByTopics={overrides.usedByTopics ?? []}
      usedByPhases={overrides.usedByPhases ?? []}
      loading={overrides.loading ?? false}
      error={overrides.error ?? false}
      onNavigate={onNavigate}
      onClose={onClose}
      onRetry={overrides.onRetry}
    />,
  );
  return {
    ...utils,
    ctx: utils.container.ownerDocument,
    onNavigate,
    onClose,
  };
};

describe('<MaterialUsageModal>', () => {
  // ── TC-3: Loading state ────────────────────────────────────────────────────

  describe('TC-3: loading state', () => {
    it('renders a skeleton list when loading=true', () => {
      renderModal({ loading: true, usedByTopics: [TOPIC_1], usedByPhases: [PHASE_1] });

      // Skeleton rows must be present (rendered via key="sk-N", use class check)
      const skeletonList = document.querySelector('[class*="skeletonList"]');
      expect(skeletonList).not.toBeNull();
      const skeletons = skeletonList!.querySelectorAll('[class*="skeletonRow"]');
      expect(skeletons.length).toBeGreaterThan(0);

      // Real content must NOT be rendered during loading
      expect(screen.queryByText('Distributed Systems')).not.toBeInTheDocument();
      expect(screen.queryByText('Phase 1')).not.toBeInTheDocument();

      // "Nothing links" must NOT appear during loading
      expect(screen.queryByText(/nothing links/i)).not.toBeInTheDocument();
    });

    it('shows the loading intro text while loading', () => {
      renderModal({ loading: true });
      expect(screen.getByText(/Scanning your topics and phases/i)).toBeInTheDocument();
    });
  });

  // ── TC-4: Error state ─────────────────────────────────────────────────────

  describe('TC-4: error state', () => {
    it('does NOT show "Nothing links to this material yet" on error', () => {
      renderModal({ error: true, usedByTopics: [], usedByPhases: [] });

      // The "nothing links" empty state must not appear on an error
      expect(screen.queryByText(/nothing links/i)).not.toBeInTheDocument();
    });

    it('shows the error intro text when error=true', () => {
      renderModal({ error: true });
      expect(screen.getByText(/Failed to load usage details/i)).toBeInTheDocument();
    });

    it('renders the error state UI with an optional retry button', () => {
      const handleRetry = vi.fn();
      renderModal({ error: true, onRetry: handleRetry });

      // The error state must be present
      expect(screen.getByText(/Could not load usage details/i)).toBeInTheDocument();

      // Retry button must be rendered when onRetry is provided
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      expect(retryBtn).toBeInTheDocument();

      // Clicking retry calls onRetry
      retryBtn.click();
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('does not render a retry button when onRetry is not provided', () => {
      renderModal({ error: true, onRetry: undefined });
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('renders error state even when usedByTopics / usedByPhases are non-empty (stale)', () => {
      // Even if the modal receives old data, the error state takes precedence
      renderModal({ error: true, usedByTopics: [TOPIC_1], usedByPhases: [PHASE_1] });
      expect(screen.queryByText(/nothing links/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Failed to load usage details/i)).toBeInTheDocument();
    });
  });

  // ── TC-2: Valid data ──────────────────────────────────────────────────────

  describe('TC-2: topics and phases from props are rendered correctly', () => {
    it('renders all provided topics in the Research Topics section', () => {
      renderModal({ usedByTopics: [TOPIC_1, TOPIC_2] });

      const section = screen.getByText(/Research Topics \(2\)/);
      expect(section).toBeInTheDocument();

      const topicList = screen.getByRole('list');
      const items = within(topicList).getAllByRole('listitem');
      expect(items).toHaveLength(2);

      expect(screen.getByText('Distributed Systems')).toBeInTheDocument();
      expect(screen.getByText('Quantum Compilers')).toBeInTheDocument();
    });

    it('renders all provided phases in the Phases section', () => {
      renderModal({ usedByPhases: [PHASE_1, PHASE_2] });

      const section = screen.getByText(/Phases \(2\)/);
      expect(section).toBeInTheDocument();

      const phaseList = screen.getByRole('list');
      const items = within(phaseList).getAllByRole('listitem');
      expect(items).toHaveLength(2);
    });

    it('shows the correct count in the intro when both topics and phases are provided', () => {
      renderModal({ usedByTopics: [TOPIC_1], usedByPhases: [PHASE_1] });

      expect(
        screen.getByText(/referenced by 1 topic\(s\) and 1 phase\(s\)/),
      ).toBeInTheDocument();
    });

    it('renders the empty state only when all three conditions are met: no loading, no error, no results', () => {
      // Should show "nothing links" when not loading, no error, and no data
      const { unmount } = renderModal({ usedByTopics: [], usedByPhases: [] });
      expect(screen.getByText(/nothing links to this material yet/i)).toBeInTheDocument();
      unmount();

      // Must NOT show "nothing links" when loading
      renderModal({ loading: true, usedByTopics: [], usedByPhases: [] });
      expect(screen.queryByText(/nothing links/i)).not.toBeInTheDocument();
    });

    it('renders nothing when isOpen=false', () => {
      const { container } = renderModal({ isOpen: false });
      expect(container.firstChild).toBeNull();
    });
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  describe('navigation', () => {
    it('calls onNavigate with topic target when a topic row is clicked', async () => {
      const user = userEvent.setup();
      const { onNavigate } = renderModal({ usedByTopics: [TOPIC_1] });

      const topicRow = screen.getByRole('button', { name: /Open topic/i });
      await user.click(topicRow);

      expect(onNavigate).toHaveBeenCalledWith({ kind: 'topic', topicId: 1 });
    });

    it('calls onNavigate with phase target when a phase row is clicked', async () => {
      const user = userEvent.setup();
      const { onNavigate } = renderModal({ usedByPhases: [PHASE_1] });

      const phaseRow = screen.getByRole('button', { name: /Open phase/i });
      await user.click(phaseRow);

      expect(onNavigate).toHaveBeenCalledWith({
        kind: 'phase',
        topicId: 1,
        groupId: 10,
        phaseNumber: 1,
      });
    });
  });
});
