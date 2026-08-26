import { describe, expect, it } from 'vitest';
import { publicationAdapter } from '../../../src/features/publication/api/publication.adapter';
import { demoPublicationPapers } from '../../../src/features/publication/demo/publication.demo';
import { canAppearInPublicCatalog } from '../../../src/features/publication/types/publication';

describe('publication demo adapter', () => {
  it('returns only public published papers in the catalog', async () => {
    const result = await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 20, sort: 'PUBLISHED_DESC' });
    expect(result.dataSource).toBe('demo');
    expect(result.items).toHaveLength(2);
    expect(result.items.every(canAppearInPublicCatalog)).toBe(true);
  });

  it('keeps drafts and under-review records out of the public catalog', async () => {
    const catalog = await publicationAdapter.getPublicCatalog({ page: 1, pageSize: 20 });
    expect(catalog.items.map((paper) => paper.id)).not.toContain('demo-private-draft');
    expect(catalog.items.map((paper) => paper.id)).not.toContain('demo-under-review');
    expect(demoPublicationPapers.find((paper) => paper.id === 'demo-under-review')?.reviewer?.privateComments).toBe('This must remain private.');
  });

  it('lets a researcher submit a draft without selecting a reviewer', async () => {
    const draft = await publicationAdapter.createDraft({ title: 'Submission test', abstract: 'A valid submission abstract.', authors: [{ id: 'author', name: 'Researcher', institutionIds: ['institution'], order: 1 }], institutions: [{ id: 'institution', name: 'ARS University' }], paperType: 'Research article', topics: [], keywords: [] });
    expect(draft.status).toBe('DRAFT');
    expect(draft.reviewer).toBeUndefined();
    const submitted = await publicationAdapter.submitPaper(draft.id);
    expect(submitted.status).toBe('SUBMITTED');
  });

  it('makes reviewer recommendation distinct from Admin publication', async () => {
    const draft = await publicationAdapter.createDraft({ title: 'Admin decision test', abstract: 'A valid submission abstract.', authors: [{ id: 'author', name: 'Researcher', institutionIds: ['institution'], order: 1 }], institutions: [{ id: 'institution', name: 'ARS University' }], paperType: 'Research article', topics: [], keywords: [] });
    const assigned = await publicationAdapter.assignReviewer(draft.id, 'Reviewer Name');
    expect(assigned.status).toBe('REVIEWER_ASSIGNED');
    const reviewing = await publicationAdapter.respondToAssignment(draft.id, true);
    expect(reviewing.status).toBe('UNDER_REVIEW');
    const reviewed = await publicationAdapter.submitReview(draft.id, 'ACCEPT', 'Private review for Admin only.');
    expect(reviewed.status).toBe('REVIEWER_RECOMMENDED_ACCEPT');
    expect(reviewed.visibility).toBe('PRIVATE');
    const published = await publicationAdapter.publishPaper(draft.id);
    expect(published.status).toBe('PUBLISHED');
    expect(published.visibility).toBe('PUBLIC');
  });
});
