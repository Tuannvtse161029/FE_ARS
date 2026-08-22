/**
 * Hook-level tests for src/hooks/usePhasedReports.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { listReportsForGroupMock } = vi.hoisted(() => ({
  listReportsForGroupMock: vi.fn(),
}));

vi.mock('../../services/phasedReport.service', () => ({
  listReportsForGroup: listReportsForGroupMock,
}));

import { usePhasedReports } from '../../hooks/usePhasedReports';

const SEED = [
  {
    id: 1,
    researchGroupId: 7,
    status: 'SUBMITTED' as const,
    submittedAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 2,
    researchGroupId: 7,
    status: 'REJECTED' as const,
    submittedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 3,
    researchGroupId: 7,
    status: 'EVALUATED' as const,
    submittedAt: '2024-12-01T00:00:00Z',
  },
];

describe('usePhasedReports', () => {
  beforeEach(() => {
    listReportsForGroupMock.mockReset();
  });

  it('does not load when researchGroupId is null', async () => {
    const { result } = renderHook(() => usePhasedReports(null));
    // waitFor: ensure no call was made
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listReportsForGroupMock).not.toHaveBeenCalled();
    expect(result.current.reports).toEqual([]);
  });

  it('loads the list when researchGroupId is provided', async () => {
    listReportsForGroupMock.mockResolvedValueOnce(SEED);
    const { result } = renderHook(() => usePhasedReports(7));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.reports).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it('surfaces errors and clears the list on failure', async () => {
    listReportsForGroupMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePhasedReports(7));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.reports).toEqual([]);
  });

  it('latestByStatus returns the most recent report for each status', async () => {
    listReportsForGroupMock.mockResolvedValueOnce(SEED);
    const { result } = renderHook(() => usePhasedReports(7));
    await waitFor(() => expect(result.current.reports).toHaveLength(3));

    expect(result.current.latestByStatus('SUBMITTED')).toMatchObject({ id: 1 });
    expect(result.current.latestByStatus('REJECTED')).toMatchObject({ id: 2 });
    expect(result.current.latestByStatus('EVALUATED')).toMatchObject({ id: 3 });
    expect(result.current.latestByStatus('WAITING')).toBeNull();
  });

  it('refetch re-runs the load', async () => {
    listReportsForGroupMock.mockResolvedValueOnce(SEED);
    const { result } = renderHook(() => usePhasedReports(7));
    await waitFor(() => expect(result.current.reports).toHaveLength(3));

    listReportsForGroupMock.mockResolvedValueOnce([SEED[0]]);
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.reports).toHaveLength(1);
  });
});