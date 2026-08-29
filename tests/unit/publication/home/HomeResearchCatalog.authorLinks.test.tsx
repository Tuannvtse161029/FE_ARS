/**
 * Catalog-level author-links tests.
 *
 * These pin at the page level that, when a paper carries a canonical ORCID
 * on an author, the rendered card has an outbound ORCID link that:
 *   - targets the canonical https://orcid.org/ host (no name-based URLs)
 *   - opens in a new tab (target="_blank")
 *   - is safe to open in another tab (rel includes noopener + noreferrer)
 *
 * The card-level tests cover the same behavior. This file is the belt to
 * the card's braces — it asserts the same invariant through the catalog,
 * which is the surface an authenticated user actually sees.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HomeResearchCatalog } from '../../../../src/features/publication/home/HomeResearchCatalog';
import { publicationAdapter } from '../../../../src/features/publication/api/publication.adapter';
import type { PagedPublicationResult, PublicationPaper } from '../../../../src/features/publication/types/publication';

vi.mock('../../../../src/features/publication/api/publication.adapter', () => ({
  publicationAdapter: {
    getPublicCatalog: vi.fn(),
  },
}));

const getCatalogMock = vi.mocked(publicationAdapter.getPublicCatalog);

const paper: PublicationPaper = {
  id: 'demo-published-urban-heat',
  title: 'Street-Level Tree Canopy and Urban Heat Exposure in Ho Chi Minh City',
  abstract: 'Heat exposure study combining street imagery and observations.',
  authors: [
    { id: 'a-1', name: 'Nguyen Minh Anh', institutionIds: ['i-1'], orcid: '0000-0002-1825-0097', order: 1 },
    { id: 'a-2', name: 'Tran Gia Han', institutionIds: ['i-2'], order: 2 },
  ],
  institutions: [
    { id: 'i-1', name: 'VNU-HCM' },
    { id: 'i-2', name: 'UEH' },
  ],
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
  reviewer: {
    reviewerName: 'Dr. Le Quang Huy',
    recommendation: 'ACCEPT',
    privateComments: 'must remain private',
    privateScores: {},
  },
};

const buildResult = (items: PublicationPaper[]): PagedPublicationResult => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 8,
  dataSource: 'api',
});

describe('<HomeResearchCatalog> – canonical author links', () => {
  it('renders a safe ORCID link for authors that carry a canonical iD', async () => {
    getCatalogMock.mockResolvedValueOnce(buildResult([paper]));
    render(<HomeResearchCatalog />);

    const link = await screen.findByRole('link', { name: /Open ORCID profile for Nguyen Minh Anh/i });
    expect(link).toHaveAttribute('href', 'https://orcid.org/0000-0002-1825-0097');
    expect(link).toHaveAttribute('target', '_blank');
    const rel = link.getAttribute('rel') ?? '';
    expect(rel).toMatch(/noopener/);
    expect(rel).toMatch(/noreferrer/);
  });

  it('does not render a profile link for an author without ORCID', async () => {
    getCatalogMock.mockResolvedValueOnce(buildResult([paper]));
    render(<HomeResearchCatalog />);

    await waitFor(() => {
      expect(screen.getByTestId('public-paper-card')).toBeInTheDocument();
    });
    const tranLink = screen.queryByRole('link', { name: /Open ORCID profile for Tran Gia Han/i });
    expect(tranLink).toBeNull();
  });

  it('keeps the ORCID link on the canonical orcid.org host and never builds URLs from names', async () => {
    getCatalogMock.mockResolvedValueOnce(buildResult([paper]));
    render(<HomeResearchCatalog />);

    await waitFor(() => {
      expect(screen.getAllByTestId('public-paper-card')).toHaveLength(1);
    });

    // Every external <a> in the rendered tree must target a known host —
    // never a name-keyed search URL or a stray javascript: scheme.
    const externalLinks = screen.getAllByRole('link');
    externalLinks.forEach((link) => {
      const href = link.getAttribute('href') ?? '';
      expect(href).not.toMatch(/^javascript:/i);
      expect(href).not.toMatch(/^data:/i);
      expect(href.toLowerCase()).toMatch(/^https:\/\/(orcid\.org|doi\.org|openalex\.org)\//);
    });
  });
});
