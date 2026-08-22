/**
 * reportService tests.
 *
 * Verifies the strict-TS boundary against the Swagger contract:
 *   POST /api/Report — create report
 *   GET  /api/Report — list reports (admin)
 *
 * The service is the only place where DTO normalization happens; every
 * downstream hook/component consumes the strict shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../../src/services/axios';
import { reportService } from '../../../src/services/report.service';

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('reportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReport', () => {
    it('calls POST /api/Report with correct payload for ForumPost', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: {
          id: 1,
          reporterId: 7,
          targetType: 'ForumPost',
          targetId: 10,
          reason: 'Spam content',
          status: 'Pending',
          violationNotes: 'Repeated promotional links',
          createdAt: '2026-08-19T00:00:00Z',
        },
      });

      const result = await reportService.createReport({
        reporterId: 7,
        targetType: 'ForumPost',
        targetId: 10,
        reason: 'Spam content',
        violationNotes: 'Repeated promotional links',
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/Report', {
        reporterId: 7,
        targetType: 'ForumPost',
        targetId: 10,
        reason: 'Spam content',
        violationNotes: 'Repeated promotional links',
      });
      expect(result).toEqual({
        id: 1,
        reporterId: 7,
        targetType: 'ForumPost',
        targetId: 10,
        reason: 'Spam content',
        status: 'Pending',
        violationNotes: 'Repeated promotional links',
        createdAt: '2026-08-19T00:00:00Z',
      });
    });

    it('calls POST /api/Report with correct payload for ForumComment', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: {
          id: 2,
          reporterId: 3,
          targetType: 'ForumComment',
          targetId: 55,
          reason: 'Harassment',
          status: 'Pending',
          createdAt: '2026-08-19T01:00:00Z',
        },
      });

      const result = await reportService.createReport({
        reporterId: 3,
        targetType: 'ForumComment',
        targetId: 55,
        reason: 'Harassment',
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/Report', {
        reporterId: 3,
        targetType: 'ForumComment',
        targetId: 55,
        reason: 'Harassment',
        violationNotes: undefined,
      });
      expect(result.targetType).toBe('ForumComment');
      expect(result.targetId).toBe(55);
    });

    it('omits violationNotes when not provided', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: {
          id: 3,
          reporterId: 5,
          targetType: 'ForumPost',
          targetId: 20,
          reason: 'Inappropriate content',
          status: 'Pending',
          createdAt: '2026-08-19T02:00:00Z',
        },
      });

      await reportService.createReport({
        reporterId: 5,
        targetType: 'ForumPost',
        targetId: 20,
        reason: 'Inappropriate content',
      });

      const callArgs = mockedApi.post.mock.calls[0];
      expect(callArgs[1]).not.toHaveProperty('violationNotes');
    });

    it('throws on API error', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        reportService.createReport({
          reporterId: 1,
          targetType: 'ForumPost',
          targetId: 1,
          reason: 'Test',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('getReports', () => {
    it('calls GET /api/Report and returns the data array', async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            reporterId: 7,
            targetType: 'ForumPost',
            targetId: 10,
            reason: 'Spam',
            status: 'Pending',
            createdAt: '2026-08-19T00:00:00Z',
          },
          {
            id: 2,
            reporterId: 3,
            targetType: 'ForumComment',
            targetId: 55,
            reason: 'Harassment',
            status: 'Resolved',
            createdAt: '2026-08-18T00:00:00Z',
          },
        ],
      });

      const reports = await reportService.getReports();

      expect(mockedApi.get).toHaveBeenCalledWith('/api/Report');
      expect(reports).toHaveLength(2);
      expect(reports[0].id).toBe(1);
      expect(reports[1].targetType).toBe('ForumComment');
    });

    it('returns an empty array when BE responds with null', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });
      const reports = await reportService.getReports();
      expect(reports).toEqual([]);
    });

    it('returns an empty array when BE responds with undefined', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: undefined });
      const reports = await reportService.getReports();
      expect(reports).toEqual([]);
    });

    it('throws on API error', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(reportService.getReports()).rejects.toThrow('Unauthorized');
    });
  });
});
