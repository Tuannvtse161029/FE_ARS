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

  it('preserves local time through toApiIsoString and back toLocalDatetimeInput', () => {
    const localInput = '2026-09-15T14:30';
    const apiIso = toApiIsoString(localInput);
    expect(apiIso).not.toBeNull();
    const restored = toLocalDatetimeInput(apiIso);
    expect(restored).toBe(localInput);
  });

  it('formats display dates in local time', () => {
    const d = new Date(2026, 8, 15, 14, 30);
    const dateStr = formatDisplayDate(d, 'vi');
    expect(dateStr).toContain('2026');

    const timeStr = formatDisplayTime(d, 'vi');
    expect(timeStr).toBe('14:30');
  });
});
