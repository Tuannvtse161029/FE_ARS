import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import {
  OrcidCheckFeatureDisabledError,
  lookupOrcid,
} from '../../../src/services/orcid.service';
import { lookupOpenAlexPreview } from '../../../src/features/publication/researcher/openalexAdapter';
import { API_ENDPOINTS } from '../../../src/utils/constants';

const projectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('Agent 53 - ORCID backend boundary', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('sends only the backend correlation identifier, never ORCID credentials or provider URLs', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        orcidId: '0000-0002-1825-0097',
        author: { displayName: 'Reviewer One' },
        affiliations: [],
        topics: [],
        works: [],
      },
    });

    await lookupOrcid('0000-0002-1825-0097', 73);

    expect(postMock).toHaveBeenCalledWith(API_ENDPOINTS.ADMIN.ORCID_LOOKUP, {
      roleRequestId: 73,
    });
    const [, body] = postMock.mock.calls[0];
    expect(body).not.toHaveProperty('orcidId');
    expect(body).not.toHaveProperty('clientSecret');
    expect(body).not.toHaveProperty('accessToken');
    expect(JSON.stringify(body)).not.toMatch(/orcid\.org|openalex\.org/i);
  });

  it('requires a positive backend-confirmed role request identifier before lookup', async () => {
    await expect(lookupOrcid('0000-0002-1825-0097')).rejects.toBeInstanceOf(
      OrcidCheckFeatureDisabledError,
    );
    await expect(lookupOrcid('0000-0002-1825-0097', 0)).rejects.toBeInstanceOf(
      OrcidCheckFeatureDisabledError,
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it('projects only reviewable OpenAlex-backed fields and omits major and subfield metadata', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        orcidId: '0000-0002-1825-0097',
        author: { displayName: 'Reviewer One', major: 'Computer Science' },
        affiliations: [
          { institutionName: 'ARS University', major: 'Engineering' },
        ],
        topics: [
          { topicName: 'Peer review', subfield: 'Machine learning' },
        ],
        works: [
          {
            title: 'A Reviewable Work',
            doi: '10.1000/example',
            publicationYear: 2026,
            type: 'article',
            externalUrl: 'https://openalex.org/W123',
            major: 'Science',
            subfield: 'AI',
          },
        ],
        major: 'Forbidden root field',
        subfield: 'Forbidden root subfield',
      },
    });

    const result = await lookupOrcid('0000-0002-1825-0097', 73);

    expect(result).toEqual({
      status: 'success',
      meta: {
        orcid: '0000-0002-1825-0097',
        displayName: 'Reviewer One',
        affiliations: ['ARS University'],
        emails: [],
        orcidUrl: 'https://orcid.org/0000-0002-1825-0097',
        keywords: ['Peer review'],
        works: [
          {
            title: 'A Reviewable Work',
            doi: '10.1000/example',
            year: 2026,
            type: 'article',
            openalexUrl: 'https://openalex.org/W123',
          },
        ],
        isIncomplete: false,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/major|subfield/i);
  });
});

describe('Agent 53 - OpenAlex preview recovery', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('reports malformed and unsupported values locally without issuing a backend or provider request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      await expect(lookupOpenAlexPreview('not-a-work-id')).resolves.toMatchObject({
        status: 'invalid_format',
      });
      await expect(lookupOpenAlexPreview('doi:10.1000/example')).resolves.toMatchObject({
        status: 'unsupported_variant',
      });
      expect(getMock).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('calls the backend OpenAlex work preview endpoint and returns preview metadata', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    getMock.mockResolvedValueOnce({
      data: {
        openAlexWorkId: 'W2741809807',
        title: 'Deep Residual Learning for Image Recognition',
        abstract: 'Deeper neural networks are more difficult to train.',
        authors: [
          {
            authorDisplayName: 'Kaiming He',
            institutions: [{ displayName: 'Microsoft Research' }],
          },
        ],
        concepts: [{ conceptName: 'Computer vision' }],
        topics: [{ topicName: 'Deep learning' }],
        publicationYear: 2016,
        doi: 'https://doi.org/10.1109/cvpr.2016.90',
      },
    });

    try {
      const outcome = await lookupOpenAlexPreview('W2741809807');
      expect(outcome).toMatchObject({
        status: 'preview',
        metadata: {
          id: 'W2741809807',
          title: 'Deep Residual Learning for Image Recognition',
          authors: ['Kaiming He'],
          institutions: ['Microsoft Research'],
          keywords: ['Computer vision'],
          topics: ['Deep learning'],
        },
      });
      expect(getMock).toHaveBeenCalledWith(API_ENDPOINTS.OPEN_ALEX.GET_WORK('W2741809807'));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('Agent 53 - motion and navigation accessibility contracts', () => {
  it('provides a global reduced-motion fallback and an explicit banner override', () => {
    const globals = projectFile('src/styles/globals.css');
    const banner = projectFile('src/components/WelcomeBackBanner/WelcomeBackBanner.module.css');
    const layout = projectFile('src/layouts/MainLayout.module.css');

    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(globals).toMatch(/animation-duration: 0\.01ms !important/);
    expect(globals).toMatch(/transition-duration: 0\.01ms !important/);
    expect(banner).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.banner\s*\{\s*animation: none;/);
    expect(layout).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.sidebar\s*\{\s*transition: none;/);
  });
});
