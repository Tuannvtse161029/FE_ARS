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
import { MemoryRouter } from 'react-router-dom';
import { PublishedPaperCard } from '../../../../src/features/publication/home/PublishedPaperCard';
import type { PublicationPaper } from '../../../../src/features/publication/types/publication';
import { demoPublicationPapers } from '../../../../src/features/publication/demo/publication.demo';

// Render the card inside a MemoryRouter so the `Link` component
// (used for the author profile link) has a Router context. Existing
// tests that don't render a profile link also benefit — they would
// have broken the moment a paper carried a `userId`, and the wrapper
// is a no-op for the plain-text + ORCID cases.
const renderCard = (paper: PublicationPaper, publicReviewerName: string | null) =>
  render(
    <MemoryRouter>
      <PublishedPaperCard paper={paper} publicReviewerName={publicReviewerName} />
    </MemoryRouter>,
  );

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
    renderCard(publicPaper, "Dr. Le Quang Huy");
    openPublicationDetails();
    expect(screen.getByText(/Dr\. Le Quang Huy/)).toBeInTheDocument();
  });

  it('never renders private reviewer comments in the DOM', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
    expect(screen.queryByText(/Top secret reviewer commentary/)).toBeNull();
  });

  it('never renders private reviewer scores in the DOM', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
    expect(screen.queryByText(/originality/i)).toBeNull();
    expect(screen.queryByText(/methodology/i)).toBeNull();
  });

  it('never renders the REVIEWER_RECOMMENDED_* recommendation string', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
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
    renderCard(closedIdentity, null);
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
    renderCard(safer, "Dr. Le Quang Huy");
    expect(screen.queryByText(/INTERNAL: do not leak/)).toBeNull();
    expect(screen.queryByText(/internalSecret/)).toBeNull();
    expect(screen.queryByText(/7/)).toBeNull();
  });
});

describe('<PublishedPaperCard> – required metadata is rendered', () => {
  it('renders title, abstract, paper type, version, and publication date', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
    expect(screen.getByRole('heading', { name: publicPaper.title })).toBeInTheDocument();
    expect(screen.getByText(publicPaper.abstract)).toBeInTheDocument();
    expect(screen.getByText('Research article')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText(/2026-08-04/)).toBeInTheDocument();
  });

  it('renders keywords and topics as a scannable list', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
    openPublicationDetails();
    expect(screen.getByText('remote sensing')).toBeInTheDocument();
    expect(screen.getByText('Urban heat')).toBeInTheDocument();
  });

  it('renders the domain → field → subfield chain', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
    openPublicationDetails();
    expect(screen.getByText(/Environmental science \/ Urban climate \/ Heat resilience/)).toBeInTheDocument();
  });
});

