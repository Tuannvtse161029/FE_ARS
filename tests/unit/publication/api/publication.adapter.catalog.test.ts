import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockOpenAlexLookup } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockOpenAlexLookup: vi.fn(),
}));

vi.mock('../../../../src/services/axios', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

vi.mock('../../../../src/features/publication/researcher/openalexAdapter', () => ({
  openAlexAdapter: {
    lookupPreview: (...args: unknown[]) => mockOpenAlexLookup(...args),
  },
}));

vi.mock('../../../../src/services/field.service', () => ({
  fieldService: {
    getSubFieldById: vi.fn().mockRejectedValue(new Error('not configured for this test')),
    getAllMajor: vi.fn().mockResolvedValue([]),
  },
}));

import { publicationAdapter } from '../../../../src/features/publication/api/publication.adapter';

describe('publicationAdapter.getPublicCatalog', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockOpenAlexLookup.mockReset();
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

  it('attaches a userId to the author whose name matches the paper submitter', async () => {
    // The BE's PaperResponse.authors[] doesn't carry a per-author
    // userId. Today the only way to confidently link a bibliographic
    // author to a profile is when their name matches the paper's
    // submitter name — the adapter attaches `userId: paper.authorId`
    // to that author so the card can render the name as a link to
    // /profile/:userId.
    mockGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'p-1',
            title: 'Submitter-link paper',
            abstract: '…',
            status: 'Published',
            createdAt: '2026-08-01T00:00:00.000Z',
            // Submitting researcher — the only person we can link.
            authorId: 42,
            authorName: 'Nguyen Minh Anh',
            authors: [
              { paperAuthorId: 1, authorName: 'Nguyen Minh Anh', authorOrder: 1, orcidId: null },
              { paperAuthorId: 2, authorName: 'Tran Gia Han', authorOrder: 2, orcidId: null },
            ],
          },
        ],
        pageNumber: 1,
        pageSize: 1000,
        totalCount: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      },
    });

    const result = await publicationAdapter.getPublicCatalog({
      page: 1,
      pageSize: 8,
      sort: 'PUBLISHED_DESC',
    });

    expect(result.items).toHaveLength(1);
    const [first, second] = result.items[0].authors;
    expect(first).toMatchObject({ name: 'Nguyen Minh Anh', userId: '42' });
    // Co-author without a matching submitter stays userId-less so the
    // card renders the name as plain text. The adapter does set
    // `userId: undefined` on the object (it always assigns a value),
    // so we assert the value rather than the property's presence.
    expect(second).toMatchObject({ name: 'Tran Gia Han' });
    expect(second?.userId).toBeUndefined();
  });

  it('does not attach a userId when no author name matches the submitter', async () => {
    // The submitter may not be a bibliographic author (e.g. an
    // admin uploading on behalf of a research group). The adapter
    // must NOT match across names — every author stays userId-less
    // and the card renders all names as plain text.
    mockGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'p-2',
            title: 'Submitter not in author list',
            abstract: '…',
            status: 'Published',
            createdAt: '2026-08-01T00:00:00.000Z',
            authorId: 99,
            authorName: 'Some Submitter',
            authors: [
              { paperAuthorId: 1, authorName: 'Nguyen Minh Anh', authorOrder: 1, orcidId: null },
            ],
          },
        ],
        pageNumber: 1,
        pageSize: 1000,
        totalCount: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      },
    });

    const result = await publicationAdapter.getPublicCatalog({
      page: 1,
      pageSize: 8,
      sort: 'PUBLISHED_DESC',
    });

    const [first] = result.items[0].authors;
    expect(first).toMatchObject({ name: 'Nguyen Minh Anh' });
    expect(first?.userId).toBeUndefined();
  });

  it('attaches the submitter userId to the OpenAlex-enriched author row when the BE authors[] is empty', async () => {
    // The BE's `PaperResponse.authors[]` is often empty (today's public
    // catalog endpoint ships only the submitter name on the parent
    // record). When the BE authors[] is empty, the OpenAlex enrichment
    // synthesises the author list, and the submitter's full name (which
    // the admin uses to verify authorship) ends up as one of the
    // OpenAlex author rows. The adapter must still attach the
    // submitter's `userId` to the matching row so the published-paper
    // card can render that name as a /profile/:userId link. Without
    // this second pass, the submitter's name in the OpenAlex author
    // list stays as plain text — defeating the admin's authorship
    // verification workflow on the public catalog.
    // OpenAlex names the submitter first when they are also a
    // co-author on the OpenAlex work.
    mockOpenAlexLookup.mockResolvedValueOnce({
      status: 'preview',
      metadata: {
        id: 'W123',
        institutions: [],
        topics: [],
        keywords: [],
        authors: ['Nguyen Minh Anh', 'Tran Gia Han', 'Pham Quoc Viet'],
      },
    });

    mockGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'p-openalex',
            title: 'OpenAlex-sourced paper with submitter as co-author',
            abstract: '…',
            status: 'Published',
            createdAt: '2026-08-01T00:00:00.000Z',
            openAlexWorkId: 'W123',
            // The BE's PaperResponse.authors[] is empty here — that's
            // the production shape for the public catalog endpoint.
            authors: [],
            // But the BE still gives us the submitter's identity.
            authorId: 42,
            authorName: 'Nguyen Minh Anh',
          },
        ],
        pageNumber: 1,
        pageSize: 1000,
        totalCount: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      },
    });

    const result = await publicationAdapter.getPublicCatalog({
      page: 1,
      pageSize: 8,
      sort: 'PUBLISHED_DESC',
    });

    const authors = result.items[0].authors;
    expect(authors.map((author) => author.name)).toEqual([
      'Nguyen Minh Anh',
      'Tran Gia Han',
      'Pham Quoc Viet',
    ]);
    // The submitter's name matched against the OpenAlex row gets the
    // submitter's userId — the card renders it as /profile/42.
    const submitter = authors[0];
    expect(submitter).toMatchObject({ name: 'Nguyen Minh Anh', userId: '42' });
    // Co-authors without a submitter match stay userId-less.
    expect(authors[1]?.userId).toBeUndefined();
    expect(authors[2]?.userId).toBeUndefined();
  });
});
