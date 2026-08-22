/**
 * Tests for the AI ORCID Check button on VerificationDetailsModal.
 *
 * Rules:
 *   - Visible only when user.roleName === 'Reviewer' AND user.orcidId is non-empty
 *     AND user.orcidId is a valid ORCID format
 *   - Visible only when an `onOpenOrcidCheck` callback is provided
 *   - Clicking the button calls `onOpenOrcidCheck` exactly once
 *   - The ORCID iD row in the details grid is rendered when present
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerificationDetailsModal } from '../../../../src/pages/Admin/VerificationDetailsModal';
import type { User } from '../../../../src/types/auth';

const baseUser: User = {
  id: 9001,
  username: 'reviewer.khanh',
  email: 'khanh.reviewer@example.com',
  fullName: 'Tran Van Khanh',
  roleId: 3,
  roleName: 'Reviewer',
  isActive: false,
  orcidId: '0000-0002-1825-0097',
  verificationStatus: 'Pending',
  isEmailVerified: true,
  createdAt: '2026-08-22T00:00:00Z',
};

describe('VerificationDetailsModal — AI ORCID Check button', () => {
  it('shows the AI ORCID Check button when user is Reviewer with valid ORCID', () => {
    render(
      <VerificationDetailsModal
        user={baseUser}
        open={true}
        onClose={() => undefined}
        onOpenOrcidCheck={() => undefined}
      />,
    );
    const button = screen.getByTestId('verification-orcid-check-button');
    expect(button).toBeInTheDocument();
    expect(button.textContent).toMatch(/AI ORCID Check/);
  });

  it('hides the AI ORCID Check button for non-Reviewer roles', () => {
    const lecturer = { ...baseUser, roleName: 'Lecturer' };
    render(
      <VerificationDetailsModal
        user={lecturer}
        open={true}
        onClose={() => undefined}
        onOpenOrcidCheck={() => undefined}
      />,
    );
    expect(screen.queryByTestId('verification-orcid-check-button')).toBeNull();
  });

  it('hides the AI ORCID Check button when ORCID iD is missing', () => {
    const noOrcid = { ...baseUser, orcidId: undefined };
    render(
      <VerificationDetailsModal
        user={noOrcid}
        open={true}
        onClose={() => undefined}
        onOpenOrcidCheck={() => undefined}
      />,
    );
    expect(screen.queryByTestId('verification-orcid-check-button')).toBeNull();
  });

  it('hides the AI ORCID Check button when ORCID iD is malformed', () => {
    const malformed = { ...baseUser, orcidId: 'not-a-valid-orcid' };
    render(
      <VerificationDetailsModal
        user={malformed}
        open={true}
        onClose={() => undefined}
        onOpenOrcidCheck={() => undefined}
      />,
    );
    expect(screen.queryByTestId('verification-orcid-check-button')).toBeNull();
  });

  it('hides the button when no onOpenOrcidCheck callback is provided', () => {
    render(
      <VerificationDetailsModal
        user={baseUser}
        open={true}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByTestId('verification-orcid-check-button')).toBeNull();
  });

  it('clicking the button calls onOpenOrcidCheck', async () => {
    const onOpenOrcidCheck = vi.fn();
    render(
      <VerificationDetailsModal
        user={baseUser}
        open={true}
        onClose={() => undefined}
        onOpenOrcidCheck={onOpenOrcidCheck}
      />,
    );
    const button = screen.getByTestId('verification-orcid-check-button');
    await userEvent.click(button);
    expect(onOpenOrcidCheck).toHaveBeenCalledTimes(1);
  });

  it('displays the ORCID iD row in the details grid', () => {
    render(
      <VerificationDetailsModal
        user={baseUser}
        open={true}
        onClose={() => undefined}
        onOpenOrcidCheck={() => undefined}
      />,
    );
    expect(screen.getByText('0000-0002-1825-0097')).toBeInTheDocument();
  });

  it('handles null roleName safely (button hidden)', () => {
    const noRole = { ...baseUser, roleName: null };
    render(
      <VerificationDetailsModal
        user={noRole}
        open={true}
        onClose={() => undefined}
        onOpenOrcidCheck={() => undefined}
      />,
    );
    expect(screen.queryByTestId('verification-orcid-check-button')).toBeNull();
  });

  it('handles the lowercase "reviewer" role name', () => {
    // The check is case-insensitive — the BE might return 'reviewer' or 'Reviewer'.
    const lowercase = { ...baseUser, roleName: 'reviewer' };
    render(
      <VerificationDetailsModal
        user={lowercase}
        open={true}
        onClose={() => undefined}
        onOpenOrcidCheck={() => undefined}
      />,
    );
    expect(screen.queryByTestId('verification-orcid-check-button')).not.toBeNull();
    cleanup();
  });
});
