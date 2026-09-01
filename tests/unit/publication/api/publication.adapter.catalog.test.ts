import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../../../../src/services/axios', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

import { publicationAdapter } from '../../../../src/features/publication/api/publication.adapter';

describe('publicationAdapter.getPublicCatalog', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('loads the authenticated Paper endpoint and exposes only published records', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'published-new',
            title: 'New published paper',
            abstract: 'Newest public research',
            status: 'Published',
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-04T00:00:00.000Z',
          },
          {
            id: 'draft',
            title: 'Draft paper',
            status: 'Draft',
            createdAt: '2026-08-03T00:00:00.000Z',
          },
          {
            id: 'published-old',
            title: 'Old published paper',
            status: 'Published',
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-04T00:00:00.000Z',
          },
        ],
        pageNumber: 1,
        pageSize: 1000,
        totalCount: 3,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      },
    });

    const result = await publicationAdapter.getPublicCatalog({
      page: 1,
      pageSize: 1,
      sort: 'PUBLISHED_DESC',
    });

    expect(mockGet).toHaveBeenCalledWith('/api/paper', {
      params: { pageNumber: 1, pageSize: 1000 },
    });
    expect(result.totalCount).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'published-new',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    });
  });
});
