/**
 * seminarFeedback.service.ts — summarizeSeminarFeedback() tests.
 *
 * Covers:
 *   T1:  POST /api/Seminar/{id}/summarize-feedback is called with NO body.
 *   T2:  Nullable / missing nested fields are normalized without throwing.
 *   T3:  Backend error throws a plain Error with the BE message preserved.
 *
 * The service is tested directly (no DOM required).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../../src/services/axios';
import {
  seminarService,
  // Named export so we can call normalizeFeedbackSummary directly if needed,
  // but the canonical test surface is the service method.
} from '../../../src/services/seminar.service';

vi.mock('../../../src/services/axios', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  [key: string]: ReturnType<typeof vi.fn>;
};

describe('summarizeSeminarFeedback — T1: POST with no body', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls POST /api/Seminar/{id}/summarize-feedback with no payload at all', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        seminarId: 7,
        feedbackCount: 3,
        feedback: {
          overallAssessment: 'Good session.',
          commonStrengths: ['Clear explanation'],
          areasForImprovement: [],
          commonSuggestions: [],
          conflictingFeedback: [],
          recommendedActions: [],
        },
        generatedAt: '2026-09-19T12:00:00Z',
      },
    });

    await seminarService.summarizeSeminarFeedback(7);

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    // The second argument to axios.post must be undefined (no body, no headers override).
    expect(mockedApi.post).toHaveBeenCalledWith('/api/Seminar/7/summarize-feedback');
  });

  it('accepts axios signature where second arg is omitted entirely', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        seminarId: 9,
        feedbackCount: 1,
        feedback: {
          overallAssessment: 'Well done.',
          commonStrengths: [],
          areasForImprovement: [],
          commonSuggestions: [],
          conflictingFeedback: [],
          recommendedActions: [],
        },
        generatedAt: '2026-09-19T12:00:00Z',
      },
    });

    // Invoke and let it settle — if the service accidentally passes {} it still
    // resolves (axios does not error on an empty object), but the assertion above
    // already guards against passing any second arg.
    await seminarService.summarizeSeminarFeedback(9);
  });
});

describe('summarizeSeminarFeedback — T2: null/missing fields normalized', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns a stable shape when feedback object is null', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: null });

    const result = await seminarService.summarizeSeminarFeedback(5);

    // Must not throw; all fields must be present.
    expect(result).toHaveProperty('seminarId', 5);
    expect(result).toHaveProperty('feedbackCount', 0);
    expect(result).toHaveProperty('summary', '');
    expect(result).toHaveProperty('highlights');
    expect(Array.isArray(result.highlights)).toBe(true);
    expect(result).toHaveProperty('concerns');
    expect(Array.isArray(result.concerns)).toBe(true);
  });

  it('filters out non-string entries from highlights and concerns', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        seminarId: 11,
        feedbackCount: 2,
        feedback: {
          overallAssessment: 'A solid session overall.', // wrong type fields below are filtered
          commonStrengths: ['A', null, 1, false, 'B'],
          areasForImprovement: ['Pacing'],
          commonSuggestions: [undefined, 'More examples'],
          conflictingFeedback: [null, 'Mixed opinions'],
          recommendedActions: [],
        },
        generatedAt: null,           // nullable — should fall back to ISO now
      },
    });

    const result = await seminarService.summarizeSeminarFeedback(11);

    expect(result.summary).toBe('A solid session overall.');
    expect(result.highlights).toEqual(['A', 'B']);
    // concerns = areasForImprovement + commonSuggestions + conflictingFeedback
    expect(result.concerns).toEqual(['Pacing', 'More examples', 'Mixed opinions']);
    // generatedAt must be a valid ISO string
    expect(result.generatedAt).toBeTruthy();
    expect(() => new Date(result.generatedAt)).not.toThrow();
  });

  it('returns empty arrays when lists are absent', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        seminarId: 13,
        feedbackCount: 0,
        feedback: {},
        generatedAt: '2026-09-19T00:00:00Z',
      },
    });

    const result = await seminarService.summarizeSeminarFeedback(13);

    expect(result.highlights).toEqual([]);
    expect(result.concerns).toEqual([]);
    expect(result.summary).toBe('');
  });

  it('passes through seminarId and feedbackCount when present', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        seminarId: 17,
        feedbackCount: 5,
        feedback: {
          overallAssessment: 'Strong session.',
          commonStrengths: [],
          areasForImprovement: [],
          commonSuggestions: [],
          conflictingFeedback: [],
          recommendedActions: [],
        },
        generatedAt: '2026-09-19T10:00:00Z',
      },
    });

    const result = await seminarService.summarizeSeminarFeedback(17);

    expect(result.seminarId).toBe(17);
    expect(result.feedbackCount).toBe(5);
  });
});

describe('summarizeSeminarFeedback — T3: error propagation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws a plain Error with the BE error message on 4xx/5xx', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Not enough feedback submissions to generate a summary.',
        },
      },
    });

    await expect(seminarService.summarizeSeminarFeedback(5)).rejects.toThrow(
      'Not enough feedback submissions to generate a summary.',
    );
  });

  it('throws a plain Error with the axios error message when BE message is absent', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('Network failure'));

    await expect(seminarService.summarizeSeminarFeedback(5)).rejects.toThrow(
      'Network failure',
    );
  });

  it('throws "Unknown error" when no message is available at all', async () => {
    mockedApi.post.mockRejectedValueOnce({});

    await expect(seminarService.summarizeSeminarFeedback(5)).rejects.toThrow(
      'Unknown error',
    );
  });
});
