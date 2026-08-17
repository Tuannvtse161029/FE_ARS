/**
 * Service-level tests for src/services/researchTopic.service.ts.
 *
 * Mocks the axios client at the module boundary so we test the
 * defensive normalization + CRUD wrapper, not the HTTP transport.
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

vi.mock('../../services/axios', () => ({
  default: {
    get: getMock,
    post: postMock,
    put: putMock,
    delete: deleteMock,
  },
}));

import { researchTopicService, getResearchTopicMaterialsUrl } from '../../services/researchTopic.service';

describe('researchTopicService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  describe('getAll', () => {
    it('returns the BE list normalized to { id, ... }', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          { id: 1, title: 'Topic A', status: 'OPEN' },
          { topicId: 2, title: 'Topic B', status: 'OPEN' },
        ],
      });
      const list = await researchTopicService.getAll();
      expect(list).toHaveLength(2);
      expect(list[0]).toMatchObject({ id: 1, title: 'Topic A' });
      expect(list[1]).toMatchObject({ id: 2, title: 'Topic B' });
      expect(getMock).toHaveBeenCalledWith('/api/ResearchTopic');
    });

    it('handles non-array response gracefully (returns [])', async () => {
      getMock.mockResolvedValueOnce({ data: null });
      const list = await researchTopicService.getAll();
      expect(list).toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns the single row, normalizing topicId → id', async () => {
      getMock.mockResolvedValueOnce({
        data: { topicId: 7, title: 'Just topicId', status: 'OPEN' },
      });
      const row = await researchTopicService.getById(7);
      expect(row.id).toBe(7);
      expect(row.title).toBe('Just topicId');
      expect(getMock).toHaveBeenCalledWith('/api/ResearchTopic/7');
    });
  });

  describe('create', () => {
    it('POSTs payload and returns normalized row', async () => {
      postMock.mockResolvedValueOnce({
        data: { topicId: 9, title: 'New', status: 'OPEN' },
      });
      const created = await researchTopicService.create({
        title: 'New',
        status: 'OPEN',
      });
      expect(postMock).toHaveBeenCalledWith('/api/ResearchTopic', {
        title: 'New',
        status: 'OPEN',
      });
      expect(created.id).toBe(9);
    });

    it('propagates 409 conflict error verbatim', async () => {
      const err = new Error('Request failed with status code 409');
      postMock.mockRejectedValueOnce(err);
      await expect(
        researchTopicService.create({ title: 'Dup', status: 'OPEN' }),
      ).rejects.toBe(err);
    });
  });

  describe('update', () => {
    it('PUTs to /api/ResearchTopic/:id', async () => {
      putMock.mockResolvedValueOnce({
        data: { id: 3, title: 'Edited', status: 'ASSIGNED' },
      });
      await researchTopicService.update(3, { title: 'Edited' });
      expect(putMock).toHaveBeenCalledWith('/api/ResearchTopic/3', {
        title: 'Edited',
      });
    });
  });

  describe('delete', () => {
    it('DELETEs /api/ResearchTopic/:id', async () => {
      deleteMock.mockResolvedValueOnce({});
      await researchTopicService.delete(3);
      expect(deleteMock).toHaveBeenCalledWith('/api/ResearchTopic/3');
    });
  });

  describe('getResearchTopicMaterialsUrl', () => {
    it('returns the materials URL when present', () => {
      expect(
        getResearchTopicMaterialsUrl({ materialsUrl: 'https://x/y.pdf' }),
      ).toBe('https://x/y.pdf');
    });
    it('returns empty string for null / missing', () => {
      expect(getResearchTopicMaterialsUrl(null)).toBe('');
      expect(getResearchTopicMaterialsUrl(undefined)).toBe('');
      expect(getResearchTopicMaterialsUrl({})).toBe('');
    });
  });
});