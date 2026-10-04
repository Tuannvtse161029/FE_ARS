/**
 * Pure-helper tests for src/features/publication/home/publicationLinks.ts.
 *
 * The catalog must never:
 *   - build URLs from unsanitized author names or paper titles
 *   - emit external links whose host is not on the allow list
 *   - silently coerce a malformed DOI / ORCID / OpenAlex value into a URL
 *
 * These tests pin that behavior at the helper boundary, before any JSX
 * ever sees the values.
 */

import { describe, expect, it } from 'vitest';
import {
  buildArxivBadge,
  buildAuthorProfilePath,
  buildDoiLink,
  buildOpenAlexLink,
  buildOrcidLink,
  collectPaperExternalLinks,
  hasAuthorExternalLinks,
  resolveAuthorLinks,
  resolvePaperExternalLinks,
} from '../../../../src/features/publication/home/publicationLinks';

describe('publicationLinks – canonical DOI', () => {
  it('emits a https://doi.org/ URL for a bare DOI suffix', () => {
    const link = buildDoiLink('10.5555/ars.demo.2026.001');
    expect(link).toEqual({
      href: 'https://doi.org/10.5555/ars.demo.2026.001',
      label: 'DOI',
      source: 'DOI',
    });
  });

  it('accepts a full https URL when its host is doi.org', () => {
    const link = buildDoiLink('https://doi.org/10.5555/ars.demo.2026.001');
    expect(link?.href).toBe('https://doi.org/10.5555/ars.demo.2026.001');
  });

  it('trims surrounding whitespace before validating the DOI', () => {
    // Whitespace is benign UI noise — we sanitize it once at the boundary
    // rather than reject a DOI the user accidentally copied with a space.
    const link = buildDoiLink('  10.5555/ars.demo.2026.001  ');
    expect(link?.href).toBe('https://doi.org/10.5555/ars.demo.2026.001');
  });

  it('rejects a DOI string that is whitespace only', () => {
    expect(buildDoiLink('   ')).toBeNull();
  });

  it('rejects a non-DOI host even if it claims to be one', () => {
    expect(buildDoiLink('https://evil.example.com/10.5555/x')).toBeNull();
  });

  it('drops javascript: and data: schemes', () => {
    expect(buildDoiLink('javascript:alert(1)')).toBeNull();
    expect(buildDoiLink('data:text/html,hi')).toBeNull();
  });

  it('returns null for empty or undefined inputs', () => {
    expect(buildDoiLink(undefined)).toBeNull();
    expect(buildDoiLink('')).toBeNull();
    expect(buildDoiLink('   ')).toBeNull();
  });
});

describe('publicationLinks – canonical OpenAlex', () => {
  it('emits a https://openalex.org/W… URL for a bare ID', () => {
    const link = buildOpenAlexLink('W999999001');
    expect(link).toEqual({
      href: 'https://openalex.org/W999999001',
      label: 'OpenAlex',
      source: 'OpenAlex',
    });
  });

  it('rejects a non-OpenAlex host', () => {
    expect(buildOpenAlexLink('https://evil.example.org/W123')).toBeNull();
  });

  it('rejects malformed OpenAlex IDs', () => {
    expect(buildOpenAlexLink('A999999001')).toBeNull(); // wrong prefix
    expect(buildOpenAlexLink('W')).toBeNull();
    expect(buildOpenAlexLink('W-999')).toBeNull();
  });
});

describe('publicationLinks – canonical ORCID', () => {
  it('emits a https://orcid.org/ URL for a bare iD', () => {
    const link = buildOrcidLink('0000-0002-1825-0097');
    expect(link?.href).toBe('https://orcid.org/0000-0002-1825-0097');
  });

  it('keeps the X checksum character as supplied (no rewriting)', () => {
    const link = buildOrcidLink('0000-0001-2345-678X');
    expect(link?.href).toBe('https://orcid.org/0000-0001-2345-678X');
  });

  it('rejects malformed ORCID identifiers', () => {
    expect(buildOrcidLink('not-an-orcid')).toBeNull();
    expect(buildOrcidLink('0000-0002-1825-009')).toBeNull(); // too short
    expect(buildOrcidLink('0000-0002-1825-0097Z')).toBeNull(); // bad checksum char
  });

  it('rejects non-orcid.org hosts', () => {
    expect(buildOrcidLink('https://evil.example.com/0000-0002-1825-0097')).toBeNull();
  });
});

describe('publicationLinks – arXiv', () => {
  it('renders a plain-text badge for an arXiv identifier', () => {
    expect(buildArxivBadge('arXiv:2608.01001')).toBe('arXiv:2608.01001');
    expect(buildArxivBadge('arXiv:2608.01001v2')).toBe('arXiv:2608.01001v2');
  });

  it('returns null for unknown identifiers (no URL is built)', () => {
    expect(buildArxivBadge('arxiv-xyz')).toBeNull();
    expect(buildArxivBadge(undefined)).toBeNull();
  });
});

