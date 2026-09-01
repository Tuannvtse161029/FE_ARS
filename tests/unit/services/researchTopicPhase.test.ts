/**
 * Unit tests for src/services/researchTopicPhase.service.ts
 *
 * Tests the phase validation logic (validatePhaseDrafts) and the
 * MAX_PHASES_PER_TOPIC constant.
 */

import { describe, expect, it } from 'vitest';
import {
  validatePhaseDrafts,
  MAX_PHASES_PER_TOPIC,
} from '../../../src/services/researchTopicPhase.service';
import type { PhaseDraft } from '../../../src/services/researchTopicPhase.service';

// ─── Helpers ───────────────────────────────────────────────────────────────

const makeDraft = (overrides: Partial<PhaseDraft> = {}): PhaseDraft => ({
  title: 'Phase 1',
  requirements: '',
  assessmentCriteria: '',
  startAt: '',
  endAt: '2026-10-01T23:59',
  ...overrides,
});

// ─── MAX_PHASES_PER_TOPIC ─────────────────────────────────────────────────

describe('MAX_PHASES_PER_TOPIC', () => {
  it('is exactly 5 per Swagger contract', () => {
    expect(MAX_PHASES_PER_TOPIC).toBe(5);
  });
});

// ─── validatePhaseDrafts ─────────────────────────────────────────────────

describe('validatePhaseDrafts', () => {
  it('returns null for a single valid draft', () => {
    const drafts = [makeDraft({ title: 'Phase 1' })];
    expect(validatePhaseDrafts(drafts)).toBeNull();
  });

  it('returns null for multiple valid drafts', () => {
    const drafts = [
      makeDraft({ title: 'Phase 1' }),
      makeDraft({ title: 'Phase 2' }),
    ];
    expect(validatePhaseDrafts(drafts)).toBeNull();
  });

  it('returns error for empty array', () => {
    expect(validatePhaseDrafts([])).toBe(
      'Add at least one phase before activating a topic.',
    );
  });

  it('returns error when more than MAX_PHASES_PER_TOPIC drafts', () => {
    const drafts = Array.from({ length: MAX_PHASES_PER_TOPIC + 1 }, (_, i) =>
      makeDraft({ title: `Phase ${i + 1}` }),
    );
    const result = validatePhaseDrafts(drafts);
    expect(result).toContain(`${MAX_PHASES_PER_TOPIC}`);
  });

  it('returns error for empty title', () => {
    const drafts = [makeDraft({ title: '' })];
    expect(validatePhaseDrafts(drafts)).toBe('Enter a title for Phase 1.');
  });

  it('returns error for the first phase when its title is whitespace-only', () => {
    const drafts = [
      makeDraft({ title: 'Phase 1 OK' }),
      makeDraft({ title: '   ' }),
    ];
    expect(validatePhaseDrafts(drafts)).toBe('Enter a title for Phase 2.');
  });

  it('returns error for phase whose endAt is not a valid date', () => {
    const drafts = [makeDraft({ endAt: 'not-a-date' })];
    expect(validatePhaseDrafts(drafts)).toBe(
      'Choose a valid end date for Phase 1.',
    );
  });

  it('returns error when endAt is before startAt', () => {
    const drafts = [
      makeDraft({ startAt: '2026-10-10T10:00', endAt: '2026-10-01T10:00' }),
    ];
    expect(validatePhaseDrafts(drafts)).toBe(
      'Phase 1 must end after it starts.',
    );
  });

  it('returns error when a later phase starts before the previous ends', () => {
    const drafts = [
      makeDraft({ startAt: '2026-09-01T00:00', endAt: '2026-09-30T23:59' }),
      makeDraft({ startAt: '2026-09-15T00:00', endAt: '2026-10-15T23:59' }),
    ];
    expect(validatePhaseDrafts(drafts)).toBe(
      'Phase 2 overlaps the previous phase. Gaps are allowed.',
    );
  });

  it('allows a gap between phases (later start after previous end)', () => {
    const drafts = [
      makeDraft({ startAt: '2026-09-01T00:00', endAt: '2026-09-30T23:59' }),
      makeDraft({ startAt: '2026-10-05T00:00', endAt: '2026-10-15T23:59' }),
    ];
    expect(validatePhaseDrafts(drafts)).toBeNull();
  });

  it('allows phases with only endAt (no startAt)', () => {
    const drafts = [
      makeDraft({ startAt: '', endAt: '2026-10-01T23:59' }),
    ];
    expect(validatePhaseDrafts(drafts)).toBeNull();
  });

  it('returns error for invalid startAt when endAt is valid', () => {
    const drafts = [
      makeDraft({ startAt: 'bad-date', endAt: '2026-10-01T23:59' }),
    ];
    expect(validatePhaseDrafts(drafts)).toBe(
      'Choose a valid start date for Phase 1.',
    );
  });

  it('returns the first error it finds (not all of them)', () => {
    const drafts = [
      makeDraft({ title: '' }),
      makeDraft({ title: '' }),
    ];
    expect(validatePhaseDrafts(drafts)).toBe('Enter a title for Phase 1.');
  });

  it('tracks the correct phase number in the error message', () => {
    const drafts = [
      makeDraft({ title: 'Good' }),
      makeDraft({ title: '' }),
      makeDraft({ title: '' }),
    ];
    expect(validatePhaseDrafts(drafts)).toBe('Enter a title for Phase 2.');
  });
});
