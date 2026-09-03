/**
 * Centralized Datetime Utility for ARS Platform.
 *
 * Solves timezone offsets and database skew:
 * 1. `<input type="datetime-local">` requires local format `YYYY-MM-DDTHH:mm`.
 * 2. `<input type="date">` requires local format `YYYY-MM-DD`.
 * 3. Never use `d.toISOString().slice(0, 16)` for input values because `toISOString()`
 *    is in UTC (GMT+0), which causes a 7-hour shift in Vietnam (UTC+7) every time
 *    a form is opened and saved.
 * 4. API endpoints expect ISO 8601 strings, but date-only deadlines must not be shifted
 *    into the previous day.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Safely parse any API or user date/time value into a valid Date object.
 * Handles:
 * - ISO strings with 'Z' (e.g. 2026-09-15T07:00:00.000Z)
 * - ISO strings without timezone (e.g. 2026-09-15T14:00:00.123)
 * - Date-only strings (e.g. 2026-09-15) -> parsed in local time to avoid UTC-midnight day drop
 * - Existing Date objects or timestamps
 */
export function parseApiDate(val: string | number | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Date-only string YYYY-MM-DD (e.g. '2026-09-15')
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Converts any date or datetime into a local string formatted for:
 * `<input type="datetime-local">` -> `YYYY-MM-DDTHH:mm`
 */
export function toLocalDatetimeInput(val: string | number | Date | null | undefined): string {
  const d = parseApiDate(val);
  if (!d) return '';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Converts any date or datetime into a local string formatted for:
 * `<input type="date">` -> `YYYY-MM-DD`
 */
export function toLocalDateInput(val: string | number | Date | null | undefined): string {
  const d = parseApiDate(val);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Converts a datetime input (e.g. '2026-09-15T14:00' or Date) into standard ISO 8601 UTC string
 * for sending in API payloads.
 */
export function toApiIsoString(val: string | number | Date | null | undefined): string | null {
  if (!val) return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Date-only string (e.g. '2026-09-15') -> set to end of that day in local time (23:59:59)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      return new Date(year, month - 1, day, 23, 59, 59).toISOString();
    }
  }

  const d = parseApiDate(val);
  return d ? d.toISOString() : null;
}

/**
 * Formats a date for user-facing UI in local time (e.g. "15/09/2026" or "Sep 15, 2026").
 */
export function formatDisplayDate(
  val: string | number | Date | null | undefined,
  locale = 'vi',
): string {
  const d = parseApiDate(val);
  if (!d) return '—';
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a date and time for user-facing UI in local time (e.g. "14:00, 15/09/2026").
 */
export function formatDisplayDateTime(
  val: string | number | Date | null | undefined,
  locale = 'vi',
): string {
  const d = parseApiDate(val);
  if (!d) return '—';
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a time for user-facing UI in local time (e.g. "14:00").
 */
export function formatDisplayTime(
  val: string | number | Date | null | undefined,
  locale = 'vi',
): string {
  const d = parseApiDate(val);
  if (!d) return '—';
  return d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
