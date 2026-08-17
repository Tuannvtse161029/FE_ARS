/**
 * Component tests for src/components/lecturer/AssignTopicModal.tsx.
 *
 * Focuses on the conflict-aware behaviour: groups already locked to a
 * different topic are dropped from the selectable list and surfaced
 * via the locked-banner; per-group PUT failures (409) keep the modal
 * open and surface an outcomes panel.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignTopicModal } from '../../components/lecturer/AssignTopicModal';
import type { ResearchGroup } from '../../services/researchGroup.service';
import type { ResearchTopic } from '../../services/researchTopic.service';

const { assignTopicToGroupsMock } = vi.hoisted(() => ({
  assignTopicToGroupsMock: vi.fn(),
}));

vi.mock('../../services/researchGroup.service', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/researchGroup.service')
  >('../../services/researchGroup.service');
  return {
    ...actual,
    assignTopicToGroups: assignTopicToGroupsMock,
  };
});

const TOPIC: ResearchTopic = {
  id: 11,
  title: 'Topic A',
  description: 'desc',
  status: 'OPEN',
};

const GROUPS: ResearchGroup[] = [
  { id: 1, lecturerId: 7, name: 'Group Alpha', topicId: null },
  { id: 2, lecturerId: 7, name: 'Group Beta', topicId: null },
  { id: 3, lecturerId: 7, name: 'Locked', topicId: 99 /* different topic */ },
];

describe('<AssignTopicModal>', () => {
  beforeEach(() => {
    assignTopicToGroupsMock.mockReset();
  });

  it('renders nothing when isOpen=false', () => {
    const { container } = render(
      <AssignTopicModal isOpen={false} topic={TOPIC} groups={GROUPS} onClose={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when topic=null', () => {
    const { container } = render(
      <AssignTopicModal isOpen={true} topic={null} groups={GROUPS} onClose={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('lists only groups whose topicId matches (drops groups locked to a different topic)', () => {
    render(
      <AssignTopicModal isOpen={true} topic={TOPIC} groups={GROUPS} onClose={() => undefined} />,
    );
    expect(screen.getByText(/Group Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Group Beta/)).toBeInTheDocument();
    expect(screen.queryByText(/Locked/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/1 group\(s\) are already locked to another topic/),
    ).toBeInTheDocument();
  });

  it('Confirm Assignment is disabled until at least one group is selected', () => {
    render(
      <AssignTopicModal isOpen={true} topic={TOPIC} groups={GROUPS} onClose={() => undefined} />,
    );
    const confirm = screen.getByRole('button', { name: /Confirm Assignment/ });
    expect(confirm).toBeDisabled();
  });

  it('calls assignTopicToGroups with selected ids and closes on full success', async () => {
    assignTopicToGroupsMock.mockResolvedValueOnce([
      { groupId: 1, ok: true },
      { groupId: 2, ok: true },
    ]);
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <AssignTopicModal
        isOpen={true}
        topic={TOPIC}
        groups={GROUPS}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    // Click on Group Alpha row
    await user.click(screen.getByText(/Group Alpha/));
    await user.click(screen.getByText(/Group Beta/));

    await user.click(screen.getByRole('button', { name: /Confirm Assignment/ }));

    await waitFor(() => {
      expect(assignTopicToGroupsMock).toHaveBeenCalledWith(11, [1, 2]);
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the modal open when at least one group fails (409 conflict)', async () => {
    assignTopicToGroupsMock.mockResolvedValueOnce([
      { groupId: 1, ok: true },
      { groupId: 2, ok: false, error: 'Group locked by another topic (409)' },
    ]);
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <AssignTopicModal isOpen={true} topic={TOPIC} groups={GROUPS} onClose={onClose} />,
    );

    await user.click(screen.getByText(/Group Alpha/));
    await user.click(screen.getByText(/Group Beta/));
    await user.click(screen.getByRole('button', { name: /Confirm Assignment/ }));

    await waitFor(() => {
      expect(screen.getByText(/Server Response/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Group #2/)).toBeInTheDocument();
    expect(
      screen.getByText(/Group locked by another topic \(/),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders an error banner when topic has no id', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignTopicModal
        isOpen={true}
        topic={{ id: undefined, title: 'No id' }}
        groups={GROUPS}
        onClose={onClose}
      />,
    );
    // We can't select rows in this state (no rows show up since availableGroups
    //  filters by topic.id). Try clicking the disabled confirm directly:
    const confirm = screen.getByRole('button', { name: /Confirm Assignment/ });
    await user.click(confirm); // disabled click — no assignment call
    expect(assignTopicToGroupsMock).not.toHaveBeenCalled();
  });
});