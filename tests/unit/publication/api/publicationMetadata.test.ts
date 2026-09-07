import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../../src/services/field.service', () => ({ fieldService: { getSubFieldById: vi.fn(), getAllMajor: vi.fn() } }));
vi.mock('../../../../src/features/publication/researcher/openalexAdapter', () => ({ openAlexAdapter: { lookupPreview: vi.fn() } }));
import { fieldService } from '../../../../src/services/field.service';
import { openAlexAdapter } from '../../../../src/features/publication/researcher/openalexAdapter';
import { enrichPublicationMetadata } from '../../../../src/features/publication/api/publicationMetadata';
import type { PublicationPaper } from '../../../../src/features/publication/types/publication';
const paper = { id: '1', subFieldId: 1, openAlexId: 'W123', authors: [], institutions: [], topics: [], keywords: [] } as unknown as PublicationPaper;
beforeEach(() => vi.resetAllMocks());
it('resolves real taxonomy and external bibliography without duplicating major fields', async () => {
  vi.mocked(fieldService.getSubFieldById).mockResolvedValue({ name: 'Data Science', majorFieldName: 'Computer Science' });
  vi.mocked(openAlexAdapter.lookupPreview).mockResolvedValue({ status: 'preview', metadata: { id: 'W123', authors: ['External author'], institutions: ['University'], topics: ['Statistics'], keywords: ['analysis'] } });
  const result = await enrichPublicationMetadata(paper);
  expect(result.field).toBe('Computer Science');
  expect(result.subfield).toBe('Data Science');
  expect(result.domain).toBeUndefined();
  expect(result.authors[0].name).toBe('External author');
  expect(result.institutions[0].name).toBe('University');
  const saved = [{ id: 'a', name: 'Saved author', order: 1, institutionIds: [] }];
  expect((await enrichPublicationMetadata({ ...paper, authors: saved })).authors).toEqual(saved);
});
it('surfaces lookup failures without inventing metadata', async () => {
  vi.mocked(fieldService.getSubFieldById).mockRejectedValue(new Error('Unavailable'));
  vi.mocked(openAlexAdapter.lookupPreview).mockResolvedValue({ status: 'unavailable', message: 'Unavailable' });
  const result = await enrichPublicationMetadata(paper);
  expect(result.authors).toEqual([]);
  expect(result.metadataWarnings).toHaveLength(2);
});
