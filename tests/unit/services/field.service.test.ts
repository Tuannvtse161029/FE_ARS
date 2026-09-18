import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());
const patchMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/axios', () => ({
  default: { get: getMock, patch: patchMock },
}));

import { fieldService } from '../../../src/services/field.service';

describe('fieldService', () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockReset();
  });

  it('normalizes the API majorFieldId into the frontend id contract', async () => {
    getMock.mockResolvedValue({
      data: [
        {
          majorFieldId: 11,
          name: 'Law and Legal Studies',
          description: 'Legal research.',
        },
      ],
    });

    await expect(fieldService.getAllMajor()).resolves.toEqual([
      {
        id: 11,
        name: 'Law and Legal Studies',
        description: 'Legal research.',
      },
    ]);
  });

  it('filters malformed records rather than yielding undefined option values', async () => {
    getMock.mockResolvedValue({
      data: [
        { majorFieldId: undefined, name: 'Invalid' },
        { majorFieldId: 3, name: 'Business and Economics' },
      ],
    });

    await expect(fieldService.getAllMajor()).resolves.toEqual([
      { id: 3, name: 'Business and Economics', description: null },
    ]);
  });

  it('normalizes the API subFieldId into the frontend id contract', async () => {
    getMock.mockResolvedValue({
      data: [
        {
          subFieldId: 31,
          majorFieldId: 11,
          name: 'Constitutional Law',
          description: 'Public law research.',
        },
      ],
    });

    await expect(fieldService.getAllSub(11)).resolves.toEqual([
      {
        id: 31,
        majorFieldId: 11,
        name: 'Constitutional Law',
        description: 'Public law research.',
      },
    ]);
  });

  it('filters malformed subfield records rather than yielding undefined option values', async () => {
    getMock.mockResolvedValue({
      data: [
        { subFieldId: undefined, majorFieldId: 11, name: 'Invalid' },
        { subFieldId: 32, majorFieldId: 11, name: 'Legal Policy' },
      ],
    });

    await expect(fieldService.getAllSub(11)).resolves.toEqual([
      { id: 32, majorFieldId: 11, name: 'Legal Policy', description: null },
    ]);
  });

  describe('listSubFieldsWithRubric', () => {
    it('normalizes subfield array including gradingRubric criteria', async () => {
      getMock.mockResolvedValue({
        data: [
          {
            subFieldId: 10,
            name: 'Machine Learning',
            majorFieldName: 'Computer Science',
            description: 'ML research',
            gradingRubric: [
              {
                code: 'NOVELTY',
                title: 'Novelty & Originality',
                description: 'Assesses novelty of contribution',
                maxScore: 25,
                order: 1,
                standardReferences: ['IEEE Standard 101'],
              },
            ],
          },
        ],
      });

      const result = await fieldService.listSubFieldsWithRubric();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        subFieldId: 10,
        name: 'Machine Learning',
        majorFieldName: 'Computer Science',
        description: 'ML research',
        gradingRubric: [
          {
            code: 'NOVELTY',
            title: 'Novelty & Originality',
            description: 'Assesses novelty of contribution',
            maxScore: 25,
            order: 1,
            standardReferences: ['IEEE Standard 101'],
          },
        ],
      });
    });

    it('handles empty gradingRubric gracefully', async () => {
      getMock.mockResolvedValue({
        data: [
          {
            subFieldId: 12,
            name: 'Cybersecurity',
            majorFieldName: 'Computer Science',
            gradingRubric: null,
          },
        ],
      });

      const result = await fieldService.listSubFieldsWithRubric();
      expect(result[0].gradingRubric).toEqual([]);
    });

    it('returns empty array when response is not an array', async () => {
      getMock.mockResolvedValue({ data: null });
      const result = await fieldService.listSubFieldsWithRubric();
      expect(result).toEqual([]);
    });
  });

  describe('patchRubric', () => {
    it('calls PATCH /api/SubField/{id}/rubric with gradingRubric payload', async () => {
      patchMock.mockResolvedValue({ data: {} });

      const rubric = [
        {
          code: 'METHODOLOGY',
          title: 'Methodology Rigor',
          description: 'Rigor of scientific methodology',
          maxScore: 30,
          order: 1,
          standardReferences: [],
        },
      ];

      await fieldService.patchRubric(15, rubric);

      expect(patchMock).toHaveBeenCalledTimes(1);
      expect(patchMock).toHaveBeenCalledWith('/api/SubField/15/rubric', {
        gradingRubric: rubric,
      });
    });
  });
});

