/**
 * Component tests for src/components/gradstudent/InvitationBanner.tsx.
 *
 * Per the contract §2, the BE has no /api/GroupInvitation endpoint, so
 * the Accept / Decline buttons intentionally do NOT issue a network
 * request. The banner surfaces an inline disclaimer.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  InvitationBanner,
  type InvitationPreview,
} from '../../../src/components/gradstudent/InvitationBanner';

const INV: InvitationPreview = {
  id: 'inv-1',
  lecturerName: 'Prof. Smith',
  groupName: 'Alpha Lab',
  topicTitle: 'Speech-to-text',
  sentAt: '2025-01-01T00:00:00Z',
};

describe('<InvitationBanner>', () => {
  it('renders nothing when invitation is null', () => {
    const { container } = render(
      <InvitationBanner invitation={null} onAccept={vi.fn()} onDecline={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows lecturer + group + topic', () => {
    render(<InvitationBanner invitation={INV} />);
    expect(screen.getByText(/New group invitation/i)).toBeInTheDocument();
    expect(screen.getByText(/Prof\. Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Alpha Lab/)).toBeInTheDocument();
    expect(screen.getByText(/Speech-to-text/)).toBeInTheDocument();
  });

  it('surfaces the BE-gap disclaimer inline', () => {
    render(<InvitationBanner invitation={INV} />);
    expect(
      screen.getByText(/Invitations are advisory until the BE endpoint is available/),
    ).toBeInTheDocument();
  });

  it('Accept is a no-op that fires the local callback (per contract §2)', async () => {
    const onAccept = vi.fn();
    render(
      <InvitationBanner invitation={INV} onAccept={onAccept} />,
    );
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Accept invitation/i }),
    );
    expect(onAccept).toHaveBeenCalledWith(INV);
  });

  it('Decline fires the local callback (no network call)', async () => {
    const onDecline = vi.fn();
    render(
      <InvitationBanner invitation={INV} onDecline={onDecline} />,
    );
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Decline invitation/i }),
    );
    expect(onDecline).toHaveBeenCalledWith(INV);
  });

  it('shows Dismiss button only when onDismiss is provided', () => {
    const { rerender } = render(<InvitationBanner invitation={INV} />);
    expect(
      screen.queryByRole('button', { name: /Dismiss invitation banner/i }),
    ).not.toBeInTheDocument();

    rerender(<InvitationBanner invitation={INV} onDismiss={() => undefined} />);
    expect(
      screen.getByRole('button', { name: /Dismiss invitation banner/i }),
    ).toBeInTheDocument();
  });

  it('shows the status pill and hides Accept/Decline when status is not pending', () => {
    const expired: InvitationPreview = { ...INV, status: 'expired' };
    render(<InvitationBanner invitation={expired} />);
    expect(
      screen.queryByRole('button', { name: /Accept invitation/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Decline invitation/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Expired/i)).toBeInTheDocument();
    // Disclaimer text is hidden for non-actionable states.
    expect(
      screen.queryByText(/Invitations are advisory until the BE endpoint/),
    ).not.toBeInTheDocument();
  });

  it('treats invitations without an explicit status as pending (backward-compat)', () => {
    render(<InvitationBanner invitation={INV} />);
    expect(
      screen.getByRole('button', { name: /Accept invitation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Decline invitation/i }),
    ).toBeInTheDocument();
  });
});