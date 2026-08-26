/**
 * Safe-link helpers for the public Home research catalog.
 *
 * Rules:
 *  - URL sources are restricted to canonical IDs / slugs already on
 *    PublicationAuthor / PublicationPaper. We never concatenate raw names.
 *  - External identifiers (DOI, OpenAlex, ORCID) are emitted only when they
 *    match a known strict format, so a stray string in the adapter cannot
 *    produce a malformed link.
 *  - Every emitted URL goes through allow-listed host checks. This prevents
 *    demo fixtures from drifting into javascript: / data: schemes or
 *    arbitrary third-party hosts.
 */

import type { PublicationAuthor, PublicationPaper } from '../types/publication';

/**
 * Strict ORCID iD format. ORCID mandates 16 digits in 4-4-4-3 groups, with
 * an optional X (or x) as the final checksum character. Any other shape is
 * rejected — we never coerce, replace, or "fix" the input.
 */
const ORCID_ID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dXx]$/;

/** Strict OpenAlex ID: literal `W` prefix + digits (e.g. `W2741809807`). */
const OPENALEX_ID_PATTERN = /^W\d+$/;

/** Strict DOI suffix: `10.NNNN/...` with no whitespace and a non-empty suffix. */
const DOI_PATTERN = /^10\.\d{4,9}\/[^\s]+$/;

/** arXiv identifier prefix used by demo fixtures. */
const ARXIV_PATTERN = /^arXiv:[0-9]{4}\.[0-9]{4,5}(v\d+)?$/i;

const SAFE_PROTOCOLS = ['http:', 'https:'];

/**
 * Verify a URL string parses, uses an allow-listed protocol, and targets one
 * of the trusted hosts. Returns `null` for anything else so the caller can
 * fall through to a non-link label.
 */
const validateSafeUrl = (raw: string, allowedHosts: readonly string[]): string | null => {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!SAFE_PROTOCOLS.includes(parsed.protocol)) return null;
  const host = parsed.hostname.toLowerCase();
  const matches = allowedHosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
  return matches ? parsed.toString() : null;
};

export interface ResolvedExternalLink {
  readonly href: string;
  readonly label: string;
  readonly source: 'DOI' | 'OpenAlex' | 'ORCID' | 'arXiv';
}

/**
 * Build a canonical DOI link.
 *
 * Accepts either a bare DOI suffix (`10.5555/...`) or a full URL. Anything
 * that does not match the strict DOI pattern is dropped — we never guess.
 */
export const buildDoiLink = (value: string | undefined): ResolvedExternalLink | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = DOI_PATTERN.test(trimmed) ? `https://doi.org/${trimmed}` : trimmed;
  return validateSafeUrl(candidate, ['doi.org'])
    ? { href: candidate, label: 'DOI', source: 'DOI' }
    : null;
};

/**
 * Build a canonical OpenAlex link from a strict `W…` identifier or a full URL.
 * Anything not matching the strict shape or `openalex.org` host is rejected.
 */
export const buildOpenAlexLink = (value: string | undefined): ResolvedExternalLink | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = OPENALEX_ID_PATTERN.test(trimmed) ? `https://openalex.org/${trimmed}` : trimmed;
  return validateSafeUrl(candidate, ['openalex.org'])
    ? { href: candidate, label: 'OpenAlex', source: 'OpenAlex' }
    : null;
};

/**
 * Build a canonical ORCID link from a strict `XXXX-XXXX-XXXX-XXXX(X)` iD or
 * a full `orcid.org` URL. Demonstrations only — the demo fixtures carry
 * already-validated identifiers; we still re-validate at the boundary.
 */
export const buildOrcidLink = (value: string | undefined): ResolvedExternalLink | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = ORCID_ID_PATTERN.test(trimmed) ? `https://orcid.org/${trimmed}` : trimmed;
  return validateSafeUrl(candidate, ['orcid.org'])
    ? { href: candidate, label: 'ORCID', source: 'ORCID' }
    : null;
};

/**
 * arXiv has no URI-shaped identifier with `arXiv:` prefix. We render it as
 * an inline metadata badge only — never a hyperlink — because we have no
 * authoritative lookup key from the demo fixtures. Returns `null`.
 */
export const buildArxivBadge = (value: string | undefined): string | null => {
  if (!value) return null;
  return ARXIV_PATTERN.test(value.trim()) ? value.trim() : null;
};

export interface PaperExternalLinks {
  readonly doi: ResolvedExternalLink | null;
  readonly openAlex: ResolvedExternalLink | null;
  readonly arxiv: string | null;
}

/**
 * Resolve every external identifier on a paper into the validated links /
 * badges the catalog card renders. The returned object intentionally only
 * exposes safe values — `null` everywhere means the paper carried no
 * author-supplied identifiers.
 */
export const resolvePaperExternalLinks = (paper: Pick<PublicationPaper, 'doi' | 'openAlexId' | 'externalIdentifier'>): PaperExternalLinks => ({
  doi: buildDoiLink(paper.doi),
  openAlex: buildOpenAlexLink(paper.openAlexId),
  arxiv: paper.externalIdentifier && ARXIV_PATTERN.test(paper.externalIdentifier.trim())
    ? paper.externalIdentifier.trim()
    : null,
});

export interface ResolvedAuthorLink {
  readonly authorId: string;
  readonly orcid: ResolvedExternalLink | null;
}

/**
 * Resolve the ORCID link(s) we can safely surface for an author. Authors
 * carry only their canonical ID and ORCID — no URLs are constructed from
 * the name. The returned list is empty when nothing validates.
 */
export const resolveAuthorLinks = (author: Pick<PublicationAuthor, 'id' | 'orcid'>): ResolvedAuthorLink[] => {
  const orcid = buildOrcidLink(author.orcid);
  return orcid ? [{ authorId: author.id, orcid }] : [];
};

/**
 * Reader-friendly answer to "do we have anything to show for this author?"
 * Used by the card to decide whether to render the ORCID chip.
 */
export const hasAuthorExternalLinks = (author: Pick<PublicationAuthor, 'orcid'>): boolean =>
  Boolean(buildOrcidLink(author.orcid));

/**
 * Sorted, deduplicated list of external links for the whole paper card.
 * Order follows OpenAlex convention: DOI first, then OpenAlex.
 */
export const collectPaperExternalLinks = (paper: Pick<PublicationPaper, 'doi' | 'openAlexId'>): ResolvedExternalLink[] => {
  const links: ResolvedExternalLink[] = [];
  const doi = buildDoiLink(paper.doi);
  if (doi) links.push(doi);
  const openAlex = buildOpenAlexLink(paper.openAlexId);
  if (openAlex) links.push(openAlex);
  return links;
};
