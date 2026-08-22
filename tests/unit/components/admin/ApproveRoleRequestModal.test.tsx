/**
 * Component tests for src/pages/Admin/ApproveRoleRequestModal.tsx (Phase C: Admin).
 *
 * Covers:
 *  - Renders nothing when closed
 *  - Required notes textarea (optional, but trimmed)
 *  - Confirmation calls adminService.decideRoleRequest with APPROVED
 *  - Failed approval surfaces inline API error and does not call onClose/onActioned
 *  - Cancelling preserves PENDING (no mutation)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApproveRoleRequestModal } from '../../../../../src/pages/Admin/ApproveRoleRequestModal';
import type { RoleRequest } from '../../../../../src/types/admin';

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
      status: decision.status as 'APPROVED',
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

vi.mock('../../../../../src/services/admin.service', () => ({ adminService }));

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof ApproveRoleRequestModal>> = {},
) => {
  const onClose = vi.fn();
  const onActioned = vi.fn();
  const utils = render(
    <ApproveRoleRequestModal
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

describe('<ApproveRoleRequestModal>', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <ApproveRoleRequestModal
        request={REQUEST}
        open={false}
        onClose={vi.fn()}
        onActioned={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing when request is null', () => {
    render(
      <ApproveRoleRequestModal request={null} open onClose={vi.fn()} onActioned={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the summary box with the requested additional role', () => {
    renderModal();
    expect(screen.getByText('Approve Role Request')).toBeInTheDocument();
    expect(screen.getByText(/REVIEWER/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Internal verification notes/i)).toBeInTheDocument();
  });

  it('counter reflects typed notes length', async () => {
    const user = userEvent.setup();
    renderModal();
    const textarea = screen.getByLabelText(/Internal verification notes/i);
    await user.type(textarea, 'Looks fine');
    expect(screen.getByText(/10 \/ 1,500/)).toBeInTheDocument();
  });

  it('calls adminService.decideRoleRequest with APPROVED + notes, then closes', async () => {
    const user = userEvent.setup();
    const { onClose, onActioned } = renderModal();
    const textarea = screen.getByLabelText(/Internal verification notes/i);
    await user.type(textarea, 'Verified manually');
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    await waitFor(() => {
      expect(adminService.decideRoleRequest).toHaveBeenCalledWith(1234, {
        status: 'APPROVED',
        notes: 'Verified manually',
      });
    });
    await waitFor(() => {
      expect(onActioned).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('failed approval surfaces inline API error and does not close', async () => {
    adminService.decideRoleRequest.mockRejectedValueOnce(new Error('BE timeout'));
    const user = userEvent.setup();
    const { onClose, onActioned } = renderModal();
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/BE timeout/);
    expect(onClose).not.toHaveBeenCalled();
    expect(onActioned).not.toHaveBeenCalled();
  });

  it('cancelling keeps PENDING and does not call decideRoleRequest', async () => {
    const user = userEvent.setup();
    const { onClose, onActioned } = renderModal();
    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(onClose).toHaveBeenCalled();
    expect(adminService.decideRoleRequest).not.toHaveBeenCalled();
    expect(onActioned).not.toHaveBeenCalled();
  });
});