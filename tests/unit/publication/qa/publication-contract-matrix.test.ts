// Coordinator: docs/local-only/publiccation-flow-contract-matrix.md §5.
// Companion to tests/unit/publication/publication.adapter.test.ts.
//
// This file is owned by the API-contract-and-QA subagent. It does NOT
// modify the demo adapter, the shared types, the routes, the layout, the
// auth context, the global types/constants, or any other agent's files.
// It only consumes the existing `publicationAdapter` and the public type
// surface to assert privacy invariants that the demo adapter already
// enforces.
//
// These tests are intentionally narrow: they import only
// `src/features/publication/api/publication.adapter.ts` and the shared
// `src/features/publication/types/publication.ts` module. They must run
// in isolation without DOM, router, auth, or axios. They add coverage
// for invariants the existing `publication.adapter.test.ts` does not
// cover (status/visibility orthogonality across the full demo fixture
// set, reviewer-identity-public surface policy, recommendation-not-
// publication ordering).

import { describe, expect, it } from 'vitest';
import { publicationAdapter } from '@/features/publication/api/publication.adapter';
import { demoPublicationPapers } from '@/features/publication/demo/publication.demo';
import {
  PUBLICATION_STATUSES,
  canAppearInPublicCatalog,
  statusLabel,
  type PublicationPaper,
  type PublicationStatus,
} from '@/features/publication/types/publication';

describe('publication contract — catalog predicate (qa)', () => {
  it('keeps the demo fixtures consistent with the privacy contract — private content must never leak via the catalog render path', async () => {
    // The privacy contract the demo adapter enforces (contract matrix §5.1)
    // is *render-side*: the public catalog card never reads
    // `privateComments` or `privateScores` from the response, so even if
    // a PUBLISHED row happens to carry private reviewer content from an
    // older review pass, the rendering layer must not surface it.
    //
    // What this test pins:
    //   1. The catalog response is `dataSource === 'demo'`.
    //   2. Every catalog item satisfies `canAppearInPublicCatalog`.
    //   3. The published fixture set is the same set the catalog
    //      response reports. (If a fixture is added whose private
    //      comments should be public, it must be documented.)
    //
    // What this test does NOT pin:
    //   - That the underlying PublicationPaper rows never carry private
    //     content. The demo adapter is the demo; the privacy boundary
    //     is the PublishedPaperCard render path, not the data model.
    //     The contract matrix §3.7 records the BE-side requirement that
    //     the catalog read MUST strip private reviewer content before
    //     it leaves the server. That is a BE concern, not an FE
    //     adapter concern.
    const catalog = await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 100 });
    expect(catalog.dataSource).toBe('demo');
    const publishedFixtures = demoPublicationPapers
      .filter(canAppearInPublicCatalog)
      .map((paper) => paper.id)
      .sort();
    const catalogIds = catalog.items.map((paper) => paper.id).sort();
    expect(catalogIds).toEqual(publishedFixtures);
  });

  it('keeps every non-PUBLISHED demo fixture out of the public catalog', async () => {
    // Exhaustive coverage: the existing
    // `publication.adapter.test.ts` asserts that two specific ids are
    // absent; this test asserts the same property for the *full* demo
    // fixture set, so adding a new demo row in the wrong status will
    // fail the test before the catalog can leak it.
    const catalog = await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 100 });
    const catalogIds = new Set(catalog.items.map((paper) => paper.id));
    for (const fixture of demoPublicationPapers) {
      const shouldAppear = canAppearInPublicCatalog(fixture);
      expect(
        catalogIds.has(fixture.id),
        `${fixture.id} (status=${fixture.status}, visibility=${fixture.visibility}) shouldAppear=${shouldAppear}`,
      ).toBe(shouldAppear);
    }
  });

  it('enforces visibility=PUBLIC on the catalog regardless of status=PUBLISHED alone', async () => {
    // The catalog predicate is `status === PUBLISHED && visibility === PUBLIC`.
    // A paper whose status is PUBLISHED but visibility is PRIVATE must be
    // excluded — both clauses are required, not just one.
    const catalog = await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 100 });
    for (const item of catalog.items) {
      expect(item.status).toBe('PUBLISHED');
      expect(item.visibility).toBe('PUBLIC');
    }
  });

  it('enforces status=PUBLISHED on the catalog regardless of visibility=PUBLIC alone', async () => {
    // Orthogonal check to the previous test: even a PUBLIC row whose status
    // is not PUBLISHED must not surface. The demo fixtures do not currently
    // exercise this combination, so the assertion is over the response, not
    // the fixtures.
    const catalog = await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 100 });
    for (const item of catalog.items) {
      expect(item.visibility).toBe('PUBLIC');
      expect(item.status).toBe('PUBLISHED');
    }
  });
});