describe('<PublishedPaperCard> – canonical author links', () => {
  it('emits a safe ORCID link only when the author carries a canonical iD', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
    const orcidLink = screen.getByRole('link', { name: /Open ORCID profile for Nguyen Minh Anh/i });
    expect(orcidLink).toHaveAttribute('href', 'https://orcid.org/0000-0002-1825-0097');
    expect(orcidLink).toHaveAttribute('target', '_blank');
    expect(orcidLink).toHaveAttribute('rel', expect.stringMatching(/noopener/));
    expect(orcidLink).toHaveAttribute('rel', expect.stringMatching(/noreferrer/));
  });

  it('does NOT emit a link when an author has no ORCID', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
    expect(screen.queryByRole('link', { name: /Open ORCID profile for Tran Gia Han/i })).toBeNull();
  });

  it('never builds a URL from the author name', () => {
    // The author "Tran Gia Han" has no ORCID and no userId and must
    // therefore have no outbound link at all. This pins the "never
    // URL from unsanitized name" rule at the component level: a
    // profile link only ever renders for authors the adapter could
    // identify as registered ARS users (currently: the paper's
    // submitter).
    const { container } = renderCard(publicPaper, "Dr. Le Quang Huy");
    const tranLink = container.querySelector('[data-author-id="a-2"] a');
    expect(tranLink).toBeNull();
  });

  it('renders the submitter author as a link to /profile/:userId when the adapter attaches a userId', () => {
    // Simulate the adapter having identified "Nguyen Minh Anh" as the
    // paper's submitter — the author carries a `userId` and the
    // component must wrap the name in a <Link> to that profile.
    const paperWithUserIds: PublicationPaper = {
      ...publicPaper,
      authors: [
        { ...publicPaper.authors[0], userId: '42' },
        publicPaper.authors[1],
      ],
    };
    renderCard(paperWithUserIds, "Dr. Le Quang Huy");
    const profileLink = screen.getByTestId('public-paper-author-profile-link');
    expect(profileLink).toHaveAttribute('href', '/profile/42');
    // The ORCID chip is still rendered alongside the profile link.
    expect(
      screen.getByRole('link', { name: /Open ORCID profile for Nguyen Minh Anh/i }),
    ).toBeInTheDocument();
  });

  it('does not render a profile link for an author without a userId', () => {
    // The "Tran Gia Han" author carries no userId — the profile link
    // must not appear, even if other authors on the same paper have
    // one. We assert this by counting links with the profile-link
    // testid on the SECOND author's chip; the first chip carries
    // one (asserted separately above) so the total in the document
    // is exactly 1, not 2.
    const paperWithMixed: PublicationPaper = {
      ...publicPaper,
      authors: [
        { ...publicPaper.authors[0], userId: '42' },
        publicPaper.authors[1],
      ],
    };
    renderCard(paperWithMixed, "Dr. Le Quang Huy");
    const chips = screen.getAllByTestId('public-paper-author');
    const tranChip = chips[1];
    const profileLinks = tranChip.querySelectorAll(
      '[data-testid="public-paper-author-profile-link"]',
    );
    expect(profileLinks).toHaveLength(0);
  });

  it('ignores a non-numeric userId and falls back to plain text', () => {
    // Defensive: if the adapter ever ships a garbage userId (string
    // that doesn't parse as a positive integer), the card must not
    // build a malformed URL like /profile/abc — the Profile page
    // would 404.
    const paperWithBadId: PublicationPaper = {
      ...publicPaper,
      authors: [{ ...publicPaper.authors[0], userId: 'not-a-number' }],
    };
    renderCard(paperWithBadId, "Dr. Le Quang Huy");
    expect(
      screen.queryByTestId('public-paper-author-profile-link'),
    ).toBeNull();
  });

  it('renders authors in canonical order (order field, not name)', () => {
    const unsorted: PublicationPaper = {
      ...publicPaper,
      authors: [
        { id: 'a-2', name: 'Tran Gia Han', institutionIds: ['i-2'], order: 2 },
        { id: 'a-1', name: 'Nguyen Minh Anh', institutionIds: ['i-1'], orcid: '0000-0002-1825-0097', order: 1 },
      ],
    };
    renderCard(unsorted, "Dr. Le Quang Huy");
    const authorEls = screen.getAllByTestId('public-paper-author');
    expect(authorEls[0]).toHaveAttribute('data-author-id', 'a-1');
    expect(authorEls[1]).toHaveAttribute('data-author-id', 'a-2');
  });
});

describe('<PublishedPaperCard> – external identifiers produce safe links only', () => {
  it('emits a DOI link to https://doi.org/ when the DOI is canonical', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
    openPublicationDetails();
    const doiLink = screen.getByRole('link', { name: /10\.5555\/ars\.demo\.2026\.001/ });
    expect(doiLink).toHaveAttribute('href', 'https://doi.org/10.5555/ars.demo.2026.001');
    expect(doiLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(doiLink).toHaveAttribute('target', '_blank');
  });

  it('emits an OpenAlex link to https://openalex.org/W… when the ID is canonical', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
    openPublicationDetails();
    const openAlexLink = screen.getByRole('link', { name: /W999999001/ });
    expect(openAlexLink).toHaveAttribute('href', 'https://openalex.org/W999999001');
    expect(openAlexLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(openAlexLink).toHaveAttribute('target', '_blank');
  });

  it('renders the arXiv identifier as plain text, never as a link', () => {
    renderCard(publicPaper, "Dr. Le Quang Huy");
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
    renderCard(noDoi, "Dr. Le Quang Huy");
    openPublicationDetails();
    expect(screen.getByText('Not supplied')).toBeInTheDocument();
  });

  it('does not emit a malformed DOI link for an unparseable value', () => {
    const bad: PublicationPaper = {
      ...publicPaper,
      doi: 'javascript:alert(1)',
    };
    renderCard(bad, "Dr. Le Quang Huy");
    const links = screen.queryAllByRole('link');
    links.forEach((link) => {
      expect(link.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
      expect(link.getAttribute('href') ?? '').not.toMatch(/^data:/i);
    });
  });
});

describe('<PublishedPaperCard> – demo papers render a profile link for the submitter', () => {
  // The demo catalog papers each have a single submitter author with a
  // hand-picked `userId` so developers can preview the author → profile
  // link shape locally without a live BE seed. This block pins that
  // contract: every demo paper's submitter name must be a clickable
  // link to `/profile/:userId`, and the userId must be a real-looking
  // positive integer (the helper would otherwise reject it and fall
  // back to plain text).
  for (const demoPaper of demoPublicationPapers) {
    const submitter = demoPaper.authors[0];
    if (!submitter?.userId) continue;

    it(`renders ${submitter.name} as a link to /profile/${submitter.userId} on "${demoPaper.title.slice(0, 40)}…"`, () => {
      renderCard(demoPaper, null);
      const link = screen.getByTestId('public-paper-author-profile-link');
      expect(link).toHaveAttribute('href', `/profile/${submitter.userId}`);
      expect(link.textContent).toContain(submitter.name);
    });
  }
});
