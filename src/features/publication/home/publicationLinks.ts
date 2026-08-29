import type { PublicationAuthor, PublicationPaper } from '../types/publication';

const ORCID_ID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dXx]$/;
const OPENALEX_ID_PATTERN = /^W\d+$/;
const DOI_PATTERN = /^10\.\d{4,9}\/[^\s]+$/;
const ARXIV_PATTERN = /^arXiv:[0-9]{4}\.[0-9]{4,5}(v\d+)?$/i;
const SAFE_PROTOCOLS = ['http:', 'https:'];

const validateSafeUrl = (raw: string, allowedHosts: readonly string[]): string | null => {
  if (!raw) return null;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return null; }
  if (!SAFE_PROTOCOLS.includes(parsed.protocol)) return null;
  const host = parsed.hostname.toLowerCase();
  return allowedHosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`)) ? parsed.toString() : null;
};

export const buildSafeResourceLink = (value: string | undefined): string | null => {
  if (!value) return null;
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { return null; }
  return SAFE_PROTOCOLS.includes(parsed.protocol) ? parsed.toString() : null;
};

export interface ResolvedExternalLink {
  readonly href: string;
  readonly label: string;
  readonly source: 'DOI' | 'OpenAlex' | 'ORCID' | 'arXiv';
}

export const buildDoiLink = (value: string | undefined): ResolvedExternalLink | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const candidate = DOI_PATTERN.test(trimmed) ? `https://doi.org/${trimmed}` : trimmed;
  return validateSafeUrl(candidate, ['doi.org']) ? { href: candidate, label: 'DOI', source: 'DOI' } : null;
};

export const buildOpenAlexLink = (value: string | undefined): ResolvedExternalLink | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const candidate = OPENALEX_ID_PATTERN.test(trimmed) ? `https://openalex.org/${trimmed}` : trimmed;
  return validateSafeUrl(candidate, ['openalex.org']) ? { href: candidate, label: 'OpenAlex', source: 'OpenAlex' } : null;
};

export const buildOrcidLink = (value: string | undefined): ResolvedExternalLink | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const candidate = ORCID_ID_PATTERN.test(trimmed) ? `https://orcid.org/${trimmed}` : trimmed;
  return validateSafeUrl(candidate, ['orcid.org']) ? { href: candidate, label: 'ORCID', source: 'ORCID' } : null;
};

export const buildArxivBadge = (value: string | undefined): string | null => value && ARXIV_PATTERN.test(value.trim()) ? value.trim() : null;

export const resolveAuthorLinks = (author: Pick<PublicationAuthor, 'id' | 'orcid'>) => {
  const orcid = buildOrcidLink(author.orcid);
  return orcid ? [{ authorId: author.id, orcid }] : [];
};

export const resolvePaperExternalLinks = (
  paper: Pick<PublicationPaper, 'doi' | 'openAlexId' | 'externalIdentifier'>,
): {
  doi: ResolvedExternalLink | null;
  openAlex: ResolvedExternalLink | null;
  arxiv: string | null;
} => ({
  doi: buildDoiLink(paper.doi),
  openAlex: buildOpenAlexLink(paper.openAlexId),
  arxiv: buildArxivBadge(paper.externalIdentifier),
});

export const hasAuthorExternalLinks = (
  author: Pick<PublicationAuthor, 'orcid'>,
): boolean => Boolean(buildOrcidLink(author.orcid));

export const collectPaperExternalLinks = (paper: Pick<PublicationPaper, 'doi' | 'openAlexId' | 'externalIdentifier'>): ResolvedExternalLink[] => {
  const links: ResolvedExternalLink[] = [];
  const doi = buildDoiLink(paper.doi);
  if (doi) links.push(doi);
  const openAlex = buildOpenAlexLink(paper.openAlexId);
  if (openAlex) links.push(openAlex);
  return links;
};
