/**
 * Component tests for src/pages/Admin/DenyRoleRequestModal.tsx (Phase C: Admin).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DenyRoleRequestModal } from '../../../pages/Admin/DenyRoleRequestModal';
import type { RoleRequest } from '../../../types/admin';

const NOW = '2026-08-16T10:30:00Z';
const REQUEST: RoleRequest = {
  id: 1234,
  userId: 99,
  userName: 'Pham Test',
  email: 'test@example.com',
  affiliation: 'VNU',
  department: 'CS',
  currentRoles: ['RESEARCHER'],
  requestedAdditionalRoles: ['REVIEWER'],
  requestType: 'ADDITIONAL_ROLE',
  proofDocumentUrl: 'https://example.com/proof.pdf',
  submissionDate: NOW,
  status: 'PENDING',
};

const { adminService } = vi.hoisted(() => ({
  adminService: {
    decideRoleRequest: vi.fn(async (id: number, decision: { status: string; notes?: string }) => ({
      ...REQUEST,
      id,
      status: decision.status as 'DENIED',
      notes: decision.notes,
    })),
    getRoleRequests: vi.fn(async () => []),
    getRoleRequest: vi.fn(async () => null),
    getAccounts: vi.fn(async () => []),
    suspendAccount: vi.fn(async () => ({})),
    unsuspendAccount: vi.fn(async () => ({})),
    getReviewerWithdrawals: vi.fn(async () => []),
    markWithdrawalProcessing: vi.fn(async () => ({})),
    completeWithdrawal: vi.fn(async () => ({})),
    denyWithdrawal: vi.fn(async () => ({})),
    getAnalyticsSummary: vi.fn(async () => ({ totalMembers: 0, totalPapers: 0 })),
    getAnalyticsTimeseries: vi.fn(async () => ({
      range: 'daily',
      metric: 'revenue',
      points: [],
    })),
    __resetAdminMockStores: vi.fn(),
  },
}));

vi.mock('../../../services/admin.service', () => ({ adminService }));

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof DenyRoleRequestModal>> = {},
) => {
  const onClose = vi.fn();
  const onActioned = vi.fn();
  const utils = render(
    <DenyRoleRequestModal
      request={REQUEST}
      open
      onClose={onClose}
      onActioned={onActioned}
      {...overrides}
    />,
  );
  return { onClose, onActioned, ...utils };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<DenyRoleRequestModal>', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <DenyRoleRequestModal
        request={REQUEST}
        open={false}
        onClose={vi.fn()}
        onActioned={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('textarea enforces min 10 / max 1000 chars and shows a counter', async () => {
    const user = userEvent.setup();
    renderModal();
    const textarea = screen.getByLabelText(/Reason for denial/i) as HTMLTextAreaElement;
    expect(textarea).toHaveAttribute('minLength', '10');
    expect(textarea).toHaveAttribute('maxLength', '1000');
    expect(textarea).toBeRequired();
    expect(screen.getByText(/0 \/ 1,000/)).toBeInTheDocument();
    await user.type(textarea, 'short');
    expect(screen.getByText(/5 \/ 1,000/)).toBeInTheDocument();
  });

  it('rejects a reason shorter than 10 chars with a validation error', async () => {
    const user = userEvent.setup();
    renderModal();
    const textarea = screen.getByLabelText(/Reason for denial/i);
    await user.type(textarea, 'short');
    await user.click(screen.getByRole('button', { name: /Confirm Denial/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/at least 10 characters/);
    expect(adminService.decideRoleRequest).not.toHaveBeenCalled();
  });

  it('successful denial passes the trimmed reason to adminService.decideRoleRequest', async () => {
    const user = userEvent.setup();
    const { onActioned, onClose } = renderModal();
    const textarea = screen.getByLabelText(/Reason for denial/i);
    await user.type(textarea, '   Proof was a CV, not a research focus statement.   ');
    await user.click(screen.getByRole('button', { name: /Confirm Denial/i }));
    await waitFor(() => {
      expect(adminService.decideRoleRequest).toHaveBeenCalledWith(1234, {
        status: 'DENIED',
        notes: 'Proof was a CV, not a research focus statement.',
      });
    });
    await waitFor(() => {
      expect(onActioned).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('API error is surfaced as inline alert', async () => {
    adminService.decideRoleRequest.mockRejectedValueOnce(new Error('Server conflict'));
    const user = userEvent.setup();
    const { onClose, onActioned } = renderModal();
    const textarea = screen.getByLabelText(/Reason for denial/i);
    await user.type(textarea, 'Proof document was unreadable');
    await user.click(screen.getByRole('button', { name: /Confirm Denial/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Server conflict/);
    expect(onClose).not.toHaveBeenCalled();
    expect(onActioned).not.toHaveBeenCalled();
  });

  it('Cancel button calls onClose without firing decideRoleRequest', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(onClose).toHaveBeenCalled();
    expect(adminService.decideRoleRequest).not.toHaveBeenCalled();
  });
});