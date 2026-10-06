/**
 * Unit tests for src/utils/seminarTitle.ts (Oct 2026).
 *
 * Pins the heading-cleaner behavior — strip the section-label suffix
 * that some lecturers accidentally type into the title field, but
 * preserve every other title exactly.
 */
import { describe, it } from 'vitest';
import { expect } from 'vitest';
import { cleanSeminarHeading } from '../../../src/utils/seminarTitle';

describe('cleanSeminarHeading', () => {
  describe('strips the accidentally-typed " Seminar Details" suffix', () => {
    it('removes a trailing " Seminar Details" (the bug case)', () => {
      expect(cleanSeminarHeading('AI Research Discussion Seminar Details'))
        .toBe('AI Research Discussion');
    });

    it('handles a trailing punctuation after the suffix', () => {
      expect(cleanSeminarHeading('AI Research Discussion Seminar Details.'))
        .toBe('AI Research Discussion');
      expect(cleanSeminarHeading('AI Research Discussion Seminar Details!'))
        .toBe('AI Research Discussion');
      expect(cleanSeminarHeading('AI Research Discussion Seminar Details?'))
        .toBe('AI Research Discussion');
    });

    it('is case-insensitive', () => {
      expect(cleanSeminarHeading('AI Research Discussion seminar details'))
        .toBe('AI Research Discussion');
      expect(cleanSeminarHeading('AI Research Discussion SEMINAR DETAILS'))
        .toBe('AI Research Discussion');
      expect(cleanSeminarHeading('AI Research Discussion Seminar details'))
        .toBe('AI Research Discussion');
    });

    it('trims surrounding whitespace before checking the suffix', () => {
      expect(cleanSeminarHeading('  AI Research Discussion Seminar Details  '))
        .toBe('AI Research Discussion');
    });
  });

  describe('preserves titles that legitimately contain "Seminar Details"', () => {
    it('keeps the suffix when it is NOT at the end of the string', () => {
      // Real title: a workshop called "Seminar Details Workshop".
      expect(cleanSeminarHeading('Seminar Details Workshop')).toBe(
        'Seminar Details Workshop',
      );
      // Real title: a recap session with "Details" inside the name.
      expect(cleanSeminarHeading('Mid-Year Seminar Details Recap')).toBe(
        'Mid-Year Seminar Details Recap',
      );
    });

    it('keeps titles that do not contain the suffix at all', () => {
      expect(cleanSeminarHeading('AI Research Discussion')).toBe(
        'AI Research Discussion',
      );
      expect(cleanSeminarHeading('Data Science Roundtable')).toBe(
        'Data Science Roundtable',
      );
    });

    it('preserves a title that is only " Seminar Details" (fallback to original)', () => {
      // If the title is literally just the section label we don't want
      // to produce a blank heading — fall back to the raw value.
      expect(cleanSeminarHeading('Seminar Details')).toBe('Seminar Details');
    });

    it('preserves a title where stripping would leave a 1- or 2-char string', () => {
      // "AB Seminar Details" → would strip to "AB" (under MIN_HEADING_LENGTH).
      // Fall back to the original so we don't show a blank/near-blank heading.
      expect(cleanSeminarHeading('AB Seminar Details')).toBe('AB Seminar Details');
    });
  });

  describe('handles edge cases safely', () => {
    it('returns empty string for null', () => {
      expect(cleanSeminarHeading(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(cleanSeminarHeading(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(cleanSeminarHeading('')).toBe('');
    });

    it('returns empty string for whitespace only', () => {
      expect(cleanSeminarHeading('   ')).toBe('');
    });

    it('returns the original for a normal title without the suffix', () => {
      expect(cleanSeminarHeading('Quarterly Research Forum')).toBe(
        'Quarterly Research Forum',
      );
    });
  });
});