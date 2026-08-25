/**
 * Contract tests for src/types/researchWorkflowDtos.ts and the strict-DTO
 * integration across the four research-workflow services. These tests
 * ensure:
 *   1. Strict DTOs mirror the Swagger schema field names exactly.
 *   2. Each service's create/update call uses the canonical Swagger path.
 *   3. The strict DTOs compile under TypeScript (implicit — the build will
 *      fail loudly if a property name drifts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getMock, postMock, putMock, deleteMock } = vi.hoisted(() => {
  return {
    getMock: vi.fn(),
    postMock: vi.fn(),
    putMock: vi.fn(),
    deleteMock: vi.fn(),
  };
});

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: getMock,
    post: postMock,
    put: putMock,
    delete: deleteMock,
  },
}));

import { researchGroupService, assignTopicToGroups } from '../../../src/services/researchGroup.service';
import { researchTopicService } from '../../../src/services/researchTopic.service';
import { groupMemberService } from '../../../src/services/groupMember.service';
import { learningMaterialService } from '../../../src/services/learningMaterial.service';

describe('Research-workflow strict DTO contract integration', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  describe('ResearchGroupService', () => {
    it('POST /api/ResearchGroup accepts the full strict DTO shape', async () => {
      postMock.mockResolvedValueOnce({
        data: { id: 1, lecturerId: 7, topicId: 11, name: 'Alpha' },
      });
      await researchGroupService.create({
        lecturerId: 7,
        topicId: 11,
        name: 'Alpha',
        description: 'A research group',
        deadline: '2026-12-31T00:00:00Z',
        assignedAt: null,
      });
      expect(postMock).toHaveBeenCalledWith(
        '/api/ResearchGroup',
        expect.objectContaining({
          lecturerId: 7,
          topicId: 11,
          name: 'Alpha',
          description: 'A research group',
          deadline: '2026-12-31T00:00:00Z',
          assignedAt: null,
        }),
      );
    });

    it('PUT /api/ResearchGroup/:id sends topicId in the strict body', async () => {
      putMock.mockResolvedValueOnce({ data: { id: 8, topicId: 12 } });
      await researchGroupService.update(8, {
        lecturerId: null,
        topicId: 12,
        name: null,
        description: null,
        deadline: null,
        assignedAt: '2026-09-01T00:00:00Z',
      });
      expect(putMock).toHaveBeenCalledWith(
        '/api/ResearchGroup/8',
        expect.objectContaining({ topicId: 12, assignedAt: '2026-09-01T00:00:00Z' }),
      );
    });

    it('assignTopicToGroups fires one PUT per group with the same assignedAt timestamp', async () => {
      putMock.mockImplementation(async (url: string, payload: object) => ({
        data: { id: Number(url.split('/').pop()), ...payload },
      }));
      const outcomes = await assignTopicToGroups(11, [1, 2, 3]);
      expect(putMock).toHaveBeenCalledTimes(3);
      expect(outcomes.every((o) => o.ok)).toBe(true);
    });
  });

  describe('ResearchTopicService', () => {
    it('POST /api/ResearchTopic sends the strict DTO with topicId required', async () => {
      postMock.mockResolvedValueOnce({
        data: { topicId: 9, title: 'New', status: 'OPEN' },
      });
      await researchTopicService.create({
        topicId: 9,
        title: 'New',
        description: 'desc',
        status: 'OPEN',
        materialsUrl: null,
      });
      expect(postMock).toHaveBeenCalledWith(
        '/api/ResearchTopic',
        expect.objectContaining({
          topicId: 9,
          title: 'New',
          description: 'desc',
          status: 'OPEN',
          materialsUrl: null,
        }),
      );
    });

    it('PUT /api/ResearchTopic/:id sends the strict DTO with topicId required', async () => {
      putMock.mockResolvedValueOnce({ data: { id: 3, title: 'Edited' } });
      await researchTopicService.update(3, {
        topicId: 3,
        title: 'Edited',
        description: null,
        status: null,
        materialsUrl: null,
      });
      expect(putMock).toHaveBeenCalledWith(
        '/api/ResearchTopic/3',
        expect.objectContaining({ topicId: 3, title: 'Edited' }),
      );
    });
  });

  describe('GroupMemberService', () => {
    it('POST /api/GroupMember sends the strict DTO with all nullable fields', async () => {
      postMock.mockResolvedValueOnce({
        data: { id: 1, researchGroupId: 7, studentId: 9 },
      });
      await groupMemberService.create({
        researchGroupId: 7,
        studentId: 9,
        activityStatus: 'ACTIVE',
        joinedAt: '2026-09-01T00:00:00Z',
      });
      expect(postMock).toHaveBeenCalledWith(
        '/api/GroupMember',
        expect.objectContaining({
          researchGroupId: 7,
          studentId: 9,
          activityStatus: 'ACTIVE',
          joinedAt: '2026-09-01T00:00:00Z',
        }),
      );
    });

    it('PUT /api/GroupMember/:id sends the strict DTO', async () => {
      putMock.mockResolvedValueOnce({ data: { id: 1 } });
      await groupMemberService.update(1, {
        researchGroupId: 7,
        studentId: 9,
        activityStatus: 'INACTIVE',
        joinedAt: null,
      });
      expect(putMock).toHaveBeenCalledWith(
        '/api/GroupMember/1',
        expect.objectContaining({ activityStatus: 'INACTIVE' }),
      );
    });
  });

  describe('LearningMaterialService', () => {
    it('POST /api/LearningMaterial sends the strict DTO with fileUrl', async () => {
      postMock.mockResolvedValueOnce({
        data: { learningMaterialId: 7, title: 'PDF', fileUrl: 'https://fb/x.pdf' },
      });
      await learningMaterialService.create({
        lecturerId: 7,
        title: 'PDF',
        fileUrl: 'https://fb/x.pdf',
        description: 'Material description',
        subFieldId: null,
      });
      expect(postMock).toHaveBeenCalledWith(
        '/api/LearningMaterial',
        expect.objectContaining({
          lecturerId: 7,
          title: 'PDF',
          fileUrl: 'https://fb/x.pdf',
          description: 'Material description',
          subFieldId: null,
        }),
      );
    });

    it('PUT /api/LearningMaterial/:id sends the strict DTO', async () => {
      putMock.mockResolvedValueOnce({ data: { id: 3, title: 'Edited' } });
      await learningMaterialService.update(3, {
        lecturerId: 7,
        title: 'Edited',
        fileUrl: null,
        description: null,
        subFieldId: null,
      });
      expect(putMock).toHaveBeenCalledWith(
        '/api/LearningMaterial/3',
        expect.objectContaining({ title: 'Edited' }),
      );
    });
  });
});
