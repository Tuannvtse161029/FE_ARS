import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RoleRequest } from '../../../../src/types/admin';

const { adminService } = vi.hoisted(() => ({
  adminService: {
    getAnalyticsSummary: vi.fn(),
    getRoleRequests: vi.fn(),
  },
}));

vi.mock('../../../../src/services/admin.service', () => ({ adminService }));

import { AdminDashboard } from '../../../../src/pages/Admin/AdminDashboard';

const roleRequest: RoleRequest = {
  id: 18,
  userId: 24,
  userName: 'Nguyen Minh',
  email: 'minh@example.edu',
  affiliation: 'ARS',
  department: 'Computer Science',
  proofDocumentUrl: 'https://example.edu/proof.pdf',
  submissionDate: '2026-08-30T06:00:00Z',
  status: 'PENDING',
};

describe('AdminDashboard', () => {
  it('leads with the live role-request queue and does not request chart data', async () => {
    adminService.getAnalyticsSummary.mockResolvedValueOnce({ totalMembers: 12, totalPapers: 5 });
    adminService.getRoleRequests.mockResolvedValueOnce([roleRequest]);

    render(<AdminDashboard />);

    expect(await screen.findByRole('heading', { name: /Requests awaiting review/i })).toBeInTheDocument();
    expect(screen.getByText('Nguyen Minh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review request/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Revenue$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/User Newly Register/i)).not.toBeInTheDocument();
    expect(adminService.getAnalyticsSummary).toHaveBeenCalledTimes(1);
    expect(adminService.getRoleRequests).toHaveBeenCalledTimes(1);
  });

  it('keeps selection delegated to the existing role-request callback', async () => {
    adminService.getAnalyticsSummary.mockResolvedValueOnce({ totalMembers: 12, totalPapers: 5 });
    adminService.getRoleRequests.mockResolvedValueOnce([roleRequest]);
    const onSelectRoleRequest = vi.fn();

    render(<AdminDashboard onSelectRoleRequest={onSelectRoleRequest} />);
    fireEvent.click(await screen.findByRole('button', { name: /Review request/i }));

    expect(onSelectRoleRequest).toHaveBeenCalledWith(roleRequest);
  });

  it('shows a retryable queue error without hiding the analytics snapshot', async () => {
    adminService.getAnalyticsSummary.mockResolvedValueOnce({ totalMembers: 12, totalPapers: 5 });
    adminService.getRoleRequests.mockRejectedValueOnce(new Error('Unavailable'));

    render(<AdminDashboard />);

    expect(await screen.findByTestId('role-requests-error')).toHaveTextContent(/Data unavailable/i);
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
  });
});
