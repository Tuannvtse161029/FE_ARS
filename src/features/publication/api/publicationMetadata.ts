import { fieldService } from '../../../services/field.service';
import { openAlexAdapter } from '../researcher/openalexAdapter';
import type { PublicationPaper } from '../types/publication';

// Share concurrent lookups only; subsequent refreshes fetch authoritative data.
const pending = new Map<string, Promise<unknown>>();
function lookup<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const result = fetcher().finally(() => pending.delete(key));
  pending.set(key, result);
  return result;
}

export async function enrichPublicationMetadata(paper: PublicationPaper): Promise<PublicationPaper> {
  const result = { ...paper };
  const failures: string[] = [];
  await Promise.all([
    (async () => {
      if (!paper.subFieldId) return;
      try {
        const field = await lookup(`subfield:${paper.subFieldId}`, () => fieldService.getSubFieldById(paper.subFieldId!));
        result.subfield = field.name?.trim() || undefined;
        result.field = field.majorFieldName?.trim() || undefined;
        if (!result.field && field.majorFieldId) {
          const majors = await lookup('major-fields', () => fieldService.getAllMajor());
          result.field = majors.find((major) => major.id === field.majorFieldId)?.name;
        }
      } catch { failures.push('Research classification could not be loaded.'); }
    })(),
    (async () => {
      if (!paper.openAlexId) return;
      const outcome = await lookup(`openalex:${paper.openAlexId}`, () => openAlexAdapter.lookupPreview(paper.openAlexId!));
      if (outcome.status !== 'preview') {
        failures.push('External bibliographic metadata could not be loaded.');
        return;
      }
      const metadata = outcome.metadata;
      result.externalMetadataSource = 'OpenAlex';
      if (!paper.authors.length) result.authors = metadata.authors.map((name, index) => ({ id: `${metadata.id}:author:${index}`, name, order: index + 1, institutionIds: [] }));
      result.institutions = metadata.institutions.map((name, index) => ({ id: `${metadata.id}:institution:${index}`, name }));
      result.topics = metadata.topics ?? [];
      result.keywords = metadata.keywords;
      result.doi = paper.doi || metadata.doi;
      result.publicationDate = paper.publicationDate || metadata.publicationDate;
    })(),
  ]);
  result.metadataWarnings = failures;
  return result;
}
