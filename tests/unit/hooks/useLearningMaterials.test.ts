/**
 * Hook-level tests for src/hooks/useLearningMaterials.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getAllMock } = vi.hoisted(() => ({ getAllMock: vi.fn() }));

vi.mock('../../../src/services/learningMaterial.service', () => ({
  learningMaterialService: { getAll: getAllMock },
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

  it('surfaces errors', async () => {
    getAllMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useLearningMaterials({ lecturerId: 7 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.materials).toEqual([]);
  });
});