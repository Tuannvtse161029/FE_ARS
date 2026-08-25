/**
 * Service-level tests for src/services/phasedReport.service.ts.
 *
 * Covers both Lecturer-owned helpers (evaluate / reject, including the
 * required-feedback-on-reject rule) and Graduate-Student-owned helpers
 * (submit / resubmit / listReportsForGroup).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getMock, postMock, putMock, deleteMock } = vi.hoisted(() => {
  return {
    getMock: vi.fn(),
    postMock: vi.fn(),
    putMock: vi.fn(),
    deleteMock: vi.fn(),
  };
});

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: getMock,
    post: postMock,
    put: putMock,
    delete: deleteMock,
  },
}));

import {
  phasedReportService,
  evaluatePhasedReport,
  rejectPhasedReport,
  submitPhasedReport,
  resubmitPhasedReport,
  listReportsForGroup,
  filterPhasedReportsByGroupIds,
  filterPhasedReportsAwaitingReview,
  parsePhasedReportLineage,
} from '../../../src/services/phasedReport.service';

describe('phasedReportService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  describe('raw CRUD', () => {
    it('getAll() normalizes status via the defensive normalizer', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          { id: 1, researchGroupId: 7, status: 'submitted' },
          { id: 2, researchGroupId: 7, status: 'APPROVED' },
          { id: 3, researchGroupId: 7, status: 'gibberish' },
        ],
      });
      const list = await phasedReportService.getAll();
      expect(list).toHaveLength(3);
      expect(list[0].status).toBe('SUBMITTED');
      expect(list[1].status).toBe('EVALUATED');
      expect(list[2].status).toBe('WAITING');
    });
  });

  describe('evaluatePhasedReport', () => {
    it('PUTs EVALUATED + numeric grade + free-text outcome', async () => {
      putMock.mockResolvedValueOnce({
        data: {
          id: 5,
          researchGroupId: 7,
          status: 'EVALUATED',
          lectureFeedback: 9,
          finalOutcomeEvaluation: 'Solid work',
        },
      });
      const result = await evaluatePhasedReport(5, {
        lectureFeedback: 9,
        finalOutcomeEvaluation: 'Solid work',
      });
      expect(putMock).toHaveBeenCalledWith('/api/PhasedReport/5', {
        researchGroupId: null,
        groupMemberId: null,
        reportFileUrl: null,
        capacityEvaluation: null,
        finalOutcomeEvaluation: 'Solid work',
        lectureFeedback: 9,
        submittedAt: null,
        status: 'EVALUATED',
      });
      expect(result.status).toBe('EVALUATED');
    });

    it('sends lectureFeedback: null when omitted', async () => {
      putMock.mockResolvedValueOnce({
        data: { id: 5, status: 'EVALUATED' },
      });
      await evaluatePhasedReport(5, { finalOutcomeEvaluation: 'OK' });
      expect(putMock).toHaveBeenCalledWith('/api/PhasedReport/5', {
        researchGroupId: null,
        groupMemberId: null,
        reportFileUrl: null,
        capacityEvaluation: null,
        finalOutcomeEvaluation: 'OK',
        lectureFeedback: null,
        submittedAt: null,
        status: 'EVALUATED',
      });
    });
  });

  describe('rejectPhasedReport', () => {
    it('rejects when both rejectionReason AND finalOutcomeEvaluation are empty', async () => {
      await expect(
        rejectPhasedReport(5, {
          finalOutcomeEvaluation: '   ',
          rejectionReason: '',
        }),
      ).rejects.toThrow(/rejection reason or feedback note is required/i);
    });

    it('accepts when only finalOutcomeEvaluation is provided', async () => {
      putMock.mockResolvedValueOnce({
        data: {
          id: 5,
          researchGroupId: 7,
          status: 'REJECTED',
          finalOutcomeEvaluation: 'Need more detail',
        },
      });
      await rejectPhasedReport(5, { finalOutcomeEvaluation: 'Need more detail' });
      const body = putMock.mock.calls[0][1];
      expect(body.status).toBe('REJECTED');
      expect(body.finalOutcomeEvaluation).toBe('Need more detail');
      expect(body.capacityEvaluation).toBe('Need more detail');
    });

    it('prefers rejectionReason for capacityEvaluation when both are present', async () => {
      putMock.mockResolvedValueOnce({
        data: {
          id: 5,
          status: 'REJECTED',
          finalOutcomeEvaluation: 'Overall notes',
          capacityEvaluation: 'Specific reason',
        },
      });
      await rejectPhasedReport(5, {
        finalOutcomeEvaluation: 'Overall notes',
        rejectionReason: 'Specific reason',
      });
      const body = putMock.mock.calls[0][1];
      expect(body.capacityEvaluation).toBe('Specific reason');
    });
  });

  describe('submitPhasedReport', () => {
    it('POSTs researchGroupId + reportFileUrl + status SUBMITTED', async () => {
      postMock.mockResolvedValueOnce({
        data: {
          id: 100,
          researchGroupId: 7,
          reportFileUrl: 'https://fb/x.pdf',
          status: 'SUBMITTED',
        },
      });
      await submitPhasedReport({
        researchGroupId: 7,
        reportFileUrl: 'https://fb/x.pdf',
      });
      const body = postMock.mock.calls[0][1];
      expect(body.researchGroupId).toBe(7);
      expect(body.reportFileUrl).toBe('https://fb/x.pdf');
      expect(body.status).toBe('SUBMITTED');
      expect(typeof body.submittedAt).toBe('string');
    });

    it('throws when BE response is missing id / researchGroupId', async () => {
      postMock.mockResolvedValueOnce({
        data: { reportFileUrl: 'x' /* missing ids */ },
      });
      await expect(
        submitPhasedReport({ researchGroupId: 7, reportFileUrl: 'x' }),
      ).rejects.toThrow(/missing required id/);
    });
  });

  describe('resubmitPhasedReport', () => {
    it('threads previousReportId via capacityEvaluation when present', async () => {
      postMock.mockResolvedValueOnce({
        data: {
          id: 200,
          researchGroupId: 7,
          reportFileUrl: 'https://fb/y.pdf',
          status: 'SUBMITTED',
        },
      });
      await resubmitPhasedReport({
        researchGroupId: 7,
        reportFileUrl: 'https://fb/y.pdf',
        previousReportId: 100,
      });
      const body = postMock.mock.calls[0][1];
      expect(body.capacityEvaluation).toMatch(/Resubmitted from report #100/);
    });

    it('writes the __LINEAGE__: sentinel into capacityEvaluation (G2)', async () => {
      postMock.mockResolvedValueOnce({
        data: {
          id: 201,
          researchGroupId: 7,
          reportFileUrl: 'https://fb/y.pdf',
          status: 'SUBMITTED',
        },
      });
      await resubmitPhasedReport({
        researchGroupId: 7,
        reportFileUrl: 'https://fb/y.pdf',
        previousReportId: 42,
      });
      const body = postMock.mock.calls[0][1];
      // No spaces around `:` per lead-phase-c-contract.md G2(a).
      expect(body.capacityEvaluation).toBe(
        '__LINEAGE__:Resubmitted from report #42',
      );
    });

    it('does NOT set capacityEvaluation when previousReportId is missing', async () => {
      postMock.mockResolvedValueOnce({
        data: {
          id: 202,
          researchGroupId: 7,
          reportFileUrl: 'https://fb/y.pdf',
          status: 'SUBMITTED',
        },
      });
      await resubmitPhasedReport({
        researchGroupId: 7,
        reportFileUrl: 'https://fb/y.pdf',
      });
      const body = postMock.mock.calls[0][1];
      expect(body.capacityEvaluation).toBeUndefined();
    });

    it('propagates previousReportId from BE response when echoed', async () => {
      postMock.mockResolvedValueOnce({
        data: {
          id: 203,
          researchGroupId: 7,
          reportFileUrl: 'https://fb/y.pdf',
          status: 'SUBMITTED',
          previousReportId: 42,
        },
      });
      const result = await resubmitPhasedReport({
        researchGroupId: 7,
        reportFileUrl: 'https://fb/y.pdf',
        previousReportId: 42,
      });
      expect(result.previousReportId).toBe(42);
    });
  });

  describe('parsePhasedReportLineage', () => {
    it('extracts previousReportId from the __LINEAGE__: sentinel', () => {
      const out = parsePhasedReportLineage(
        '__LINEAGE__:Resubmitted from report #42',
      );
      expect(out.previousReportId).toBe(42);
      expect(out.remainder).toBe('');
    });

    it('returns previousReportId + remainder when sentinel is followed by text', () => {
      const out = parsePhasedReportLineage(
        '__LINEAGE__:Resubmitted from report #7 still needs more detail',
      );
      expect(out.previousReportId).toBe(7);
      expect(out.remainder).toBe('still needs more detail');
    });

    it('returns the raw string verbatim when no sentinel is present', () => {
      const out = parsePhasedReportLineage('weak methodology');
      expect(out.previousReportId).toBeNull();
      expect(out.remainder).toBe('weak methodology');
    });

    it('returns empty defaults for undefined / empty input', () => {
      expect(parsePhasedReportLineage(undefined)).toEqual({
        previousReportId: null,
        remainder: '',
      });
      expect(parsePhasedReportLineage('')).toEqual({
        previousReportId: null,
        remainder: '',
      });
    });

    it('keeps the raw string when the sentinel body is malformed', () => {
      const out = parsePhasedReportLineage('__LINEAGE__:not a real lineage');
      expect(out.previousReportId).toBeNull();
      expect(out.remainder).toBe('__LINEAGE__:not a real lineage');
    });
  });

  describe('listReportsForGroup', () => {
    it('issues GET /api/PhasedReport with the BE filter param', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          { id: 1, researchGroupId: 7, status: 'SUBMITTED' },
          { id: 2, researchGroupId: 8, status: 'SUBMITTED' },
        ],
      });
      const list = await listReportsForGroup(7);
      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/PhasedReport'),
        expect.objectContaining({ params: { researchGroupId: 7 } }),
      );
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(1);
    });

    it('filters server-side leakage client-side defensively', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          { id: 1, researchGroupId: 7 },
          { id: 2, researchGroupId: 9 /* wrong group */ },
        ],
      });
      const list = await listReportsForGroup(7);
      expect(list).toHaveLength(1);
    });
  });

  describe('filter helpers', () => {
    it('filterPhasedReportsByGroupIds includes only matching ids', () => {
      const out = filterPhasedReportsByGroupIds(
        [
          { id: 1, researchGroupId: 7 },
          { id: 2, researchGroupId: null as unknown as number },
          { id: 3, researchGroupId: 8 },
        ],
        [7, 8],
      );
      expect(out.map((r) => r.id)).toEqual([1, 3]);
    });

    it('filterPhasedReportsAwaitingReview keeps WAITING/SUBMITTED/REJECTED', () => {
      const out = filterPhasedReportsAwaitingReview([
        { id: 1, status: 'WAITING' },
        { id: 2, status: 'SUBMITTED' },
        { id: 3, status: 'REJECTED' },
        { id: 4, status: 'EVALUATED' },
      ]);
      expect(out.map((r) => r.id)).toEqual([1, 2, 3]);
    });
  });
});