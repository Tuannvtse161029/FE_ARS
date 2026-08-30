import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('VerificationDetailsModal ORCID identity disclosure', () => {
  it('does not display a raw ORCID iD when the user response lacks linkage confirmation', () => {
    render(<VerificationDetailsModal user={baseUser} open={true} onClose={() => undefined} />);

    expect(screen.getByText('ORCID identity connection')).toBeInTheDocument();
    expect(screen.getByText(/Connection status is not provided/i)).toBeInTheDocument();
    expect(screen.queryByText('0000-0002-1825-0097')).toBeNull();
  });

  it('explains that ORCID linkage does not decide an ARS role request', () => {
    render(<VerificationDetailsModal user={baseUser} open={true} onClose={() => undefined} />);

    expect(
      screen.getByText(/identity signal; approving this request remains an ARS role decision/i),
    ).toBeInTheDocument();
  });

  it('does not expose the legacy ORCID lookup action from the user verification response', () => {
    render(<VerificationDetailsModal user={baseUser} open={true} onClose={() => undefined} />);

    expect(screen.queryByTestId('verification-orcid-check-button')).toBeNull();
  });
});
