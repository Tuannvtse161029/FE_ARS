/**
 * Sibling tests for src/services/phasedReport.service.ts —
 * dedicated to `parsePhasedReportLineage` and the sentinel write inside
 * `resubmitPhasedReport`.
 *
 * The 16 existing tests in `phasedReport.service.test.ts` are untouched.
 * This file is a NEW sibling so the lineage-specific branches are isolated
 * for documentation and future regression detection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: vi.fn(),
    post: postMock,
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  parsePhasedReportLineage,
  resubmitPhasedReport,
} from '../../../src/services/phasedReport.service';

describe('parsePhasedReportLineage — sibling tests', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('parses "__LINEAGE__:Resubmitted from report #5\\nPlease address comments"', () => {
    const out = parsePhasedReportLineage(
      '__LINEAGE__:Resubmitted from report #5\nPlease address comments',
    );
    expect(out.previousReportId).toBe(5);
    // The parser trims the leading newline so the remainder text after the
    // lineage pointer is what the lecturer actually wrote.
    expect(out.remainder).toBe('Please address comments');
  });

  it('returns null previousReportId + verbatim remainder for a non-sentinel input', () => {
    const out = parsePhasedReportLineage('No lineage here');
    expect(out.previousReportId).toBeNull();
    expect(out.remainder).toBe('No lineage here');
  });

  it('returns empty defaults for undefined input', () => {
    expect(parsePhasedReportLineage(undefined)).toEqual({
      previousReportId: null,
      remainder: '',
    });
  });

  it('graceful parse failure on "#not-a-number" — keeps raw string as remainder', () => {
    const out = parsePhasedReportLineage(
      '__LINEAGE__:Resubmitted from report #not-a-number',
    );
    expect(out.previousReportId).toBeNull();
    expect(out.remainder).toBe(
      '__LINEAGE__:Resubmitted from report #not-a-number',
    );
  });
});

describe('resubmitPhasedReport — sentinel write', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('writes "__LINEAGE__:Resubmitted from report #7" into body.capacityEvaluation exactly', async () => {
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
      previousReportId: 7,
    });
    const body = postMock.mock.calls[0][1];
    expect(body.capacityEvaluation).toBe(
      '__LINEAGE__:Resubmitted from report #7',
    );
  });

  it('payload still contains the original reportFileUrl, submittedAt, etc.', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        id: 202,
        researchGroupId: 11,
        reportFileUrl: 'https://fb/v3.pdf',
        status: 'SUBMITTED',
      },
    });
    const fixedSubmittedAt = '2025-02-02T10:00:00Z';
    await resubmitPhasedReport({
      researchGroupId: 11,
      reportFileUrl: 'https://fb/v3.pdf',
      submittedAt: fixedSubmittedAt,
      groupMemberId: 99,
      previousReportId: 7,
    });
    const body = postMock.mock.calls[0][1];
    expect(body.researchGroupId).toBe(11);
    expect(body.reportFileUrl).toBe('https://fb/v3.pdf');
    expect(body.submittedAt).toBe(fixedSubmittedAt);
    expect(body.groupMemberId).toBe(99);
    expect(body.status).toBe('SUBMITTED');
    expect(body.capacityEvaluation).toBe(
      '__LINEAGE__:Resubmitted from report #7',
    );
  });
});