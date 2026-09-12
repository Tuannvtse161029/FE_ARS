import { describe, it, expect, beforeEach, vi } from 'vitest';

const { postMock, getMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: postMock,
    get: getMock,
  },
}));

import { roleRequestService } from '../../../src/services/roleRequest.service';

describe('roleRequestService', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    localStorage.clear();
  });

  describe('submit', () => {
    it('omits affiliation and department from POST /api/RoleRequest payload while keeping phoneNumber', async () => {
      postMock.mockResolvedValueOnce({
        data: {
          id: 101,
          userId: 12,
          requestedRole: 'Reviewer',
          status: 'PENDING',
        },
      });

      const result = await roleRequestService.submit({
        userId: 12,
        userName: 'Nguyen Van A',
        email: 'vana@example.com',
        phone: '+84901234567',
        currentRoles: ['Researcher'],
        requestedAdditionalRole: 'Reviewer',
        reason: 'Academic promotion',
        proofDocumentUrl: 'https://example.com/proof.pdf',
        orcidId: '0000-0002-1825-0097',
      });

      expect(postMock).toHaveBeenCalledTimes(1);
      const [endpoint, payload] = postMock.mock.calls[0];
      expect(endpoint).toBe('/api/RoleRequest');

      // Crucial BE contract check: affiliation and department MUST NOT be present
      expect(payload).not.toHaveProperty('affiliation');
      expect(payload).not.toHaveProperty('department');

      // phoneNumber MUST be present and correctly mapped
      expect(payload).toEqual({
        userId: 12,
        requestedRole: 'Reviewer',
        proofDocumentUrl: 'https://example.com/proof.pdf',
        requestType: 'ADDITIONAL_ROLE',
        phoneNumber: '+84901234567',
        orcidId: '0000-0002-1825-0097',
        reason: 'Academic promotion',
      });

      expect(result.id).toBe(101);
      expect(result.status).toBe('PENDING');
      expect(result.requestedRole).toBe('Reviewer');
    });

    it('handles phone or phoneNumber aliases consistently', async () => {
      postMock.mockResolvedValueOnce({
        data: { id: 102 },
      });

      await roleRequestService.submit({
        userId: 15,
        userName: 'Le Thi B',
        email: 'lethib@example.com',
        phoneNumber: '0987654321',
        currentRoles: ['Lecturer'],
        requestedAdditionalRole: 'Researcher',
      });

      const [, payload] = postMock.mock.calls[0];
      expect(payload.phoneNumber).toBe('0987654321');
      expect(payload).not.toHaveProperty('affiliation');
      expect(payload).not.toHaveProperty('department');
    });
  });

  describe('fetchPendingRequest', () => {
    it('calls GET /api/RoleRequest/user/:userId/pending and maps response with phone', async () => {
      getMock.mockResolvedValueOnce({
        status: 200,
        data: {
          id: 55,
          userId: 12,
          userName: 'Nguyen Van A',
          email: 'vana@example.com',
          phone: '+84901234567',
          requestedRole: 'Reviewer',
          status: 'PENDING',
        },
      });

      const req = await roleRequestService.fetchPendingRequest(12);
      expect(getMock).toHaveBeenCalledWith('/api/RoleRequest/user/12/pending');
      expect(req?.id).toBe(55);
      expect(req?.phone).toBe('+84901234567');
      expect(req?.requestedRole).toBe('Reviewer');
    });

    it('returns null on 204 or 404', async () => {
      getMock.mockResolvedValueOnce({ status: 204, data: null });
      const req = await roleRequestService.fetchPendingRequest(99);
      expect(req).toBeNull();
    });
  });
});
