import type { PublicationPaper } from '../../src/features/publication/types/publication';

export const publicationFixtures: PublicationPaper[] = [
  {
    id: 'fixture-published-urban-heat', title: 'Street-Level Tree Canopy and Urban Heat Exposure in Ho Chi Minh City', abstract: 'Heat exposure study.',
    authors: [{ id: 'a-1', name: 'Nguyen Minh Anh', institutionIds: ['i-1'], orcid: '0000-0002-1825-0097', order: 1 }],
    institutions: [{ id: 'i-1', name: 'Vietnam National University Ho Chi Minh City' }], doi: '10.5555/ars.fixture.2026.001', publicationDate: '2026-08-04', paperType: 'Research article', domain: 'Environmental science', field: 'Urban climate', subfield: 'Heat resilience', topics: ['Urban heat'], keywords: ['remote sensing'], version: 2, status: 'PUBLISHED', visibility: 'PUBLIC', createdAt: '2026-06-04T08:00:00.000Z', publishedAt: '2026-08-04T08:00:00.000Z', reviewerIdentityPublic: true, researcherVerificationStatus: 'VERIFIED',
  },
  {
    id: 'fixture-published-learning', title: 'Transparent Learning Analytics', abstract: 'Feedback paper.',
    authors: [{ id: 'a-3', name: 'Pham Thu Bao', institutionIds: ['i-3'], order: 1 }], institutions: [{ id: 'i-3', name: 'Can Tho University' }], openAlexId: 'W999999001', externalIdentifier: 'arXiv:2608.01001', publicationDate: '2026-08-18', paperType: 'Methodology article', domain: 'Education', field: 'Learning analytics', subfield: 'Academic writing', topics: ['Feedback'], keywords: ['analytics'], version: 1, status: 'PUBLISHED', visibility: 'PUBLIC', createdAt: '2026-07-03T08:00:00.000Z', publishedAt: '2026-08-18T08:00:00.000Z', reviewerIdentityPublic: false, researcherVerificationStatus: 'VERIFIED',
  },
  {
    id: 'fixture-private-draft', title: 'Private Draft', abstract: 'Draft.', authors: [{ id: 'a-4', name: 'Internal Author', institutionIds: ['i-4'], order: 1 }], institutions: [{ id: 'i-4', name: 'Internal Institution' }], paperType: 'Research article', topics: ['Internal'], keywords: ['draft'], version: 1, status: 'DRAFT', visibility: 'PRIVATE', createdAt: '2026-08-20T08:00:00.000Z', reviewerIdentityPublic: false, researcherVerificationStatus: 'PENDING',
  },
  {
    id: 'fixture-under-review', title: 'Under Review Paper', abstract: 'Review.', authors: [{ id: 'a-5', name: 'Private Researcher', institutionIds: ['i-5'], order: 1 }], institutions: [{ id: 'i-5', name: 'Private Institution' }], paperType: 'Research article', topics: ['Internal'], keywords: ['review'], version: 1, status: 'UNDER_REVIEW', visibility: 'PRIVATE', createdAt: '2026-08-16T08:00:00.000Z', reviewerIdentityPublic: false, researcherVerificationStatus: 'VERIFIED', reviewer: { reviewerName: 'Private Reviewer', recommendation: 'REVISION_REQUIRED', privateComments: 'This must remain private.', privateScores: { methodology: 2 } },
  },
];
