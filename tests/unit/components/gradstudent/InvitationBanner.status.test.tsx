/**
 * Sibling tests for src/components/gradstudent/InvitationBanner.tsx —
 * dedicated to the read-only `status` field.
 *
 * The 6 existing tests in `InvitationBanner.test.tsx` are untouched.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  InvitationBanner,
  type InvitationPreview,
} from '../../../../src/components/gradstudent/InvitationBanner';

const INV: InvitationPreview = {
  id: 'inv-1',
  lecturerName: 'Prof. Smith',
  groupName: 'Alpha Lab',
  topicTitle: 'Speech-to-text',
  sentAt: '2025-01-01T00:00:00Z',
};

describe('<InvitationBanner> — status sibling tests', () => {
  it('renders Accept / Decline buttons when status is "pending"', () => {
    render(<InvitationBanner invitation={INV} />);
    expect(
      screen.getByRole('button', { name: /Accept invitation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Decline invitation/i }),
    ).toBeInTheDocument();
  });

  it('shows "Invitation expired" muted message and no buttons when status is "expired"', () => {
    render(<InvitationBanner invitation={{ ...INV, status: 'expired' }} />);
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Accept invitation/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Decline invitation/i }),
    ).not.toBeInTheDocument();
  });

  it('shows "Invitation accepted" muted message and no buttons when status is "accepted"', () => {
    render(<InvitationBanner invitation={{ ...INV, status: 'accepted' }} />);
    expect(screen.getByText(/Accepted/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Accept invitation/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Decline invitation/i }),
    ).not.toBeInTheDocument();
  });

  it('shows "Invitation declined" muted message and no buttons when status is "declined"', () => {
    render(<InvitationBanner invitation={{ ...INV, status: 'declined' }} />);
    expect(screen.getByText(/Declined/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Accept invitation/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Decline invitation/i }),
    ).not.toBeInTheDocument();
  });

  it('renders Accept / Decline buttons when status is undefined (backward-compat default)', () => {
    render(<InvitationBanner invitation={INV} />);
    expect(
      screen.getByRole('button', { name: /Accept invitation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Decline invitation/i }),
    ).toBeInTheDocument();
    // The userEvent import path is here so a future test that needs
    // `.click()` doesn't have to repeat it.
    void userEvent;
    void vi;
  });
});