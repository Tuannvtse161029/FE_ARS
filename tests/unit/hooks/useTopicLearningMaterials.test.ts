/**
 * Regression test for the September 2026 bug where materials attached
 * to a Research Topic via "Manage Materials" did NOT appear in either:
 *   1. The Lecturer `GroupDetail` page (`/research-groups/:id`)
 *   2. The Graduate Student's workspace (`StudentResearchGroups.tsx →
 *      WorkspaceView`)
 *
 * Both surfaces now call the dedicated
 * `/api/ResearchTopic/{topicId}/learning-materials` endpoint via the
 * new `useTopicLearningMaterials` hook so topic-level attachments are
 * surfaced alongside the lecturer's general library.
 *
 * These tests verify:
 *   - The hook returns materials fetched from the topic endpoint.
 *   - The hook returns an empty array (no error) when no topicId is
 *     provided.
 *   - The hook reports errors as an Error object so the UI can show a
 *     retry button.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getByTopicIdMock } = vi.hoisted(() => ({
  getByTopicIdMock: vi.fn(),
}));
vi.mock('../../../src/services/researchTopic.service', () => ({
  topicLearningMaterialService: {
    getByTopicId: getByTopicIdMock,
  },
}));

import { useTopicLearningMaterials } from '../../../src/hooks/useTopicLearningMaterials';

const TOPIC_MATERIAL = {
  learningMaterialId: 9001,
  topicId: 11,
  lecturerId: 7,
  title: 'Topic-level syllabus',
  fileUrl: 'https://cdn.example.com/topics/11/syllabus.pdf',
  description: 'Read this before milestone 1',
  createdAt: '2025-09-01T00:00:00Z',
};

describe('useTopicLearningMaterials', () => {
  beforeEach(() => {
    getByTopicIdMock.mockReset();
  });

  it('returns the materials fetched from the topic endpoint', async () => {
    getByTopicIdMock.mockResolvedValueOnce([TOPIC_MATERIAL]);

    const { result } = renderHook(() => useTopicLearningMaterials(11));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.materials).toHaveLength(1);
    const first = result.current.materials[0];
    expect(first.id).toBe(9001);
    expect(first.learningMaterialId).toBe(9001);
    expect(first.title).toBe('Topic-level syllabus');
    expect(first.fileUrl).toBe('https://cdn.example.com/topics/11/syllabus.pdf');
    expect(first.description).toBe('Read this before milestone 1');
    expect(first.lecturerId).toBe(7);
    expect(result.current.error).toBeNull();
    expect(getByTopicIdMock).toHaveBeenCalledWith(11);
  });

  it('returns an empty array and never fetches when topicId is null', async () => {
    const { result } = renderHook(() => useTopicLearningMaterials(null));

    // Synchronous: the hook should NOT enter loading state because we
    // short-circuit on null/undefined topicIds.
    expect(result.current.materials).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(getByTopicIdMock).not.toHaveBeenCalled();
  });

  it('returns an empty array and never fetches when topicId is undefined', async () => {
    const { result } = renderHook(() => useTopicLearningMaterials(undefined));

    expect(result.current.materials).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(getByTopicIdMock).not.toHaveBeenCalled();
  });

  it('captures errors and exposes them as an Error object', async () => {
    getByTopicIdMock.mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useTopicLearningMaterials(11));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.materials).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network down');
  });

  it('wraps non-Error rejections in a generic Error', async () => {
    getByTopicIdMock.mockRejectedValueOnce('string-failure');

    const { result } = renderHook(() => useTopicLearningMaterials(11));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.materials).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toMatch(/failed to load/i);
  });

  it('refetch re-issues the GET after the caller clears an error', async () => {
    getByTopicIdMock
      .mockRejectedValueOnce(new Error('first call fails'))
      .mockResolvedValueOnce([TOPIC_MATERIAL]);

    const { result } = renderHook(() => useTopicLearningMaterials(11));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);

    await result.current.refetch();

    await waitFor(() => expect(result.current.materials).toHaveLength(1));
    expect(result.current.error).toBeNull();
    expect(getByTopicIdMock).toHaveBeenCalledTimes(2);
  });

  it('tolerates rows missing the learningMaterialId column (legacy BE)', async () => {
    // The BE has historically returned rows with only `id` set; the
    // hook must normalise them so callers can always read `.id`.
    getByTopicIdMock.mockResolvedValueOnce([
      {
        id: 555,
        title: 'Legacy row',
        fileUrl: 'https://cdn.example.com/legacy.pdf',
      },
    ]);

    const { result } = renderHook(() => useTopicLearningMaterials(11));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.materials).toHaveLength(1);
    expect(result.current.materials[0].id).toBe(555);
  });
});