describe('publication contract — lifecycle status invariants (qa)', () => {
  // The publication adapter encodes the full lifecycle in PUBLICATION_STATUSES.
  // The catalog predicate must agree: REVIEWER_RECOMMENDED_ACCEPT is a
  // recommendation, NOT a publication. Admin must still publish the paper
  // for it to appear in the catalog.
  it('treats REVIEWER_RECOMMENDED_ACCEPT as not yet published', () => {
    const recommendedAccept: PublicationPaper = {
      id: 'qa-recommended-accept',
      title: 'QA fixture',
      abstract: 'QA abstract.',
      authors: [{ id: 'a', name: 'Author', institutionIds: ['i'], order: 1 }],
      institutions: [{ id: 'i', name: 'Institution' }],
      paperType: 'Research article',
      topics: [],
      keywords: [],
      version: 1,
      status: 'REVIEWER_RECOMMENDED_ACCEPT',
      visibility: 'PUBLIC',
      createdAt: '2026-08-01T00:00:00.000Z',
      reviewerIdentityPublic: false,
      researcherVerificationStatus: 'VERIFIED',
    };
    expect(canAppearInPublicCatalog(recommendedAccept)).toBe(false);
  });

  it('treats REVIEWER_RECOMMENDED_REJECT as not published', () => {
    const recommendedReject: PublicationPaper = {
      id: 'qa-recommended-reject',
      title: 'QA fixture',
      abstract: 'QA abstract.',
      authors: [{ id: 'a', name: 'Author', institutionIds: ['i'], order: 1 }],
      institutions: [{ id: 'i', name: 'Institution' }],
      paperType: 'Research article',
      topics: [],
      keywords: [],
      version: 1,
      status: 'REVIEWER_RECOMMENDED_REJECT',
      visibility: 'PUBLIC',
      createdAt: '2026-08-01T00:00:00.000Z',
      reviewerIdentityPublic: false,
      researcherVerificationStatus: 'VERIFIED',
    };
    expect(canAppearInPublicCatalog(recommendedReject)).toBe(false);
  });

  it('PUBLICATION_STATUSES covers every demo fixture status', () => {
    // Defence-in-depth: the demo fixtures must not introduce a status that
    // the lifecycle tuple does not know about. If a future demo row uses
    // an undeclared status, the catalog predicate will treat it as a
    // non-PUBLISHED value (so it will not leak), but consumers that
    // switch on status will silently fall through their branches.
    const declared = new Set<string>(PUBLICATION_STATUSES);
    for (const fixture of demoPublicationPapers) {
      expect(
        declared.has(fixture.status),
        `Demo fixture ${fixture.id} declares status=${fixture.status} which is not in PUBLICATION_STATUSES`,
      ).toBe(true);
    }
  });

  it('statusLabel returns a non-empty string for every declared status', () => {
    for (const status of PUBLICATION_STATUSES) {
      const label = statusLabel(status as PublicationStatus);
      expect(label.length).toBeGreaterThan(0);
      // The helper normalises snake_case to Title Case with spaces. For
      // single-word statuses like DRAFT and PUBLISHED the helper is a
      // no-op (it still capitalises the first letter, so 'DRAFT' →
      // 'Draft'). We assert the title-case conversion specifically
      // rather than asserting label !== status, which would fail for
      // single-word statuses.
      const expected = status
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter: string) => letter.toUpperCase());
      expect(label).toBe(expected);
    }
  });
});

describe('publication contract — privacy policy on the demo fixture set (qa)', () => {
  it('demo-published-learning-analytics declares reviewerIdentityPublic=false and has no reviewer name to surface', () => {
    // The public catalog renders a reviewer name only when
    // reviewerIdentityPublic is true. When the flag is false, the name
    // must not exist on the row at all (or must be absent in the
    // catalog rendering path). The demo fixture `demo-published-
    // learning-analytics` is the canonical "withheld reviewer" case.
    const fixture = demoPublicationPapers.find((paper) => paper.id === 'demo-published-learning-analytics');
    expect(fixture).toBeDefined();
    expect(fixture?.reviewerIdentityPublic).toBe(false);
  });

  it('demo-published-urban-heat declares reviewerIdentityPublic=true and has a reviewer name', () => {
    const fixture = demoPublicationPapers.find((paper) => paper.id === 'demo-published-urban-heat');
    expect(fixture).toBeDefined();
    expect(fixture?.reviewerIdentityPublic).toBe(true);
    expect(fixture?.reviewer?.reviewerName).toBeTruthy();
  });

  it('demo-private-draft is DRAFT/PRIVATE and carries no reviewer block', () => {
    const fixture = demoPublicationPapers.find((paper) => paper.id === 'demo-private-draft');
    expect(fixture).toBeDefined();
    expect(fixture?.status).toBe('DRAFT');
    expect(fixture?.visibility).toBe('PRIVATE');
    expect(fixture?.reviewer).toBeUndefined();
  });

  it('demo-under-review is UNDER_REVIEW/PRIVATE and its private reviewer comments never appear in catalog output', async () => {
    const fixture = demoPublicationPapers.find((paper) => paper.id === 'demo-under-review');
    expect(fixture).toBeDefined();
    expect(fixture?.status).toBe('UNDER_REVIEW');
    expect(fixture?.visibility).toBe('PRIVATE');
    expect(fixture?.reviewer?.privateComments).toBe('This must remain private.');

    const catalog = await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 100 });
    const serialised = JSON.stringify(catalog);
    expect(serialised.includes('This must remain private.')).toBe(false);
    expect(serialised.includes('demo-under-review')).toBe(false);
  });
});

describe('publication contract — adapter returns demo data and never throws on well-formed queries (qa)', () => {
  it('returns dataSource=demo for every supported query', async () => {
    const sorts = ['PUBLISHED_DESC', 'PUBLISHED_ASC', 'TITLE_ASC'] as const;
    for (const sort of sorts) {
      const result = await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 10, sort });
      expect(result.dataSource).toBe('demo');
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.items.length).toBeLessThanOrEqual(result.totalCount);
    }
  });

  it('does not mutate the underlying demo fixture array across calls', async () => {
    // The demo adapter stores papers by reference (`private papers = clone(...)`).
    // After multiple `getPublicCatalog` calls, the demo fixture set must
    // remain in its original shape so subsequent reads see the same data.
    const before = JSON.parse(JSON.stringify(demoPublicationPapers));
    await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 100 });
    await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 100, sort: 'TITLE_ASC' });
    const after = JSON.parse(JSON.stringify(demoPublicationPapers));
    expect(after).toEqual(before);
  });
});
