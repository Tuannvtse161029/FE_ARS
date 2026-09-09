import { describe, it, expect } from 'vitest';
import {
  parseApiDate,
  toLocalDatetimeInput,
  toLocalDateInput,
  toApiIsoString,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime,
} from '../../../src/utils/datetime';

describe('datetime utility', () => {
  it('parses null and undefined safely', () => {
    expect(parseApiDate(null)).toBeNull();
    expect(parseApiDate(undefined)).toBeNull();
    expect(parseApiDate('')).toBeNull();
  });

  it('parses date-only strings without falling back to previous day', () => {
    const d = parseApiDate('2026-09-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8); // September is 8 (0-indexed)
    expect(d!.getDate()).toBe(15);
  });

  it('formats toLocalDateInput consistently', () => {
    expect(toLocalDateInput('2026-09-15')).toBe('2026-09-15');
    expect(toLocalDateInput(new Date(2026, 8, 15))).toBe('2026-09-15');
  });

  it('formats toLocalDatetimeInput without UTC skew', () => {
    const d = new Date(2026, 8, 15, 14, 30);
    expect(toLocalDatetimeInput(d)).toBe('2026-09-15T14:30');
  });

  it('encodes a datetime-local input as if its clock time were UTC', () => {
    // ARS convention: when the user picks "2026-09-15T14:30" in their local
    // timezone (UTC+7), we store it as `2026-09-15T14:30:00.000Z` on the BE
    // so that other surfaces (date pickers, list displays) round-trip the
    // same clock time back to the user regardless of where they are viewing
    // the data from.
    expect(toApiIsoString('2026-09-15T14:30')).toBe('2026-09-15T14:30:00.000Z');
    expect(toApiIsoString('2026-09-20T09:00')).toBe('2026-09-20T09:00:00.000Z');
  });

  it('does NOT subtract the local timezone offset from a datetime-local input (regression)', () => {
    // A user in UTC+7 picks "2026-09-20T14:00". The helper is supposed to
    // preserve that local clock time and emit it as the UTC value, so the
    // BE stores `2026-09-20T14:00:00.000Z`. A previous bug round-tripped
    // through `new Date(...)` + `getUTC*()`, which silently shifted the
    // time by -7h and caused the seminar to flip straight into COMPLETED.
    expect(toApiIsoString('2026-09-20T14:00')).toBe('2026-09-20T14:00:00.000Z');
    expect(toApiIsoString('2026-09-20T09:00')).toBe('2026-09-20T09:00:00.000Z');
    expect(toApiIsoString('2026-09-20T23:59')).toBe('2026-09-20T23:59:00.000Z');
  });

  it('still respects the offset for full ISO strings that include a timezone', () => {
    // A real ISO string with 'Z' or an offset must be parsed in UTC so the
    // DB stores the actual point in time the BE returned.
    expect(toApiIsoString('2026-09-15T07:00:00.000Z')).toBe(
      '2026-09-15T07:00:00.000Z',
    );
    expect(toApiIsoString(new Date('2026-09-15T07:00:00.000Z'))).toBe(
      '2026-09-15T07:00:00.000Z',
    );
  });

  it('formats display dates in local time', () => {
    const d = new Date(2026, 8, 15, 14, 30);
    const dateStr = formatDisplayDate(d, 'vi');
    expect(dateStr).toContain('2026');

    const timeStr = formatDisplayTime(d, 'vi');
    expect(timeStr).toBe('14:30');
  });
});
