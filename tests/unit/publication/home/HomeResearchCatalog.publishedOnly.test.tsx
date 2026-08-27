/**
 * Catalog-only tests for HomeResearchCatalog.
 *
 * The catalog must render only papers that satisfy the public catalog
 * predicate (PUBLISHED + PUBLIC). The demo adapter already enforces that
 * filter server-side; this test pins the catalog's *contractual*
 * responsibility — namely that it never fabricates visibility on the
 * client and that it surfaces the demo banner so reviewers and
 * researchers know the data is not from a BE endpoint yet.
 *
 * Adapter-level filtering is asserted by tests/unit/publication/publication.adapter.test.ts.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HomeResearchCatalog } from '../../../../src/features/publication/home/HomeResearchCatalog';
import { publicationAdapter } from '../../../../src/features/publication/api/publication.adapter';
import { canAppearInPublicCatalog, type PagedPublicationResult, type PublicationPaper } from '../../../../src/features/publication/types/publication';

vi.mock('../../../../src/features/publication/api/publication.adapter', () => ({
  publicationAdapter: {
    getPublicCatalog: vi.fn(),
  },
}));

const getCatalogMock = vi.mocked(publicationAdapter.getPublicCatalog);

const publicPaperA: PublicationPaper = {
  id: 'demo-published-urban-heat',
  title: 'Street-Level Tree Canopy and Urban Heat Exposure in Ho Chi Minh City',
  abstract: 'Heat exposure paper.',
  authors: [{ id: 'a-1', name: 'Nguyen Minh Anh', institutionIds: ['i-1'], order: 1 }],
  institutions: [{ id: 'i-1', name: 'VNU-HCM' }],
  doi: '10.5555/ars.demo.2026.001',
  paperType: 'Research article',
  topics: ['Urban heat'],
  keywords: ['heat'],
  version: 2,
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  createdAt: '2026-08-04T08:00:00.000Z',
  publishedAt: '2026-08-04T08:00:00.000Z',
  reviewerIdentityPublic: true,
  researcherVerificationStatus: 'VERIFIED',
};

const publicPaperB: PublicationPaper = {
  id: 'demo-published-learning-analytics',
  title: 'Transparent Learning Analytics',
  abstract: 'Feedback paper.',
  authors: [{ id: 'a-3', name: 'Pham Thu Bao', institutionIds: ['i-3'], order: 1 }],
  institutions: [{ id: 'i-3', name: 'Can Tho' }],
  openAlexId: 'W999999001',
  paperType: 'Methodology article',
  topics: ['Feedback'],
  keywords: ['analytics'],
  version: 1,
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  createdAt: '2026-08-18T08:00:00.000Z',
  publishedAt: '2026-08-18T08:00:00.000Z',
  reviewerIdentityPublic: false,
  researcherVerificationStatus: 'VERIFIED',
};

const buildResult = (items: PublicationPaper[]): PagedPublicationResult => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 8,
  dataSource: 'demo',
});

describe('<HomeResearchCatalog> – published-only contract', () => {
  it('only renders papers that satisfy the public-catalog predicate', async () => {
    // When the typed adapter behaves correctly, only PUBLISHED+PUBLIC papers
    // are in the result. The catalog surfaces them as-is, with no client-side
    // fabrication. (Adapter-level filtering is owned by the adapter and is
    // pinned in tests/unit/publication/publication.adapter.test.ts.)
    getCatalogMock.mockResolvedValueOnce(
      buildResult([publicPaperA, publicPaperB]),
    );

    render(<HomeResearchCatalog />);

    const cards = await screen.findAllByTestId('public-paper-card');
    const renderedIds = cards.map((card) => card.getAttribute('data-paper-id'));

    expect(renderedIds).toEqual(['demo-published-urban-heat', 'demo-published-learning-analytics']);
    renderedIds.forEach((id) => {
      const paper = id === publicPaperA.id ? publicPaperA : publicPaperB;
      expect(canAppearInPublicCatalog(paper)).toBe(true);
    });
  });

  it('still surfaces the demo banner that flags catalog data as awaiting the backend API', async () => {
    getCatalogMock.mockResolvedValueOnce(buildResult([publicPaperA]));
    render(<HomeResearchCatalog />);
    expect(await screen.findByText(/awaiting backend published-paper api/i)).toBeInTheDocument();
  });

  it('reports the count to authenticated users so they can see how many papers are available', async () => {
    getCatalogMock.mockResolvedValueOnce(buildResult([publicPaperA, publicPaperB]));
    render(<HomeResearchCatalog />);
    await waitFor(() => {
      expect(screen.getAllByTestId('public-paper-card')).toHaveLength(2);
    });
    expect(screen.getByText(/2 published papers/i)).toBeInTheDocument();
  });
});
