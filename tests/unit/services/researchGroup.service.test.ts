/**
 * Service-level tests for src/services/researchGroup.service.ts.
 *
 * Covers CRUD normalization + assignTopicToGroups' parallel PUT + per-
 * group outcome surfacing (incl. 409 conflict propagation).
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

import {
  researchGroupService,
  assignTopicToGroups,
  deriveGroupStatus,
} from '../../../src/services/researchGroup.service';

describe('researchGroupService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  describe('getAll', () => {
    it('normalizes researchGroupId → id', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          { id: 1, name: 'Group A' },
          { researchGroupId: 2, name: 'Group B' },
        ],
      });
      const list = await researchGroupService.getAll();
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(1);
      expect(list[1].id).toBe(2);
    });

    it('returns [] for non-array response', async () => {
      getMock.mockResolvedValueOnce({ data: undefined });
      const list = await researchGroupService.getAll();
      expect(list).toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns the row with id normalized', async () => {
      getMock.mockResolvedValueOnce({
        data: { researchGroupId: 5, name: 'Just an id' },
      });
      const row = await researchGroupService.getById(5);
      expect(row.id).toBe(5);
    });
  });

  describe('update', () => {
    it('PUTs payload to /api/ResearchGroup/:id', async () => {
      putMock.mockResolvedValueOnce({ data: { id: 8, topicId: 12 } });
      await researchGroupService.update(8, { topicId: 12 });
      expect(putMock).toHaveBeenCalledWith('/api/ResearchGroup/8', {
        topicId: 12,
      });
    });
  });

  describe('delete', () => {
    it('DELETEs /api/ResearchGroup/:id', async () => {
      deleteMock.mockResolvedValueOnce({});
      await researchGroupService.delete(8);
      expect(deleteMock).toHaveBeenCalledWith('/api/ResearchGroup/8');
    });
  });

  describe('deriveGroupStatus', () => {
    it('returns OPEN when group is null/undefined', () => {
      expect(deriveGroupStatus(null, null)).toBe('OPEN');
      expect(deriveGroupStatus(undefined, 'COMPLETED')).toBe('OPEN');
    });
    it('returns OPEN when topicId is falsy', () => {
      expect(deriveGroupStatus({ topicId: null }, null)).toBe('OPEN');
      expect(deriveGroupStatus({ topicId: undefined }, null)).toBe('OPEN');
    });
    it('returns COMPLETED only when related topic is COMPLETED', () => {
      expect(deriveGroupStatus({ topicId: 1 }, 'COMPLETED')).toBe('COMPLETED');
      expect(deriveGroupStatus({ topicId: 1 }, 'completed')).toBe('COMPLETED');
    });
    it('returns ASSIGNED for any other related topic status', () => {
      expect(deriveGroupStatus({ topicId: 1 }, 'OPEN')).toBe('ASSIGNED');
      expect(deriveGroupStatus({ topicId: 1 }, 'ASSIGNED')).toBe('ASSIGNED');
      expect(deriveGroupStatus({ topicId: 1 }, 'CLOSED')).toBe('ASSIGNED');
      expect(deriveGroupStatus({ topicId: 1 }, null)).toBe('ASSIGNED');
    });
  });

  describe('assignTopicToGroups', () => {
    it('issues one PUT per group and reports a happy-path outcome', async () => {
      // Mock getById for all groups
      getMock.mockImplementation(async (url: string) => {
        if (url.includes('/api/ResearchGroup/')) {
          const id = Number(url.split('/').pop());
          return {
            data: {
              id,
              name: `Group ${id}`,
              lecturerId: 7,
              description: null,
              deadline: null,
              materialsUrl: null,
            },
          };
        }
        return { data: [] };
      });
      putMock.mockImplementation(async (url: string, payload: object) => ({
        data: { id: Number(url.split('/').pop()), ...payload },
      }));
      const outcomes = await assignTopicToGroups(11, [1, 2, 3]);
      expect(putMock).toHaveBeenCalledTimes(3);
      expect(outcomes).toHaveLength(3);
      outcomes.forEach((o, idx) => {
        expect(o.ok).toBe(true);
        expect(o.groupId).toBe(idx + 1);
      });
    });

    it('per-group outcome marks ok=false when the PUT rejects (e.g. 409)', async () => {
      // Mock getById for all groups
      getMock.mockImplementation(async (url: string) => {
        if (url.includes('/api/ResearchGroup/')) {
          const id = Number(url.split('/').pop());
          return {
            data: {
              id,
              name: `Group ${id}`,
              lecturerId: 7,
              description: null,
              deadline: null,
              materialsUrl: null,
            },
          };
        }
        return { data: [] };
      });
      putMock.mockImplementation(async (url: string) => {
        if (url.endsWith('/2')) {
          throw new Error('Request failed with status code 409');
        }
        return { data: { id: Number(url.split('/').pop()) } };
      });
      const outcomes = await assignTopicToGroups(11, [1, 2, 3]);
      expect(outcomes).toEqual([
        expect.objectContaining({ groupId: 1, ok: true }),
        expect.objectContaining({ groupId: 2, ok: false }),
        expect.objectContaining({ groupId: 3, ok: true }),
      ]);
      const failed = outcomes.find((o) => o.groupId === 2);
      expect(failed?.error).toMatch(/409/);
    });

    it('synthesises a generic conflict message when error is not an Error', async () => {
      // Mock getById for all groups
      getMock.mockImplementation(async (url: string) => {
        if (url.includes('/api/ResearchGroup/')) {
          const id = Number(url.split('/').pop());
          return {
            data: {
              id,
              name: `Group ${id}`,
              lecturerId: 7,
              description: null,
              deadline: null,
              materialsUrl: null,
            },
          };
        }
        return { data: [] };
      });
      putMock.mockImplementation(async (url: string) => {
        if (url.endsWith('/1')) {
          // String thrown — not an Error instance
          throw 'plain string rejection';
        }
        return { data: { id: Number(url.split('/').pop()) } };
      });
      const outcomes = await assignTopicToGroups(11, [1, 2]);
      const failed = outcomes.find((o) => o.groupId === 1);
      expect(failed?.ok).toBe(false);
      expect(failed?.error).toMatch(/locked by another topic/);
    });
  });
});