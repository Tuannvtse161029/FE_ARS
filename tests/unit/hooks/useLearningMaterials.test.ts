/**
 * Hook-level tests for src/hooks/useLearningMaterials.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getAllMock, getAllSharedMock } = vi.hoisted(() => ({
  getAllMock: vi.fn(),
  getAllSharedMock: vi.fn(),
}));

vi.mock('../../../src/services/learningMaterial.service', () => ({
  learningMaterialService: { getAll: getAllMock },
}));

vi.mock('../../../src/services/sharedMaterial.service', () => ({
  sharedMaterialService: { getAll: getAllSharedMock },
}));

import { useLearningMaterials } from '../../../src/hooks/useLearningMaterials';

const SEED = [
  { id: 1, lecturerId: 7, title: 'A' },
  { id: 2, lecturerId: 8, title: 'B' },
  { id: 3, lecturerId: 7, title: 'C' },
];

describe('useLearningMaterials', () => {
  beforeEach(() => {
    getAllMock.mockReset();
    getAllSharedMock.mockReset();
    getAllSharedMock.mockResolvedValue([]);
  });

  it('returns all materials without a filter', async () => {
    getAllMock.mockResolvedValueOnce(SEED);
    const { result } = renderHook(() => useLearningMaterials());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.materials).toHaveLength(3);
  });

  it('filters client-side by lecturerId', async () => {
    getAllMock.mockResolvedValueOnce(SEED);
    const { result } = renderHook(() => useLearningMaterials({ lecturerId: 7 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.materials).toHaveLength(2);
    result.current.materials.forEach((m) => expect(m.lecturerId).toBe(7));
  });

  it('includes accepted shared materials if not expired', async () => {
    getAllMock.mockResolvedValueOnce(SEED);
    // Material 2 (owned by 8) is shared with 7 and accepted 5 days ago
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    getAllSharedMock.mockResolvedValueOnce([
      {
        sharedMaterialId: 99,
        paperId: 2,
        lecturerId: 8,
        sharedWithColleagueId: 7,
        status: 'ACCEPTED',
        sharedAt: fiveDaysAgo,
      },
    ]);
    const { result } = renderHook(() => useLearningMaterials({ lecturerId: 7 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should include material 1 and 3 (owned by 7) PLUS material 2 (shared and accepted)
    expect(result.current.materials).toHaveLength(3);
    const ids = result.current.materials.map((m) => m.id);
    expect(ids).toContain(2);
  });

  it('excludes expired shared materials (> 30 days) and ended shares', async () => {
    getAllMock.mockResolvedValueOnce(SEED);
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    getAllSharedMock.mockResolvedValueOnce([
      {
        sharedMaterialId: 98,
        paperId: 2,
        lecturerId: 8,
        sharedWithColleagueId: 7,
        status: 'ACCEPTED',
        sharedAt: thirtyFiveDaysAgo, // expired!
      },
      {
        sharedMaterialId: 97,
        paperId: 2,
        lecturerId: 8,
        sharedWithColleagueId: 7,
        status: 'ENDED', // ended!
        sharedAt: new Date().toISOString(),
      },
    ]);
    const { result } = renderHook(() => useLearningMaterials({ lecturerId: 7 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should ONLY have materials owned by 7, material 2 must NOT be included
    expect(result.current.materials).toHaveLength(2);
    const ids = result.current.materials.map((m) => m.id);
    expect(ids).not.toContain(2);
  });

  it('surfaces errors', async () => {
    getAllMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useLearningMaterials({ lecturerId: 7 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.materials).toEqual([]);
  });
});