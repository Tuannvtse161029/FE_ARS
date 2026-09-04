import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();

vi.mock('../../../../src/services/axios', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

import { lookupOpenAlexPreview } from '../../../../src/features/publication/researcher/openalexAdapter';
import { API_ENDPOINTS } from '../../../../src/utils/constants';

describe('openalexAdapter.lookupOpenAlexPreview', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('rejects invalid work ID format without issuing an HTTP request', async () => {
    const outcome = await lookupOpenAlexPreview('invalid-id');
    expect(outcome.status).toBe('invalid_format');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('rejects DOI variant with unsupported_variant status without issuing an HTTP request', async () => {
    const outcome = await lookupOpenAlexPreview('doi:10.1000/182');
    expect(outcome.status).toBe('unsupported_variant');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('fetches OpenAlex work metadata and formats preview successfully', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        openAlexWorkId: 'W2741809807',
        lookupStatus: 'FOUND',
        title: 'Deep Residual Learning for Image Recognition',
        abstract: 'Deeper neural networks are more difficult to train.',
        publicationYear: 2016,
        publicationDate: '2016-12-01T00:00:00Z',
        doi: 'https://doi.org/10.1109/cvpr.2016.90',
        authors: [
          {
            authorDisplayName: 'Kaiming He',
            institutions: [{ displayName: 'Microsoft Research' }],
          },
          {
            rawAuthorName: 'Xiangyu Zhang',
            institutions: [{ displayName: 'Microsoft Research' }],
          },
        ],
        topics: [
          { topicName: 'Artificial intelligence' },
          { topicName: 'Computer vision' },
        ],
        concepts: [
          { conceptName: 'Residual neural network' },
          { conceptName: 'Pattern recognition' },
        ],
      },
    });

    const outcome = await lookupOpenAlexPreview('W2741809807');
    expect(outcome.status).toBe('preview');
    if (outcome.status === 'preview') {
      expect(outcome.metadata.id).toBe('W2741809807');
      expect(outcome.metadata.title).toBe('Deep Residual Learning for Image Recognition');
      expect(outcome.metadata.abstract).toBe('Deeper neural networks are more difficult to train.');
      expect(outcome.metadata.publicationDate).toBe('2016-12-01');
      expect(outcome.metadata.doi).toBe('https://doi.org/10.1109/cvpr.2016.90');
      expect(outcome.metadata.authors).toEqual(['Kaiming He', 'Xiangyu Zhang']);
      expect(outcome.metadata.institutions).toEqual(['Microsoft Research']);
      expect(outcome.metadata.topics).toEqual(['Artificial intelligence', 'Computer vision']);
      expect(outcome.metadata.keywords).toEqual(['Residual neural network', 'Pattern recognition']);
    }

    expect(getMock).toHaveBeenCalledWith(API_ENDPOINTS.OPEN_ALEX.GET_WORK('W2741809807'));
  });

  it('handles 404 work not found gracefully', async () => {
    getMock.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { message: 'Work not found' },
      },
    });

    const outcome = await lookupOpenAlexPreview('W9999999999');
    expect(outcome.status).toBe('unavailable');
    if (outcome.status === 'unavailable') {
      expect(outcome.message).toContain('Work not found');
    }
  });

  it('handles 429 rate limit gracefully', async () => {
    getMock.mockRejectedValueOnce({
      response: {
        status: 429,
      },
    });

    const outcome = await lookupOpenAlexPreview('W2741809807');
    expect(outcome.status).toBe('unavailable');
    if (outcome.status === 'unavailable') {
      expect(outcome.message).toMatch(/rate limit/i);
    }
  });
});
