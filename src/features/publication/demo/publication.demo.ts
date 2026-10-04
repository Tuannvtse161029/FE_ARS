import type { PublicationPaper } from '../types/publication';

/** Temporary presentation data for the home catalog until the BE publishes
 * the status/visibility-scoped catalog contract. It is never used for writes.
 *
 * The demo papers carry a hand-picked `userId` on the submitter author so
 * the Discover Research card can render the author name as a profile link
 * (`/profile/:userId`). This lets developers preview the new "author →
 * profile" link shape locally without needing a live BE seed.
 *
 * The userIds here (`99001`, `99002`) are obviously non-real values that
 * the Profile page cannot resolve; clicking the link locally will land on
 * the Profile page with an unknown id, which is the correct demo behavior
 * for "what the link looks like" — the link wiring (router + href + hover
 * + aria-label) is what matters, not the BE user lookup. */
export const demoPublicationPapers: PublicationPaper[] = [
  {
    id: 'demo-published-learning-analytics',
    title: 'Transparent Learning Analytics for Research Writing Feedback',
    abstract: 'A mixed-methods evaluation of transparent feedback signals for postgraduate research-writing workshops, focused on feedback timing, student agency, and revision quality.',
    authors: [{ id: 'demo-author-1', name: 'Pham Thu Bao', institutionIds: ['demo-institution-1'], order: 1, userId: '99001' }],
    institutions: [{ id: 'demo-institution-1', name: 'Can Tho University' }],
    externalIdentifier: 'arXiv:2608.01001',
    publicationDate: '2026-08-18',
    paperType: 'Methodology article',
    domain: 'Education',
    field: 'Learning analytics',
    subfield: 'Academic writing',
    topics: ['Feedback', 'Research writing', 'Learning analytics'],
    keywords: ['higher education', 'revision', 'transparency'],
    version: 1,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    createdAt: '2026-07-03T08:00:00.000Z',
    publishedAt: '2026-08-18T08:00:00.000Z',
    reviewerIdentityPublic: false,
    researcherVerificationStatus: 'VERIFIED',
  },
  {
    id: 'demo-published-urban-heat',
    title: 'Street-Level Tree Canopy and Urban Heat Exposure in Ho Chi Minh City',
    abstract: 'This study combines street imagery, temperature observations, and neighborhood indicators to examine how tree canopy distribution relates to daytime heat exposure across urban districts.',
    authors: [{ id: 'demo-author-2', name: 'Nguyen Minh Anh', institutionIds: ['demo-institution-2'], order: 1, userId: '99002' }],
    institutions: [{ id: 'demo-institution-2', name: 'Vietnam National University Ho Chi Minh City' }],
    doi: '10.5555/ars.demo.2026.001',
    publicationDate: '2026-08-04',
    paperType: 'Research article',
    domain: 'Environmental science',
    field: 'Urban climate',
    subfield: 'Heat resilience',
    topics: ['Urban heat', 'Tree canopy', 'Climate adaptation'],
    keywords: ['remote sensing', 'public health', 'cities'],
    version: 2,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    createdAt: '2026-06-04T08:00:00.000Z',
    publishedAt: '2026-08-04T08:00:00.000Z',
    reviewerIdentityPublic: true,
    researcherVerificationStatus: 'VERIFIED',
  },
];
