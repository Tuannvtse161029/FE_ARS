/**
 * Hook-level tests for src/hooks/useGuidanceProjects.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getAllGuidanceProjectsMock } = vi.hoisted(() => ({
  getAllGuidanceProjectsMock: vi.fn(),
}));

vi.mock('../../services/guidanceProject.service', () => ({
  getAllGuidanceProjects: getAllGuidanceProjectsMock,
}));

import { useGuidanceProjects } from '../../hooks/useGuidanceProjects';

describe('useGuidanceProjects', () => {
  beforeEach(() => {
    getAllGuidanceProjectsMock.mockReset();
  });

  it('loads projects on mount', async () => {
    getAllGuidanceProjectsMock.mockResolvedValueOnce([
      {
        id: 1,
        lecturerId: 4,
        studentId: 9,
        title: 'A',
        status: 'ONGOING' as const,
      },
    ]);
    const { result } = renderHook(() => useGuidanceProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.projects).toHaveLength(1);
  });

  it('captures errors', async () => {
    getAllGuidanceProjectsMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useGuidanceProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.projects).toEqual([]);
  });
});