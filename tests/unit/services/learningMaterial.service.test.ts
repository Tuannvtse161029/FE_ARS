/**
 * Service-level tests for src/services/learningMaterial.service.ts.
 *
 * Covers CRUD wrapper + the folder-path helper that the Lecturer
 * console "Add material" flow relies on for stable Firebase uploads.
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
  learningMaterialService,
  defaultLearningMaterialFolderPath,
} from '../../../src/services/learningMaterial.service';

describe('learningMaterialService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  describe('getAll', () => {
    it('returns the BE list with id normalized', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          { id: 1, title: 'A' },
          { learningMaterialId: 2, title: 'B' },
        ],
      });
      const list = await learningMaterialService.getAll();
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(1);
      expect(list[1].id).toBe(2);
    });
  });

  describe('create', () => {
    it('POSTs payload and returns normalized row', async () => {
      postMock.mockResolvedValueOnce({
        data: { learningMaterialId: 7, title: 'New' },
      });
      const created = await learningMaterialService.create({
        title: 'New',
        fileUrl: 'https://fb/x.pdf',
      });
      expect(postMock).toHaveBeenCalledWith('/api/LearningMaterial', {
        title: 'New',
        fileUrl: 'https://fb/x.pdf',
      });
      expect(created.id).toBe(7);
    });
  });

  describe('update', () => {
    it('PUTs partial payload to /api/LearningMaterial/:id', async () => {
      putMock.mockResolvedValueOnce({ data: { id: 3, title: 'Edited' } });
      await learningMaterialService.update(3, { title: 'Edited' });
      expect(putMock).toHaveBeenCalledWith('/api/LearningMaterial/3', {
        title: 'Edited',
      });
    });
  });

  describe('delete', () => {
    it('DELETEs /api/LearningMaterial/:id', async () => {
      deleteMock.mockResolvedValueOnce({});
      await learningMaterialService.delete(3);
      expect(deleteMock).toHaveBeenCalledWith('/api/LearningMaterial/3');
    });
  });

  describe('defaultLearningMaterialFolderPath', () => {
    it('returns learning-materials/<lecturerId>/ for a known lecturerId', () => {
      expect(defaultLearningMaterialFolderPath(7)).toBe('learning-materials/7/');
    });

    it('returns learning-materials/unknown/ when lecturerId is null/undefined', () => {
      expect(defaultLearningMaterialFolderPath(null)).toBe(
        'learning-materials/unknown/',
      );
      expect(defaultLearningMaterialFolderPath(undefined)).toBe(
        'learning-materials/unknown/',
      );
    });
  });
});