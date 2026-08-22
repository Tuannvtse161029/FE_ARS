/**
 * Service-level tests for src/services/guidanceProject.service.ts.
 *
 * Covers:
 *  - getAllGuidanceProjects normalization (drops malformed rows)
 *  - getActiveGuidanceProjectForStudent client-side filter (prefer ONGOING over PROPOSED)
 *  - getResearchTopicById throws on malformed response
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../../../src/services/axios', () => ({
  default: { get: getMock },
}));

import {
  getAllGuidanceProjects,
  getGuidanceProjectById,
  getAllResearchTopics,
  getResearchTopicById,
  getActiveGuidanceProjectForStudent,
} from '../../../src/services/guidanceProject.service';

describe('guidanceProjectService', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  describe('getAllGuidanceProjects', () => {
    it('normalizes known-good rows', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            lecturerId: 4,
            studentId: 9,
            title: 'Project A',
            status: 'ONGOING',
          },
        ],
      });
      const list = await getAllGuidanceProjects();
      expect(list).toHaveLength(1);
      expect(list[0].status).toBe('ONGOING');
    });

    it('drops rows missing id / lecturerId / studentId', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          { id: 1, lecturerId: 4, studentId: 9, title: 'Good', status: 'ONGOING' },
          { id: 2, lecturerId: 4 /* no studentId */, status: 'ONGOING' },
          { id: 3, studentId: 9 /* no lecturerId */, status: 'ONGOING' },
          null,
          'not-an-object',
        ],
      });
      const list = await getAllGuidanceProjects();
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Good');
    });

    it('maps DONE / DONE-ish statuses → COMPLETED', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            lecturerId: 4,
            studentId: 9,
            title: 'A',
            status: 'DONE',
          },
        ],
      });
      const list = await getAllGuidanceProjects();
      expect(list[0].status).toBe('COMPLETED');
    });
  });

  describe('getGuidanceProjectById', () => {
    it('throws on malformed response', async () => {
      getMock.mockResolvedValueOnce({ data: { id: 1 } /* missing lecturer/student */ });
      await expect(getGuidanceProjectById(1)).rejects.toThrow(/malformed/);
    });
  });

  describe('getAllResearchTopics', () => {
    it('normalizes the list', async () => {
      getMock.mockResolvedValueOnce({
        data: [{ id: 7, title: 'T', status: 'OPEN' }],
      });
      const list = await getAllResearchTopics();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(7);
    });

    it('drops rows with no id', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          { id: 1, title: 'A', status: 'OPEN' },
          { title: 'No id', status: 'OPEN' },
        ],
      });
      const list = await getAllResearchTopics();
      expect(list).toHaveLength(1);
    });
  });

  describe('getResearchTopicById', () => {
    it('throws on malformed response', async () => {
      getMock.mockResolvedValueOnce({ data: { title: 'no id' } });
      await expect(getResearchTopicById(1)).rejects.toThrow(/malformed/);
    });
  });

  describe('getActiveGuidanceProjectForStudent', () => {
    it('prefers ONGOING over PROPOSED', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            lecturerId: 4,
            studentId: 9,
            title: 'Proposed',
            status: 'PROPOSED',
          },
          {
            id: 2,
            lecturerId: 4,
            studentId: 9,
            title: 'Ongoing',
            status: 'ONGOING',
          },
        ],
      });
      const project = await getActiveGuidanceProjectForStudent(9);
      expect(project?.id).toBe(2);
      expect(project?.status).toBe('ONGOING');
    });

    it('falls back to PROPOSED when no ONGOING exists', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            lecturerId: 4,
            studentId: 9,
            title: 'Proposed',
            status: 'PROPOSED',
          },
          {
            id: 2,
            lecturerId: 4,
            studentId: 99,
            title: 'Other',
            status: 'ONGOING',
          },
        ],
      });
      const project = await getActiveGuidanceProjectForStudent(9);
      expect(project?.id).toBe(1);
    });

    it('returns null when the student has no projects', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            lecturerId: 4,
            studentId: 99,
            title: 'Other student',
            status: 'ONGOING',
          },
        ],
      });
      const project = await getActiveGuidanceProjectForStudent(9);
      expect(project).toBeNull();
    });
  });
});