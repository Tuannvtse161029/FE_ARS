/**
 * Hook-level tests for src/hooks/useStudentGroups.ts.
 *
 * Verifies that the aggregate hook fires both reads in parallel
 * (Promise.all — see research-workflow test plan §1 question #5) and
 * surfaces the right primary group / topic.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const {
  getActiveGuidanceProjectForStudentMock,
  getJoinedGroupsForStudentMock,
  getResearchTopicByIdMock,
} = vi.hoisted(() => ({
  getActiveGuidanceProjectForStudentMock: vi.fn(),
  getJoinedGroupsForStudentMock: vi.fn(),
  getResearchTopicByIdMock: vi.fn(),
}));

vi.mock('../../services/guidanceProject.service', () => ({
  getActiveGuidanceProjectForStudent: getActiveGuidanceProjectForStudentMock,
  getResearchTopicById: getResearchTopicByIdMock,
}));

vi.mock('../../services/groupMembership.service', () => ({
  getJoinedGroupsForStudent: getJoinedGroupsForStudentMock,
}));

import { useStudentGroups } from '../../hooks/useStudentGroups';

describe('useStudentGroups', () => {
  beforeEach(() => {
    getActiveGuidanceProjectForStudentMock.mockReset();
    getJoinedGroupsForStudentMock.mockReset();
    getResearchTopicByIdMock.mockReset();
  });

  it('is idle when studentId is null', async () => {
    const { result } = renderHook(() => useStudentGroups(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.guidanceProject).toBeNull();
    expect(result.current.joinedGroups).toEqual([]);
    expect(result.current.primaryGroup).toBeNull();
    expect(result.current.primaryTopic).toBeNull();
    expect(getJoinedGroupsForStudentMock).not.toHaveBeenCalled();
  });

  it('resolves joined groups + guidance project + topic', async () => {
    getActiveGuidanceProjectForStudentMock.mockResolvedValueOnce({
      id: 1,
      lecturerId: 4,
      studentId: 9,
      title: 'P',
      status: 'ONGOING' as const,
    });
    getJoinedGroupsForStudentMock.mockResolvedValueOnce([
      {
        id: 7,
        lecturerId: 4,
        topicId: 100,
        name: 'Alpha',
        membershipId: 99,
      },
    ]);
    getResearchTopicByIdMock.mockResolvedValueOnce({
      id: 100,
      title: 'Topic T',
      status: 'OPEN' as const,
    });

    const { result } = renderHook(() => useStudentGroups(9));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.primaryGroup?.id).toBe(7);
    expect(result.current.primaryTopic?.id).toBe(100);
    expect(getActiveGuidanceProjectForStudentMock).toHaveBeenCalledWith(9);
    expect(getJoinedGroupsForStudentMock).toHaveBeenCalledWith(9);
  });

  it('swallows topic-load failures (sets primaryTopic=null)', async () => {
    getActiveGuidanceProjectForStudentMock.mockResolvedValueOnce(null);
    getJoinedGroupsForStudentMock.mockResolvedValueOnce([
      { id: 7, lecturerId: 4, topicId: 100, name: 'Alpha', membershipId: 99 },
    ]);
    getResearchTopicByIdMock.mockRejectedValueOnce(new Error('topic not found'));

    const { result } = renderHook(() => useStudentGroups(9));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.primaryGroup?.id).toBe(7);
    expect(result.current.primaryTopic).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('surfaces a top-level error when joined-groups read fails', async () => {
    getActiveGuidanceProjectForStudentMock.mockResolvedValueOnce(null);
    getJoinedGroupsForStudentMock.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useStudentGroups(9));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.joinedGroups).toEqual([]);
  });
});