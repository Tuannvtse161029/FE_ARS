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

const LOCALE_STORAGE_KEY = 'ars_lang';

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Read the active UI locale from localStorage. Mirrors the behaviour of
 * `utils/formatDate.ts:resolveActiveLocale` so the two formatter helpers
 * never disagree on which language is currently displayed.
 *
 * Defaults to `'en'` to match I18nProvider's `DEFAULT_LOCALE`. SSR /
 * privacy-mode callers fall back to the same value.
 */
const resolveActiveLocale = (): 'vi' | 'en' => {
  if (typeof window === 'undefined') return 'en';
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === 'vi' || raw === 'en') return raw;
  } catch {
    /* ignore — privacy mode / SSR */
  }
  return 'en';
};

/** Map the short app locale code (`vi` / `en`) to a BCP-47 tag. */
const toIntlLocaleTag = (locale: 'vi' | 'en'): string =>
  locale === 'en' ? 'en-US' : 'vi-VN';

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
 *
 * IMPORTANT: <input type="datetime-local"> produces a local datetime string (e.g.
 * "2026-09-15T14:00") with NO timezone indicator. The JavaScript Date constructor
 * interprets bare datetime-local strings as local time in some browsers, then
 * toISOString() converts to UTC — causing a 7-hour shift for UTC+7 users.
 *
 * To preserve the user's LOCAL time as the intended UTC time, we manually parse
 * the datetime-local components and construct the ISO string without relying on
 * the Date constructor's ambiguous parsing of bare datetime strings.
 *
 * - Date-only string (e.g. '2026-09-15') -> set to end of that day in local time (23:59:59)
 * - Datetime-local string (e.g. '2026-09-15T14:00') -> preserve local time as-is
 * - Full ISO or Date object -> fall through to standard parsing
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

    // Datetime-local string (e.g. '2026-09-15T14:00') — no timezone suffix.
    // new Date('2026-09-15T14:00') is ambiguous: some browsers parse as local,
    // others as UTC. We manually extract the components and construct the ISO
    // string so the user's LOCAL time is stored as the intended UTC time.
    const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    if (DATETIME_LOCAL_RE.test(trimmed)) {
      const [yearS, monthS, dayS, hourS, minS] = trimmed.split(/[-\sT:]/);
      const year = parseInt(yearS, 10);
      const month = parseInt(monthS, 10) - 1; // JS months are 0-indexed
      const day = parseInt(dayS, 10);
      const hour = parseInt(hourS, 10);
      const min = parseInt(minS, 10);
      // Construct a local-interpreted Date, then extract its UTC components to
      // build a Z-suffixed ISO string. This ensures the user's local clock time
      // is stored as the UTC time — no 7-hour shift for UTC+7 users.
      const localDate = new Date(year, month, day, hour, min, 0, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      return (
        `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())}T` +
        `${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}.000Z`
      );
    }
  }

  const d = parseApiDate(val);
  return d ? d.toISOString() : null;
}

/**
 * Formats a date for user-facing UI in local time (e.g. "Aug 18, 2026"
 * in English, "18 thg 8, 2026" in Vietnamese). The locale argument
 * accepts the short app codes (`en` / `vi`) and is translated to the
 * proper BCP-47 tag before reaching `Intl`. When omitted the helper
 * reads the active UI locale from storage so the output matches the
 * rest of the page even if the caller forgets to pass a locale.
 */
export function formatDisplayDate(
  val: string | number | Date | null | undefined,
  locale: 'vi' | 'en' = resolveActiveLocale(),
): string {
  const d = parseApiDate(val);
  if (!d) return '—';
  return d.toLocaleDateString(toIntlLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a date and time for user-facing UI in local time (e.g.
 * "Aug 18, 2026, 14:00"). Same locale-resolution contract as
 * `formatDisplayDate`.
 */
export function formatDisplayDateTime(
  val: string | number | Date | null | undefined,
  locale: 'vi' | 'en' = resolveActiveLocale(),
): string {
  const d = parseApiDate(val);
  if (!d) return '—';
  return d.toLocaleDateString(toIntlLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a time for user-facing UI in local time (e.g. "14:00").
 * Same locale-resolution contract as `formatDisplayDate`.
 */
export function formatDisplayTime(
  val: string | number | Date | null | undefined,
  locale: 'vi' | 'en' = resolveActiveLocale(),
): string {
  const d = parseApiDate(val);
  if (!d) return '—';
  return d.toLocaleTimeString(toIntlLocaleTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
