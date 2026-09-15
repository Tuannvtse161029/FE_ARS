import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: getMock,
    post: postMock,
  },
}));

import { groupJoinRequestService } from '../../../src/services/groupJoinRequest.service';

describe('groupJoinRequestService (BE-RESEARCH-GROUP-JOIN-REQUEST-01)', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('applyToGroup calls POST /api/ResearchGroup/{groupId}/join-requests', async () => {
    postMock.mockResolvedValueOnce({
      data: { joinRequestId: 101, researchGroupId: 42, applicantUserId: 99, status: 'PENDING' },
    });

    const res = await groupJoinRequestService.applyToGroup(42);
    expect(postMock).toHaveBeenCalledWith('/api/ResearchGroup/42/join-requests');
    expect(res.joinRequestId).toBe(101);
    expect(res.status).toBe('PENDING');
  });

  it('getRequestsByGroup calls GET /api/lecturer/research-groups/{groupId}/join-requests?status=PENDING', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        {
          joinRequestId: 101,
          researchGroupId: 42,
          applicant: { userId: 99, displayName: 'Student A', email: 'a@example.com' },
          status: 'PENDING',
        },
      ],
    });

    const res = await groupJoinRequestService.getRequestsByGroup(42, 'PENDING');
    expect(getMock).toHaveBeenCalledWith('/api/lecturer/research-groups/42/join-requests?status=PENDING');
    expect(res).toHaveLength(1);
    expect(res[0].applicant.displayName).toBe('Student A');
  });

  it('getRequestById calls GET /api/lecturer/research-groups/{groupId}/join-requests/{requestId}', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        joinRequestId: 101,
        researchGroupId: 42,
        applicant: { userId: 99, displayName: 'Student A', email: 'a@example.com' },
        status: 'PENDING',
      },
    });

    const res = await groupJoinRequestService.getRequestById(42, 101);
    expect(getMock).toHaveBeenCalledWith('/api/lecturer/research-groups/42/join-requests/101');
    expect(res.joinRequestId).toBe(101);
  });

  it('acceptRequest calls POST /api/lecturer/research-groups/{groupId}/join-requests/{requestId}/accept', async () => {
    postMock.mockResolvedValueOnce({
      data: { joinRequestId: 101, researchGroupId: 42, applicantUserId: 99, status: 'ACCEPTED', groupMemberId: 500 },
    });

    const res = await groupJoinRequestService.acceptRequest(42, 101);
    expect(postMock).toHaveBeenCalledWith('/api/lecturer/research-groups/42/join-requests/101/accept');
    expect(res.status).toBe('ACCEPTED');
    expect(res.groupMemberId).toBe(500);
  });

  it('rejectRequest calls POST /api/lecturer/research-groups/{groupId}/join-requests/{requestId}/reject with note', async () => {
    postMock.mockResolvedValueOnce({
      data: { joinRequestId: 101, researchGroupId: 42, applicantUserId: 99, status: 'REJECTED', rejectionNote: 'Group full' },
    });

    const res = await groupJoinRequestService.rejectRequest(42, 101, 'Group full');
    expect(postMock).toHaveBeenCalledWith('/api/lecturer/research-groups/42/join-requests/101/reject', {
      rejectionNote: 'Group full',
    });
    expect(res.status).toBe('REJECTED');
  });
});
