/**
 * Unit tests for src/utils/topicRouting.ts
 *
 * Tests the URL parse / build helpers for the Lecturer topic-scoped workflow.
 */

import { describe, expect, it } from 'vitest';
import {
  parseTopicIdFromSearch,
  parseIdFromSearch,
  buildConfigureMilestonesUrl,
  buildPhaseReportsUrl,
} from '../../../src/utils/topicRouting';

// ─── Helpers to build URLSearchParams from a plain object ───

const makeParams = (obj: Record<string, string | undefined>): URLSearchParams => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) p.set(k, v);
  }
  return p;
};

// ─── parseTopicIdFromSearch ──────────────────────────────────────────────

describe('parseTopicIdFromSearch', () => {
  it('returns null + missing when params is null', () => {
    expect(parseTopicIdFromSearch(null)).toEqual({ topicId: null, error: 'missing' });
  });

  it('returns null + missing when params is undefined', () => {
    expect(parseTopicIdFromSearch(undefined)).toEqual({ topicId: null, error: 'missing' });
  });

  it('returns null + missing when topicId is absent', () => {
    const p = makeParams({});
    expect(parseTopicIdFromSearch(p)).toEqual({ topicId: null, error: 'missing' });
  });

  it('returns null + missing when topicId is empty string', () => {
    const p = makeParams({ topicId: '' });
    expect(parseTopicIdFromSearch(p)).toEqual({ topicId: null, error: 'missing' });
  });

  it('returns null + invalid for non-numeric value', () => {
    const p = makeParams({ topicId: 'abc' });
    expect(parseTopicIdFromSearch(p)).toEqual({ topicId: null, error: 'invalid' });
  });

  it('returns null + invalid for decimal', () => {
    const p = makeParams({ topicId: '1.5' });
    expect(parseTopicIdFromSearch(p)).toEqual({ topicId: null, error: 'invalid' });
  });

  it('returns null + invalid for zero', () => {
    const p = makeParams({ topicId: '0' });
    expect(parseTopicIdFromSearch(p)).toEqual({ topicId: null, error: 'invalid' });
  });

  it('returns null + invalid for negative', () => {
    const p = makeParams({ topicId: '-3' });
    expect(parseTopicIdFromSearch(p)).toEqual({ topicId: null, error: 'invalid' });
  });

  it('returns the id + null error for a valid positive integer', () => {
    const p = makeParams({ topicId: '42' });
    expect(parseTopicIdFromSearch(p)).toEqual({ topicId: 42, error: null });
  });

  it('handles a large positive integer', () => {
    const p = makeParams({ topicId: '999999' });
    expect(parseTopicIdFromSearch(p)).toEqual({ topicId: 999999, error: null });
  });
});

// ─── parseIdFromSearch ────────────────────────────────────────────────────

describe('parseIdFromSearch', () => {
  it('returns null for null params', () => {
    expect(parseIdFromSearch(null, 'groupId')).toBeNull();
  });

  it('returns null for absent key', () => {
    const p = makeParams({});
    expect(parseIdFromSearch(p, 'groupId')).toBeNull();
  });

  it('returns null for empty string value', () => {
    const p = makeParams({ groupId: '' });
    expect(parseIdFromSearch(p, 'groupId')).toBeNull();
  });

  it('returns null for non-numeric value', () => {
    const p = makeParams({ groupId: 'xyz' });
    expect(parseIdFromSearch(p, 'groupId')).toBeNull();
  });

  it('returns null for zero', () => {
    const p = makeParams({ groupId: '0' });
    expect(parseIdFromSearch(p, 'groupId')).toBeNull();
  });

  it('returns the parsed id for a valid integer', () => {
    const p = makeParams({ groupId: '7' });
    expect(parseIdFromSearch(p, 'groupId')).toBe(7);
  });

  it('returns null when the target key is not present but other keys are', () => {
    const p = makeParams({ topicId: '5' });
    expect(parseIdFromSearch(p, 'groupId')).toBeNull();
  });
});

// ─── buildConfigureMilestonesUrl ─────────────────────────────────────────

describe('buildConfigureMilestonesUrl', () => {
  it('builds a URL with only topicId', () => {
    expect(buildConfigureMilestonesUrl(5)).toBe('/configure-milestones?topicId=5');
  });

  it('includes groupId when provided', () => {
    expect(buildConfigureMilestonesUrl(5, 12)).toBe(
      '/configure-milestones?topicId=5&groupId=12',
    );
  });

  it('ignores null groupId', () => {
    expect(buildConfigureMilestonesUrl(5, null)).toBe('/configure-milestones?topicId=5');
  });

  it('ignores undefined groupId', () => {
    expect(buildConfigureMilestonesUrl(5, undefined)).toBe('/configure-milestones?topicId=5');
  });

  it('builds a clean URL for a large id', () => {
    expect(buildConfigureMilestonesUrl(100000)).toBe('/configure-milestones?topicId=100000');
  });
});

// ─── buildPhaseReportsUrl ────────────────────────────────────────────────

describe('buildPhaseReportsUrl', () => {
  it('returns the base path when no params', () => {
    expect(buildPhaseReportsUrl({})).toBe('/lecturer/phase-reports');
  });

  it('includes topicId when provided', () => {
    expect(buildPhaseReportsUrl({ topicId: 3 })).toBe(
      '/lecturer/phase-reports?topicId=3',
    );
  });

  it('includes both ids in the correct order', () => {
    expect(buildPhaseReportsUrl({ topicId: 3, groupId: 7 })).toBe(
      '/lecturer/phase-reports?topicId=3&groupId=7',
    );
  });

  it('omits topicId when null', () => {
    expect(buildPhaseReportsUrl({ topicId: null })).toBe('/lecturer/phase-reports');
  });

  it('omits groupId when null', () => {
    expect(buildPhaseReportsUrl({ topicId: 3, groupId: null })).toBe(
      '/lecturer/phase-reports?topicId=3',
    );
  });

  it('omits both when zero', () => {
    expect(buildPhaseReportsUrl({ topicId: 0, groupId: 0 })).toBe(
      '/lecturer/phase-reports',
    );
  });
});
