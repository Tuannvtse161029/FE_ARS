/**
 * Hook-level tests for src/hooks/useResearchGroups.ts.
 *
 * Verifies the lecturerId client-side filter (BE has no ?lecturerId=).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { getAllMock } = vi.hoisted(() => ({ getAllMock: vi.fn() }));

vi.mock('../../../src/services/researchGroup.service', () => ({
  researchGroupService: { getAll: getAllMock },
}));

import { useResearchGroups } from '../../../src/hooks/useResearchGroups';

const SEED = [
  { id: 1, lecturerId: 7, name: 'Group A', topicId: 11 },
  { id: 2, lecturerId: 8, name: 'Group B', topicId: null },
  { id: 3, lecturerId: 7, name: 'Group C', topicId: 12 },
];

describe('useResearchGroups', () => {
  beforeEach(() => {
    getAllMock.mockReset();
  });

  it('returns all groups when no lecturerId filter is provided', async () => {
    getAllMock.mockResolvedValueOnce(SEED);
    const { result } = renderHook(() => useResearchGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groups).toHaveLength(3);
  });

  it('filters groups by lecturerId client-side', async () => {
    getAllMock.mockResolvedValueOnce(SEED);
    const { result } = renderHook(() => useResearchGroups({ lecturerId: 7 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groups).toHaveLength(2);
    result.current.groups.forEach((g) => expect(g.lecturerId).toBe(7));
  });

  it('surfaces the error and clears groups on failure', async () => {
    getAllMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useResearchGroups({ lecturerId: 7 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.groups).toEqual([]);
  });

  it('refetch re-runs and re-applies the filter', async () => {
    getAllMock.mockResolvedValueOnce(SEED);
    const { result } = renderHook(() => useResearchGroups({ lecturerId: 7 }));
    await waitFor(() => expect(result.current.groups).toHaveLength(2));

    getAllMock.mockResolvedValueOnce([
      { id: 1, lecturerId: 7, name: 'Group A' },
      { id: 2, lecturerId: 7, name: 'Group B' },
      { id: 3, lecturerId: 7, name: 'Group C' },
    ]);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.groups).toHaveLength(3));
  });
});