import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/axios', () => ({
  default: { get: getMock },
}));

import { fieldService } from '../../services/field.service';

describe('fieldService', () => {
  beforeEach(() => {
    getMock.mockReset();
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
});
