import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
} from '../../utils/formatDate';

describe('formatDate utils', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // formatDate
  // ─────────────────────────────────────────────────────────────────────────────

  describe('formatDate', () => {
    it('should format date in default English locale', () => {
      const result = formatDate('2024-03-15');
      expect(result).toBe('March 15, 2024');
    });

    it('should format date in different locale', () => {
      const result = formatDate('2024-03-15', 'vi-VN');
      expect(result).toBe('15 tháng 3, 2024');
    });

    it('should format date with time component', () => {
      const result = formatDate('2024-12-25T14:30:00Z');
      expect(result).toBe('December 25, 2024');
    });

    it('should format date with different separator styles', () => {
      expect(formatDate('2024-01-01')).toBe('January 1, 2024');
      expect(formatDate('2024/06/15')).toBe('June 15, 2024');
    });

    it('should handle single digit day and month', () => {
      const result = formatDate('2024-01-05');
      expect(result).toBe('January 5, 2024');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // formatDateTime
  // ─────────────────────────────────────────────────────────────────────────────

  describe('formatDateTime', () => {
    it('should format date with time in default English locale', () => {
      const result = formatDateTime('2024-03-15T14:30:00Z');
      // Check that it contains both date and time parts
      expect(result).toContain('2024');
      expect(result).toContain('Mar');
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Contains time
    });

    it('should format date with time in different locale', () => {
      const result = formatDateTime('2024-03-15T14:30:00Z', 'vi-VN');
      expect(result).toContain('2024');
    });

    it('should format midnight time correctly', () => {
      const result = formatDateTime('2024-03-15T00:00:00Z');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format end of day time correctly', () => {
      const result = formatDateTime('2024-03-15T23:59:59Z');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // formatRelativeTime
  // ─────────────────────────────────────────────────────────────────────────────

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      // Freeze time for consistent testing
      const mockDate = new Date('2024-06-15T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "just now" for very recent times', () => {
      const result = formatRelativeTime('2024-06-15T11:59:59Z');
      expect(result).toBe('just now');
    });

    it('should return "just now" for current time', () => {
      const result = formatRelativeTime('2024-06-15T12:00:00Z');
      expect(result).toBe('just now');
    });

    it('should return minutes ago for times under an hour', () => {
      const result = formatRelativeTime('2024-06-15T11:45:00Z');
      expect(result).toBe('15 minutes ago');
    });

    it('should return singular minute for 1 minute ago', () => {
      const result = formatRelativeTime('2024-06-15T11:59:00Z');
      expect(result).toBe('1 minute ago');
    });

    it('should return hours ago for times under a day', () => {
      const result = formatRelativeTime('2024-06-15T08:00:00Z');
      expect(result).toBe('4 hours ago');
    });

    it('should return singular hour for 1 hour ago', () => {
      const result = formatRelativeTime('2024-06-15T11:00:00Z');
      expect(result).toBe('1 hour ago');
    });

    it('should return days ago for times under a week', () => {
      const result = formatRelativeTime('2024-06-10T12:00:00Z');
      expect(result).toBe('5 days ago');
    });

    it('should return singular day for 1 day ago', () => {
      const result = formatRelativeTime('2024-06-14T12:00:00Z');
      expect(result).toBe('1 day ago');
    });

    it('should return formatted date for times older than a week', () => {
      const result = formatRelativeTime('2024-01-15T12:00:00Z');
      // Should return full date format (not relative)
      expect(result).toBe('January 15, 2024');
    });

    it('should handle boundary between minutes and hours', () => {
      // 59 minutes ago
      const result = formatRelativeTime('2024-06-15T11:01:00Z');
      expect(result).toBe('59 minutes ago');
    });

    it('should handle boundary between hours and days', () => {
      // 23 hours ago
      const result = formatRelativeTime('2024-06-14T13:00:00Z');
      expect(result).toBe('23 hours ago');
    });

    it('should handle boundary between days and weeks', () => {
      // Exactly 7 days ago should fall back to date
      const result = formatRelativeTime('2024-06-08T12:00:00Z');
      expect(result).toBe('June 8, 2024');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle invalid date string gracefully', () => {
      // Invalid date strings throw RangeError when passed to Date
      expect(() => formatDate('invalid-date')).toThrow(RangeError);
    });

    it('should handle empty string', () => {
      // Empty string throws RangeError
      expect(() => formatDate('')).toThrow(RangeError);
    });

    it('should handle leap year date', () => {
      const result = formatDate('2024-02-29');
      expect(result).toBe('February 29, 2024');
    });

    it('should handle year boundary', () => {
      expect(formatDate('2024-01-01')).toBe('January 1, 2024');
      expect(formatDate('2023-12-31')).toBe('December 31, 2023');
    });
  });
});
