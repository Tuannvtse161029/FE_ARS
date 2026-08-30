import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnalyticsTimeSeries, RoleRequest } from '../../../../src/types/admin';

const registrations: AnalyticsTimeSeries = {
  range: 'monthly',
  metric: 'user_registrations',
  points: [{ date: '2026-08-01T00:00:00Z', value: 12 }],
};

const revenue: AnalyticsTimeSeries = {
  range: 'monthly',
  metric: 'revenue',
  points: [{ date: '2026-08-01T00:00:00Z', value: 1_200_000 }],
};

const { adminService } = vi.hoisted(() => ({
  adminService: {
    getAnalyticsSummary: vi.fn(),
    getAnalyticsTimeseries: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders real member-growth and revenue charts from the analytics time-series endpoint', async () => {
    adminService.getAnalyticsSummary.mockResolvedValueOnce({ totalMembers: 12, totalPapers: 5 });
    adminService.getAnalyticsTimeseries
      .mockResolvedValueOnce(registrations)
      .mockResolvedValueOnce(revenue);
    adminService.getRoleRequests.mockResolvedValueOnce([roleRequest]);

    render(<AdminDashboard />);

    expect(await screen.findByRole('heading', { name: /Member growth - monthly/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Revenue - monthly/i })).toBeInTheDocument();
    expect(adminService.getAnalyticsTimeseries).toHaveBeenCalledWith('monthly', 'user_registrations', expect.any(AbortSignal));
    expect(adminService.getAnalyticsTimeseries).toHaveBeenCalledWith('monthly', 'revenue', expect.any(AbortSignal));
  });

  it('changes analytics range and refetches both charts', async () => {
    adminService.getAnalyticsSummary.mockResolvedValue({ totalMembers: 12, totalPapers: 5 });
    adminService.getAnalyticsTimeseries.mockImplementation(async (range, metric) => ({
      ...(metric === 'revenue' ? revenue : registrations),
      range,
    }));
    adminService.getRoleRequests.mockResolvedValue([roleRequest]);

    render(<AdminDashboard />);
    await screen.findByRole('heading', { name: /Member growth - monthly/i });
    fireEvent.click(screen.getAllByRole('button', { name: 'Daily' })[0]);

    await waitFor(() => {
      expect(adminService.getAnalyticsTimeseries).toHaveBeenCalledWith('daily', 'user_registrations', expect.any(AbortSignal));
      expect(adminService.getAnalyticsTimeseries).toHaveBeenCalledWith('daily', 'revenue', expect.any(AbortSignal));
    });
  });

  it('leads with the live role-request queue and loads chart data', async () => {
    adminService.getAnalyticsSummary.mockResolvedValueOnce({ totalMembers: 12, totalPapers: 5 });
    adminService.getAnalyticsTimeseries
      .mockResolvedValueOnce(registrations)
      .mockResolvedValueOnce(revenue);
    adminService.getRoleRequests.mockResolvedValueOnce([roleRequest]);

    render(<AdminDashboard />);

    expect(await screen.findByRole('heading', { name: /Requests awaiting review/i })).toBeInTheDocument();
    expect(screen.getByText('Nguyen Minh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review request/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Revenue - monthly/i })).toBeInTheDocument();
    expect(adminService.getAnalyticsSummary).toHaveBeenCalledTimes(1);
    expect(adminService.getAnalyticsTimeseries).toHaveBeenCalledTimes(2);
    expect(adminService.getRoleRequests).toHaveBeenCalledTimes(1);
  });

  it('keeps selection delegated to the existing role-request callback', async () => {
    adminService.getAnalyticsSummary.mockResolvedValueOnce({ totalMembers: 12, totalPapers: 5 });
    adminService.getAnalyticsTimeseries
      .mockResolvedValueOnce(registrations)
      .mockResolvedValueOnce(revenue);
    adminService.getRoleRequests.mockResolvedValueOnce([roleRequest]);
    const onSelectRoleRequest = vi.fn();

    render(<AdminDashboard onSelectRoleRequest={onSelectRoleRequest} />);
    fireEvent.click(await screen.findByRole('button', { name: /Review request/i }));

    expect(onSelectRoleRequest).toHaveBeenCalledWith(roleRequest);
  });

  it('shows a retryable queue error without hiding the analytics snapshot', async () => {
    adminService.getAnalyticsSummary.mockResolvedValueOnce({ totalMembers: 12, totalPapers: 5 });
    adminService.getAnalyticsTimeseries
      .mockResolvedValueOnce(registrations)
      .mockResolvedValueOnce(revenue);
    adminService.getRoleRequests.mockRejectedValueOnce(new Error('Unavailable'));

    render(<AdminDashboard />);

    expect(await screen.findByTestId('role-requests-error')).toHaveTextContent(/Data unavailable/i);
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
  });
});
