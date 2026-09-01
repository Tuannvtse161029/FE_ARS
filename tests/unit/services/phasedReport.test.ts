/**
 * Unit tests for the PhasedReport lineage sentinel parser in
 * src/services/phasedReport.service.ts
 */

import { describe, expect, it } from 'vitest';
import {
  parsePhasedReportLineage,
  PHASED_REPORT_LINEAGE_SENTINEL,
} from '../../../src/services/phasedReport.service';

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Build a sentinel value for testing. */
const withSentinel = (id: number, remainder = ''): string =>
  `${PHASED_REPORT_LINEAGE_SENTINEL}Resubmitted from report #${id}${remainder ? ' ' + remainder : ''}`;

// ─── PHASED_REPORT_LINEAGE_SENTINEL ────────────────────────────────────────

describe('PHASED_REPORT_LINEAGE_SENTINEL', () => {
  it('has the expected exact prefix', () => {
    expect(PHASED_REPORT_LINEAGE_SENTINEL).toBe('__LINEAGE__:');
  });
});

// ─── parsePhasedReportLineage ───────────────────────────────────────────

describe('parsePhasedReportLineage', () => {
  it('returns null id + empty remainder for undefined', () => {
    expect(parsePhasedReportLineage(undefined)).toEqual({
      previousReportId: null,
      remainder: '',
    });
  });

  it('returns null id + empty remainder for null', () => {
    expect(parsePhasedReportLineage(null)).toEqual({
      previousReportId: null,
      remainder: '',
    });
  });

  it('returns null id + empty remainder for empty string', () => {
    expect(parsePhasedReportLineage('')).toEqual({
      previousReportId: null,
      remainder: '',
    });
  });

  it('returns null id + full string when no sentinel prefix', () => {
    expect(parsePhasedReportLineage('Some lecturer feedback text')).toEqual({
      previousReportId: null,
      remainder: 'Some lecturer feedback text',
    });
  });

  it('parses a clean sentinel with only the id', () => {
    expect(parsePhasedReportLineage(withSentinel(42))).toEqual({
      previousReportId: 42,
      remainder: '',
    });
  });

  it('parses a sentinel with id and trailing user text', () => {
    expect(parsePhasedReportLineage(withSentinel(7, 'Please fix the abstract section'))).toEqual({
      previousReportId: 7,
      remainder: 'Please fix the abstract section',
    });
  });

  it('returns null id + raw string for malformed sentinel body', () => {
    expect(parsePhasedReportLineage(`${PHASED_REPORT_LINEAGE_SENTINEL}Invalid body`)).toEqual({
      previousReportId: null,
      remainder: `${PHASED_REPORT_LINEAGE_SENTINEL}Invalid body`,
    });
  });

  it('handles whitespace-only remainder correctly', () => {
    // The regex strips trailing whitespace with [\s\u00A0]* before the capture,
    // so a whitespace-only remainder becomes ''.
    expect(parsePhasedReportLineage(withSentinel(5, '   '))).toEqual({
      previousReportId: 5,
      remainder: '',
    });
  });

  it('handles non-numeric id in sentinel', () => {
    expect(parsePhasedReportLineage(`${PHASED_REPORT_LINEAGE_SENTINEL}Resubmitted from report #abc`)).toEqual({
      previousReportId: null,
      remainder: `${PHASED_REPORT_LINEAGE_SENTINEL}Resubmitted from report #abc`,
    });
  });

  it('handles negative id', () => {
    expect(parsePhasedReportLineage(withSentinel(-1))).toEqual({
      previousReportId: null,
      remainder: `${PHASED_REPORT_LINEAGE_SENTINEL}Resubmitted from report #-1`,
    });
  });

  it('treats zero id as invalid and returns null id', () => {
    // id > 0 check: 0 is not > 0, so previousReportId = null.
    // No trailing text: match[2] is undefined → remainder = ''.
    expect(parsePhasedReportLineage(withSentinel(0))).toEqual({
      previousReportId: null,
      remainder: '',
    });
  });

  it('is idempotent on a round-trip with a non-sentinel remainder', () => {
    const original = 'Lecturer feedback: please revise';
    const parsed = parsePhasedReportLineage(original);
    expect(parsed).toEqual({ previousReportId: null, remainder: original });
  });

  it('normalises a real-world example', () => {
    const raw = '__LINEAGE__:Resubmitted from report #12 Please address reviewer comments on methodology.';
    expect(parsePhasedReportLineage(raw)).toEqual({
      previousReportId: 12,
      remainder: 'Please address reviewer comments on methodology.',
    });
  });
});