describe('publicationLinks – paper + author aggregation', () => {
  const basePaper = {
    id: 'demo-published-urban-heat',
    doi: '10.5555/ars.demo.2026.001',
    openAlexId: 'W999999001',
    externalIdentifier: 'arXiv:2608.01001',
  } as Parameters<typeof resolvePaperExternalLinks>[0];

  it('resolves every valid identifier on a paper and drops the rest', () => {
    const resolved = resolvePaperExternalLinks(basePaper);
    expect(resolved.doi?.href).toBe('https://doi.org/10.5555/ars.demo.2026.001');
    expect(resolved.openAlex?.href).toBe('https://openalex.org/W999999001');
    expect(resolved.arxiv).toBe('arXiv:2608.01001');
  });

  it('returns null links when the paper carries no identifiers', () => {
    const empty = resolvePaperExternalLinks({ doi: undefined, openAlexId: undefined, externalIdentifier: undefined });
    expect(empty.doi).toBeNull();
    expect(empty.openAlex).toBeNull();
    expect(empty.arxiv).toBeNull();
  });

  it('collects links in canonical order (DOI first, then OpenAlex)', () => {
    const links = collectPaperExternalLinks(basePaper);
    expect(links.map((link) => link.source)).toEqual(['DOI', 'OpenAlex']);
  });

  it('produces a single author-link record from the canonical author ORCID', () => {
    const author = { id: 'a-1', orcid: '0000-0002-1825-0097' };
    const resolved = resolveAuthorLinks(author);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].authorId).toBe('a-1');
    expect(resolved[0].orcid?.href).toBe('https://orcid.org/0000-0002-1825-0097');
  });

  it('reports no links when an author carries no ORCID', () => {
    expect(hasAuthorExternalLinks({ orcid: undefined })).toBe(false);
    expect(resolveAuthorLinks({ id: 'a-1', orcid: undefined })).toEqual([]);
  });

  it('never builds a URL from the author name', () => {
    // The helpers only accept `orcid`; there is no helper that accepts a
    // name. This pins the contract that name → URL is impossible.
    const author: Parameters<typeof resolveAuthorLinks>[0] = { id: 'a-1' };
    expect(resolveAuthorLinks(author)).toEqual([]);
  });
});

describe('publicationLinks – author profile path', () => {
  // The catalog card uses buildAuthorProfilePath() to turn an
  // `author.userId` into an in-app `/profile/:userId` link. The
  // helper MUST only return a path when the userId is a positive
  // integer — never a name, never a slug, never a non-numeric
  // garbage string. The route param is consumed by the Profile page
  // and would 404 on a non-numeric value.

  it('returns /profile/:userId when the author carries a numeric userId', () => {
    expect(buildAuthorProfilePath({ id: 'a-1', userId: '42' })).toBe('/profile/42');
  });

  it('returns null when the author has no userId', () => {
    expect(buildAuthorProfilePath({ id: 'a-1' })).toBeNull();
    expect(buildAuthorProfilePath({ id: 'a-1', userId: undefined })).toBeNull();
    expect(buildAuthorProfilePath({ id: 'a-1', userId: '' })).toBeNull();
    expect(buildAuthorProfilePath({ id: 'a-1', userId: '   ' })).toBeNull();
  });

  it('rejects non-numeric userIds (would 404 the Profile page)', () => {
    expect(buildAuthorProfilePath({ id: 'a-1', userId: 'not-a-number' })).toBeNull();
    expect(buildAuthorProfilePath({ id: 'a-1', userId: '42abc' })).toBeNull();
    expect(buildAuthorProfilePath({ id: 'a-1', userId: 'abc42' })).toBeNull();
  });

  it('rejects zero, negative, and decimal userIds', () => {
    expect(buildAuthorProfilePath({ id: 'a-1', userId: '0' })).toBeNull();
    expect(buildAuthorProfilePath({ id: 'a-1', userId: '-42' })).toBeNull();
    expect(buildAuthorProfilePath({ id: 'a-1', userId: '3.14' })).toBeNull();
  });

  it('never builds a path from the author name', () => {
    // Even if a future adapter ever ships `userId: "Nguyen Minh Anh"`,
    // the helper must refuse to build a /profile/<name> path. The
    // Profile route resolves by user id, and a name slug would 404.
    expect(
      buildAuthorProfilePath({ id: 'a-1', userId: 'Nguyen Minh Anh' }),
    ).toBeNull();
  });
});
