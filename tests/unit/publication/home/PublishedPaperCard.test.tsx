/**
 * <PublishedPaperCard> privacy + external-link tests.
 *
 * The catalog card is the most data-leak-prone surface in the publication
 * flow. A reviewer can be named publicly only when the paper itself says
 * so. Private comments, scores, recommendations, and admin notes must
 * never reach the rendered DOM. External links must be safe.
 */

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PublishedPaperCard } from '../../../../src/features/publication/home/PublishedPaperCard';
import type { PublicationPaper } from '../../../../src/features/publication/types/publication';

const baseAuthor = (id: string, name: string) => ({ id, name, institutionIds: ['i-1'], order: 1 });

const publicPaper: PublicationPaper = {
  id: 'demo-published-urban-heat',
  title: 'Street-Level Tree Canopy and Urban Heat Exposure in Ho Chi Minh City',
  abstract: 'Heat exposure study combining street imagery and observations.',
  authors: [
    { ...baseAuthor('a-1', 'Nguyen Minh Anh'), orcid: '0000-0002-1825-0097' },
    baseAuthor('a-2', 'Tran Gia Han'),
  ],
  institutions: [{ id: 'i-1', name: 'VNU-HCM' }],
  doi: '10.5555/ars.demo.2026.001',
  openAlexId: 'W999999001',
  externalIdentifier: 'arXiv:2608.01001',
  publicationDate: '2026-08-04',
  paperType: 'Research article',
  domain: 'Environmental science',
  field: 'Urban climate',
  subfield: 'Heat resilience',
  topics: ['Urban heat', 'Tree canopy'],
  keywords: ['remote sensing', 'public health'],
  version: 2,
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  createdAt: '2026-06-04T08:00:00.000Z',
  submittedAt: '2026-06-06T08:00:00.000Z',
  publishedAt: '2026-08-04T08:00:00.000Z',
  reviewer: {
    reviewerName: 'Dr. Le Quang Huy',
    recommendation: 'ACCEPT',
    privateComments: 'Top secret reviewer commentary that must NEVER leak.',
    privateScores: { originality: 5, methodology: 4 },
    submittedAt: '2026-07-22T08:00:00.000Z',
  },
  reviewerIdentityPublic: true,
  researcherVerificationStatus: 'VERIFIED',
};

const openPublicationDetails = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Show publication details' }));
};

describe('<PublishedPaperCard> – private review data is hidden', () => {
  it('shows the reviewer name only when reviewerIdentityPublic is true', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    openPublicationDetails();
    expect(screen.getByText(/Dr\. Le Quang Huy/)).toBeInTheDocument();
  });

  it('never renders private reviewer comments in the DOM', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    expect(screen.queryByText(/Top secret reviewer commentary/)).toBeNull();
  });

  it('never renders private reviewer scores in the DOM', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    expect(screen.queryByText(/originality/i)).toBeNull();
    expect(screen.queryByText(/methodology/i)).toBeNull();
  });

  it('never renders the REVIEWER_RECOMMENDED_* recommendation string', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    expect(screen.queryByText(/recommendation/i)).toBeNull();
    expect(screen.queryByText(/ACCEPT/i)).toBeNull();
    expect(screen.queryByText(/REVISION_REQUIRED/i)).toBeNull();
    expect(screen.queryByText(/REJECT/i)).toBeNull();
  });

  it('shows a "Reviewer identity withheld" signal when publicReviewerName is null', () => {
    const closedIdentity: PublicationPaper = {
      ...publicPaper,
      reviewerIdentityPublic: false,
    };
    render(<PublishedPaperCard paper={closedIdentity} publicReviewerName={null} />);
    openPublicationDetails();
    expect(screen.queryByText(/Dr\. Le Quang Huy/)).toBeNull();
    expect(screen.getByText(/Reviewer identity withheld per policy/i)).toBeInTheDocument();
  });

  it('never renders private reviewer fields even when reviewerIdentityPublic=true', () => {
    const safer: PublicationPaper = {
      ...publicPaper,
      // Strip OpenAlex so the rendered "W999999001" can't trip up on the
      // "99" substring check below.
      openAlexId: undefined,
      reviewer: {
        ...publicPaper.reviewer!,
        privateComments: 'INTERNAL: do not leak',
        privateScores: { originality: 5, methodology: 4, internalSecret: 7 },
      },
    };
    render(<PublishedPaperCard paper={safer} publicReviewerName="Dr. Le Quang Huy" />);
    expect(screen.queryByText(/INTERNAL: do not leak/)).toBeNull();
    expect(screen.queryByText(/internalSecret/)).toBeNull();
    expect(screen.queryByText(/7/)).toBeNull();
  });
});

