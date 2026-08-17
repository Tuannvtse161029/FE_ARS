/**
 * Hook-level tests for src/hooks/useResearchTopics.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { getAllResearchTopicsMock } = vi.hoisted(() => ({
  getAllResearchTopicsMock: vi.fn(),
}));

vi.mock('../../services/guidanceProject.service', () => ({
  getAllResearchTopics: getAllResearchTopicsMock,
}));

import { useResearchTopics } from '../../hooks/useResearchTopics';

describe('useResearchTopics', () => {
  beforeEach(() => {
    getAllResearchTopicsMock.mockReset();
  });

  it('starts in loading=true', () => {
    getAllResearchTopicsMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useResearchTopics());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.topics).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('populates topics on successful load', async () => {
    getAllResearchTopicsMock.mockResolvedValueOnce([
      { id: 1, title: 'A', status: 'OPEN' },
    ]);
    const { result } = renderHook(() => useResearchTopics());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.topics).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('captures errors and clears topics on failure', async () => {
    getAllResearchTopicsMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useResearchTopics());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.topics).toEqual([]);
  });

  it('coerces non-Error rejections to a friendly message', async () => {
    getAllResearchTopicsMock.mockRejectedValueOnce('plain string');
    const { result } = renderHook(() => useResearchTopics());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toMatch(/Failed to load/);
  });

  it('refetch() resets loading + retries', async () => {
    getAllResearchTopicsMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useResearchTopics());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    getAllResearchTopicsMock.mockResolvedValueOnce([
      { id: 9, title: 'New', status: 'OPEN' },
    ]);
    // The mockResolvedValueOnce queue resets if the implementation is the
    // default vi.fn — make sure the *next* call (triggered by refetch)
    // returns the seeded payload.
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.topics).toHaveLength(1));
    expect(getAllResearchTopicsMock).toHaveBeenCalledTimes(2);
  });
});