describe('<PublishedPaperCard> – required metadata is rendered', () => {
  it('renders title, abstract, paper type, version, and publication date', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    expect(screen.getByRole('heading', { name: publicPaper.title })).toBeInTheDocument();
    expect(screen.getByText(publicPaper.abstract)).toBeInTheDocument();
    expect(screen.getByText('Research article')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText(/2026-08-04/)).toBeInTheDocument();
  });

  it('renders keywords and topics as a scannable list', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    openPublicationDetails();
    expect(screen.getByText('remote sensing')).toBeInTheDocument();
    expect(screen.getByText('Urban heat')).toBeInTheDocument();
  });

  it('renders the domain → field → subfield chain', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    openPublicationDetails();
    expect(screen.getByText(/Environmental science \/ Urban climate \/ Heat resilience/)).toBeInTheDocument();
  });
});

describe('<PublishedPaperCard> – canonical author links', () => {
  it('emits a safe ORCID link only when the author carries a canonical iD', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    const orcidLink = screen.getByRole('link', { name: /Open ORCID profile for Nguyen Minh Anh/i });
    expect(orcidLink).toHaveAttribute('href', 'https://orcid.org/0000-0002-1825-0097');
    expect(orcidLink).toHaveAttribute('target', '_blank');
    expect(orcidLink).toHaveAttribute('rel', expect.stringMatching(/noopener/));
    expect(orcidLink).toHaveAttribute('rel', expect.stringMatching(/noreferrer/));
  });

  it('does NOT emit a link when an author has no ORCID', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    expect(screen.queryByRole('link', { name: /Open ORCID profile for Tran Gia Han/i })).toBeNull();
  });

  it('never builds a URL from the author name', () => {
    // The author "Tran Gia Han" has no ORCID and must therefore have no
    // outbound link at all. This pins the "never URL from unsanitized
    // name" rule at the component level.
    const { container } = render(
      <PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />,
    );
    const tranLink = container.querySelector('[data-author-id="a-2"] a');
    expect(tranLink).toBeNull();
  });

  it('renders authors in canonical order (order field, not name)', () => {
    const unsorted: PublicationPaper = {
      ...publicPaper,
      authors: [
        { id: 'a-2', name: 'Tran Gia Han', institutionIds: ['i-2'], order: 2 },
        { id: 'a-1', name: 'Nguyen Minh Anh', institutionIds: ['i-1'], orcid: '0000-0002-1825-0097', order: 1 },
      ],
    };
    render(<PublishedPaperCard paper={unsorted} publicReviewerName="Dr. Le Quang Huy" />);
    const authorEls = screen.getAllByTestId('public-paper-author');
    expect(authorEls[0]).toHaveAttribute('data-author-id', 'a-1');
    expect(authorEls[1]).toHaveAttribute('data-author-id', 'a-2');
  });
});

describe('<PublishedPaperCard> – external identifiers produce safe links only', () => {
  it('emits a DOI link to https://doi.org/ when the DOI is canonical', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    openPublicationDetails();
    const doiLink = screen.getByRole('link', { name: /10\.5555\/ars\.demo\.2026\.001/ });
    expect(doiLink).toHaveAttribute('href', 'https://doi.org/10.5555/ars.demo.2026.001');
    expect(doiLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(doiLink).toHaveAttribute('target', '_blank');
  });

  it('emits an OpenAlex link to https://openalex.org/W… when the ID is canonical', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    openPublicationDetails();
    const openAlexLink = screen.getByRole('link', { name: /W999999001/ });
    expect(openAlexLink).toHaveAttribute('href', 'https://openalex.org/W999999001');
    expect(openAlexLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(openAlexLink).toHaveAttribute('target', '_blank');
  });

  it('renders the arXiv identifier as plain text, never as a link', () => {
    render(<PublishedPaperCard paper={publicPaper} publicReviewerName="Dr. Le Quang Huy" />);
    openPublicationDetails();
    expect(screen.getByText('arXiv:2608.01001')).toBeInTheDocument();
    const arxivLinks = screen.queryAllByRole('link', { name: /arXiv:2608\.01001/ });
    expect(arxivLinks).toHaveLength(0);
  });

  it('falls back to "Not supplied" when the paper carries no DOI', () => {
    const noDoi: PublicationPaper = {
      ...publicPaper,
      doi: undefined,
    };
    render(<PublishedPaperCard paper={noDoi} publicReviewerName="Dr. Le Quang Huy" />);
    openPublicationDetails();
    expect(screen.getByText('Not supplied')).toBeInTheDocument();
  });

  it('does not emit a malformed DOI link for an unparseable value', () => {
    const bad: PublicationPaper = {
      ...publicPaper,
      doi: 'javascript:alert(1)',
    };
    render(<PublishedPaperCard paper={bad} publicReviewerName="Dr. Le Quang Huy" />);
    const links = screen.queryAllByRole('link');
    links.forEach((link) => {
      expect(link.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
      expect(link.getAttribute('href') ?? '').not.toMatch(/^data:/i);
    });
  });
});
